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

export const mockInventoryItems = [
  {
    id: '1',
    user_id: 'mock-user-1',
    name: 'Cashews',
    category: 'Nuts',
    unit: 'KG',
    current_stock: 120,
    par_stock: 50,
    cost_price: 800,
    mrp: 1200,
    availability_status: 'active',
    notes: '',
    attributes: ['Grade', 'Roast'],
    variants: [
      { id: 'v1', code: 'CSH-320-P', attributes: ['W320', 'Plain'], quantity: 30 },
      { id: 'v2', code: 'CSH-320-R', attributes: ['W320', 'Roasted'], quantity: 30 },
      { id: 'v3', code: 'CSH-240-P', attributes: ['W240', 'Plain'], quantity: 30 },
      { id: 'v4', code: 'CSH-240-R', attributes: ['W240', 'Roasted'], quantity: 30 },
    ],
    created_at: '2024-01-15T10:00:00Z',
    supplier_id: null,
    branch_id: null
  },
  {
    id: '2',
    user_id: 'mock-user-1',
    name: 'Almonds',
    category: 'Nuts',
    unit: 'KG',
    current_stock: 18,
    par_stock: 25,
    cost_price: 700,
    mrp: 1100,
    availability_status: 'active',
    notes: 'Reorder soon',
    attributes: ['Origin', 'Type'],
    variants: [
      { id: 'v5', code: 'ALM-CAL-R', attributes: ['California', 'Raw'], quantity: 5 },
      { id: 'v6', code: 'ALM-CAL-B', attributes: ['California', 'Blanched'], quantity: 5 },
      { id: 'v7', code: 'ALM-GUR-R', attributes: ['Gurbandi', 'Raw'], quantity: 4 },
      { id: 'v8', code: 'ALM-GUR-B', attributes: ['Gurbandi', 'Blanched'], quantity: 4 },
    ],
    created_at: '2024-01-16T10:00:00Z',
    supplier_id: null,
    branch_id: null
  },
  {
    id: '3',
    user_id: 'mock-user-1',
    name: 'Pistachios',
    category: 'Nuts',
    unit: 'KG',
    current_stock: 80,
    par_stock: 20,
    cost_price: 1200,
    mrp: 1800,
    availability_status: 'active',
    notes: '',
    attributes: ['Origin', 'Type'],
    variants: [
      { id: 'v9', code: 'PST-IRN-R', attributes: ['Iranian', 'Roasted'], quantity: 40 },
      { id: 'v10', code: 'PST-IRN-S', attributes: ['Iranian', 'Salted'], quantity: 40 },
    ],
    created_at: '2024-01-17T10:00:00Z',
    supplier_id: null,
    branch_id: null
  },
  {
    id: '4',
    user_id: 'mock-user-1',
    name: 'Raisins',
    category: 'Dry Fruits',
    unit: 'KG',
    current_stock: 45,
    par_stock: 30,
    cost_price: 300,
    mrp: 500,
    availability_status: 'active',
    notes: '',
    attributes: ['Type', 'Color'],
    variants: [
      { id: 'v11', code: 'RSN-SL-GR', attributes: ['Seedless', 'Green'], quantity: 15 },
      { id: 'v12', code: 'RSN-SL-GD', attributes: ['Seedless', 'Golden'], quantity: 20 },
      { id: 'v13', code: 'RSN-SD-GD', attributes: ['Seeded', 'Golden'], quantity: 10 },
    ],
    created_at: '2024-01-18T10:00:00Z',
    supplier_id: null,
    branch_id: null
  },
  { id: '5', user_id: 'mock-user-1', name: 'Walnuts', category: 'Nuts', unit: 'KG', current_stock: 0, par_stock: 15, cost_price: 900, mrp: 1400, availability_status: 'discontinued', notes: 'Supplier unavailable', attributes: ['California', 'In-shell', 'Grade B', 'Halves', 'Shelled'], created_at: '2024-01-19T10:00:00Z', supplier_id: null, branch_id: null },
  {
    id: '6',
    user_id: 'mock-user-1',
    name: 'Dates',
    category: 'Dry Fruits',
    unit: 'KG',
    current_stock: 12,
    par_stock: 20,
    cost_price: 250,
    mrp: 400,
    availability_status: 'active',
    notes: '',
    attributes: ['Variety', 'Processing'],
    variants: [
      { id: 'v14', code: 'DT-MDJ-PT', attributes: ['Medjool', 'Pitted'], quantity: 4 },
      { id: 'v15', code: 'DT-MDJ-WH', attributes: ['Medjool', 'Whole'], quantity: 4 },
      { id: 'v16', code: 'DT-AJW-PT', attributes: ['Ajwa', 'Pitted'], quantity: 4 },
    ],
    created_at: '2024-01-20T10:00:00Z',
    supplier_id: null,
    branch_id: null
  },
]

export const mockCategories: Category[] = [
  { id: '1', user_id: 'mock-user-1', name: 'Nuts', parent_id: null, is_archived: false, sort_order: 0, created_at: '2024-01-15T10:00:00Z' },
  { id: '2', user_id: 'mock-user-1', name: 'Dry Fruits', parent_id: null, is_archived: false, sort_order: 1, created_at: '2024-01-15T10:00:00Z' },
  { id: '3', user_id: 'mock-user-1', name: 'Gift Packs', parent_id: null, is_archived: false, sort_order: 2, created_at: '2024-01-15T10:00:00Z' },
  { id: '4', user_id: 'mock-user-1', name: 'Loose Items', parent_id: null, is_archived: false, sort_order: 3, created_at: '2024-01-15T10:00:00Z' },
  { id: '5', user_id: 'mock-user-1', name: 'Cashew Variants', parent_id: '1', is_archived: false, sort_order: 0, created_at: '2024-01-15T10:00:00Z' },
  { id: '6', user_id: 'mock-user-1', name: 'Almond Variants', parent_id: '1', is_archived: false, sort_order: 1, created_at: '2024-01-15T10:00:00Z' },
]

export const mockUnits: Unit[] = [
  { id: 'u1', user_id: 'mock-user-1', name: 'KG', allow_decimal: true, is_locked: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'u2', user_id: 'mock-user-1', name: 'Grams', allow_decimal: false, is_locked: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'u3', user_id: 'mock-user-1', name: 'Litres', allow_decimal: true, is_locked: false, created_at: '2024-01-15T10:00:00Z' },
  { id: 'u4', user_id: 'mock-user-1', name: 'Pieces', allow_decimal: false, is_locked: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'u5', user_id: 'mock-user-1', name: 'ML', allow_decimal: false, is_locked: false, created_at: '2024-01-15T10:00:00Z' },
]

export const mockUnitConversions: UnitConversion[] = [
  { id: 'uc1', user_id: 'mock-user-1', from_unit_id: 'u1', to_unit_id: 'u2', factor: 1000, created_at: '2024-01-15T10:00:00Z' },
  { id: 'uc2', user_id: 'mock-user-1', from_unit_id: 'u3', to_unit_id: 'u5', factor: 1000, created_at: '2024-01-15T10:00:00Z' },
]

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

export const mockSales = [
  { id: '1', user_id: 'mock-user-1', subtotal_amount: 450, bill_discount_amount: 0, final_amount: 450, payment_method: 'upi', sold_at: new Date().toISOString(), notes: '', customer_id: null, branch_id: null },
  { id: '2', user_id: 'mock-user-1', subtotal_amount: 1200, bill_discount_amount: 100, final_amount: 1100, payment_method: 'cash', sold_at: new Date(Date.now() - 3600000).toISOString(), notes: 'Regular customer', customer_id: null, branch_id: null },
  { id: '3', user_id: 'mock-user-1', subtotal_amount: 320, bill_discount_amount: 0, final_amount: 320, payment_method: 'card', sold_at: new Date(Date.now() - 7200000).toISOString(), notes: '', customer_id: null, branch_id: null },
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

export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
