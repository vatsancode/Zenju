# Database Schema — ZenJu
> Final agreed database structure decisions. Single source of truth for all database design decisions.
> See [architecture.md](./architecture.md) for how these tables map to folders, and [css-styleguide.md](./css-styleguide.md) for the UI conventions.

---

## Global Design Decisions
- All primary keys use **UUID v7** — time-ordered, fast for inserts, timestamp embedded in ID
- All tables keep `created_at` alongside UUID v7 — UUID v7 handles ordering, `created_at` handles human-readable querying and Supabase tooling
- All mutable tables carry `updated_at TIMESTAMP` — auto-updated on every change. Enables change detection, caching, sync, and CDC.
- All tenant-owned tables carry `business_id` for Row Level Security (multi-tenancy)
- `branch_id` is planted as nullable on relevant tables — NULL = all branches, set = branch-specific (future franchise support)
- `channel_id` is planted as nullable on offers — NULL = all catalogues, set = specific catalogue/channel (future wholesale/retail split)
- **Soft delete rule:** `deleted_at TIMESTAMP` on inventory_items, catalogue_items, offers, and customers. NULL = active, set = soft-deleted. Queries must filter `WHERE deleted_at IS NULL` for active records.
- **Authorship rule:** Tables where it matters carry `created_by UUID FK → business_users.id` to track who performed the action.
- **Unit rule:** All `unit` references use `unit_id UUID FK → units.id` — never plain text. This ensures unit conversions are always resolvable.
- **Category rule:** All `category` references use `category_id UUID FK → categories.id` — never plain text.

---

## Foundation Tables (Multi-Tenancy Core)

### Table 0a — `businesses`
The top-level tenant. Every other table traces back to this. One row per registered business.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `name` | TEXT | Business trading name |
| `owner_user_id` | UUID | FK → auth.users.id — the account owner |
| `business_type_id` | UUID | FK → business_types.id — nullable |
| `subscription_plan` | TEXT | `'free'` / `'pro'` |
| `currency` | TEXT | DEFAULT `'INR'` — business-level currency |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

---

### Table — `business_types`
Lookup list of business categories (e.g. "Grocery", "Cafe") shown in the super-admin "Add Business" form. Super-admin-only — no RLS policies, only the service-role client can read/write it. Names are unique case-insensitively so quick-add can't create near-duplicate entries.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | e.g. "Grocery" — unique (case-insensitive) |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

---

### Table — `admin_users`
Allowlist of platform super-admins — separate from regular business staff. Not multi-tenant (no `business_id`) since admins operate across all businesses. RLS allows a user to check "am I admin" (self-lookup only); adding a new admin requires the service-role client — always a manual, deliberate action, not something the app does on its own.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `auth_user_id` | UUID | FK → auth.users.id — unique, one admin row per auth account |
| `created_at` | TIMESTAMP | Auto-set |

---

### Table 0b — `branches`
Physical locations of a business. v1 starts with one default branch per business. v2 enables multi-branch.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Main Store", "Warehouse" |
| `address` | TEXT | Optional |
| `is_default` | BOOLEAN | True for the first/only branch |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

**Rule:** Every business gets exactly one default branch on signup. `branch_id` on other tables defaults to this branch's ID.

---

### Table 0c — `channels`
Sales channels — e.g. retail counter, wholesale, online. Used to separate pricing and offers per channel.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Retail", "Wholesale", "Online" |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

**v1 rule:** Most businesses use one default channel (retail). `channel_id` is NULL on most tables in v1 — means "applies to all channels."

---

### Table 0d — `business_users`
The bridge between Supabase Auth and business operations. One row per user per business. Tracks role, branch access, and identity for audit trails.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key — referenced by `sales.created_by` and `event_log.performed_by` |
| `business_id` | UUID | FK → businesses.id |
| `auth_user_id` | UUID | FK → auth.users.id (Supabase Auth) |
| `role` | TEXT | `'owner'` / `'manager'` / `'cashier'` / `'viewer'` |
| `branch_id` | UUID | NULL = all branches, set = this branch only |
| `display_name` | TEXT | Name shown in POS and reports |
| `phone` | TEXT | Nullable — contact number for this person at this business (e.g. WhatsApp) |
| `is_active` | BOOLEAN | Disable without deleting |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

**Unique constraint:** `(business_id, auth_user_id)` — one role per user per business.

**Check constraint:** `role != 'owner' OR phone IS NOT NULL` — owners must have a phone on file; other roles may leave it blank.

**Why this design:**
- One Supabase auth account can work at multiple businesses (e.g. freelance cashier)
- Role is per-business, not global
- `branch_id` scoping enables "this cashier only works at Branch A"
- `businesses.owner_user_id` identifies who owns the billing/subscription; `business_users` handles operational access

**RLS note:** every tenant-owned table's policy answers "which businesses does this user belong to?" by looking into `business_users`. That lookup goes through the `get_my_business_ids()` SQL function (a `SECURITY DEFINER` function that bypasses RLS) rather than a raw subquery — a raw subquery against `business_users` re-triggers `business_users`' own policy, causing infinite recursion (Postgres error 42P17). See `005_fix_business_users_rls_recursion.sql`.

---

## Inventory

### Table 1 — `inventory_items`
The product identity. Shared information that never changes per variant or branch.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id (multi-tenancy) |
| `item_code` | TEXT | User-defined code |
| `name` | TEXT | Product name |
| `category_id` | UUID | FK → categories.id — replaces free-text category + subcategory |
| `unit_id` | UUID | FK → units.id — base unit of this item (KG, Pieces, etc.) |
| `has_expiry` | BOOLEAN | Is this perishable? |
| `expires_within_days` | INTEGER | Alert window before expiry |
| `image_url` | TEXT | Optional |
| `notes` | TEXT | Optional description |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |
| `deleted_at` | TIMESTAMP | NULL = active, set = soft-deleted |

**Changed from original:**
- `category TEXT` + `subcategory TEXT` → removed, replaced with `category_id UUID FK → categories.id`
- `unit TEXT` → removed, replaced with `unit_id UUID FK → units.id`
- `taxes JSONB` → removed. Tax is defined at the catalogue level via `catalogue_item_taxes` junction table, not on inventory.

---

### Table 2 — `attribute_definitions`
The attribute type names for an item (e.g. Size, Color). One row per attribute type per item.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `name` | TEXT | e.g. Size, Color, Weight |
| `display_order` | INTEGER | Controls column order in UI |

**Unique constraint:** `(inventory_item_id, name)` — a product cannot have two "Size" attributes.

---

### Table 3 — `inventory_variants`
Each unique version of a product. Holds default pricing and thresholds.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `variant_code` | TEXT | e.g. VAR-001 |
| `purchase_price` | DECIMAL | Latest or weighted-average cost price — convenience field, not source of truth once batches exist |
| `selling_price` | DECIMAL | Default selling price / MRP |
| `par_stock` | DECIMAL | Default minimum stock threshold |
| `availability_status` | TEXT | `'active'` / `'inactive'` |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

---

### Table 4 — `variant_attribute_values`
The actual attribute values per variant. Links each variant to its attribute definitions.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `variant_id` | UUID | FK → inventory_variants.id |
| `attribute_definition_id` | UUID | FK → attribute_definitions.id |
| `value` | TEXT | e.g. Large, Red, 500g |

---

### View — `variant_stock_current`
Replaces the old `variant_stock` table. Current stock is **derived**, not stored — one source of truth, nothing to sync, nothing to mismatch.

```sql
CREATE VIEW variant_stock_current AS
SELECT variant_id, branch_id, COALESCE(SUM(quantity_remaining), 0) AS current_stock
FROM inventory_batches
GROUP BY variant_id, branch_id;
```

**Why a view instead of a table:** The old `variant_stock.current_stock` had to stay in sync with `SUM(inventory_batches.quantity_remaining)` — any bug in the sync logic created phantom stock. The view eliminates this risk entirely.

**Stock deduction rule (backend):** When processing a sale, lock the batch rows directly: `SELECT ... FROM inventory_batches WHERE variant_id = X AND branch_id = Y FOR UPDATE`. Check SUM >= quantity needed, then deduct from specific batches via FEFO/FIFO. This is better than locking a separate table — you're locking the exact rows you're modifying.

**Pricing rule:** POS reads prices from `catalogue_items.selling_price`, not from inventory. `par_stock` and `availability_status` stay on `inventory_variants` as defaults — no branch-level overrides in v1.

---

### Table 6 — `suppliers`
One row per vendor/supplier a business purchases from.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | Vendor/supplier name |
| `phone` | TEXT | Optional |
| `email` | TEXT | Optional |
| `address` | TEXT | Optional |
| `notes` | TEXT | Optional — e.g. "Reliable for nuts, slow on spices" |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

---

### Table 7 — `inventory_batches`
One row per purchase batch of a variant. Tracks vendor, cost, quantity, and expiry at the batch level.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `variant_id` | UUID | FK → inventory_variants.id |
| `branch_id` | UUID | FK → branches.id — which branch received this batch |
| `supplier_id` | UUID | FK → suppliers.id |
| `purchase_price` | DECIMAL | Cost per unit in this batch |
| `quantity_received` | DECIMAL | How much came in |
| `quantity_remaining` | DECIMAL | How much is still unsold/unused |
| `expiry_date` | DATE | NULL if non-perishable |
| `batch_number` | TEXT | Optional — vendor's own batch/lot label |
| `received_at` | TIMESTAMP | When this batch was received |
| `created_at` | TIMESTAMP | Auto-set |

**Source of truth:** `quantity_remaining` on each batch IS the stock. The `variant_stock_current` view SUMs these per variant+branch to give live stock levels. No separate table to keep in sync.

**Sale deduction:** Batches are picked using FEFO (first-expiry, first-out) for perishables, FIFO (first-in, first-out) for non-perishables.

---

### Inventory Relationships
```
inventory_items (category_id → categories, unit_id → units)
  ├── attribute_definitions
  └── inventory_variants
        ├── variant_attribute_values → attribute_definitions
        └── inventory_batches → suppliers
              └── variant_stock_current (VIEW: SUM of quantity_remaining per variant+branch)
```

---

## Catalogue

### Table 8 — `categories`
Handles both categories and subcategories in one table using a self-referencing `parent_id`. Shared between inventory and catalogue.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Nuts", "Cashews" |
| `parent_id` | UUID | NULL = top-level category, set = subcategory of that parent |
| `display_order` | INTEGER | Controls sort order in UI |
| `is_archived` | BOOLEAN | Soft delete — keeps data, hides from UI |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

**Rule:** Only one level of nesting — a subcategory cannot itself have children. Enforced in application layer.

---

### Table 9 — `tags`
Business-wide master list of tags. Tags are shared across the whole business.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "seasonal", "bestseller", "gift" |
| `color` | TEXT | Optional hex color for UI display |
| `description` | TEXT | Optional |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

---

### Table 10 — `entity_tags`
Bridge table connecting tags to any entity in the system.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `tag_id` | UUID | FK → tags.id |
| `entity_type` | TEXT | `'catalogue_item'` / `'inventory_item'` / `'customer'` / extensible |
| `entity_id` | UUID | The ID of whatever is being tagged |
| `created_at` | TIMESTAMP | Auto-set |

**Index:** `(entity_type, entity_id)` composite — how you find all tags for a given item.

**Cleanup rule (backend trigger):** When any tagged entity is deleted, a database trigger deletes its `entity_tags` rows. The database cannot enforce this as a FK because the target table varies per row — a trigger is the correct fix.

---

### Table 11 — `catalogue_items`
The menu — one row per thing a business sells.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Cashew 100g" |
| `category_id` | UUID | FK → categories.id |
| `type` | TEXT | `'linked'` / `'bundle'` / `'independent'` |
| `selling_price` | DECIMAL | Default price |
| `tax_inclusive` | BOOLEAN | Is tax already inside the selling price? Per-item control. |
| `inventory_tracking` | BOOLEAN | Should a sale deduct stock? |
| `availability_status` | TEXT | `'active'` / `'inactive'` / `'archived'` |
| `notes` | TEXT | Internal notes |
| `branch_id` | UUID | NULL = visible in all branches, set = this branch only |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |
| `deleted_at` | TIMESTAMP | NULL = active, set = soft-deleted |

**Tax handling:** Taxes are linked via the `catalogue_item_taxes` junction table → `tax_rates`. The old `taxes JSONB` column has been removed. `tax_inclusive` stays on this table because inclusive/exclusive is a per-item decision.

---

### Table 12 — `catalogue_components`
The recipe. Links each catalogue item to the inventory items it uses.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `catalogue_item_id` | UUID | FK → catalogue_items.id |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `quantity_used` | DECIMAL | How much to deduct per unit sold |
| `unit_id` | UUID | FK → units.id — the unit `quantity_used` is measured in. NULL = use inventory item's native unit |
| `display_order` | INTEGER | Order shown in UI for bundles |
| `created_at` | TIMESTAMP | Auto-set |

**Changed from original:** `unit TEXT` → `unit_id UUID FK → units.id`

**Unit conversion rule:** If `unit_id` differs from the inventory item's `unit_id`, use `unit_conversions` to convert before deducting stock. If `unit_id` is NULL, deduct directly in the inventory item's native unit.

---

### Table 13 — `catalogue_component_variants`
Controls which specific variants are selectable at POS for a given component.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `catalogue_component_id` | UUID | FK → catalogue_components.id |
| `variant_id` | UUID | FK → inventory_variants.id |

---

### Table — `tax_rates`
Master list of taxes per business. Replaces the old `taxes JSONB` column — normalized for clean reporting and filtering.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "GST 18%", "CGST 9%", "Cess 1%" |
| `percentage` | NUMERIC | The tax rate |
| `active` | BOOLEAN | DEFAULT true — inactive rates are hidden from UI but preserved for history |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

**Unique constraint:** `(business_id, name, percentage)` — prevents duplicate tax definitions.

---

### Table — `catalogue_item_taxes`
Junction table linking catalogue items to their applicable taxes.

| Column | Type | Notes |
|---|---|---|
| `catalogue_item_id` | UUID | FK → catalogue_items.id |
| `tax_rate_id` | UUID | FK → tax_rates.id |

**Composite primary key:** `(catalogue_item_id, tax_rate_id)`

**At sale time:** Snapshot the computed tax into `sale_items` as `tax_amount` (total) and `tax_breakdown` JSONB (`[{name, percentage, amount}]`). The snapshot is a frozen historical record — `tax_rates` is the source of truth for current rates.

---

### Table 14 — `offers`
Deals and promotions with flexible JSONB config. Supports scheduled offers with optional date ranges.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `channel_id` | UUID | NULL = all channels, set = specific channel |
| `name` | TEXT | e.g. "Buy 3 Get 1 Free" |
| `min_quantity` | INTEGER | Minimum cart quantity to trigger |
| `benefit_type` | TEXT | Label — see benefit types below |
| `benefit_config` | JSONB | Rules for that type |
| `active` | BOOLEAN | Is this offer currently running? |
| `start_date` | DATE | Optional — NULL = active immediately when `active` is true |
| `end_date` | DATE | Optional — NULL = no expiry |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |
| `deleted_at` | TIMESTAMP | NULL = active, set = soft-deleted |

**Active offer query:** `WHERE active = true AND deleted_at IS NULL AND (start_date IS NULL OR start_date <= CURRENT_DATE) AND (end_date IS NULL OR end_date >= CURRENT_DATE)`

**Benefit types:**

| benefit_type | benefit_config example | Meaning |
|---|---|---|
| `percentage_discount` | `{"value": 10}` | 10% off total |
| `flat_discount` | `{"value": 500}` | ₹500 off total |
| `fixed_price` | `{"value": 230}` | Whole combo for ₹230 |
| `free_item` | `{"select": "cheapest"}` | Cheapest item is free |
| `buy_x_get_y` | `{"buy_item_id": "x", "buy_qty": 3, "get_item_id": "y", "get_qty": 1}` | Buy 3 get 1 free |
| `tiered_pricing` | `{"tiers": [{"min": 1, "max": 5, "price": 90}, {"min": 6, "price": 80}]}` | Price drops as quantity rises |

---

### Table 15 — `offer_items`
Bridge between offers and catalogue items.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `offer_id` | UUID | FK → offers.id |
| `catalogue_item_id` | UUID | FK → catalogue_items.id |

---

## Units

### Table 16 — `units`
Master list of measurement units per business.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Kilogram" |
| `abbreviation` | TEXT | e.g. "KG" |
| `allows_decimal` | BOOLEAN | Can you sell 1.5 of this? |
| `is_locked` | BOOLEAN | True once used in inventory — cannot be deleted |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

---

### Table 17 — `unit_conversions`
Conversion factors between units.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `from_unit_id` | UUID | FK → units.id |
| `to_unit_id` | UUID | FK → units.id |
| `factor` | DECIMAL | Multiply from_unit by this to get to_unit |
| `created_at` | TIMESTAMP | Auto-set |

**Example:** from=KG, to=Grams, factor=1000. System automatically derives the reverse: 1 Gram = 0.001 KG.

**Unique constraint:** `(business_id, from_unit_id, to_unit_id)` — only one conversion per pair per business. Prevents two entries with conflicting factors for the same unit pair.

---

### Catalogue Relationships
```
categories (parent_id → self)
tags → entity_tags (entity_type + entity_id → anything)

tax_rates (business_id)
  └── catalogue_item_taxes → catalogue_items

catalogue_items (business_id, branch_id, category_id → categories)
  ├── catalogue_item_taxes → tax_rates
  ├── catalogue_components (unit_id → units)
  │     └── catalogue_component_variants → inventory_variants
  └── offer_items ←── offers (business_id, channel_id → channels, start_date, end_date)

units → unit_conversions
      UNIQUE (business_id, from_unit_id, to_unit_id)
```

---

## POS

### Table 18 — `customers`
One row per customer per business.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | Full name — searchable at POS |
| `phone` | TEXT | Primary lookup identifier |
| `email` | TEXT | Optional |
| `birthday` | DATE | Optional |
| `address` | TEXT | Optional |
| `notes` | TEXT | Optional |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |
| `deleted_at` | TIMESTAMP | NULL = active, set = soft-deleted |

**Unique constraint:** `(business_id, phone)` — one customer record per phone number per business. Prevents duplicates on POS lookup.

---

### Table 19 — `sales`
One row per transaction. The bill header.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `branch_id` | UUID | FK → branches.id |
| `customer_id` | UUID | NULL = walk-in, set = known customer |
| `status` | TEXT | `NOT NULL DEFAULT 'completed'` — CHECK: `('draft', 'completed', 'voided', 'refunded')` |
| `subtotal` | DECIMAL | Total before bill-level discount |
| `bill_discount_amount` | DECIMAL | Discount applied to whole bill |
| `bill_discount_type` | TEXT | `'flat'` / `'percentage'` — CHECK constraint enforced |
| `tax_total` | DECIMAL | Total tax collected |
| `final_amount` | DECIMAL | What the customer actually paid |
| `payment_method` | TEXT | `'cash'` / `'upi'` / `'card'` — CHECK constraint enforced |
| `notes` | TEXT | Optional |
| `created_by` | UUID | FK → business_users.id — who processed this sale |
| `created_at` | TIMESTAMP | Auto-set — this is the sale timestamp |

**Scaling note:** This table grows forever. Plan for monthly partitioning by `created_at` before it exceeds 500k rows. Always filter queries with a date range — this keeps queries fast by only scanning one month's data at a time.

---

### Table 20 — `sale_items`
One row per line item. Prices and names are snapshotted at time of sale — never updated.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `sale_id` | UUID | FK → sales.id |
| `catalogue_item_id` | UUID | FK → catalogue_items.id |
| `variant_id` | UUID | FK → inventory_variants.id — NULL if no variant |
| `catalogue_item_name` | TEXT | Snapshot — name at time of sale |
| `quantity` | DECIMAL | How many units sold |
| `unit_price` | DECIMAL | Snapshot — price at time of sale |
| `cost_price_at_sale` | DECIMAL | Snapshot — cost price for profit calculation |
| `item_discount_amount` | DECIMAL | Discount applied to this line item |
| `tax_amount` | DECIMAL | Total tax on this line item |
| `tax_breakdown` | JSONB | Snapshot: `[{name, percentage, amount}]` — itemized tax detail for receipts |
| `line_total` | DECIMAL | Final amount after discount + tax |
| `applied_offer_id` | UUID | NULL = no offer applied |
| `stock_deducted` | BOOLEAN | False in v1 — activates in v2 |
| `created_at` | TIMESTAMP | Auto-set |

**Tax snapshot rule:** At sale time, compute taxes from `catalogue_item_taxes` → `tax_rates`, then freeze the result into `tax_amount` (total) and `tax_breakdown` (itemized). The snapshot is a frozen historical record — `tax_rates` is the live source of truth.

---

### Table 21 — `stock_movements`
Audit log of every stock change. Append-only — never update or delete rows here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `variant_id` | UUID | FK → inventory_variants.id |
| `branch_id` | UUID | FK → branches.id |
| `movement_type` | TEXT | `'sale'` / `'purchase'` / `'manual_adjustment'` / `'waste'` |
| `quantity_change` | DECIMAL | Negative = stock out, Positive = stock in |
| `reference_id` | UUID | The sale ID or purchase ID that caused this movement |
| `reference_type` | TEXT | `'sale'` / `'purchase'` / `'manual'` |
| `notes` | TEXT | Optional reason |
| `created_at` | TIMESTAMP | Auto-set |

**Scaling note:** This table grows faster than `sales` — every sale creates multiple movement rows. Plan for monthly partitioning by `created_at` before it exceeds 1M rows.

---

### Table — `refunds`
Track refunds against completed sales. Supports partial refunds — a customer can return 2 of 5 items.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `sale_id` | UUID | FK → sales.id |
| `business_id` | UUID | FK → businesses.id |
| `refund_amount` | DECIMAL | Total refund amount |
| `reason` | TEXT | Optional — why the refund |
| `created_by` | UUID | FK → business_users.id — who processed the refund |
| `created_at` | TIMESTAMP | Auto-set |

**Rule:** When a refund is created, set `sales.status = 'refunded'`.

---

### Table — `refund_items`
Which specific line items were refunded and how many. Enables partial refunds.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `refund_id` | UUID | FK → refunds.id |
| `sale_item_id` | UUID | FK → sale_items.id |
| `quantity` | DECIMAL | How many units refunded (can be less than original) |
| `refund_amount` | DECIMAL | Amount refunded for this line |

**Example:** Customer bought 5 cashew packs at ₹100 each, returns 2 → `refund_items` row with `quantity = 2`, `refund_amount = 200`.

---

## Audit

### Table — `event_log`
General-purpose audit trail for all entity changes. Append-only — never update or delete rows here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `entity_type` | TEXT | `'inventory_item'` / `'catalogue_item'` / `'customer'` / `'offer'` / etc. |
| `entity_id` | UUID | The ID of the changed entity |
| `action` | TEXT | `'created'` / `'updated'` / `'deleted'` / `'restored'` |
| `changes` | JSONB | `{"field": {"old": X, "new": Y}}` — what changed |
| `performed_by` | UUID | FK → business_users.id — who made the change |
| `created_at` | TIMESTAMP | When the event happened |

**Scaling note:** This table grows with every edit across the system. Plan for monthly partitioning by `created_at` when it grows large.

**Write rule:** Backend writes to this table on every create/update/delete of tracked entities. The `changes` JSONB only includes fields that actually changed — not the full row.

---

### POS Relationships
```
customers (business_id)
  └── entity_tags (entity_type = 'customer') ← tags

sales (business_id, branch_id → branches, customer_id → customers, created_by → business_users)
  ├── sale_items
  │     ├── catalogue_item_id → catalogue_items
  │     ├── variant_id        → inventory_variants
  │     ├── applied_offer_id  → offers
  │     └── tax_breakdown     JSONB snapshot from tax_rates
  └── refunds (created_by → business_users)
        └── refund_items → sale_items

sale_items → stock_movements (v2)

event_log (entity_type + entity_id → anything, performed_by → business_users)
```

---

## Required Unique Constraints

> These rules must exist in the database, not just in the app. The database will reject duplicates before they can be saved.

| Table | Unique Constraint | Why |
|---|---|---|
| `business_users` | `(business_id, auth_user_id)` | One role per user per business |
| `customers` | `(business_id, phone)` | No duplicate customer per phone number |
| `unit_conversions` | `(business_id, from_unit_id, to_unit_id)` | Only one factor per unit pair — prevents conflicting conversions |
| `attribute_definitions` | `(inventory_item_id, name)` | No duplicate attribute names per product |
| `tax_rates` | `(business_id, name, percentage)` | No duplicate tax definitions per business |
| `catalogue_item_taxes` | `(catalogue_item_id, tax_rate_id)` | Composite PK — one link per item-tax pair |

---

## Required Indexes

> An index is like the index at the back of a book — instead of reading every row, the database jumps straight to the matching ones. Every column you filter or sort by needs one.

### Required Extensions
```sql
-- Enable before creating any text search or partial indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Foundation
```sql
CREATE UNIQUE INDEX ON business_users(business_id, auth_user_id);
CREATE INDEX ON business_users(auth_user_id);      -- "which businesses does this user belong to?"
```

### Inventory
```sql
CREATE INDEX ON inventory_items(business_id);
CREATE INDEX ON inventory_items(category_id);
CREATE INDEX ON inventory_variants(inventory_item_id);
CREATE INDEX ON inventory_batches(variant_id, branch_id);
CREATE INDEX ON inventory_batches(expiry_date);
CREATE INDEX ON inventory_batches(supplier_id);    -- "what did I buy from this supplier?"
CREATE INDEX ON suppliers(business_id);             -- supplier list lookup
```

### Catalogue
```sql
CREATE INDEX ON catalogue_items(business_id, availability_status);
CREATE INDEX ON catalogue_items(business_id, branch_id);   -- POS: load items for current branch
CREATE INDEX ON catalogue_items(category_id);
CREATE INDEX ON catalogue_components(catalogue_item_id);
CREATE INDEX ON categories(business_id, parent_id);
CREATE INDEX ON entity_tags(entity_type, entity_id);
CREATE INDEX ON entity_tags(tag_id);
CREATE UNIQUE INDEX ON unit_conversions(business_id, from_unit_id, to_unit_id);
CREATE INDEX ON tax_rates(business_id);
CREATE INDEX ON tax_rates(business_id, active) WHERE active = true;
CREATE INDEX ON catalogue_item_taxes(catalogue_item_id);
CREATE INDEX ON catalogue_item_taxes(tax_rate_id);
```

### POS
```sql
CREATE UNIQUE INDEX ON customers(business_id, phone);
CREATE INDEX ON customers(business_id, name);
CREATE INDEX ON sales(business_id, created_at);
CREATE INDEX ON sales(branch_id);                              -- branch-level revenue reports
CREATE INDEX ON sales(customer_id);
CREATE INDEX ON sales(payment_method);                         -- payment method reports
CREATE INDEX ON sales(status) WHERE status != 'completed';     -- find drafts/refunded/voided quickly
CREATE INDEX ON sales(created_by);                             -- "sales by this cashier"
CREATE INDEX ON sale_items(sale_id);
CREATE INDEX ON sale_items(catalogue_item_id);
CREATE INDEX ON sale_items(variant_id);                        -- variant-level sales analytics
CREATE INDEX ON stock_movements(variant_id, created_at);
CREATE INDEX ON stock_movements(movement_type);                -- filter by waste / purchase / manual
CREATE INDEX ON stock_movements(reference_id, reference_type);
CREATE INDEX ON refunds(sale_id);
CREATE INDEX ON refunds(business_id, created_at);
CREATE INDEX ON refund_items(refund_id);
CREATE INDEX ON refund_items(sale_item_id);
```

### Audit
```sql
CREATE INDEX ON event_log(business_id, created_at);
CREATE INDEX ON event_log(entity_type, entity_id);
CREATE INDEX ON event_log(performed_by);
```

### Text Search (GIN + pg_trgm)
> Enables partial word matching at the POS — typing "Rah" finds "Rahul", typing "Cash" finds "Cashew 100g". Without these, every keystroke is a full table scan.

```sql
CREATE INDEX ON customers       USING gin(name gin_trgm_ops);
CREATE INDEX ON inventory_items USING gin(name gin_trgm_ops);
CREATE INDEX ON catalogue_items USING gin(name gin_trgm_ops);
```

### Partial Indexes (Active Rows Only)
> Only indexes rows that are actually in use — ignores deleted/archived rows entirely. Smaller index, faster query. Created alongside the `deleted_at` soft-delete columns.

```sql
CREATE INDEX ON inventory_items(business_id) WHERE deleted_at IS NULL;
CREATE INDEX ON catalogue_items(business_id) WHERE deleted_at IS NULL;
CREATE INDEX ON customers(business_id)       WHERE deleted_at IS NULL;
CREATE INDEX ON offers(business_id, active)  WHERE active = true AND deleted_at IS NULL;
```

---

## Full Table Index

| # | Table | Module | One-line description |
|---|---|---|---|
| 0a | `businesses` | Foundation | Top-level tenant — every table links back here |
| 0b | `branches` | Foundation | Physical locations of a business |
| 0c | `channels` | Foundation | Sales channels (retail, wholesale, online) |
| 0d | `business_users` | Foundation | Staff/users per business — roles, branch access, audit identity |
| — | `business_types` | Foundation | Lookup list of business categories — super-admin-only, no RLS write policy |
| — | `admin_users` | Foundation | Platform super-admin allowlist — self-lookup RLS only |
| 1 | `inventory_items` | Inventory | Raw stock identity — category_id + unit_id linked properly |
| 2 | `attribute_definitions` | Inventory | Attribute type names per item (Size, Color, etc.) |
| 3 | `inventory_variants` | Inventory | Each unique version of a product |
| 4 | `variant_attribute_values` | Inventory | Attribute values per variant |
| — | `variant_stock_current` | Inventory | **VIEW** — live stock per variant+branch, derived from batch quantities |
| 5 | `suppliers` | Inventory | Vendor/supplier profiles |
| 6 | `inventory_batches` | Inventory | Per-purchase batch — vendor, cost, qty, expiry |
| 7 | `categories` | Global | Categories + subcategories — shared by inventory and catalogue |
| 8 | `tags` | Global | Business-wide master tag list |
| 9 | `entity_tags` | Global | Bridge — tags to any entity type |
| 10 | `tax_rates` | Global | Master tax list per business — normalized from old JSONB |
| 11 | `catalogue_items` | Catalogue | The menu — what you sell |
| — | `catalogue_item_taxes` | Catalogue | Junction — which taxes apply to which catalogue item |
| 12 | `catalogue_components` | Catalogue | Recipe — unit_id linked to units table |
| 13 | `catalogue_component_variants` | Catalogue | Which variants are selectable per component |
| 14 | `offers` | Catalogue | Deals with JSONB config + scheduled date range |
| 15 | `offer_items` | Catalogue | Which catalogue items each offer covers |
| 16 | `units` | Units | Measurement units per business |
| 17 | `unit_conversions` | Units | Conversion rates — unique constraint enforced |
| 18 | `customers` | POS | Customer profiles — unique phone per business |
| 19 | `sales` | POS | Bill header with status + created_by — partition at scale |
| 20 | `sale_items` | POS | Line items with snapshots, tax breakdown, and offer tracking |
| 21 | `stock_movements` | POS | Audit log — partition by created_at at scale |
| 22 | `refunds` | POS | Refund header — linked to sales |
| 23 | `refund_items` | POS | Refund line items — partial refund support |
| 24 | `event_log` | Audit | General audit trail — append-only, partition at scale |
