-- ============================================================
-- ZenJu — Atomic business creation
--
-- Business creation writes to 3 tables (businesses, business_users,
-- branches) after the owner's Auth login already exists. Previously
-- this was 3 sequential app-level inserts with hand-written
-- compensating deletes if a later step failed — if a delete itself
-- failed mid-cleanup, a business could be left half-created.
--
-- A plpgsql function body runs inside the calling transaction: if any
-- statement raises, every insert made so far in this function is
-- rolled back automatically by Postgres. No manual undo logic needed.
--
-- The owner's Auth user (auth.users) is still created by the app
-- BEFORE calling this function — Auth isn't a regular table, so it
-- can't participate in this transaction. If this function fails, the
-- app still needs to clean up the orphaned Auth user itself (one
-- remaining manual rollback step, down from three).
-- ============================================================

CREATE OR REPLACE FUNCTION create_business_with_owner(
  p_business_name TEXT,
  p_owner_auth_id UUID,
  p_business_type_id UUID,
  p_owner_name TEXT,
  p_owner_phone TEXT
)
RETURNS businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business businesses;
BEGIN
  INSERT INTO businesses (name, owner_user_id, business_type_id, subscription_plan, currency)
  VALUES (p_business_name, p_owner_auth_id, p_business_type_id, 'free', 'INR')
  RETURNING * INTO v_business;

  INSERT INTO business_users (business_id, auth_user_id, role, branch_id, display_name, phone, is_active)
  VALUES (v_business.id, p_owner_auth_id, 'owner', NULL, p_owner_name, p_owner_phone, true);

  INSERT INTO branches (business_id, name, address, is_default)
  VALUES (v_business.id, 'Main Store', NULL, true);

  RETURN v_business;
END;
$$;
