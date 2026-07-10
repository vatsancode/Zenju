-- ============================================================
-- ZenJu — Add phone to business_users
-- Contact number for a person's membership at a business
-- (e.g. the owner's WhatsApp number), captured on the admin
-- "Add Business" form. Lives on business_users, not businesses,
-- since it's a per-person detail, not a business-level one.
-- ============================================================

ALTER TABLE business_users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Owners must have a phone on file; other roles (manager/cashier/viewer)
-- may leave it blank. Enforced here so no insert path — API, script, or
-- future admin action — can create an ownerless-phone row by accident.
ALTER TABLE business_users DROP CONSTRAINT IF EXISTS business_users_owner_phone_check;
ALTER TABLE business_users ADD CONSTRAINT business_users_owner_phone_check
  CHECK (role != 'owner' OR phone IS NOT NULL);
