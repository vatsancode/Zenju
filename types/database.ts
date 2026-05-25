// ============================================================
// SmartInventory AI — Database Types (v1)
// Single source of truth for all Supabase table shapes.
// Keep in sync with SCHEMA.md
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'pro'
export type AvailabilityStatus = 'active' | 'out_of_stock' | 'discontinued'
export type CatalogueAvailabilityStatus = 'active' | 'inactive'
export type StockUnit = 'KG' | 'Grams' | 'Litres' | 'Pieces' | 'ML'
export type PaymentMethod = 'cash' | 'upi' | 'card'
export type MovementType = 'purchase' | 'waste' | 'consumption' | 'sale_deduction'

// ─── Table: users ────────────────────────────────────────────

export interface User {
  id: string                      // uuid, PK
  name: string
  email: string
  business_name: string
  subscription_plan: SubscriptionPlan
  preferred_language: string      // default: 'en'
  created_at: string              // ISO timestamp
  role: string | null             // RESERVED v2 (RBAC)
  branch_id: string | null        // RESERVED v2 (multi-branch)
  razorpay_customer_id: string | null
}

// ─── Table: inventory_items ──────────────────────────────────

export interface InventoryVariant {
  id: string
  code: string
  attributes: string[]  // Values matching the order of InventoryItem.attributes
  quantity: number
}

export interface InventoryItem {
  id: string                      // uuid, PK
  user_id: string                 // FK → users.id
  name: string
  category: string
  unit: StockUnit
  current_stock: number           // auto-updated via stock_movements only
  par_stock: number               // low-stock threshold
  cost_price: number
  mrp: number
  availability_status: AvailabilityStatus
  notes: string | null
  attributes?: string[]           // If variants exist, these are attribute NAMES (e.g. ['Size', 'Color']). Otherwise, they are simple tags.
  variants?: InventoryVariant[]   // Added to support item variations
  created_at: string
  supplier_id: string | null      // RESERVED v2
  branch_id: string | null        // RESERVED v2
}

// ─── Table: catalogue_items ──────────────────────────────────

export interface CatalogueItem {
  id: string                      // uuid, PK
  user_id: string                 // FK → users.id
  name: string
  category: string
  selling_price: number
  is_bundle: boolean
  availability_status: CatalogueAvailabilityStatus
  notes: string | null
  created_at: string
  branch_id: string | null        // RESERVED v2
}

// ─── Table: catalogue_components (bridge) ───────────────────

export interface CatalogueComponent {
  id: string                      // uuid, PK
  catalogue_item_id: string       // FK → catalogue_items.id
  inventory_item_id: string       // FK → inventory_items.id
  quantity_used: number           // amount deducted per 1 unit sold
}

// ─── Table: sales ────────────────────────────────────────────

export interface Sale {
  id: string                      // uuid, PK
  user_id: string                 // FK → users.id
  subtotal_amount: number
  bill_discount_amount: number    // default 0
  final_amount: number            // subtotal - bill_discount
  payment_method: PaymentMethod
  sold_at: string                 // ISO timestamp
  notes: string | null
  customer_id: string | null      // RESERVED v2
  branch_id: string | null        // RESERVED v2
}

// ─── Table: sale_items ───────────────────────────────────────

export interface SaleItem {
  id: string                      // uuid, PK
  sale_id: string                 // FK → sales.id
  catalogue_item_id: string       // FK → catalogue_items.id
  quantity: number
  unit_price: number              // price at time of sale (may be overridden)
  cost_price_at_sale: number      // snapshot — never references live cost_price
  item_discount_amount: number    // default 0
  line_total: number              // (unit_price × qty) - item_discount
  is_bundle: boolean              // copied from catalogue_items
  stock_deducted: boolean         // false = insufficient stock — needs reconciliation
}

// ─── Table: stock_movements ──────────────────────────────────

export interface StockMovement {
  id: string                      // uuid, PK
  user_id: string                 // FK → users.id
  inventory_item_id: string       // FK → inventory_items.id
  movement_type: MovementType
  quantity: number                // positive = IN (purchase), negative = OUT (others)
  notes: string | null
  created_at: string
  branch_id: string | null        // RESERVED v2
}

// ─── Table: categories ──────────────────────────────────────

export interface Category {
  id: string                      // uuid, PK
  user_id: string                 // FK → users.id
  name: string
  parent_id: string | null        // FK → categories.id; null = root category
  is_archived: boolean            // default false
  sort_order: number              // default 0
  created_at: string              // ISO timestamp
}

// ─── Table: units ───────────────────────────────────────────

export interface Unit {
  id: string                      // uuid, PK
  user_id: string                 // FK → users.id
  name: string
  allow_decimal: boolean          // default false
  is_locked: boolean              // true once any inventory item uses this unit
  created_at: string              // ISO timestamp
}

// ─── Table: unit_conversions ────────────────────────────────

export interface UnitConversion {
  id: string                      // uuid, PK
  user_id: string                 // FK → users.id
  from_unit_id: string            // FK → units.id
  to_unit_id: string              // FK → units.id
  factor: number                  // 1 from_unit = factor × to_unit (up to 6 decimals)
  created_at: string              // ISO timestamp
}

// ─── Supabase Database type wrapper ──────────────────────────
// Used to type createBrowserClient / createServerClient

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<User, 'id'>>
      }
      inventory_items: {
        Row: InventoryItem
        Insert: Omit<InventoryItem, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<InventoryItem, 'id'>>
      }
      catalogue_items: {
        Row: CatalogueItem
        Insert: Omit<CatalogueItem, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<CatalogueItem, 'id'>>
      }
      catalogue_components: {
        Row: CatalogueComponent
        Insert: Omit<CatalogueComponent, 'id'> & { id?: string }
        Update: Partial<Omit<CatalogueComponent, 'id'>>
      }
      sales: {
        Row: Sale
        Insert: Omit<Sale, 'id' | 'sold_at'> & {
          id?: string
          sold_at?: string
        }
        Update: Partial<Omit<Sale, 'id'>>
      }
      sale_items: {
        Row: SaleItem
        Insert: Omit<SaleItem, 'id'> & { id?: string }
        Update: Partial<Omit<SaleItem, 'id'>>
      }
      stock_movements: {
        Row: StockMovement
        Insert: Omit<StockMovement, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<StockMovement, 'id'>>
      }
    }
    categories: {
      Row: Category
      Insert: Omit<Category, 'id' | 'created_at'> & {
        id?: string
        created_at?: string
      }
      Update: Partial<Omit<Category, 'id'>>
    }
    units: {
      Row: Unit
      Insert: Omit<Unit, 'id' | 'created_at'> & {
        id?: string
        created_at?: string
      }
      Update: Partial<Omit<Unit, 'id'>>
    }
    unit_conversions: {
      Row: UnitConversion
      Insert: Omit<UnitConversion, 'id' | 'created_at'> & {
        id?: string
        created_at?: string
      }
      Update: Partial<Omit<UnitConversion, 'id'>>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Composite / helper types ────────────────────────────────

/** CatalogueItem with its components pre-fetched */
export interface CatalogueItemWithComponents extends CatalogueItem {
  catalogue_components: (CatalogueComponent & {
    inventory_item: InventoryItem
  })[]
}

/** SaleItem with its catalogue item pre-fetched */
export interface SaleItemWithCatalogue extends SaleItem {
  catalogue_item: CatalogueItem
}

/** Full sale with all line items */
export interface SaleWithItems extends Sale {
  sale_items: SaleItemWithCatalogue[]
}

/** Return type from confirm_sale RPC */
export interface ConfirmSaleResult {
  sale_id: string
  flagged_items: {
    catalogue_item_id: string
    name: string
    reason: string
  }[]
}
