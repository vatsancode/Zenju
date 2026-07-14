// ============================================================
// ZenJu — Database Types (v1)
// Auto-mirrors the real Supabase tables from 001_initial_schema.sql
// Source of truth: docs/database-schema.md
// ============================================================

// ─── Enums (CHECK constraints in the database) ─────────────

export type SubscriptionPlan = 'free' | 'pro'
export type BusinessStatus = 'active' | 'suspended'
export type UserRole = 'owner' | 'manager' | 'cashier' | 'viewer'
export type InventoryAvailability = 'active' | 'inactive'
export type CatalogueItemType = 'linked' | 'bundle' | 'independent'
export type CatalogueAvailability = 'active' | 'inactive' | 'archived'
export type PaymentMethod = 'cash' | 'upi' | 'card'
export type SaleStatus = 'draft' | 'completed' | 'voided' | 'refunded'
export type MovementType = 'sale' | 'purchase' | 'manual_adjustment' | 'waste'
export type ReferenceType = 'sale' | 'purchase' | 'manual'
export type BillDiscountType = 'flat' | 'percentage'
export type EventAction = 'created' | 'updated' | 'deleted' | 'restored'

// ─── Foundation ─────────────────────────────────────────────

export interface Business {
  id: string
  name: string
  owner_user_id: string
  business_type_id: string | null
  subscription_plan: SubscriptionPlan
  status: BusinessStatus
  currency: string
  created_at: string
  updated_at: string
}

export interface BusinessType {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  business_id: string
  name: string
  address: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Channel {
  id: string
  business_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface BusinessUser {
  id: string
  business_id: string
  auth_user_id: string
  role: UserRole
  branch_id: string | null
  display_name: string
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminUser {
  id: string
  auth_user_id: string
  created_at: string
}

// ─── Units ──────────────────────────────────────────────────

export interface Unit {
  id: string
  business_id: string
  name: string
  abbreviation: string
  allows_decimal: boolean
  is_locked: boolean
  created_at: string
  updated_at: string
}

export interface UnitConversion {
  id: string
  business_id: string
  from_unit_id: string
  to_unit_id: string
  factor: number
  created_at: string
}

// ─── Categories & Tags ──────────────────────────────────────

export interface Category {
  id: string
  business_id: string
  name: string
  parent_id: string | null
  display_order: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  business_id: string
  name: string
  color: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface EntityTag {
  id: string
  tag_id: string
  entity_type: string
  entity_id: string
  created_at: string
}

// ─── Inventory ──────────────────────────────────────────────

export interface InventoryItem {
  id: string
  business_id: string
  item_code: string | null
  name: string
  category_id: string | null
  unit_id: string
  has_expiry: boolean
  expires_within_days: number | null
  image_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AttributeDefinition {
  id: string
  inventory_item_id: string
  name: string
  display_order: number
}

export interface InventoryVariant {
  id: string
  inventory_item_id: string
  variant_code: string | null
  purchase_price: number | null
  selling_price: number | null
  par_stock: number | null
  availability_status: InventoryAvailability
  created_at: string
  updated_at: string
}

export interface VariantAttributeValue {
  id: string
  variant_id: string
  attribute_definition_id: string
  value: string
}

export interface Supplier {
  id: string
  business_id: string
  name: string
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InventoryBatch {
  id: string
  business_id: string
  variant_id: string
  branch_id: string
  supplier_id: string | null
  purchase_price: number
  quantity_received: number
  quantity_remaining: number
  expiry_date: string | null
  batch_number: string | null
  received_at: string
  created_at: string
}

// View — variant_stock_current
export interface VariantStockCurrent {
  variant_id: string
  branch_id: string
  current_stock: number
}

// ─── Catalogue ──────────────────────────────────────────────

export interface TaxRate {
  id: string
  business_id: string
  name: string
  percentage: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface CatalogueItem {
  id: string
  business_id: string
  name: string
  category_id: string | null
  type: CatalogueItemType
  selling_price: number
  tax_inclusive: boolean
  inventory_tracking: boolean
  availability_status: CatalogueAvailability
  notes: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CatalogueItemTax {
  catalogue_item_id: string
  tax_rate_id: string
}

export interface CatalogueComponent {
  id: string
  catalogue_item_id: string
  inventory_item_id: string
  quantity_used: number
  unit_id: string | null
  display_order: number
  created_at: string
}

export interface CatalogueComponentVariant {
  id: string
  catalogue_component_id: string
  variant_id: string
}

export interface Offer {
  id: string
  business_id: string
  channel_id: string | null
  name: string
  min_quantity: number
  benefit_type: string
  benefit_config: Record<string, unknown>
  active: boolean
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface OfferItem {
  id: string
  offer_id: string
  catalogue_item_id: string
}

// ─── POS ────────────────────────────────────────────────────

export interface Customer {
  id: string
  business_id: string
  name: string
  phone: string
  email: string | null
  birthday: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Sale {
  id: string
  business_id: string
  branch_id: string
  customer_id: string | null
  status: SaleStatus
  subtotal: number
  bill_discount_amount: number
  bill_discount_type: BillDiscountType | null
  tax_total: number
  final_amount: number
  payment_method: PaymentMethod
  notes: string | null
  created_by: string
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  catalogue_item_id: string
  variant_id: string | null
  catalogue_item_name: string
  quantity: number
  unit_price: number
  cost_price_at_sale: number
  item_discount_amount: number
  tax_amount: number
  tax_breakdown: { name: string; percentage: number; amount: number }[] | null
  line_total: number
  applied_offer_id: string | null
  stock_deducted: boolean
  created_at: string
}

export interface StockMovement {
  id: string
  business_id: string
  variant_id: string
  branch_id: string
  movement_type: MovementType
  quantity_change: number
  reference_id: string | null
  reference_type: ReferenceType | null
  notes: string | null
  created_at: string
}

export interface Refund {
  id: string
  sale_id: string
  business_id: string
  refund_amount: number
  reason: string | null
  created_by: string
  created_at: string
}

export interface RefundItem {
  id: string
  refund_id: string
  sale_item_id: string
  quantity: number
  refund_amount: number
}

// ─── Audit ──────────────────────────────────────────────────

export interface EventLog {
  id: string
  business_id: string
  entity_type: string
  entity_id: string
  action: EventAction
  changes: Record<string, { old: unknown; new: unknown }> | null
  performed_by: string
  created_at: string
}

// ─── Supabase Database type wrapper ─────────────────────────
// Tells createBrowserClient / createServerClient the shape of every table.
// Row = what you get back, Insert = what you send to create, Update = what you send to edit.

// { [K in keyof T]: T[K] } is an identity transform — it converts an
// `interface` into a plain object type. This matters because TypeScript's
// GenericTable check (used internally by supabase-js for .insert()/.update())
// requires Row to structurally satisfy Record<string, unknown>, and a raw
// `interface` (as opposed to a `type` alias with the same shape) does not
// satisfy that check on its own — only the mapped-type version does.
type TableDef<T> = {
  Row: { [K in keyof T]: T[K] }
  Insert: Omit<T, Extract<keyof T, 'id' | 'created_at' | 'updated_at'>> &
    Partial<Pick<T, Extract<keyof T, 'id' | 'created_at' | 'updated_at'>>>
  Update: Partial<Omit<T, 'id'>>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      businesses: TableDef<Business>
      business_types: TableDef<BusinessType>
      branches: TableDef<Branch>
      channels: TableDef<Channel>
      business_users: TableDef<BusinessUser>
      admin_users: TableDef<AdminUser>
      units: TableDef<Unit>
      unit_conversions: TableDef<UnitConversion>
      categories: TableDef<Category>
      tags: TableDef<Tag>
      entity_tags: TableDef<EntityTag>
      inventory_items: TableDef<InventoryItem>
      attribute_definitions: TableDef<AttributeDefinition>
      inventory_variants: TableDef<InventoryVariant>
      variant_attribute_values: TableDef<VariantAttributeValue>
      suppliers: TableDef<Supplier>
      inventory_batches: TableDef<InventoryBatch>
      tax_rates: TableDef<TaxRate>
      catalogue_items: TableDef<CatalogueItem>
      catalogue_item_taxes: {
        Row: { [K in keyof CatalogueItemTax]: CatalogueItemTax[K] }
        Insert: { [K in keyof CatalogueItemTax]: CatalogueItemTax[K] }
        Update: Partial<{ [K in keyof CatalogueItemTax]: CatalogueItemTax[K] }>
        Relationships: []
      }
      catalogue_components: TableDef<CatalogueComponent>
      catalogue_component_variants: TableDef<CatalogueComponentVariant>
      offers: TableDef<Offer>
      offer_items: TableDef<OfferItem>
      customers: TableDef<Customer>
      sales: TableDef<Sale>
      sale_items: TableDef<SaleItem>
      stock_movements: TableDef<StockMovement>
      refunds: TableDef<Refund>
      refund_items: TableDef<RefundItem>
      event_log: TableDef<EventLog>
    }
    Views: {
      variant_stock_current: {
        Row: { [K in keyof VariantStockCurrent]: VariantStockCurrent[K] }
        Relationships: []
      }
    }
    Functions: {
      create_business_with_owner: {
        Args: {
          p_business_name: string
          p_owner_auth_id: string
          p_business_type_id: string
          p_owner_name: string
          p_owner_phone: string
        }
        Returns: Business
      }
    }
    Enums: Record<string, never>
  }
}

// ─── Composite / helper types ───────────────────────────────

export interface CatalogueItemWithComponents extends CatalogueItem {
  catalogue_components: (CatalogueComponent & {
    inventory_item: InventoryItem
  })[]
}

export interface SaleItemWithCatalogue extends SaleItem {
  catalogue_item: CatalogueItem
}

export interface SaleWithItems extends Sale {
  sale_items: SaleItemWithCatalogue[]
}
