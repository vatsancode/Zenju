# Schema Conclusion
> Final agreed database structure decisions. Single source of truth for all database design decisions.

---

## Global Design Decisions
- All primary keys use **UUID v7** — time-ordered, fast for inserts, timestamp embedded in ID
- All tables keep `created_at` alongside UUID v7 — UUID v7 handles ordering, `created_at` handles human-readable querying and Supabase tooling
- All tenant-owned tables carry `business_id` for Row Level Security (multi-tenancy)
- `branch_id` is planted as nullable on relevant tables — NULL = all branches, set = branch-specific (future franchise support)
- `channel_id` is planted as nullable on offers — NULL = all catalogues, set = specific catalogue/channel (future wholesale/retail split)
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
| `subscription_plan` | TEXT | `'free'` / `'pro'` |
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

**v1 rule:** Most businesses use one default channel (retail). `channel_id` is NULL on most tables in v1 — means "applies to all channels."

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
| `taxes` | JSONB | `[{name, percentage, inclusive}]` |
| `image_url` | TEXT | Optional |
| `notes` | TEXT | Optional description |
| `created_at` | TIMESTAMP | Auto-set |

**Changed from original:**
- `category TEXT` + `subcategory TEXT` → removed, replaced with `category_id UUID FK → categories.id`
- `unit TEXT` → removed, replaced with `unit_id UUID FK → units.id`

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

### Table 5 — `variant_stock`
Stock quantity per variant. Branch-aware from day one — one row per variant now, one row per variant per branch later.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `variant_id` | UUID | FK → inventory_variants.id |
| `branch_id` | UUID | FK → branches.id — default branch in v1 |
| `current_stock` | DECIMAL | Live stock quantity |
| `selling_price_override` | DECIMAL | Overrides variant default if set |
| `par_stock_override` | DECIMAL | Overrides variant default if set |
| `availability_override` | TEXT | Overrides variant default if set |
| `updated_at` | TIMESTAMP | Auto-updated on every change |

**Unique constraint:** `(variant_id, branch_id)` — only one stock row per variant per branch. Prevents double-counting.

**Stock deduction rule (backend):** When processing a sale, always use `SELECT FOR UPDATE` on this row inside a transaction. This prevents two simultaneous sales from both passing the stock check and over-selling. This is a backend code rule — the schema is designed correctly for it because having one row per variant+branch makes row-level locking possible.

---

### Override Rule
For `selling_price`, `par_stock`, and `availability_status` — always check `variant_stock` first. If the override column is `null`, fall back to the value in `inventory_variants`.

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

**Stock sync rule:** `variant_stock.current_stock` must equal the SUM of `quantity_remaining` across all active batches for that variant + branch. Both must be updated inside the same database transaction — never separately.

**Sale deduction (future):** Batches are picked using FEFO (first-expiry, first-out) for perishables, FIFO (first-in, first-out) for non-perishables.

---

### Inventory Relationships
```
inventory_items (category_id → categories, unit_id → units)
  ├── attribute_definitions
  └── inventory_variants
        ├── variant_attribute_values → attribute_definitions
        ├── variant_stock (branch_id → branches)
        └── inventory_batches → suppliers
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
| `taxes` | JSONB | `[{name, percentage, inclusive}]` |
| `tax_inclusive` | BOOLEAN | Is tax already inside the selling price? |
| `inventory_tracking` | BOOLEAN | Should a sale deduct stock? |
| `availability_status` | TEXT | `'active'` / `'inactive'` / `'archived'` |
| `notes` | TEXT | Internal notes |
| `branch_id` | UUID | NULL = visible in all branches, set = this branch only |
| `created_at` | TIMESTAMP | Auto-set |

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

### Table 14 — `offers`
Deals and promotions with flexible JSONB config.

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
| `created_at` | TIMESTAMP | Auto-set |

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

catalogue_items (business_id, branch_id, category_id → categories)
  ├── catalogue_components (unit_id → units)
  │     └── catalogue_component_variants → inventory_variants
  └── offer_items ←── offers (business_id, channel_id → channels)

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

**Unique constraint:** `(business_id, phone)` — one customer record per phone number per business. Prevents duplicates on POS lookup.

---

### Table 19 — `sales`
One row per completed transaction.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `branch_id` | UUID | FK → branches.id |
| `customer_id` | UUID | NULL = walk-in, set = known customer |
| `subtotal` | DECIMAL | Total before bill-level discount |
| `bill_discount_amount` | DECIMAL | Discount applied to whole bill |
| `bill_discount_type` | TEXT | `'flat'` / `'percentage'` — CHECK constraint enforced |
| `tax_total` | DECIMAL | Total tax collected |
| `final_amount` | DECIMAL | What the customer actually paid |
| `payment_method` | TEXT | `'cash'` / `'upi'` / `'card'` — CHECK constraint enforced |
| `notes` | TEXT | Optional |
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
| `tax_amount` | DECIMAL | Tax on this line item |
| `line_total` | DECIMAL | Final amount after discount + tax |
| `applied_offer_id` | UUID | NULL = no offer applied |
| `stock_deducted` | BOOLEAN | False in v1 — activates in v2 |
| `created_at` | TIMESTAMP | Auto-set |

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

### POS Relationships
```
customers (business_id)
  └── entity_tags (entity_type = 'customer') ← tags

sales (business_id, branch_id → branches, customer_id → customers)
  └── sale_items
        ├── catalogue_item_id → catalogue_items
        ├── variant_id        → inventory_variants
        └── applied_offer_id  → offers

sale_items → stock_movements (v2)
```

---

## Required Unique Constraints

> These rules must exist in the database, not just in the app. The database will reject duplicates before they can be saved.

| Table | Unique Constraint | Why |
|---|---|---|
| `variant_stock` | `(variant_id, branch_id)` | One stock row per variant per branch — prevents double-counting |
| `customers` | `(business_id, phone)` | No duplicate customer per phone number |
| `unit_conversions` | `(business_id, from_unit_id, to_unit_id)` | Only one factor per unit pair — prevents conflicting conversions |
| `attribute_definitions` | `(inventory_item_id, name)` | No duplicate attribute names per product |

---

## Required Indexes

> An index is like the index at the back of a book — instead of reading every row, the database jumps straight to the matching ones. Every column you filter or sort by needs one.

### Required Extensions
```sql
-- Enable before creating any text search or partial indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Inventory
```sql
CREATE INDEX ON inventory_items(business_id);
CREATE INDEX ON inventory_items(category_id);
CREATE INDEX ON inventory_variants(inventory_item_id);
CREATE UNIQUE INDEX ON variant_stock(variant_id, branch_id);
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
```

### POS
```sql
CREATE UNIQUE INDEX ON customers(business_id, phone);
CREATE INDEX ON customers(business_id, name);
CREATE INDEX ON sales(business_id, created_at);
CREATE INDEX ON sales(branch_id);                              -- branch-level revenue reports
CREATE INDEX ON sales(customer_id);
CREATE INDEX ON sale_items(sale_id);
CREATE INDEX ON sale_items(catalogue_item_id);
CREATE INDEX ON sale_items(variant_id);                        -- variant-level sales analytics
CREATE INDEX ON stock_movements(variant_id, created_at);
CREATE INDEX ON stock_movements(movement_type);                -- filter by waste / purchase / manual
CREATE INDEX ON stock_movements(reference_id, reference_type);
```

### Text Search (GIN + pg_trgm)
> Enables partial word matching at the POS — typing "Rah" finds "Rahul", typing "Cash" finds "Cashew 100g". Without these, every keystroke is a full table scan.

```sql
CREATE INDEX ON customers       USING gin(name gin_trgm_ops);
CREATE INDEX ON inventory_items USING gin(name gin_trgm_ops);
CREATE INDEX ON catalogue_items USING gin(name gin_trgm_ops);
```

### Partial Indexes (Active Rows Only)
> Only indexes rows that are actually in use — ignores deleted/archived rows entirely. Smaller index, faster query. Must be added alongside any `deleted_at` soft-delete column.

```sql
-- Active inventory and catalogue (once deleted_at column is added)
CREATE INDEX ON inventory_items(business_id) WHERE deleted_at IS NULL;
CREATE INDEX ON catalogue_items(business_id) WHERE deleted_at IS NULL;
CREATE INDEX ON customers(business_id)       WHERE deleted_at IS NULL;

-- Active offers — checked on every sale at POS
CREATE INDEX ON offers(business_id, active)  WHERE active = true;
```

**Note:** `deleted_at` columns are a P0 improvement from the expert panel review. These partial indexes must be created at the same migration as those columns.

---

## Full Table Index

| # | Table | Module | One-line description |
|---|---|---|---|
| 0a | `businesses` | Foundation | Top-level tenant — every table links back here |
| 0b | `branches` | Foundation | Physical locations of a business |
| 0c | `channels` | Foundation | Sales channels (retail, wholesale, online) |
| 1 | `inventory_items` | Inventory | Raw stock identity — category_id + unit_id linked properly |
| 2 | `attribute_definitions` | Inventory | Attribute type names per item (Size, Color, etc.) |
| 3 | `inventory_variants` | Inventory | Each unique version of a product |
| 4 | `variant_attribute_values` | Inventory | Attribute values per variant |
| 5 | `variant_stock` | Inventory | Live stock per variant+branch — unique constraint enforced |
| 6 | `suppliers` | Inventory | Vendor/supplier profiles |
| 7 | `inventory_batches` | Inventory | Per-purchase batch — vendor, cost, qty, expiry |
| 8 | `categories` | Global | Categories + subcategories — shared by inventory and catalogue |
| 9 | `tags` | Global | Business-wide master tag list |
| 10 | `entity_tags` | Global | Bridge — tags to any entity type |
| 11 | `catalogue_items` | Catalogue | The menu — what you sell |
| 12 | `catalogue_components` | Catalogue | Recipe — unit_id linked to units table |
| 13 | `catalogue_component_variants` | Catalogue | Which variants are selectable per component |
| 14 | `offers` | Catalogue | Deals with flexible JSONB benefit_config |
| 15 | `offer_items` | Catalogue | Which catalogue items each offer covers |
| 16 | `units` | Units | Measurement units per business |
| 17 | `unit_conversions` | Units | Conversion rates — unique constraint enforced |
| 18 | `customers` | POS | Customer profiles — unique phone per business |
| 19 | `sales` | POS | Bill header — partition by created_at at scale |
| 20 | `sale_items` | POS | Line items with snapshots and offer tracking |
| 21 | `stock_movements` | POS | Audit log — partition by created_at at scale |
