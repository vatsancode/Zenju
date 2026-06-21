# Schema Conclusion
> Final agreed database structure decisions. Use this as the reference alongside SCHEMA.md and PRD.md.

---

## Inventory

### Table 1 — `inventory_items`
The product identity. Shared information that never changes per variant or branch.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id |
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
| `id` | UUID | Primary key |
| `inventory_item_id` | UUID | FK → inventory_items.id |
| `name` | TEXT | e.g. Size, Color, Weight |
| `display_order` | INTEGER | Controls column order in UI |

---

### Table 3 — `inventory_variants`
Each unique version of a product. Holds default pricing and thresholds.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
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
| `id` | UUID | Primary key |
| `variant_id` | UUID | FK → inventory_variants.id |
| `attribute_definition_id` | UUID | FK → attribute_definitions.id |
| `value` | TEXT | e.g. Large, Red, 500g |

---

### Table 5 — `variant_stock`
Stock quantity per variant. Branch-aware from day one — one row per variant now, one row per variant per branch later.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
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
