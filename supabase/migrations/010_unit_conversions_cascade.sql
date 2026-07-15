-- ============================================================
-- ZenJu — Cascade-delete unit conversions when a referenced unit is deleted
--
-- unit_conversions.from_unit_id / to_unit_id reference units(id) with no
-- delete behavior specified in 001_initial_schema.sql, which defaults to
-- NO ACTION — deleting a unit that's used in any conversion would fail
-- with a raw foreign-key-violation error.
--
-- A conversion only describes a relationship *between* two units — unlike
-- inventory/catalogue usage (which blocks a unit delete outright, see
-- lib/services/units.ts isUnitInUse), there's nothing worth protecting by
-- blocking the delete here. If "Grams" is deleted, "1 KG = 1000 Grams"
-- stops meaning anything and should go with it. The app warns the user
-- with the affected count before they confirm (see the delete-unit modal
-- in app/dashboard/settings/page.tsx) — this migration is what guarantees
-- the actual cleanup happens, so no code path can ever leave an orphaned
-- conversion row behind.
--
-- Constraint names aren't hunted for and hardcoded here since
-- 001_initial_schema.sql declared them via inline REFERENCES (not a named
-- CONSTRAINT) — Postgres's auto-generated name is convention, not
-- guaranteed, so this looks them up dynamically instead of guessing.
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'unit_conversions'
      AND con.contype = 'f'
      AND con.confrelid = 'units'::regclass
  LOOP
    EXECUTE format('ALTER TABLE unit_conversions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE unit_conversions
  ADD CONSTRAINT unit_conversions_from_unit_id_fkey
  FOREIGN KEY (from_unit_id) REFERENCES units(id) ON DELETE CASCADE;

ALTER TABLE unit_conversions
  ADD CONSTRAINT unit_conversions_to_unit_id_fkey
  FOREIGN KEY (to_unit_id) REFERENCES units(id) ON DELETE CASCADE;
