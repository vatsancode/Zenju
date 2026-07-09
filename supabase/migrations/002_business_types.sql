-- ============================================================
-- ZenJu — Business Types (v2)
-- Adds a lookup table for business types + links businesses to it.
-- Run this in Supabase SQL Editor after 001_initial_schema.sql.
-- ============================================================

-- Table — business_types
CREATE TABLE business_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness (prevents "Cafe" and "cafe" both existing)
CREATE UNIQUE INDEX ON business_types (LOWER(name));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON business_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed the types currently hardcoded in app/admin/page.tsx
INSERT INTO business_types (name) VALUES
  ('Retail'),
  ('Grocery'),
  ('Cafe'),
  ('Health'),
  ('Repair'),
  ('Artisan');

-- Link businesses to a business type
ALTER TABLE businesses ADD COLUMN business_type_id UUID REFERENCES business_types(id);

-- Super-admin-only table: RLS is enabled but no policies are defined,
-- so only the service-role client (lib/supabase/server.ts createServiceClient)
-- can read or write it. Regular tenant users never touch this table.
ALTER TABLE business_types ENABLE ROW LEVEL SECURITY;
