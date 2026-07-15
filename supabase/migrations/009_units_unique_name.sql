-- ============================================================
-- ZenJu — Enforce unique unit names at the DB level
--
-- Same reasoning as 008_categories_unique_name.sql: the app-level
-- duplicate-name check (lib/services/units.ts validateName) can race if two
-- requests arrive close together, so the actual guarantee has to live in
-- the database. Added proactively here — there's no existing "units"
-- feature yet for this to have gone stale under, unlike categories.
--
-- Scoped to (business_id, lower(name)) — units aren't nested, so no
-- parent_id component like categories needed.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS units_unique_name
  ON units (business_id, lower(name));
