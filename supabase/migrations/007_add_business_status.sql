-- ============================================================
-- ZenJu — Add business status (suspend/activate)
--
-- Adds a status column to businesses so admins can suspend an account.
-- Every tenant-scoped RLS policy already gates access through
-- get_my_business_ids() (005_fix_business_users_rls_recursion.sql) — that
-- function is extended here to also require status = 'active', so a
-- suspended business's data becomes inaccessible immediately, even for
-- an already-logged-in session, without touching every policy individually.
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_status_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_status_check
  CHECK (status IN ('active', 'suspended'));

CREATE OR REPLACE FUNCTION get_my_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT bu.business_id FROM business_users bu
  JOIN businesses b ON b.id = bu.business_id
  WHERE bu.auth_user_id = auth.uid() AND bu.is_active = true AND b.status = 'active'
$$;

-- The businesses table previously only let the owner read their own row
-- (owner_user_id = auth.uid()). The login flow needs any active staff
-- member — not just the owner — to check their business's status, so add
-- a read-only policy for members alongside the owner's existing full-access
-- policy. Postgres OR-combines permissive policies for the same command, so
-- SELECT is allowed by either policy while INSERT/UPDATE/DELETE stay
-- owner-only. get_my_business_ids() is SECURITY DEFINER (bypasses RLS
-- internally), so this does not reintroduce the recursion 005 fixed.
DROP POLICY IF EXISTS "Users access own business data" ON businesses;
DROP POLICY IF EXISTS "Owner manages own business" ON businesses;
DROP POLICY IF EXISTS "Business members can view own business" ON businesses;

CREATE POLICY "Owner manages own business" ON businesses
  FOR ALL USING (owner_user_id = auth.uid());

CREATE POLICY "Business members can view own business" ON businesses
  FOR SELECT USING (id IN (SELECT get_my_business_ids()));

-- "Owner manages own business" above is FOR ALL with no column restriction,
-- so its USING clause doubles as the implicit WITH CHECK for UPDATE — an
-- owner could otherwise update their own status field directly from the
-- client (bypassing the admin-gated /api/businesses/[id]/status route) and
-- self-reactivate a suspended business while their session is still valid.
-- This trigger blocks any status change that isn't made by the service
-- role, which is what that route (and create_business_with_owner) use.
CREATE OR REPLACE FUNCTION prevent_business_status_change_by_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Only an admin can change business status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_business_status_change ON businesses;
CREATE TRIGGER trg_prevent_business_status_change
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_business_status_change_by_owner();
