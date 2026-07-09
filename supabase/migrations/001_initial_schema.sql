-- ============================================================
-- ZenJu — Initial Database Schema (v1)
-- Source of truth: docs/database-schema.md
-- Run this in Supabase SQL Editor to create all tables.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- FOUNDATION TABLES
-- ============================================================

-- Table 0a — businesses
CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  subscription_plan TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_plan IN ('free', 'pro')),
  currency    TEXT NOT NULL DEFAULT 'INR',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 0b — branches
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  address     TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 0c — channels
CREATE TABLE channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 0d — business_users
CREATE TABLE business_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id),
  role        TEXT NOT NULL DEFAULT 'cashier'
    CHECK (role IN ('owner', 'manager', 'cashier', 'viewer')),
  branch_id   UUID REFERENCES branches(id),
  display_name TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, auth_user_id)
);

-- ============================================================
-- UNITS
-- ============================================================

-- Table 16 — units
CREATE TABLE units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  allows_decimal BOOLEAN NOT NULL DEFAULT false,
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 17 — unit_conversions
CREATE TABLE unit_conversions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  from_unit_id UUID NOT NULL REFERENCES units(id),
  to_unit_id  UUID NOT NULL REFERENCES units(id),
  factor      DECIMAL NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, from_unit_id, to_unit_id)
);

-- ============================================================
-- CATEGORIES & TAGS
-- ============================================================

-- Table 8 — categories
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES categories(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 9 — tags
CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  color       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 10 — entity_tags
CREATE TABLE entity_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INVENTORY
-- ============================================================

-- Table 1 — inventory_items
CREATE TABLE inventory_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  item_code   TEXT,
  name        TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  unit_id     UUID NOT NULL REFERENCES units(id),
  has_expiry  BOOLEAN NOT NULL DEFAULT false,
  expires_within_days INTEGER,
  image_url   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Table 2 — attribute_definitions
CREATE TABLE attribute_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (inventory_item_id, name)
);

-- Table 3 — inventory_variants
CREATE TABLE inventory_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_code TEXT,
  purchase_price DECIMAL,
  selling_price DECIMAL,
  par_stock   DECIMAL,
  availability_status TEXT NOT NULL DEFAULT 'active'
    CHECK (availability_status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 4 — variant_attribute_values
CREATE TABLE variant_attribute_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES inventory_variants(id) ON DELETE CASCADE,
  attribute_definition_id UUID NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
  value       TEXT NOT NULL
);

-- Table 6 — suppliers
CREATE TABLE suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 7 — inventory_batches
CREATE TABLE inventory_batches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  variant_id  UUID NOT NULL REFERENCES inventory_variants(id),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  supplier_id UUID REFERENCES suppliers(id),
  purchase_price DECIMAL NOT NULL,
  quantity_received DECIMAL NOT NULL,
  quantity_remaining DECIMAL NOT NULL,
  expiry_date DATE,
  batch_number TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View — variant_stock_current
CREATE VIEW variant_stock_current AS
SELECT
  variant_id,
  branch_id,
  COALESCE(SUM(quantity_remaining), 0) AS current_stock
FROM inventory_batches
GROUP BY variant_id, branch_id;

-- ============================================================
-- CATALOGUE
-- ============================================================

-- Tax rates (master list per business)
CREATE TABLE tax_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  percentage  NUMERIC NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name, percentage)
);

-- Table 11 — catalogue_items
CREATE TABLE catalogue_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  type        TEXT NOT NULL DEFAULT 'linked'
    CHECK (type IN ('linked', 'bundle', 'independent')),
  selling_price DECIMAL NOT NULL,
  tax_inclusive BOOLEAN NOT NULL DEFAULT false,
  inventory_tracking BOOLEAN NOT NULL DEFAULT true,
  availability_status TEXT NOT NULL DEFAULT 'active'
    CHECK (availability_status IN ('active', 'inactive', 'archived')),
  notes       TEXT,
  branch_id   UUID REFERENCES branches(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- catalogue_item_taxes (junction)
CREATE TABLE catalogue_item_taxes (
  catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
  tax_rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE CASCADE,
  PRIMARY KEY (catalogue_item_id, tax_rate_id)
);

-- Table 12 — catalogue_components
CREATE TABLE catalogue_components (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity_used DECIMAL NOT NULL,
  unit_id     UUID REFERENCES units(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 13 — catalogue_component_variants
CREATE TABLE catalogue_component_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_component_id UUID NOT NULL REFERENCES catalogue_components(id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES inventory_variants(id)
);

-- Table 14 — offers
CREATE TABLE offers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  channel_id  UUID REFERENCES channels(id),
  name        TEXT NOT NULL,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  benefit_type TEXT NOT NULL,
  benefit_config JSONB NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Table 15 — offer_items
CREATE TABLE offer_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id)
);

-- ============================================================
-- POS
-- ============================================================

-- Table 18 — customers
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  birthday    DATE,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (business_id, phone)
);

-- Table 19 — sales
CREATE TABLE sales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  customer_id UUID REFERENCES customers(id),
  status      TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed', 'voided', 'refunded')),
  subtotal    DECIMAL NOT NULL,
  bill_discount_amount DECIMAL NOT NULL DEFAULT 0,
  bill_discount_type TEXT
    CHECK (bill_discount_type IN ('flat', 'percentage')),
  tax_total   DECIMAL NOT NULL DEFAULT 0,
  final_amount DECIMAL NOT NULL,
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('cash', 'upi', 'card')),
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES business_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 20 — sale_items
CREATE TABLE sale_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id),
  variant_id  UUID REFERENCES inventory_variants(id),
  catalogue_item_name TEXT NOT NULL,
  quantity    DECIMAL NOT NULL,
  unit_price  DECIMAL NOT NULL,
  cost_price_at_sale DECIMAL NOT NULL,
  item_discount_amount DECIMAL NOT NULL DEFAULT 0,
  tax_amount  DECIMAL NOT NULL DEFAULT 0,
  tax_breakdown JSONB,
  line_total  DECIMAL NOT NULL,
  applied_offer_id UUID REFERENCES offers(id),
  stock_deducted BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 21 — stock_movements
CREATE TABLE stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  variant_id  UUID NOT NULL REFERENCES inventory_variants(id),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('sale', 'purchase', 'manual_adjustment', 'waste')),
  quantity_change DECIMAL NOT NULL,
  reference_id UUID,
  reference_type TEXT
    CHECK (reference_type IN ('sale', 'purchase', 'manual')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refunds
CREATE TABLE refunds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  refund_amount DECIMAL NOT NULL,
  reason      TEXT,
  created_by  UUID NOT NULL REFERENCES business_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refund items
CREATE TABLE refund_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id   UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id),
  quantity    DECIMAL NOT NULL,
  refund_amount DECIMAL NOT NULL
);

-- ============================================================
-- AUDIT
-- ============================================================

-- Event log (append-only)
CREATE TABLE event_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  action      TEXT NOT NULL
    CHECK (action IN ('created', 'updated', 'deleted', 'restored')),
  changes     JSONB,
  performed_by UUID NOT NULL REFERENCES business_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON businesses        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON branches          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON channels          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON business_users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON units             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tags              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory_items   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON suppliers         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tax_rates         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON catalogue_items   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON offers            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers         FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

-- Foundation
CREATE INDEX ON business_users(auth_user_id);

-- Inventory
CREATE INDEX ON inventory_items(business_id);
CREATE INDEX ON inventory_items(category_id);
CREATE INDEX ON inventory_variants(inventory_item_id);
CREATE INDEX ON inventory_batches(variant_id, branch_id);
CREATE INDEX ON inventory_batches(expiry_date);
CREATE INDEX ON inventory_batches(supplier_id);
CREATE INDEX ON suppliers(business_id);

-- Catalogue
CREATE INDEX ON catalogue_items(business_id, availability_status);
CREATE INDEX ON catalogue_items(business_id, branch_id);
CREATE INDEX ON catalogue_items(category_id);
CREATE INDEX ON catalogue_components(catalogue_item_id);
CREATE INDEX ON categories(business_id, parent_id);
CREATE INDEX ON entity_tags(entity_type, entity_id);
CREATE INDEX ON entity_tags(tag_id);
CREATE INDEX ON tax_rates(business_id);
CREATE INDEX ON tax_rates(business_id, active) WHERE active = true;
CREATE INDEX ON catalogue_item_taxes(catalogue_item_id);
CREATE INDEX ON catalogue_item_taxes(tax_rate_id);

-- POS
CREATE INDEX ON sales(business_id, created_at);
CREATE INDEX ON sales(branch_id);
CREATE INDEX ON sales(customer_id);
CREATE INDEX ON sales(payment_method);
CREATE INDEX ON sales(status) WHERE status != 'completed';
CREATE INDEX ON sales(created_by);
CREATE INDEX ON sale_items(sale_id);
CREATE INDEX ON sale_items(catalogue_item_id);
CREATE INDEX ON sale_items(variant_id);
CREATE INDEX ON stock_movements(variant_id, created_at);
CREATE INDEX ON stock_movements(movement_type);
CREATE INDEX ON stock_movements(reference_id, reference_type);
CREATE INDEX ON refunds(sale_id);
CREATE INDEX ON refunds(business_id, created_at);
CREATE INDEX ON refund_items(refund_id);
CREATE INDEX ON refund_items(sale_item_id);

-- Audit
CREATE INDEX ON event_log(business_id, created_at);
CREATE INDEX ON event_log(entity_type, entity_id);
CREATE INDEX ON event_log(performed_by);

-- Text search (fuzzy matching at POS)
CREATE INDEX ON customers       USING gin(name gin_trgm_ops);
CREATE INDEX ON inventory_items USING gin(name gin_trgm_ops);
CREATE INDEX ON catalogue_items USING gin(name gin_trgm_ops);

-- Partial indexes (active records only)
CREATE INDEX ON inventory_items(business_id) WHERE deleted_at IS NULL;
CREATE INDEX ON catalogue_items(business_id) WHERE deleted_at IS NULL;
CREATE INDEX ON customers(business_id)       WHERE deleted_at IS NULL;
CREATE INDEX ON offers(business_id, active)  WHERE active = true AND deleted_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tenant-owned tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_item_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_component_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access data for businesses they belong to
-- The pattern: check if auth.uid() has a row in business_users for the row's business_id

CREATE POLICY "Users access own business data" ON businesses
  FOR ALL USING (owner_user_id = auth.uid());

CREATE POLICY "Users access own business data" ON branches
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON channels
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON business_users
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON units
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON unit_conversions
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON categories
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON tags
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON entity_tags
  FOR ALL USING (tag_id IN (
    SELECT id FROM tags WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON inventory_items
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON attribute_definitions
  FOR ALL USING (inventory_item_id IN (
    SELECT id FROM inventory_items WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON inventory_variants
  FOR ALL USING (inventory_item_id IN (
    SELECT id FROM inventory_items WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON variant_attribute_values
  FOR ALL USING (variant_id IN (
    SELECT id FROM inventory_variants WHERE inventory_item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (
        SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
      )
    )
  ));

CREATE POLICY "Users access own business data" ON suppliers
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON inventory_batches
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON tax_rates
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON catalogue_items
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON catalogue_item_taxes
  FOR ALL USING (catalogue_item_id IN (
    SELECT id FROM catalogue_items WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON catalogue_components
  FOR ALL USING (catalogue_item_id IN (
    SELECT id FROM catalogue_items WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON catalogue_component_variants
  FOR ALL USING (catalogue_component_id IN (
    SELECT id FROM catalogue_components WHERE catalogue_item_id IN (
      SELECT id FROM catalogue_items WHERE business_id IN (
        SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
      )
    )
  ));

CREATE POLICY "Users access own business data" ON offers
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON offer_items
  FOR ALL USING (offer_id IN (
    SELECT id FROM offers WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON customers
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON sales
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON sale_items
  FOR ALL USING (sale_id IN (
    SELECT id FROM sales WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON stock_movements
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON refunds
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users access own business data" ON refund_items
  FOR ALL USING (refund_id IN (
    SELECT id FROM refunds WHERE business_id IN (
      SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "Users access own business data" ON event_log
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE auth_user_id = auth.uid() AND is_active = true
  ));
