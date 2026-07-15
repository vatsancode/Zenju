-- ============================================================
-- ZenJu — Enforce unique category/subcategory names at the DB level
--
-- App-layer validation (lib/services/categories.ts validateName) checks for
-- a duplicate name before inserting, but two requests that arrive close
-- together (e.g. a user double-clicking Save, or mashing Enter because a
-- slow request looked like it didn't register) can both pass that check
-- before either has inserted — a classic check-then-act race. A unique
-- index is the only thing that actually prevents this, since Postgres
-- enforces it atomically per row regardless of request timing.
--
-- Scoped to (business_id, parent_id, lower(name)) so "Nuts" and "nuts"
-- collide, siblings under different parents don't, and archived categories
-- are excluded — an archived "Nuts" shouldn't block creating a new one.
-- ============================================================

-- Before the index can be created, any duplicates already sitting in the
-- table from the double-submit bug (fixed in the app, but the rows it
-- already created are still here) need to be merged away. For each group
-- of same-name duplicates, keep the oldest row as canonical, point
-- anything referencing a duplicate at the canonical row instead, then
-- delete the duplicates.
WITH ranked AS (
  SELECT
    id,
    business_id,
    parent_id,
    row_number() OVER (
      PARTITION BY business_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM categories
  WHERE is_archived = false
),
canonical AS (
  SELECT
    d.id AS duplicate_id,
    c.id AS canonical_id
  FROM ranked d
  JOIN ranked c
    ON c.business_id = d.business_id
   AND COALESCE(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = COALESCE(d.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
   AND c.rn = 1
  WHERE d.rn > 1
)
UPDATE inventory_items SET category_id = canonical.canonical_id
FROM canonical
WHERE inventory_items.category_id = canonical.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    business_id,
    parent_id,
    row_number() OVER (
      PARTITION BY business_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM categories
  WHERE is_archived = false
),
canonical AS (
  SELECT
    d.id AS duplicate_id,
    c.id AS canonical_id
  FROM ranked d
  JOIN ranked c
    ON c.business_id = d.business_id
   AND COALESCE(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = COALESCE(d.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
   AND c.rn = 1
  WHERE d.rn > 1
)
UPDATE catalogue_items SET category_id = canonical.canonical_id
FROM canonical
WHERE catalogue_items.category_id = canonical.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    business_id,
    parent_id,
    row_number() OVER (
      PARTITION BY business_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM categories
  WHERE is_archived = false
),
canonical AS (
  SELECT
    d.id AS duplicate_id,
    c.id AS canonical_id
  FROM ranked d
  JOIN ranked c
    ON c.business_id = d.business_id
   AND COALESCE(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = COALESCE(d.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
   AND c.rn = 1
  WHERE d.rn > 1
)
-- Re-point any subcategories that got created under a duplicate parent
-- before it was merged away.
UPDATE categories SET parent_id = canonical.canonical_id
FROM canonical
WHERE categories.parent_id = canonical.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY business_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM categories
  WHERE is_archived = false
)
DELETE FROM categories
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS categories_unique_name_per_parent
  ON categories (business_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE is_archived = false;
