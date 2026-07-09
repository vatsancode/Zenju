-- ============================================================
-- ZenJu — Admin allowlist (documents what already exists live)
-- This table + policy were originally created by hand in the Supabase
-- SQL Editor while building admin login, not via a migration file.
-- This migration catches the repo up to that reality, so a fresh
-- database (staging, disaster recovery) gets the same table.
-- Every statement below is safe to re-run, including against a
-- database that already has this — nothing here will error.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Self-lookup only — a user can check "am I admin" but can't enumerate
-- others. No INSERT/UPDATE/DELETE policy, so those require the
-- service-role client (adding a new admin is always a manual, deliberate
-- action, not something the app does on its own).
DROP POLICY IF EXISTS "Self lookup only" ON admin_users;
CREATE POLICY "Self lookup only" ON admin_users
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS admin_users_auth_user_id_idx ON admin_users(auth_user_id);
