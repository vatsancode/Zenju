-- ============================================================
-- ZenJu — Fix infinite recursion in RLS policies (error 42P17)
--
-- Every "Users access own business data" policy (except the one on
-- businesses) figures out "which businesses does this user belong to?"
-- by subquerying business_users directly. But business_users has its
-- OWN "Users access own business data" policy — so that subquery
-- re-triggers the same policy, which subqueries business_users again,
-- forever. Postgres detects the loop and errors with 42P17 instead of
-- hanging.
--
-- Fix: a SECURITY DEFINER function that reads business_users once,
-- running with the function owner's privileges — which bypasses RLS
-- entirely, so the lookup never re-enters the policy that's asking for
-- it. Every affected policy now calls this function instead of
-- embedding the raw subquery. Safe to re-run: CREATE OR REPLACE and
-- DROP POLICY IF EXISTS throughout.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT business_id FROM business_users
  WHERE auth_user_id = auth.uid() AND is_active = true
$$;

-- businesses is untouched — its policy checks owner_user_id = auth.uid()
-- directly and never queries business_users, so it was never part of the loop.

DROP POLICY IF EXISTS "Users access own business data" ON branches;
CREATE POLICY "Users access own business data" ON branches
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON channels;
CREATE POLICY "Users access own business data" ON channels
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON business_users;
CREATE POLICY "Users access own business data" ON business_users
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON units;
CREATE POLICY "Users access own business data" ON units
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON unit_conversions;
CREATE POLICY "Users access own business data" ON unit_conversions
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON categories;
CREATE POLICY "Users access own business data" ON categories
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON tags;
CREATE POLICY "Users access own business data" ON tags
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON entity_tags;
CREATE POLICY "Users access own business data" ON entity_tags
  FOR ALL USING (tag_id IN (
    SELECT id FROM tags WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON inventory_items;
CREATE POLICY "Users access own business data" ON inventory_items
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON attribute_definitions;
CREATE POLICY "Users access own business data" ON attribute_definitions
  FOR ALL USING (inventory_item_id IN (
    SELECT id FROM inventory_items WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON inventory_variants;
CREATE POLICY "Users access own business data" ON inventory_variants
  FOR ALL USING (inventory_item_id IN (
    SELECT id FROM inventory_items WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON variant_attribute_values;
CREATE POLICY "Users access own business data" ON variant_attribute_values
  FOR ALL USING (variant_id IN (
    SELECT id FROM inventory_variants WHERE inventory_item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (SELECT get_my_business_ids())
    )
  ));

DROP POLICY IF EXISTS "Users access own business data" ON suppliers;
CREATE POLICY "Users access own business data" ON suppliers
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON inventory_batches;
CREATE POLICY "Users access own business data" ON inventory_batches
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON tax_rates;
CREATE POLICY "Users access own business data" ON tax_rates
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON catalogue_items;
CREATE POLICY "Users access own business data" ON catalogue_items
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON catalogue_item_taxes;
CREATE POLICY "Users access own business data" ON catalogue_item_taxes
  FOR ALL USING (catalogue_item_id IN (
    SELECT id FROM catalogue_items WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON catalogue_components;
CREATE POLICY "Users access own business data" ON catalogue_components
  FOR ALL USING (catalogue_item_id IN (
    SELECT id FROM catalogue_items WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON catalogue_component_variants;
CREATE POLICY "Users access own business data" ON catalogue_component_variants
  FOR ALL USING (catalogue_component_id IN (
    SELECT id FROM catalogue_components WHERE catalogue_item_id IN (
      SELECT id FROM catalogue_items WHERE business_id IN (SELECT get_my_business_ids())
    )
  ));

DROP POLICY IF EXISTS "Users access own business data" ON offers;
CREATE POLICY "Users access own business data" ON offers
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON offer_items;
CREATE POLICY "Users access own business data" ON offer_items
  FOR ALL USING (offer_id IN (
    SELECT id FROM offers WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON customers;
CREATE POLICY "Users access own business data" ON customers
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON sales;
CREATE POLICY "Users access own business data" ON sales
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON sale_items;
CREATE POLICY "Users access own business data" ON sale_items
  FOR ALL USING (sale_id IN (
    SELECT id FROM sales WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON stock_movements;
CREATE POLICY "Users access own business data" ON stock_movements
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON refunds;
CREATE POLICY "Users access own business data" ON refunds
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Users access own business data" ON refund_items;
CREATE POLICY "Users access own business data" ON refund_items
  FOR ALL USING (refund_id IN (
    SELECT id FROM refunds WHERE business_id IN (SELECT get_my_business_ids())
  ));

DROP POLICY IF EXISTS "Users access own business data" ON event_log;
CREATE POLICY "Users access own business data" ON event_log
  FOR ALL USING (business_id IN (SELECT get_my_business_ids()));
