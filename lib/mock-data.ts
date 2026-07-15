import type { Database, Category, Unit, UnitConversion } from '@/types/database'

type InventoryItem = Database['public']['Tables']['inventory_items']['Row']
type CatalogueItem = Database['public']['Tables']['catalogue_items']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

export const mockUser = {
  id: 'mock-user-1',
  name: 'Ramesh Kumar',
  email: 'ramesh@example.com',
  business_name: 'RK Dry Fruits & Snacks',
  business_type: 'grocery' as 'retail' | 'grocery' | 'cafe' | 'health' | 'repair' | 'artisan',
  subscription_plan: 'free' as 'free' | 'pro',
  preferred_language: 'en',
  created_at: '2024-01-15T10:00:00Z',
  role: null,
  branch_id: null,
  razorpay_customer_id: null,
  operating_hours: {
    morning_start: 6,
    afternoon_start: 12,
    evening_start: 17,
    night_start: 22,
  },
}

type MockInventoryVariant = { id: string; code: string; attributes: string[]; quantity: number }

type MockInventoryItem = {
  id: string
  user_id: string
  name: string
  category: string
  unit: string
  current_stock: number
  par_stock: number
  cost_price: number
  mrp: number
  availability_status: string
  notes: string
  attributes: string[]
  variants?: MockInventoryVariant[]
  created_at: string
  supplier_id: string | null
  branch_id: string | null
}

export const mockInventoryItems: MockInventoryItem[] = []

export const mockCategories: Category[] = []

export const mockUnits: Unit[] = []

export const mockUnitConversions: UnitConversion[] = []

export const mockTags = [
  { id: '1', name: 'bestseller' },
  { id: '2', name: 'seasonal' },
  { id: '3', name: 'gift' },
  { id: '4', name: 'bulk' },
  { id: '5', name: 'vegan' },
]

export const mockCatalogueItems = [
  {
    id: '1',
    name: 'Cashew 100g',
    category_id: '4',
    category_name: 'Loose Items',
    type: 'linked',
    inventory_item_id: '1',
    inventory_item_name: 'Cashews',
    selling_price: 90,
    is_bundle: false,
    inventory_tracking: true,
    availability_status: 'active',
    tags: ['bestseller'],
    notes: '',
    taxes: [{ id: 't1', name: 'GST', percentage: 5 }],
    tax_inclusive: true,
    created_at: '2024-01-15T10:00:00Z',
    mapped_inventory: [
      { id: 'm1', inventory_item_id: '1', quantity: 100, unit: 'Grams', selected_variants: ['v1', 'v2'] }
    ]
  },
  {
    id: '2',
    name: 'Almond 100g',
    category_id: '4',
    category_name: 'Loose Items',
    type: 'linked',
    inventory_item_id: '2',
    inventory_item_name: 'Almonds',
    selling_price: 80,
    is_bundle: false,
    inventory_tracking: true,
    availability_status: 'active',
    tags: [],
    notes: '',
    taxes: [{ id: 't1', name: 'GST', percentage: 5 }],
    tax_inclusive: true,
    created_at: '2024-01-16T10:00:00Z',
    mapped_inventory: [
      { id: 'm2', inventory_item_id: '2', quantity: 100, unit: 'Grams', selected_variants: ['v5', 'v6'] }
    ]
  },
  {
    id: '3',
    name: 'Fruit & Nut Pack 200g',
    category_id: '3',
    category_name: 'Gift Packs',
    type: 'bundle',
    inventory_item_id: null,
    inventory_item_name: null,
    selling_price: 320,
    is_bundle: true,
    inventory_tracking: true,
    availability_status: 'active',
    tags: ['bestseller', 'gift'],
    notes: 'Best seller',
    taxes: [{ id: 't2', name: 'GST', percentage: 12 }],
    tax_inclusive: false,
    created_at: '2024-01-17T10:00:00Z',
    bundle_components: [
      { inventory_item_id: '1', name: 'Cashews', quantity: 50, unit: 'Grams' },
      { inventory_item_id: '2', name: 'Almonds', quantity: 50, unit: 'Grams' },
      { inventory_item_id: '3', name: 'Pistachios', quantity: 50, unit: 'Grams' },
    ],
  },
  {
    id: '4',
    name: 'Mixed Dry Fruits 500g',
    category_id: '3',
    category_name: 'Gift Packs',
    type: 'bundle',
    inventory_item_id: null,
    inventory_item_name: null,
    selling_price: 650,
    is_bundle: true,
    inventory_tracking: true,
    availability_status: 'active',
    tags: ['gift', 'bulk'],
    notes: '',
    created_at: '2024-01-18T10:00:00Z',
    bundle_components: [
      { inventory_item_id: '1', name: 'Cashews', quantity: 100, unit: 'Grams' },
      { inventory_item_id: '2', name: 'Almonds', quantity: 100, unit: 'Grams' },
      { inventory_item_id: '4', name: 'Raisins', quantity: 100, unit: 'Grams' },
      { inventory_item_id: '6', name: 'Dates', quantity: 100, unit: 'Grams' },
      { inventory_item_id: '3', name: 'Pistachios', quantity: 100, unit: 'Grams' },
    ],
  },
  {
    id: '5',
    name: 'Consultation Service',
    category_id: '4',
    category_name: 'Loose Items',
    type: 'independent',
    inventory_item_id: null,
    inventory_item_name: null,
    selling_price: 500,
    is_bundle: false,
    inventory_tracking: false,
    availability_status: 'active',
    tags: [],
    notes: 'No stock deduction',
    created_at: '2024-01-19T10:00:00Z',
  },
  {
    id: '6',
    name: 'Date Box 250g',
    category_id: '3',
    category_name: 'Gift Packs',
    type: 'linked',
    inventory_item_id: '6',
    inventory_item_name: 'Dates',
    selling_price: 180,
    is_bundle: false,
    inventory_tracking: true,
    availability_status: 'inactive',
    tags: ['seasonal'],
    notes: '',
    created_at: '2024-01-20T10:00:00Z',
  },
]

export type OfferBenefitType = 'fixed_price' | 'percentage_discount' | 'flat_discount' | 'free_item'

export interface MockOffer {
  id: string
  name: string
  applicable_item_ids: string[]
  min_quantity: number
  benefit_type: OfferBenefitType
  benefit_value: number
  active: boolean
  created_at: string
}

export const mockOffers: MockOffer[] = [
  {
    id: '1',
    name: 'Dry Fruits Combo',
    applicable_item_ids: ['1', '2'],
    min_quantity: 3,
    benefit_type: 'fixed_price',
    benefit_value: 230,
    active: true,
    created_at: '2024-06-01T10:00:00Z',
  },
  {
    id: '2',
    name: 'Gift Pack Discount',
    applicable_item_ids: ['3', '4'],
    min_quantity: 2,
    benefit_type: 'percentage_discount',
    benefit_value: 10,
    active: true,
    created_at: '2024-06-05T10:00:00Z',
  },
  {
    id: '3',
    name: 'Buy 3 Get 1 Free',
    applicable_item_ids: ['1', '2', '5'],
    min_quantity: 3,
    benefit_type: 'free_item',
    benefit_value: 0,
    active: true,
    created_at: '2024-06-10T10:00:00Z',
  },
]

export const mockPricingRules = [
  {
    id: '1',
    name: 'Buy 3 Get 1 Free',
    condition_type: 'min_quantity',
    min_qty: 3,
    benefit_type: 'free_item',
    applicable_items: ['1', '2'],
    free_item_id: '1',
    active: true,
  },
  {
    id: '2',
    name: 'Gift Pack Discount',
    condition_type: 'min_quantity',
    min_qty: 2,
    benefit_type: 'percentage_discount',
    discount_value: 10,
    applicable_items: ['3', '4'],
    active: true,
  },
]

export const mockSaleItems = [
  // Sale 1 items
  { id: 'si1', sale_id: '1', catalogue_item_id: '1', catalogue_item_name: 'Cashew 100g', quantity: 3, unit_price: 90, cost_price_at_sale: 80, item_discount_amount: 0, line_total: 270, is_bundle: false, stock_deducted: true },
  { id: 'si2', sale_id: '1', catalogue_item_id: '6', catalogue_item_name: 'Date Box 250g', quantity: 1, unit_price: 180, cost_price_at_sale: 150, item_discount_amount: 0, line_total: 180, is_bundle: false, stock_deducted: true },
  // Sale 2 items
  { id: 'si3', sale_id: '2', catalogue_item_id: '3', catalogue_item_name: 'Fruit & Nut Pack 200g', quantity: 2, unit_price: 320, cost_price_at_sale: 250, item_discount_amount: 0, line_total: 640, is_bundle: true, stock_deducted: true },
  { id: 'si4', sale_id: '2', catalogue_item_id: '2', catalogue_item_name: 'Almond 100g', quantity: 4, unit_price: 80, cost_price_at_sale: 70, item_discount_amount: 0, line_total: 320, is_bundle: false, stock_deducted: true },
  { id: 'si5', sale_id: '2', catalogue_item_id: '1', catalogue_item_name: 'Cashew 100g', quantity: 2, unit_price: 90, cost_price_at_sale: 80, item_discount_amount: 0, line_total: 180, is_bundle: false, stock_deducted: true },
  { id: 'si6', sale_id: '2', catalogue_item_id: '5', catalogue_item_name: 'Consultation Service', quantity: 1, unit_price: 60, cost_price_at_sale: 0, item_discount_amount: 0, line_total: 60, is_bundle: false, stock_deducted: false },
  // Sale 3 items
  { id: 'si7', sale_id: '3', catalogue_item_id: '3', catalogue_item_name: 'Fruit & Nut Pack 200g', quantity: 1, unit_price: 320, cost_price_at_sale: 250, item_discount_amount: 0, line_total: 320, is_bundle: true, stock_deducted: true },
  // Sale 4 items
  { id: 'si8', sale_id: '4', catalogue_item_id: '4', catalogue_item_name: 'Mixed Dry Fruits 500g', quantity: 3, unit_price: 650, cost_price_at_sale: 480, item_discount_amount: 0, line_total: 1950, is_bundle: true, stock_deducted: true },
  { id: 'si9', sale_id: '4', catalogue_item_id: '1', catalogue_item_name: 'Cashew 100g', quantity: 5, unit_price: 90, cost_price_at_sale: 80, item_discount_amount: 0, line_total: 450, is_bundle: false, stock_deducted: true },
  // Sale 5 items
  { id: 'si10', sale_id: '5', catalogue_item_id: '2', catalogue_item_name: 'Almond 100g', quantity: 2, unit_price: 80, cost_price_at_sale: 70, item_discount_amount: 0, line_total: 160, is_bundle: false, stock_deducted: true },
  { id: 'si11', sale_id: '5', catalogue_item_id: '6', catalogue_item_name: 'Date Box 250g', quantity: 2, unit_price: 180, cost_price_at_sale: 150, item_discount_amount: 0, line_total: 360, is_bundle: false, stock_deducted: true },
  // Sale 6 items
  { id: 'si12', sale_id: '6', catalogue_item_id: '1', catalogue_item_name: 'Cashew 100g', quantity: 10, unit_price: 90, cost_price_at_sale: 80, item_discount_amount: 50, line_total: 850, is_bundle: false, stock_deducted: true },
  // Sale 7 items
  { id: 'si13', sale_id: '7', catalogue_item_id: '3', catalogue_item_name: 'Fruit & Nut Pack 200g', quantity: 4, unit_price: 320, cost_price_at_sale: 250, item_discount_amount: 0, line_total: 1280, is_bundle: true, stock_deducted: true },
  { id: 'si14', sale_id: '7', catalogue_item_id: '2', catalogue_item_name: 'Almond 100g', quantity: 3, unit_price: 80, cost_price_at_sale: 70, item_discount_amount: 0, line_total: 240, is_bundle: false, stock_deducted: true },
  { id: 'si15', sale_id: '7', catalogue_item_id: '6', catalogue_item_name: 'Date Box 250g', quantity: 1, unit_price: 180, cost_price_at_sale: 150, item_discount_amount: 0, line_total: 180, is_bundle: false, stock_deducted: true },
  // Sale 8 items
  { id: 'si16', sale_id: '8', catalogue_item_id: '4', catalogue_item_name: 'Mixed Dry Fruits 500g', quantity: 1, unit_price: 650, cost_price_at_sale: 480, item_discount_amount: 0, line_total: 650, is_bundle: true, stock_deducted: true },
]

export const mockSales = [
  { id: '1', user_id: 'mock-user-1', subtotal_amount: 450, bill_discount_amount: 0, final_amount: 450, payment_method: 'upi', sold_at: new Date().toISOString(), notes: '', customer_id: null, branch_id: null },
  { id: '2', user_id: 'mock-user-1', subtotal_amount: 1200, bill_discount_amount: 100, final_amount: 1100, payment_method: 'cash', sold_at: new Date(Date.now() - 3600000).toISOString(), notes: 'Regular customer', customer_id: 'c1', branch_id: null },
  { id: '3', user_id: 'mock-user-1', subtotal_amount: 320, bill_discount_amount: 0, final_amount: 320, payment_method: 'card', sold_at: new Date(Date.now() - 7200000).toISOString(), notes: '', customer_id: null, branch_id: null },
  { id: '4', user_id: 'mock-user-1', subtotal_amount: 2400, bill_discount_amount: 200, final_amount: 2200, payment_method: 'upi', sold_at: new Date(Date.now() - 86400000).toISOString(), notes: 'Bulk order — wedding', customer_id: 'c4', branch_id: null },
  { id: '5', user_id: 'mock-user-1', subtotal_amount: 520, bill_discount_amount: 0, final_amount: 520, payment_method: 'cash', sold_at: new Date(Date.now() - 86400000 - 3600000).toISOString(), notes: '', customer_id: 'c5', branch_id: null },
  { id: '6', user_id: 'mock-user-1', subtotal_amount: 900, bill_discount_amount: 50, final_amount: 850, payment_method: 'card', sold_at: new Date(Date.now() - 172800000).toISOString(), notes: 'Loyalty discount applied', customer_id: 'c1', branch_id: null },
  { id: '7', user_id: 'mock-user-1', subtotal_amount: 1700, bill_discount_amount: 0, final_amount: 1700, payment_method: 'upi', sold_at: new Date(Date.now() - 259200000).toISOString(), notes: '', customer_id: 'c2', branch_id: null },
  { id: '8', user_id: 'mock-user-1', subtotal_amount: 650, bill_discount_amount: 0, final_amount: 650, payment_method: 'cash', sold_at: new Date(Date.now() - 345600000).toISOString(), notes: '', customer_id: null, branch_id: null },
]

export const mockDashboardStats = {
  todayRevenue: 1870,
  todayTransactions: 3,
  todayProfit: 620,
  inventoryWorth: 284600,
  lowStockCount: 2,
  lowStockItems: [
    { name: 'Almonds', current_stock: 18, par_stock: 25, unit: 'KG' },
    { name: 'Dates', current_stock: 12, par_stock: 20, unit: 'KG' },
  ],
  topSellingItems: [
    { name: 'Fruit & Nut Pack 200g', quantity: 24, revenue: 7680 },
    { name: 'Cashew 100g', quantity: 38, revenue: 3420 },
    { name: 'Mixed Dry Fruits 500g', quantity: 11, revenue: 7150 },
    { name: 'Almond 100g', quantity: 29, revenue: 2320 },
    { name: 'Pistachio 50g', quantity: 18, revenue: 1980 },
  ],
}

export type MockCustomer = {
  id: string
  name: string
  phone: string
  description: string
  total_orders: number
  last_order_at: string | null
}

export const mockCustomers: MockCustomer[] = [
  { id: 'c1', name: 'Priya Sharma', phone: '9876543210', description: 'Regular — buys gift packs weekly', total_orders: 34, last_order_at: '2024-06-18T14:30:00Z' },
  { id: 'c2', name: 'Arun Patel', phone: '9845012345', description: 'Wholesale buyer — cashews & almonds', total_orders: 12, last_order_at: '2024-06-15T10:00:00Z' },
  { id: 'c3', name: 'Meena Krishnan', phone: '9900112233', description: 'Monthly bulk order for office', total_orders: 8, last_order_at: '2024-06-10T16:45:00Z' },
  { id: 'c4', name: 'Suresh Reddy', phone: '9988776655', description: 'Event caterer — seasonal orders', total_orders: 5, last_order_at: '2024-05-20T09:00:00Z' },
  { id: 'c5', name: 'Kavitha Nair', phone: '8877665544', description: 'Health-conscious — prefers organic mix', total_orders: 19, last_order_at: '2024-06-17T11:20:00Z' },
]

// ─── Purchases (Purchase Order module — UI-only mock data) ────────────────────

export interface MockSupplier {
  id: string
  name: string
  phone: string
  email: string
  notes: string
}

export const mockSuppliers: MockSupplier[] = [
  { id: 's1', name: 'Anand Traders', phone: '9840011223', email: 'anand.traders@example.com', notes: 'Reliable for cashews & almonds — 7-day credit' },
  { id: 's2', name: 'Coastal Nut Co.', phone: '9845566778', email: '', notes: 'Best price on bulk pistachios' },
  { id: 's3', name: 'Sundar Dry Fruits Wholesale', phone: '9900123456', email: 'sundar.wholesale@example.com', notes: 'Slow on delivery during festival season' },
]

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'

export interface MockPurchaseOrderItem {
  id: string
  item_name: string
  variant_label: string
  unit: string
  qty_ordered: number
  qty_received: number
  unit_cost: number
}

export interface MockPurchaseOrder {
  id: string
  po_number: string
  supplier_id: string
  branch: string
  order_date: string
  expected_date: string | null
  status: PurchaseOrderStatus
  notes: string
  items: MockPurchaseOrderItem[]
  created_at: string
}

export const mockPurchaseOrders: MockPurchaseOrder[] = [
  {
    id: 'po1',
    po_number: 'PO-0114',
    supplier_id: 's1',
    branch: 'Main Branch',
    order_date: '2024-06-20',
    expected_date: '2024-06-24',
    status: 'received',
    notes: '',
    items: [
      { id: 'poi1', item_name: 'Cashews', variant_label: '250g Pack', unit: 'KG', qty_ordered: 50, qty_received: 50, unit_cost: 620 },
      { id: 'poi2', item_name: 'Almonds', variant_label: '500g Pack', unit: 'KG', qty_ordered: 30, qty_received: 30, unit_cost: 540 },
    ],
    created_at: '2024-06-20T09:00:00Z',
  },
  {
    id: 'po2',
    po_number: 'PO-0115',
    supplier_id: 's2',
    branch: 'Main Branch',
    order_date: '2024-06-28',
    expected_date: '2024-07-02',
    status: 'partially_received',
    notes: 'Second half of pistachio order pending',
    items: [
      { id: 'poi3', item_name: 'Pistachios', variant_label: '250g Pack', unit: 'KG', qty_ordered: 40, qty_received: 20, unit_cost: 890 },
    ],
    created_at: '2024-06-28T11:30:00Z',
  },
  {
    id: 'po3',
    po_number: 'PO-0116',
    supplier_id: 's1',
    branch: 'Main Branch',
    order_date: '2024-07-05',
    expected_date: '2024-07-08',
    status: 'ordered',
    notes: '',
    items: [
      { id: 'poi4', item_name: 'Cashews', variant_label: '250g Pack', unit: 'KG', qty_ordered: 60, qty_received: 0, unit_cost: 635 },
      { id: 'poi5', item_name: 'Dates', variant_label: '—', unit: 'KG', qty_ordered: 25, qty_received: 0, unit_cost: 210 },
    ],
    created_at: '2024-07-05T08:15:00Z',
  },
  {
    id: 'po4',
    po_number: 'PO-0117',
    supplier_id: 's3',
    branch: 'Main Branch',
    order_date: '2024-07-10',
    expected_date: null,
    status: 'draft',
    notes: 'Waiting on vendor price confirmation',
    items: [
      { id: 'poi6', item_name: 'Raisins', variant_label: '—', unit: 'KG', qty_ordered: 20, qty_received: 0, unit_cost: 260 },
    ],
    created_at: '2024-07-10T15:00:00Z',
  },
]

export { formatINR } from './utils/format'
