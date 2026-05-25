# SCHEMA.md — SmartInventory AI (v1)
> This document is the single source of truth for the database structure.
> Paste this into every Claude session **alongside PRD.md** before building any feature.
> Last synced with: PRD.md v1 Final

---

## Tech Stack
- **Frontend**: Next.js (React) + Tailwind CSS
- **Backend + Database + Auth**: Supabase
- **Payments**: Stripe
- **Deployment**: Vercel

---

## Database: 7 Core Tables

---

### 1. `users`
Stores business owner accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `name` | TEXT | Owner's full name |
| `email` | TEXT | Unique, used for login |
| `business_name` | TEXT | Displayed on dashboard |
| `subscription_plan` | TEXT | Values: `free` or `pro` |
| `preferred_language` | TEXT | Default: `en` — supports i18n (e.g. `ta`, `hi`) |
| `created_at` | TIMESTAMP | Auto-set on creation |
| `role` | TEXT | 🔒 RESERVED for v2 (RBAC — Owner/Manager/Staff) |
| `branch_id` | UUID | 🔒 RESERVED for v2 (Multi-branch — default branch assigned on signup) |

---

### 2. `inventory_items`
Stores raw ingredients or bulk stock items.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id (owner of this item) |
| `name` | TEXT | e.g. "Cashews" |
| `category` | TEXT | e.g. "Nuts", "Spices", "Dairy" |
| `unit` | TEXT | Values: `KG`, `Grams`, `Litres`, `Pieces`, `ML` |
| `current_stock` | DECIMAL | Auto-updated on every stock movement |
| `par_stock` | DECIMAL | Minimum threshold — triggers low stock alert |
| `cost_price` | DECIMAL | Cost per unit (used for valuation) |
| `mrp` | DECIMAL | Maximum retail price per unit |
| `availability_status` | TEXT | Values: `active`, `out_of_stock`, `discontinued` |
| `notes` | TEXT | Free text, optional |
| `created_at` | TIMESTAMP | Auto-set on creation |
| `supplier_id` | UUID | 🔒 RESERVED for v2 (Supplier tracking) |
| `branch_id` | UUID | 🔒 RESERVED for v2 (Multi-branch inventory separation) |

**Business Rules:**
- `current_stock` must never go below 0
- When `current_stock` ≤ `par_stock`, flag as low stock on dashboard
- `cost_price` × `current_stock` = real-time inventory worth

---

### 3. `catalogue_items`
Stores sellable products (simple items or bundles).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id |
| `name` | TEXT | e.g. "Fruit & Nut Pack 200g" |
| `category` | TEXT | e.g. "Gift Packs", "Loose Items" |
| `selling_price` | DECIMAL | Default price shown in POS |
| `is_bundle` | BOOLEAN | `true` = composite item with multiple ingredients |
| `availability_status` | TEXT | Values: `active`, `inactive` |
| `notes` | TEXT | Optional |
| `created_at` | TIMESTAMP | Auto-set on creation |
| `branch_id` | UUID | 🔒 RESERVED for v2 (Multi-branch catalogue separation) |

**Business Rules:**
- If `is_bundle = false` → maps to exactly 1 inventory item via `catalogue_components`
- If `is_bundle = true` → maps to 2 or more inventory items via `catalogue_components`

---

### 4. `catalogue_components` ⭐ (Bridge Table — Most Critical)
Defines the recipe/mapping between catalogue items and inventory items.
Each row = "this catalogue item uses this much of this inventory item per 1 unit sold."

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `catalogue_item_id` | UUID | FK → catalogue_items.id |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `quantity_used` | DECIMAL | Amount deducted from inventory per 1 unit sold |

**Example — "Fruit & Nut Pack":**
```
catalogue_item_id       inventory_item_id    quantity_used
"Fruit & Nut Pack"  →   "Cashews"            50  (grams)
"Fruit & Nut Pack"  →   "Almonds"            50  (grams)
"Fruit & Nut Pack"  →   "Pistachios"         50  (grams)
```

**Sale Trigger Logic:**
When 2 units of "Fruit & Nut Pack" are sold:
→ Deduct 100g from Cashews
→ Deduct 100g from Almonds
→ Deduct 100g from Pistachios
→ Create 3 rows in `stock_movements` with type = `sale_deduction`

---

### 5. `sales`
Stores each complete transaction (one bill = one row).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id |
| `subtotal_amount` | DECIMAL | Sum of all line items before bill-level discount |
| `bill_discount_amount` | DECIMAL | Discount applied to entire bill (default 0) |
| `final_amount` | DECIMAL | `subtotal_amount` - `bill_discount_amount` |
| `payment_method` | TEXT | Values: `cash`, `upi`, `card` |
| `sold_at` | TIMESTAMP | Exact date + time — used for all time-based analytics |
| `notes` | TEXT | Optional note on this transaction |
| `customer_id` | UUID | 🔒 RESERVED for v2 (Customer credit tracking) |
| `branch_id` | UUID | 🔒 RESERVED for v2 (Which branch recorded this sale) |

---

### 6. `sale_items`
Stores individual line items within each sale (one product = one row).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `sale_id` | UUID | FK → sales.id |
| `catalogue_item_id` | UUID | FK → catalogue_items.id |
| `quantity` | DECIMAL | Units sold |
| `unit_price` | DECIMAL | Price at time of sale (owner can override default) |
| `cost_price_at_sale` | DECIMAL | ⚠️ Snapshot of cost_price at moment of sale — never changes |
| `item_discount_amount` | DECIMAL | Discount on this specific line item (default 0) |
| `line_total` | DECIMAL | `(unit_price × quantity) - item_discount_amount` |
| `is_bundle` | BOOLEAN | Copied from catalogue_items for quick reference |
| `stock_deducted` | BOOLEAN | `true` = stock was deducted normally. `false` = insufficient stock at sale time — owner must reconcile manually |

**Why `stock_deducted` matters:**
When a sale is recorded but inventory hasn't been updated, stock may show as 0 even though physical stock exists.
Rather than blocking the sale, we record it and flag it. The owner sees a warning and can update inventory.
Any `sale_item` where `stock_deducted = false` appears in the "Needs Reconciliation" dashboard alert.

**Why `cost_price_at_sale` is critical:**
If Cashew's cost price changes from ₹500/kg to ₹600/kg next month,
all past profit reports must still show the original ₹500/kg cost.
This snapshot protects historical accuracy forever.

**Profit Calculation per line item:**
```
item_profit = (unit_price - cost_price_at_sale) × quantity - item_discount_amount
```

**Note:** Bundle profit is NOT calculated in v1 (pushed to v2 due to complexity).
Only simple (non-bundle) items show individual profit figures.

---

### 7. `stock_movements`
Audit log of every single stock change — the complete history.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `movement_type` | TEXT | Values: `purchase`, `waste`, `consumption`, `sale_deduction` |
| `quantity` | DECIMAL | Positive = stock coming IN, Negative = stock going OUT |
| `notes` | TEXT | e.g. "Spoiled due to rain", "Internal staff use" |
| `created_at` | TIMESTAMP | When this movement happened |
| `branch_id` | UUID | 🔒 RESERVED for v2 (Which branch this movement belongs to) |

**movement_type values explained:**
- `purchase` → New stock arrived, quantity is POSITIVE
- `waste` → Spoilage/damage, quantity is NEGATIVE
- `consumption` → Internal use not linked to a sale, quantity is NEGATIVE
- `sale_deduction` → Triggered automatically by a sale, quantity is NEGATIVE

---

## Relationships Map

```
users
  ├── inventory_items ◄──── stock_movements
  │         ▲
  │         │ (via catalogue_components)
  │         │
  ├── catalogue_items
  │         │
  │         ▼
  ├── sale_items ──────────► sales
```

---

## Key Business Logic (for Claude to always follow)

### When a Sale is Recorded (POS) — via Supabase RPC:
This flow runs inside a PostgreSQL stored procedure (confirm_sale RPC) for performance and reliability.
All 20+ database operations happen in a single database call — not via multiple TypeScript round trips.

1. Validate cart is not empty
2. Calculate all line totals and bill total
3. INSERT one row into `sales`
4. For each cart item:
   a. Fetch `catalogue_components` for that item
   b. Check if stock is sufficient for ALL components
   c. Snapshot `cost_price_at_sale` from current inventory prices
   d. INSERT into `sale_items`
   e. IF stock sufficient: INSERT `stock_movements` (sale_deduction) + UPDATE `current_stock`
   f. IF stock insufficient: set `stock_deducted = false`, skip deduction, add to flagged list
5. Return `{ sale_id, flagged_items[] }` to the frontend

> ⚠️ Partial sales are allowed by design. A sale is NEVER blocked due to stock shortfall.
> Instead, `stock_deducted = false` flags the item for manual reconciliation by the owner.
> This is the correct behaviour for small businesses where physical stock often exists but the system hasn't been updated.

### When Stock Arrives (Purchase):
1. Create a row in `stock_movements` (type: `purchase`, positive quantity)
2. Update `current_stock` in `inventory_items` (add quantity)

### When Waste is Logged:
1. Create a row in `stock_movements` (type: `waste`, negative quantity)
2. Update `current_stock` in `inventory_items` (subtract quantity)

---

## Dashboard Analytics This Schema Powers

| Metric | Source |
|---|---|
| Daily / Weekly / Monthly Revenue | `sales.final_amount` grouped by `sales.sold_at` |
| Profit by Time Period | `sale_items` — `(unit_price - cost_price_at_sale) × qty` |
| Profit by Category | `catalogue_items.category` joined to `sale_items` |
| Top Selling Items | `sale_items` grouped by `catalogue_item_id` |
| High Selling Time / Day | `sales.sold_at` — hour and day-of-week analysis |
| Payment Method Split | `sales.payment_method` grouped count |
| Low Stock Alerts | `inventory_items` where `current_stock` ≤ `par_stock` |
| Inventory Worth | SUM(`inventory_items.current_stock × cost_price`) |
| Waste by Item | `stock_movements` where `movement_type = 'waste'` |
| Full Stock Audit | All rows in `stock_movements` for an item |
| Unreconciled Sales Alert | `sale_items` where `stock_deducted = false` — needs owner attention |

---

## What is Intentionally NOT in v1

| Feature | Reason | Target Version |
|---|---|---|
| Supplier tracking | Adds supplier table + relationships | v2 |
| Customer management | Adds customer table + credit logic | v2 |
| Bundle-level profit | Complex discount apportioning | v2 |
| Role-Based Access Control (RBAC) | Multi-user permissions | v2 |
| WhatsApp NLP Engine | LLM + Text-to-SQL complexity | v2 |
| Multi-branch management | Single branch in v1, schema is branch-aware | v2 |
| Printable / shareable bill | Post-sale flow enhancement | v2 |
| Bulk CSV import | Not core to MVP | v2 |
| Barcode scanning | Hardware dependency | v2 |
| Returns / refunds | Complex reversal logic | v2 |
| Tax / GST settings | Regulatory complexity | v2 |
| Item images in catalogue | Storage + UX complexity | v2 |

---

## 8 Rules Claude Must Always Follow

1. **Always reference this SCHEMA.md** before writing any database query or Supabase migration
2. **Never create new tables** without explicit instruction — use only the 7 tables defined here
3. **Always filter every query by `user_id`** — every piece of data belongs to a specific user, never query without it
4. **`cost_price_at_sale` is always a snapshot** — copy from `inventory_items.cost_price` at moment of sale, never reference the live value
5. **Sale flow must be atomic** — use Supabase transactions so all `stock_movements` inserts and `current_stock` updates succeed together or all fail
6. **Free plan limits are enforced server-side** — check `subscription_plan` from `users` table, never rely on frontend alone
7. **`current_stock` is only updated via `stock_movements`** — never update it directly, always go through the movement log
8. **All tables are branch-aware** — `branch_id` columns are reserved even though v1 is single-branch; never remove them

---

*Last updated: SmartInventory AI — v1 Schema Final — synced with PRD.md v1 + PROMPTS.md v1 (RPC sale flow + stock_deducted)*
