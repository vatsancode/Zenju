# Schema Conclusion
> Final agreed database structure decisions. This is the single source of truth for all database design decisions.

---

## Global Design Decisions
- All primary keys use **UUID v7** — time-ordered, fast for inserts, timestamp embedded in ID
- All tables keep `created_at` alongside UUID v7 — UUID v7 handles ordering, `created_at` handles human-readable querying and Supabase tooling
- All tenant-owned tables carry `business_id` for Row Level Security (multi-tenancy)
- `branch_id` is planted as nullable on relevant tables — NULL = all branches, set = branch-specific (future franchise support)
- `channel_id` is planted as nullable on offers — NULL = all catalogues, set = specific catalogue/channel (future wholesale/retail split)

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
| `category` | TEXT | e.g. Clothing, Nuts |
| `subcategory` | TEXT | Optional |
| `unit` | TEXT | KG, Pieces, Litres, etc. |
| `has_expiry` | BOOLEAN | Is this perishable? |
| `expires_within_days` | INTEGER | Alert window before expiry |
| `taxes` | JSONB | `[{name, percentage, inclusive}]` |
| `image_url` | TEXT | Optional |
| `notes` | TEXT | Optional description |
| `created_at` | TIMESTAMP | Auto-set |

---

### Table 2 — `attribute_definitions`
The attribute type names for an item (e.g. Size, Color). One row per attribute type per item.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `name` | TEXT | e.g. Size, Color, Weight |
| `display_order` | INTEGER | Controls column order in UI |

---

### Table 3 — `inventory_variants`
Each unique version of a product. Holds default pricing and thresholds.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `variant_code` | TEXT | e.g. VAR-001 |
| `purchase_price` | DECIMAL | Default cost price |
| `selling_price` | DECIMAL | Default selling price / MRP |
| `par_stock` | DECIMAL | Default minimum stock threshold |
| `availability_status` | TEXT | `active` / `inactive` |
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
| `branch_id` | UUID | Reserved — default branch for v1 |
| `current_stock` | DECIMAL | Live stock quantity |
| `selling_price_override` | DECIMAL | Overrides variant default if set |
| `par_stock_override` | DECIMAL | Overrides variant default if set |
| `availability_override` | TEXT | Overrides variant default if set |
| `updated_at` | TIMESTAMP | Auto-updated on every change |

---

### Override Rule
For `selling_price`, `par_stock`, and `availability_status` — always check `variant_stock` first. If the override column is `null`, fall back to the value in `inventory_variants`.

---

### Relationships
```
inventory_items
  ├── attribute_definitions
  └── inventory_variants
        ├── variant_attribute_values → attribute_definitions
        └── variant_stock
```

---

## Catalogue

### Table 6 — `categories`
Handles both categories and subcategories in one table using a self-referencing `parent_id`. No separate subcategory table needed.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Nuts", "Cashews" |
| `parent_id` | UUID | NULL = top-level category, set = subcategory of that parent |
| `display_order` | INTEGER | Controls sort order in UI |
| `is_archived` | BOOLEAN | Soft delete — keeps data, hides from UI |
| `created_at` | TIMESTAMP | Auto-set |

**Rule:** Only one level of nesting for now — a subcategory cannot itself have children.

---

### Table 7 — `tags`
Business-wide master list of tags. Tags are shared across the whole business — not locked to catalogue or inventory. One business owns its own set of tags.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "seasonal", "bestseller", "gift" |
| `color` | TEXT | Optional hex color for UI display |
| `description` | TEXT | Optional — what this tag means |
| `created_at` | TIMESTAMP | Auto-set |

**Why not a TEXT array on catalogue_items:** Separate table allows analytics by tag, rename propagates instantly, clean metadata for vector DB injection, and tags can be applied to any entity (not just catalogue items).

---

### Table 8 — `entity_tags`
Bridge table connecting tags to any entity in the system — catalogue items today, inventory items or anything else in future. Uses `entity_type` to know what it's tagging.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `tag_id` | UUID | FK → tags.id |
| `entity_type` | TEXT | `'catalogue_item'` / `'inventory_item'` / extensible |
| `entity_id` | UUID | The ID of whatever is being tagged |
| `created_at` | TIMESTAMP | Auto-set |

---

### Table 9 — `catalogue_items`
The menu — one row per thing a business sells. Three types: linked (1 inventory item), bundle (multiple inventory items), independent (service, no stock).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Cashew 100g" |
| `category_id` | UUID | FK → categories.id |
| `type` | TEXT | `'linked'` / `'bundle'` / `'independent'` |
| `selling_price` | DECIMAL | Default price — treated as override base for channels |
| `taxes` | JSONB | `[{name, percentage, inclusive}]` |
| `tax_inclusive` | BOOLEAN | Is tax already inside the selling price? |
| `inventory_tracking` | BOOLEAN | Should a sale deduct stock? Always false for independent |
| `availability_status` | TEXT | `'active'` / `'inactive'` / `'archived'` |
| `notes` | TEXT | Internal notes |
| `branch_id` | UUID | NULL = visible in all branches, set = this branch only |
| `created_at` | TIMESTAMP | Auto-set |

**Type rule:** `type` is stored explicitly for query performance, but is always consistent with the number of component rows — 0 components = independent, 1 = linked, 2+ = bundle.

---

### Table 10 — `catalogue_components`
The recipe. Links each catalogue item to the inventory items it uses, with quantity and unit per sale. One catalogue item can point to the same inventory item with different units (e.g. Sugar 1 KG and Sugar 500g both link to the same Sugar inventory item).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `catalogue_item_id` | UUID | FK → catalogue_items.id |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `quantity_used` | DECIMAL | How much to deduct per unit sold |
| `unit` | TEXT | Unit of that quantity — can differ from inventory's unit |
| `display_order` | INTEGER | Order shown in UI for bundles |
| `created_at` | TIMESTAMP | Auto-set |

**Unit conversion rule:** If `unit` differs from the inventory item's base unit, the system uses `unit_conversions` to convert before deducting stock.

---

### Table 11 — `catalogue_component_variants`
Controls which specific variants of an inventory item are selectable at POS for a given component. If no rows exist for a component, all variants are available.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `catalogue_component_id` | UUID | FK → catalogue_components.id |
| `variant_id` | UUID | FK → inventory_variants.id |

---

### Table 12 — `offers`
Deals and promotions. `benefit_type` is a plain label. `benefit_config` is JSONB — stores the actual rules for that offer type. Adding new offer types in future requires zero database changes.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `channel_id` | UUID | NULL = all catalogues, set = specific channel only |
| `name` | TEXT | e.g. "Buy 3 Get 1 Free" |
| `min_quantity` | INTEGER | Minimum cart quantity to trigger this offer |
| `benefit_type` | TEXT | Label — see benefit types below |
| `benefit_config` | JSONB | Rules for that type — any shape |
| `active` | BOOLEAN | Is this offer currently running? |
| `created_at` | TIMESTAMP | Auto-set |

**Benefit types and their config shape:**

| benefit_type | benefit_config example | Meaning |
|---|---|---|
| `percentage_discount` | `{"value": 10}` | 10% off total |
| `flat_discount` | `{"value": 500}` | ₹500 off total |
| `fixed_price` | `{"value": 230}` | Whole combo for ₹230 |
| `free_item` | `{"select": "cheapest"}` | Cheapest item is free |
| `buy_x_get_y` | `{"buy_item_id": "x", "buy_qty": 3, "get_item_id": "y", "get_qty": 1}` | Buy 3 get 1 specific item free |
| `tiered_pricing` | `{"tiers": [{"min": 1, "max": 5, "price": 90}, {"min": 6, "price": 80}]}` | Price drops as quantity rises |

New offer types can be added by defining a new label and config shape — no migration needed.

---

### Table 13 — `offer_items`
Bridge between offers and catalogue items. Defines which items qualify for an offer.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `offer_id` | UUID | FK → offers.id |
| `catalogue_item_id` | UUID | FK → catalogue_items.id |

---

## Units

### Table 14 — `units`
Master list of measurement units per business. Businesses can create custom units. Units are locked once used in inventory to prevent data inconsistency.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `name` | TEXT | e.g. "Kilogram" |
| `abbreviation` | TEXT | e.g. "KG" |
| `allows_decimal` | BOOLEAN | Can you sell 1.5 of this? Yes for KG, No for Pieces |
| `is_locked` | BOOLEAN | True once used in inventory — cannot be deleted |
| `created_at` | TIMESTAMP | Auto-set |

---

### Table 15 — `unit_conversions`
Conversion factors between units. Only one direction needs to be defined — the system calculates the reverse automatically.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `business_id` | UUID | FK → businesses.id |
| `from_unit_id` | UUID | FK → units.id |
| `to_unit_id` | UUID | FK → units.id |
| `factor` | DECIMAL | Multiply from_unit by this to get to_unit |
| `created_at` | TIMESTAMP | Auto-set |

**Example:** from=KG, to=Grams, factor=1000 → means 1 KG = 1000 Grams. System automatically knows 1 Gram = 0.001 KG.

---

## Catalogue Relationships
```
categories (parent_id → self)
tags (business_id)
  └── entity_tags (entity_type + entity_id → anything)

catalogue_items (business_id, branch_id)
  ├── catalogue_components (quantity_used, unit)
  │     └── catalogue_component_variants (variant_id)
  └── offer_items ←── offers (business_id, channel_id, benefit_config JSONB)

units (business_id)
  └── unit_conversions (from_unit_id → to_unit_id, factor)
```

---

## Full Table Index

| # | Table | Module | One-line description |
|---|---|---|---|
| 1 | `inventory_items` | Inventory | Raw stock identity |
| 2 | `attribute_definitions` | Inventory | Attribute type names per item (Size, Color…) |
| 3 | `inventory_variants` | Inventory | Each unique version of a product |
| 4 | `variant_attribute_values` | Inventory | Attribute values per variant |
| 5 | `variant_stock` | Inventory | Live stock quantity per variant, branch-aware |
| 6 | `categories` | Global | Categories + subcategories in one self-referencing table |
| 7 | `tags` | Global | Business-wide master tag list |
| 8 | `entity_tags` | Global | Bridge — connects tags to any entity |
| 9 | `catalogue_items` | Catalogue | The menu — what you sell |
| 10 | `catalogue_components` | Catalogue | Recipe — which inventory items each item uses |
| 11 | `catalogue_component_variants` | Catalogue | Which variants are selectable per component |
| 12 | `offers` | Catalogue | Deals with flexible JSONB config |
| 13 | `offer_items` | Catalogue | Which catalogue items each offer covers |
| 14 | `units` | Units | Measurement units per business |
| 15 | `unit_conversions` | Units | Conversion rates between units |
