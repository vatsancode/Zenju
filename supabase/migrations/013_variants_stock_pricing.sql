-- has_variants: distinguishes "one implicit default variant" (false, the
-- common case) from "explicitly tracks multiple named variants" (true).
ALTER TABLE inventory_items
  ADD COLUMN has_variants BOOLEAN NOT NULL DEFAULT false;

-- expires_within_days never had real meaning (expiry varies per batch, see
-- inventory_batches.expiry_date, not a fixed offset from purchase) and
-- nothing in the app computes with it. Drop it.
ALTER TABLE inventory_items
  DROP COLUMN expires_within_days;

-- target_profit_percent lives on the variant (not the item) because margin
-- targets are set per variant — a 500g pack and a 1kg pack of the same
-- product can have different target margins.
ALTER TABLE inventory_variants
  ADD COLUMN target_profit_percent DECIMAL;

-- Pre-existing gap: inventory_batches.variant_id had no ON DELETE CASCADE,
-- so rolling back a failed product creation (which deletes the
-- inventory_items row) could leave orphaned batch rows once the create path
-- inserts batches directly. Close it now, since it's newly reachable.
ALTER TABLE inventory_batches DROP CONSTRAINT inventory_batches_variant_id_fkey;
ALTER TABLE inventory_batches ADD CONSTRAINT inventory_batches_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES inventory_variants(id) ON DELETE CASCADE;
