-- ============================================================
-- ZenJu — Business-wide attribute pool
--
-- attribute_definitions previously stored its own `name TEXT`, unique only
-- per inventory item — two different items each got their own private copy
-- of "Grade", with no way to know they're "the same" attribute or to offer
-- it as a reusable suggestion when creating the next item.
--
-- This adds a shared `attributes` table (same shape as categories/units —
-- business-scoped, one row per name) and repoints attribute_definitions at
-- it via attribute_id, the same way inventory_items.category_id already
-- points at the shared categories table instead of storing its own text.
--
-- attribute_definitions has no real rows yet (inventory_items isn't wired
-- to the UI), so this restructures it directly rather than migrating data.
-- ============================================================

CREATE TABLE attributes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON attributes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX ON attributes(business_id);

-- Proactive duplicate-name guard, same as categories_unique_name_per_parent
-- and units_unique_name — added up front this time instead of after a
-- double-submit bug, now that the pattern is established.
CREATE UNIQUE INDEX attributes_unique_name ON attributes (business_id, lower(name));

ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own business data" ON attributes
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

-- ── Repoint attribute_definitions at the shared pool ──────────────────────

ALTER TABLE attribute_definitions DROP CONSTRAINT IF EXISTS attribute_definitions_inventory_item_id_name_key;
ALTER TABLE attribute_definitions DROP COLUMN IF EXISTS name;

ALTER TABLE attribute_definitions
  ADD COLUMN attribute_id UUID NOT NULL REFERENCES attributes(id);

ALTER TABLE attribute_definitions
  ADD CONSTRAINT attribute_definitions_inventory_item_id_attribute_id_key
  UNIQUE (inventory_item_id, attribute_id);
