-- ============================================================
-- ZenJu — Enforce unique product names at the DB level
--
-- Same reasoning as 008_categories_unique_name.sql / 009_units_unique_name.sql
-- / 011_attributes_table.sql: the app-level duplicate-name check in
-- lib/services/inventory.ts can race, so the actual guarantee lives here.
--
-- Scoped to (business_id, lower(name)), excluding soft-deleted rows so a
-- deleted product's old name can be reused by a new one.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_unique_name
  ON inventory_items (business_id, lower(name))
  WHERE deleted_at IS NULL;
