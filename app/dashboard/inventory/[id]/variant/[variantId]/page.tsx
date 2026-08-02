'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Package, ShoppingCart, Layers, TrendingUp, Search, Filter, ChevronDown, Check, Plus, X, Pencil } from 'lucide-react'
import { formatINR, formatDateShort } from '@/lib/utils/format'
import type { InventoryItemWithDetails } from '@/lib/services/inventory'
import type { VariantWithDetails } from '@/lib/services/variants'
import type { BatchWithSupplier } from '@/lib/services/batches'
import type { MovementWithBranch } from '@/lib/services/movements'
import Pagination from '@/components/ui/Pagination'
import styles from '../variant.module.css'

const PAGE_SIZE = 10

type Tab = 'stock' | 'purchases' | 'consumption' | 'analytics'

const DEADSTOCK_DAYS = 45

function daysSince(isoDate: string) {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
}

// ─── Stock filter config (same chip-based pattern as /dashboard/inventory) ──

const STOCK_FILTER_DEFS = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'status', label: 'Stock Status' },
  { key: 'date', label: 'Date' },
] as const

type StockFilterKey = typeof STOCK_FILTER_DEFS[number]['key']

const STOCK_STATUS_OPTIONS = [
  { value: 'deadstock', label: 'Deadstock' },
  { value: 'fresh', label: 'Fresh' },
] as const

const PURCHASE_FILTER_DEFS = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'date', label: 'Date' },
] as const

type PurchaseFilterKey = typeof PURCHASE_FILTER_DEFS[number]['key']

const CONSUMPTION_FILTER_DEFS = [
  { key: 'source', label: 'Source' },
  { key: 'date', label: 'Date' },
] as const

type ConsumptionFilterKey = typeof CONSUMPTION_FILTER_DEFS[number]['key']

// Matches the real movement_type enum (minus 'purchase', which the
// Purchase History tab already covers via inventory_batches).
const CONSUMPTION_SOURCE_OPTIONS = [
  { value: 'sale', label: 'POS Sale' },
  { value: 'manual_adjustment', label: 'Stock Adjustment' },
  { value: 'waste', label: 'Waste / Damage' },
] as const

const CONSUMPTION_SOURCE_BADGE: Record<string, string> = {
  sale: 'success',
  manual_adjustment: 'warning',
  waste: 'danger',
}

// ─── Date range filter — shared by Current Stock, Purchase History, Consumption ──

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
] as const

function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function applyDatePreset(
  preset: string,
  setPreset: (v: string) => void,
  setFrom: (v: string) => void,
  setTo: (v: string) => void
) {
  setPreset(preset)
  const now = new Date()
  const today = getStartOfDay(now)

  if (preset === 'today') {
    setFrom(today.toISOString().slice(0, 10))
    setTo(now.toISOString().slice(0, 10))
  } else if (preset === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    setFrom(yesterday.toISOString().slice(0, 10))
    setTo(yesterday.toISOString().slice(0, 10))
  } else if (preset === 'last7') {
    const d = new Date(today)
    d.setDate(d.getDate() - 7)
    setFrom(d.toISOString().slice(0, 10))
    setTo(now.toISOString().slice(0, 10))
  } else if (preset === 'last30') {
    const d = new Date(today)
    d.setDate(d.getDate() - 30)
    setFrom(d.toISOString().slice(0, 10))
    setTo(now.toISOString().slice(0, 10))
  }
}

function matchesDateRange(isoDate: string, dateFrom: string, dateTo: string): boolean {
  const d = new Date(isoDate)
  if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false
  if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
  return true
}

function dateFilterDisplayText(datePreset: string, dateFrom: string, dateTo: string): string {
  if (!datePreset) return 'Any'
  if (datePreset === 'custom') {
    if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`
    if (dateFrom) return `From ${dateFrom}`
    if (dateTo) return `Until ${dateTo}`
    return 'Custom'
  }
  return DATE_PRESETS.find(p => p.value === datePreset)?.label ?? 'Any'
}

function DateFilterChip({
  isOpen, onToggle, onRemove, onBackdropClick,
  datePreset, dateFrom, dateTo, onPresetSelect, onDateFromChange, onDateToChange,
}: {
  isOpen: boolean
  onToggle: () => void
  onRemove: () => void
  onBackdropClick: () => void
  datePreset: string
  dateFrom: string
  dateTo: string
  onPresetSelect: (preset: string) => void
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
}) {
  const displayText = dateFilterDisplayText(datePreset, dateFrom, dateTo)

  return (
    <div className={styles.filterChipWrap}>
      <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
        <button className={styles.filterChipMain} onClick={onToggle}>
          <span className={styles.filterChipLabel}>Date</span>
          <span className={`${styles.filterChipValues}${datePreset ? ` ${styles.filterChipValuesActive}` : ''}`}>
            {displayText}
          </span>
          <ChevronDown size={11} className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`} />
        </button>
        <button className={styles.filterChipRemove} onClick={onRemove} title="Remove Date filter">
          <X size={11} />
        </button>
      </div>

      {isOpen && (
        <>
          <div className={styles.filterBackdrop} onClick={onBackdropClick} />
          <div className={`${styles.valueDropdown} ${styles.dateValueDropdown}`}>
            <div className={styles.datePresets}>
              {DATE_PRESETS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.valueOption}${datePreset === opt.value ? ` ${styles.valueOptionChecked}` : ''}`}
                  onClick={() => onPresetSelect(opt.value)}
                >
                  <span className={styles.valueOptionCheck}>
                    {datePreset === opt.value && <Check size={10} />}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <>
                <div className={styles.dateFilterRow}>
                  <label>From</label>
                  <input type="date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} />
                </div>
                <div className={styles.dateFilterRow}>
                  <label>To</label>
                  <input type="date" value={dateTo} onChange={e => onDateToChange(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function VariantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string
  const variantId = params.variantId as string

  // ── Real data ─────────────────────────────────────────────────────────────
  const [item, setItem] = useState<InventoryItemWithDetails | null>(null)
  const [itemLoading, setItemLoading] = useState(true)
  const [itemLoadError, setItemLoadError] = useState('')

  const [variant, setVariant] = useState<VariantWithDetails | null>(null)
  const [variantLoading, setVariantLoading] = useState(true)
  const [variantLoadError, setVariantLoadError] = useState('')

  const [batches, setBatches] = useState<BatchWithSupplier[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [batchesLoadError, setBatchesLoadError] = useState('')

  const [movements, setMovements] = useState<MovementWithBranch[]>([])
  const [movementsLoading, setMovementsLoading] = useState(true)
  const [movementsLoadError, setMovementsLoadError] = useState('')

  async function loadItem() {
    setItemLoading(true)
    setItemLoadError('')
    try {
      const res = await fetch(`/api/inventory/${itemId}`)
      const body = await res.json()
      if (!res.ok) { setItemLoadError(body.error || 'Product not found'); setItem(null); return }
      setItem(body.data)
    } catch {
      setItemLoadError('Could not load the product. Please check your connection.')
    } finally {
      setItemLoading(false)
    }
  }

  async function loadVariant() {
    setVariantLoading(true)
    setVariantLoadError('')
    try {
      const res = await fetch(`/api/inventory/${itemId}/variants`)
      const body = await res.json()
      if (!res.ok) { setVariantLoadError(body.error || 'Variant not found'); setVariant(null); return }
      const found = (body.data as VariantWithDetails[]).find(v => v.id === variantId) ?? null
      if (!found) { setVariantLoadError('Variant not found'); setVariant(null); return }
      setVariant(found)
    } catch {
      setVariantLoadError('Could not load the variant. Please check your connection.')
    } finally {
      setVariantLoading(false)
    }
  }

  async function loadBatches() {
    setBatchesLoading(true)
    setBatchesLoadError('')
    try {
      const res = await fetch(`/api/inventory/${itemId}/variants/${variantId}/batches`)
      const body = await res.json()
      if (!res.ok) { setBatchesLoadError(body.error || 'Could not load stock history.'); return }
      setBatches(body.data)
    } catch {
      setBatchesLoadError('Could not load stock history. Please check your connection.')
    } finally {
      setBatchesLoading(false)
    }
  }

  async function loadMovements() {
    setMovementsLoading(true)
    setMovementsLoadError('')
    try {
      const res = await fetch(`/api/inventory/${itemId}/variants/${variantId}/movements`)
      const body = await res.json()
      if (!res.ok) { setMovementsLoadError(body.error || 'Could not load consumption history.'); return }
      setMovements(body.data)
    } catch {
      setMovementsLoadError('Could not load consumption history. Please check your connection.')
    } finally {
      setMovementsLoading(false)
    }
  }

  useEffect(() => { loadItem() }, [itemId])
  useEffect(() => { loadVariant() }, [itemId, variantId])
  useEffect(() => { loadBatches() }, [itemId, variantId])
  useEffect(() => { loadMovements() }, [itemId, variantId])

  const [activeTab, setActiveTab] = useState<Tab>('stock')
  const [stockSearch, setStockSearch] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [vendorFilters, setVendorFilters] = useState<string[]>([])
  const [activeStockFilterTypes, setActiveStockFilterTypes] = useState<StockFilterKey[]>([])
  const [stockFilterTypeDropdownOpen, setStockFilterTypeDropdownOpen] = useState(false)
  const [addStockFilterDropdownOpen, setAddStockFilterDropdownOpen] = useState(false)
  const [openStockValueDropdown, setOpenStockValueDropdown] = useState<StockFilterKey | null>(null)
  const [stockDatePreset, setStockDatePreset] = useState('')
  const [stockDateFrom, setStockDateFrom] = useState('')
  const [stockDateTo, setStockDateTo] = useState('')
  const [stockPage, setStockPage] = useState(1)

  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [purchaseVendorFilters, setPurchaseVendorFilters] = useState<string[]>([])
  const [activePurchaseFilterTypes, setActivePurchaseFilterTypes] = useState<PurchaseFilterKey[]>([])
  const [purchaseFilterTypeDropdownOpen, setPurchaseFilterTypeDropdownOpen] = useState(false)
  const [addPurchaseFilterDropdownOpen, setAddPurchaseFilterDropdownOpen] = useState(false)
  const [openPurchaseValueDropdown, setOpenPurchaseValueDropdown] = useState<PurchaseFilterKey | null>(null)
  const [purchaseDatePreset, setPurchaseDatePreset] = useState('')
  const [purchaseDateFrom, setPurchaseDateFrom] = useState('')
  const [purchaseDateTo, setPurchaseDateTo] = useState('')
  const [purchasePage, setPurchasePage] = useState(1)

  const [consumptionSearch, setConsumptionSearch] = useState('')
  const [consumptionSourceFilters, setConsumptionSourceFilters] = useState<string[]>([])
  const [activeConsumptionFilterTypes, setActiveConsumptionFilterTypes] = useState<ConsumptionFilterKey[]>([])
  const [consumptionFilterTypeDropdownOpen, setConsumptionFilterTypeDropdownOpen] = useState(false)
  const [addConsumptionFilterDropdownOpen, setAddConsumptionFilterDropdownOpen] = useState(false)
  const [openConsumptionValueDropdown, setOpenConsumptionValueDropdown] = useState<ConsumptionFilterKey | null>(null)
  const [consumptionDatePreset, setConsumptionDatePreset] = useState('')
  const [consumptionDateFrom, setConsumptionDateFrom] = useState('')
  const [consumptionDateTo, setConsumptionDateTo] = useState('')
  const [consumptionPage, setConsumptionPage] = useState(1)

  const displayName = item
    ? `${item.name}${variant?.variant_code ? ` — ${variant.variant_code}` : ''}`
    : 'Variant'

  // ── Current Stock — batches still holding quantity ────────────────────────
  const stockLots = useMemo(() => {
    return batches
      .filter(b => b.quantity_remaining > 0)
      .map(b => ({ ...b, isDeadStock: daysSince(b.received_at) > DEADSTOCK_DAYS }))
  }, [batches])

  const stockVendors = useMemo(
    () => Array.from(new Set(batches.map(b => b.supplier_name).filter((v): v is string => !!v))),
    [batches]
  )

  const filteredStockLots = useMemo(() => {
    return [...stockLots].filter(lot => {
      if (statusFilters.length > 0) {
        const matchesStatus = statusFilters.includes(lot.isDeadStock ? 'deadstock' : 'fresh')
        if (!matchesStatus) return false
      }
      if (vendorFilters.length > 0 && (!lot.supplier_name || !vendorFilters.includes(lot.supplier_name))) return false
      if ((stockDateFrom || stockDateTo) && !matchesDateRange(lot.received_at, stockDateFrom, stockDateTo)) return false
      if (!stockSearch) return true
      const q = stockSearch.toLowerCase()
      return (lot.supplier_name ?? '').toLowerCase().includes(q) || (lot.batch_number ?? '').toLowerCase().includes(q)
    })
  }, [stockLots, stockSearch, statusFilters, vendorFilters, stockDateFrom, stockDateTo])

  useEffect(() => { setStockPage(1) }, [stockSearch, statusFilters, vendorFilters, stockDateFrom, stockDateTo])

  const stockTotalPages = Math.max(1, Math.ceil(filteredStockLots.length / PAGE_SIZE))
  const clampedStockPage = Math.min(stockPage, stockTotalPages)
  const pagedStockLots = filteredStockLots.slice((clampedStockPage - 1) * PAGE_SIZE, clampedStockPage * PAGE_SIZE)

  const activeStockFilterCount = activeStockFilterTypes.length

  function addStockFilterType(key: StockFilterKey) {
    setActiveStockFilterTypes(prev => prev.includes(key) ? prev : [...prev, key])
    setOpenStockValueDropdown(key)
    setStockFilterTypeDropdownOpen(false)
    setAddStockFilterDropdownOpen(false)
  }

  function removeStockFilterType(key: StockFilterKey) {
    setActiveStockFilterTypes(prev => prev.filter(k => k !== key))
    if (key === 'vendor') setVendorFilters([])
    if (key === 'status') setStatusFilters([])
    if (key === 'date') { setStockDatePreset(''); setStockDateFrom(''); setStockDateTo('') }
    if (openStockValueDropdown === key) setOpenStockValueDropdown(null)
  }

  function clearAllStockFilters() {
    setActiveStockFilterTypes([])
    setVendorFilters([])
    setStatusFilters([])
    setStockDatePreset('')
    setStockDateFrom('')
    setStockDateTo('')
    setOpenStockValueDropdown(null)
    setStockSearch('')
  }

  // ── Purchase History — every batch ever recorded ──────────────────────────
  const filteredPurchaseHistory = useMemo(() => {
    return [...batches].filter(b => {
      if (purchaseVendorFilters.length > 0 && (!b.supplier_name || !purchaseVendorFilters.includes(b.supplier_name))) return false
      if ((purchaseDateFrom || purchaseDateTo) && !matchesDateRange(b.received_at, purchaseDateFrom, purchaseDateTo)) return false
      if (!purchaseSearch) return true
      return (b.supplier_name ?? '').toLowerCase().includes(purchaseSearch.toLowerCase())
    })
  }, [batches, purchaseVendorFilters, purchaseSearch, purchaseDateFrom, purchaseDateTo])

  useEffect(() => { setPurchasePage(1) }, [purchaseSearch, purchaseVendorFilters, purchaseDateFrom, purchaseDateTo])

  const purchaseTotalPages = Math.max(1, Math.ceil(filteredPurchaseHistory.length / PAGE_SIZE))
  const clampedPurchasePage = Math.min(purchasePage, purchaseTotalPages)
  const pagedPurchaseHistory = filteredPurchaseHistory.slice((clampedPurchasePage - 1) * PAGE_SIZE, clampedPurchasePage * PAGE_SIZE)

  const activePurchaseFilterCount = activePurchaseFilterTypes.length

  function addPurchaseFilterType(key: PurchaseFilterKey) {
    setActivePurchaseFilterTypes(prev => prev.includes(key) ? prev : [...prev, key])
    setOpenPurchaseValueDropdown(key)
    setPurchaseFilterTypeDropdownOpen(false)
    setAddPurchaseFilterDropdownOpen(false)
  }

  function removePurchaseFilterType(key: PurchaseFilterKey) {
    setActivePurchaseFilterTypes(prev => prev.filter(k => k !== key))
    if (key === 'vendor') setPurchaseVendorFilters([])
    if (key === 'date') { setPurchaseDatePreset(''); setPurchaseDateFrom(''); setPurchaseDateTo('') }
    if (openPurchaseValueDropdown === key) setOpenPurchaseValueDropdown(null)
  }

  function clearAllPurchaseFilters() {
    setActivePurchaseFilterTypes([])
    setPurchaseVendorFilters([])
    setPurchaseDatePreset('')
    setPurchaseDateFrom('')
    setPurchaseDateTo('')
    setOpenPurchaseValueDropdown(null)
    setPurchaseSearch('')
  }

  // ── Consumption — real stock_movements (empty until logging is built) ─────
  const filteredConsumptionEvents = useMemo(() => {
    return [...movements].filter(e => {
      if (consumptionSourceFilters.length > 0 && !consumptionSourceFilters.includes(e.movement_type)) return false
      if ((consumptionDateFrom || consumptionDateTo) && !matchesDateRange(e.created_at, consumptionDateFrom, consumptionDateTo)) return false
      if (!consumptionSearch) return true
      const ref = `${e.reference_type ?? ''} ${e.reference_id ?? ''}`.toLowerCase()
      return ref.includes(consumptionSearch.toLowerCase())
    })
  }, [movements, consumptionSourceFilters, consumptionSearch, consumptionDateFrom, consumptionDateTo])

  useEffect(() => { setConsumptionPage(1) }, [consumptionSearch, consumptionSourceFilters, consumptionDateFrom, consumptionDateTo])

  const consumptionTotalPages = Math.max(1, Math.ceil(filteredConsumptionEvents.length / PAGE_SIZE))
  const clampedConsumptionPage = Math.min(consumptionPage, consumptionTotalPages)
  const pagedConsumptionEvents = filteredConsumptionEvents.slice((clampedConsumptionPage - 1) * PAGE_SIZE, clampedConsumptionPage * PAGE_SIZE)

  const activeConsumptionFilterCount = activeConsumptionFilterTypes.length

  function addConsumptionFilterType(key: ConsumptionFilterKey) {
    setActiveConsumptionFilterTypes(prev => prev.includes(key) ? prev : [...prev, key])
    setOpenConsumptionValueDropdown(key)
    setConsumptionFilterTypeDropdownOpen(false)
    setAddConsumptionFilterDropdownOpen(false)
  }

  function removeConsumptionFilterType(key: ConsumptionFilterKey) {
    setActiveConsumptionFilterTypes(prev => prev.filter(k => k !== key))
    if (key === 'source') setConsumptionSourceFilters([])
    if (key === 'date') { setConsumptionDatePreset(''); setConsumptionDateFrom(''); setConsumptionDateTo('') }
    if (openConsumptionValueDropdown === key) setOpenConsumptionValueDropdown(null)
  }

  function clearAllConsumptionFilters() {
    setActiveConsumptionFilterTypes([])
    setConsumptionSourceFilters([])
    setConsumptionDatePreset('')
    setConsumptionDateFrom('')
    setConsumptionDateTo('')
    setOpenConsumptionValueDropdown(null)
    setConsumptionSearch('')
  }

  // ── Analytics — derived from real batches, oldest first for the trend ─────
  const batchesAsc = useMemo(
    () => [...batches].sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()),
    [batches]
  )

  const latestCost = batchesAsc.length > 0 ? batchesAsc[batchesAsc.length - 1].purchase_price : 0
  const prevCost = batchesAsc.length > 1 ? batchesAsc[batchesAsc.length - 2].purchase_price : latestCost
  const avgCost = batchesAsc.length > 0
    ? Math.round(batchesAsc.reduce((s, b) => s + b.purchase_price, 0) / batchesAsc.length)
    : 0
  const minCost = batchesAsc.length > 0 ? Math.min(...batchesAsc.map(b => b.purchase_price)) : 0
  const maxCost = batchesAsc.length > 0 ? Math.max(...batchesAsc.map(b => b.purchase_price)) : 0
  const trendPct = prevCost > 0 ? Math.round(((latestCost - prevCost) / prevCost) * 100) : 0
  const maxChartCost = Math.max(1, ...batchesAsc.map(b => b.purchase_price))

  const vendorStats = useMemo(() => {
    const byVendor = new Map<string, { qty: number; totalCost: number; count: number }>()
    batches.forEach(b => {
      const vendor = b.supplier_name ?? 'No vendor recorded'
      const cur = byVendor.get(vendor) ?? { qty: 0, totalCost: 0, count: 0 }
      cur.qty += b.quantity_received
      cur.totalCost += b.quantity_received * b.purchase_price
      cur.count += 1
      byVendor.set(vendor, cur)
    })
    return Array.from(byVendor.entries()).map(([vendor, s]) => ({
      vendor,
      orders: s.count,
      avgCost: s.qty > 0 ? Math.round(s.totalCost / s.qty) : 0,
      totalQty: s.qty,
    }))
  }, [batches])

  // ── Early returns: loading / not found ────────────────────────────────────

  if (itemLoading || variantLoading) {
    return (
      <div>
        <button className={styles.backArrow} onClick={() => router.push(`/dashboard/inventory/${itemId}`)} title="Back to item">
          <ArrowLeft size={18} />
        </button>
        <div className="empty-state">
          <p className="empty-state__desc">Loading variant…</p>
        </div>
      </div>
    )
  }

  if (!item || !variant) {
    return (
      <div>
        <button className={styles.backArrow} onClick={() => router.push(`/dashboard/inventory/${itemId}`)} title="Back to item">
          <ArrowLeft size={18} />
        </button>
        <div className="empty-state">
          <p className="empty-state__title">{!item ? 'Product not found' : 'Variant not found'}</p>
          <p className="empty-state__desc">{itemLoadError || variantLoadError || 'This item does not exist.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <button className={styles.backArrow} onClick={() => router.push(`/dashboard/inventory/${itemId}`)} title="Back to item">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.variantTitle}>{displayName}</h1>
            <div className={styles.variantMeta}>
              {variant.variant_code && <span className={styles.variantCode}>{variant.variant_code}</span>}
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{item.category_name ?? 'Uncategorized'}</span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{variant.current_stock} {item.unit_name} in stock</span>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn--outline" disabled title="Coming soon — consumption logging isn't built yet">
            <Layers size={14} />
            Consumption
          </button>
          <button className="btn btn--outline" disabled title="Coming soon">
            <Pencil size={14} />
            Edit Variant
          </button>
        </div>
      </div>

      {/* Variant summary bar */}
      <div className={styles.variantSummaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Variant</span>
          <span className={styles.summaryValue}>{variant.variant_code || 'Unnamed'}</span>
        </div>

        {item.attribute_names.length > 0 && (
          <>
            <span className={styles.summaryDivider} />
            <div className={`${styles.summaryItem} ${styles.summaryItemAttrs}`}>
              <span className={styles.summaryLabel}>Attributes</span>
              <span
                className={styles.summaryAttrsText}
                title={item.attribute_names.map((attr, i) => `${attr}: ${variant.attribute_values[i] || '—'}`).join(' · ')}
              >
                {item.attribute_names.map((attr, i) => `${attr}: ${variant.attribute_values[i] || '—'}`).join(' · ')}
              </span>
            </div>
          </>
        )}

        <span className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Qty</span>
          <span className={styles.summaryValue}>{variant.current_stock} {item.unit_name}</span>
        </div>

        <span className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Selling / Unit</span>
          <span className={styles.summaryValue}>
            {variant.selling_price != null ? formatINR(variant.selling_price) : 'Not set'}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button className={`${styles.tabBtn} ${activeTab === 'stock' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('stock')}>
          <Package size={14} style={{ marginRight: 6 }} /> Current Stock
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'purchases' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('purchases')}>
          <ShoppingCart size={14} style={{ marginRight: 6 }} /> Purchase History
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'consumption' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('consumption')}>
          <Layers size={14} style={{ marginRight: 6 }} /> Consumption
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'analytics' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('analytics')}>
          <TrendingUp size={14} style={{ marginRight: 6 }} /> Analytics
        </button>
      </div>

      {/* Current Stock */}
      {activeTab === 'stock' && (
        <div>
          <div className={styles.stockFiltersRow}>
            <div className={styles.stockSearchWrap}>
              <Search size={14} className={styles.stockSearchIcon} />
              <input
                className={`form-input ${styles.stockSearchInput}`}
                placeholder="Search by vendor or batch #..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
              />
            </div>

            <div className={styles.stockFilterWrap}>
              <button
                className={`btn btn--ghost ${styles.filterBtn}${activeStockFilterCount > 0 ? ` ${styles.filterBtnActive}` : ''}`}
                onClick={() => { setStockFilterTypeDropdownOpen(v => !v); setAddStockFilterDropdownOpen(false) }}
              >
                <Filter size={14} />
                Filter
                {activeStockFilterCount > 0 && (
                  <span className={styles.filterBadge}>{activeStockFilterCount}</span>
                )}
              </button>
              {stockFilterTypeDropdownOpen && (
                <>
                  <div className={styles.filterBackdrop} onClick={() => setStockFilterTypeDropdownOpen(false)} />
                  <div className={styles.filterDropdown}>
                    {STOCK_FILTER_DEFS.map(f => (
                      <button
                        key={f.key}
                        className={`${styles.filterOption}${activeStockFilterTypes.includes(f.key) ? ` ${styles.filterOptionActive}` : ''}`}
                        onClick={() => addStockFilterType(f.key)}
                      >
                        {f.label}
                        {activeStockFilterTypes.includes(f.key) && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {(activeStockFilterTypes.length > 0 || stockSearch) && (
            <div className={styles.resultSummaryRow}>
              <span className={styles.resultSummary}>
                <strong>{filteredStockLots.length}</strong> {filteredStockLots.length === 1 ? 'lot' : 'lots'}
                <span className={styles.resultSummarySep}>•</span>
              </span>

              {activeStockFilterTypes.map(key => {
                const isOpen = openStockValueDropdown === key

                if (key === 'vendor') {
                  const displayText =
                    vendorFilters.length === 0 ? 'Any'
                      : vendorFilters.length === 1 ? vendorFilters[0]
                      : `${vendorFilters.length} selected`

                  return (
                    <div key={key} className={styles.filterChipWrap}>
                      <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                        <button
                          className={styles.filterChipMain}
                          onClick={() => setOpenStockValueDropdown(prev => prev === key ? null : key)}
                        >
                          <span className={styles.filterChipLabel}>Vendor</span>
                          <span className={`${styles.filterChipValues}${vendorFilters.length > 0 ? ` ${styles.filterChipValuesActive}` : ''}`}>
                            {displayText}
                          </span>
                          <ChevronDown
                            size={11}
                            className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`}
                          />
                        </button>
                        <button
                          className={styles.filterChipRemove}
                          onClick={() => removeStockFilterType(key)}
                          title="Remove Vendor filter"
                        >
                          <X size={11} />
                        </button>
                      </div>

                      {isOpen && (
                        <>
                          <div className={styles.filterBackdrop} onClick={() => setOpenStockValueDropdown(null)} />
                          <div className={styles.valueDropdown}>
                            {stockVendors.map(vendor => {
                              const checked = vendorFilters.includes(vendor)
                              return (
                                <button
                                  key={vendor}
                                  className={`${styles.valueOption}${checked ? ` ${styles.valueOptionChecked}` : ''}`}
                                  onClick={() => {
                                    setVendorFilters(prev =>
                                      prev.includes(vendor) ? prev.filter(v => v !== vendor) : [...prev, vendor]
                                    )
                                  }}
                                >
                                  <span className={styles.valueOptionCheck}>
                                    {checked && <Check size={10} />}
                                  </span>
                                  {vendor}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                }

                if (key === 'date') {
                  return (
                    <DateFilterChip
                      key={key}
                      isOpen={isOpen}
                      onToggle={() => setOpenStockValueDropdown(prev => prev === key ? null : key)}
                      onRemove={() => removeStockFilterType(key)}
                      onBackdropClick={() => setOpenStockValueDropdown(null)}
                      datePreset={stockDatePreset}
                      dateFrom={stockDateFrom}
                      dateTo={stockDateTo}
                      onPresetSelect={preset => applyDatePreset(preset, setStockDatePreset, setStockDateFrom, setStockDateTo)}
                      onDateFromChange={setStockDateFrom}
                      onDateToChange={setStockDateTo}
                    />
                  )
                }

                const displayText =
                  statusFilters.length === 0 ? 'Any'
                    : statusFilters.length === 1
                      ? STOCK_STATUS_OPTIONS.find(o => o.value === statusFilters[0])?.label ?? statusFilters[0]
                      : `${statusFilters.length} selected`

                return (
                  <div key={key} className={styles.filterChipWrap}>
                    <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                      <button
                        className={styles.filterChipMain}
                        onClick={() => setOpenStockValueDropdown(prev => prev === key ? null : key)}
                      >
                        <span className={styles.filterChipLabel}>Stock Status</span>
                        <span className={`${styles.filterChipValues}${statusFilters.length > 0 ? ` ${styles.filterChipValuesActive}` : ''}`}>
                          {displayText}
                        </span>
                        <ChevronDown
                          size={11}
                          className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`}
                        />
                      </button>
                      <button
                        className={styles.filterChipRemove}
                        onClick={() => removeStockFilterType(key)}
                        title="Remove Stock Status filter"
                      >
                        <X size={11} />
                      </button>
                    </div>

                    {isOpen && (
                      <>
                        <div className={styles.filterBackdrop} onClick={() => setOpenStockValueDropdown(null)} />
                        <div className={styles.valueDropdown}>
                          {STOCK_STATUS_OPTIONS.map(opt => {
                            const checked = statusFilters.includes(opt.value)
                            return (
                              <button
                                key={opt.value}
                                className={`${styles.valueOption}${checked ? ` ${styles.valueOptionChecked}` : ''}`}
                                onClick={() => {
                                  setStatusFilters(prev =>
                                    prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                                  )
                                }}
                              >
                                <span className={styles.valueOptionCheck}>
                                  {checked && <Check size={10} />}
                                </span>
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {stockSearch && (
                <button className={styles.filterChip} onClick={() => setStockSearch('')} title="Clear search">
                  <span className={styles.filterChipLabel}>Search:</span>
                  <span className={styles.filterChipValue}>{stockSearch}</span>
                  <X size={12} />
                </button>
              )}

              {STOCK_FILTER_DEFS.some(f => !activeStockFilterTypes.includes(f.key)) && activeStockFilterTypes.length > 0 && (
                <div className={styles.addFilterWrap}>
                  <button
                    className={styles.addFilterBtn}
                    onClick={() => { setAddStockFilterDropdownOpen(v => !v); setStockFilterTypeDropdownOpen(false) }}
                  >
                    <Plus size={12} />
                    Add Filter
                  </button>
                  {addStockFilterDropdownOpen && (
                    <>
                      <div className={styles.filterBackdrop} onClick={() => setAddStockFilterDropdownOpen(false)} />
                      <div className={styles.filterDropdown}>
                        {STOCK_FILTER_DEFS.filter(f => !activeStockFilterTypes.includes(f.key)).map(f => (
                          <button
                            key={f.key}
                            className={styles.filterOption}
                            onClick={() => addStockFilterType(f.key)}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <button className={styles.filterClearAll} onClick={clearAllStockFilters}>
                Clear all
              </button>
            </div>
          )}

          <div className={styles.panel}>
            {batchesLoading ? (
              <div className="empty-state">
                <p className="empty-state__desc">Loading stock…</p>
              </div>
            ) : batchesLoadError ? (
              <div className="empty-state">
                <p className="empty-state__title">Could not load stock</p>
                <p className="empty-state__desc">{batchesLoadError}</p>
              </div>
            ) : filteredStockLots.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">No stock lots found</p>
                <p className="empty-state__desc">
                  {stockSearch || activeStockFilterCount > 0 ? 'Try adjusting your search or filter' : 'Stock lots will appear here once purchases are received'}
                </p>
              </div>
            ) : (
              <table className={`data-table ${styles.stockLotsTable}`}>
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Vendor</th>
                    <th>Qty Remaining</th>
                    <th>Batch #</th>
                    <th>Unit Cost</th>
                    <th>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStockLots.map(lot => (
                    <tr key={lot.id}>
                      <td>
                        <div className={styles.purchaseDateCell}>
                          <span>{formatDateShort(lot.received_at)}</span>
                          <span className={styles.daysChip}>{daysSince(lot.received_at)}d ago</span>
                        </div>
                      </td>
                      <td>{lot.supplier_name ?? <span className="text-tertiary">—</span>}</td>
                      <td>
                        <div className={styles.qtyCell}>
                          <span>{lot.quantity_remaining} {item.unit_name}</span>
                          {lot.isDeadStock && <span className="badge badge--danger">Deadstock</span>}
                        </div>
                      </td>
                      <td>{lot.batch_number ?? <span className="text-tertiary">—</span>}</td>
                      <td>{formatINR(lot.purchase_price)}</td>
                      <td>{formatINR(lot.quantity_remaining * lot.purchase_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination
              page={clampedStockPage}
              totalItems={filteredStockLots.length}
              pageSize={PAGE_SIZE}
              onPageChange={setStockPage}
              itemLabel="lots"
            />
          </div>
        </div>
      )}

      {/* Purchase History */}
      {activeTab === 'purchases' && (
        <div>
          <div className={styles.stockFiltersRow}>
            <div className={styles.stockSearchWrap}>
              <Search size={14} className={styles.stockSearchIcon} />
              <input
                className={`form-input ${styles.stockSearchInput}`}
                placeholder="Search by vendor..."
                value={purchaseSearch}
                onChange={e => setPurchaseSearch(e.target.value)}
              />
            </div>

            <div className={styles.stockFilterWrap}>
              <button
                className={`btn btn--ghost ${styles.filterBtn}${activePurchaseFilterCount > 0 ? ` ${styles.filterBtnActive}` : ''}`}
                onClick={() => { setPurchaseFilterTypeDropdownOpen(v => !v); setAddPurchaseFilterDropdownOpen(false) }}
              >
                <Filter size={14} />
                Filter
                {activePurchaseFilterCount > 0 && (
                  <span className={styles.filterBadge}>{activePurchaseFilterCount}</span>
                )}
              </button>
              {purchaseFilterTypeDropdownOpen && (
                <>
                  <div className={styles.filterBackdrop} onClick={() => setPurchaseFilterTypeDropdownOpen(false)} />
                  <div className={styles.filterDropdown}>
                    {PURCHASE_FILTER_DEFS.map(f => (
                      <button
                        key={f.key}
                        className={`${styles.filterOption}${activePurchaseFilterTypes.includes(f.key) ? ` ${styles.filterOptionActive}` : ''}`}
                        onClick={() => addPurchaseFilterType(f.key)}
                      >
                        {f.label}
                        {activePurchaseFilterTypes.includes(f.key) && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {(activePurchaseFilterTypes.length > 0 || purchaseSearch) && (
            <div className={styles.resultSummaryRow}>
              <span className={styles.resultSummary}>
                <strong>{filteredPurchaseHistory.length}</strong> {filteredPurchaseHistory.length === 1 ? 'purchase' : 'purchases'}
                <span className={styles.resultSummarySep}>•</span>
              </span>

              {activePurchaseFilterTypes.map(key => {
                const isOpen = openPurchaseValueDropdown === key

                if (key === 'date') {
                  return (
                    <DateFilterChip
                      key={key}
                      isOpen={isOpen}
                      onToggle={() => setOpenPurchaseValueDropdown(prev => prev === key ? null : key)}
                      onRemove={() => removePurchaseFilterType(key)}
                      onBackdropClick={() => setOpenPurchaseValueDropdown(null)}
                      datePreset={purchaseDatePreset}
                      dateFrom={purchaseDateFrom}
                      dateTo={purchaseDateTo}
                      onPresetSelect={preset => applyDatePreset(preset, setPurchaseDatePreset, setPurchaseDateFrom, setPurchaseDateTo)}
                      onDateFromChange={setPurchaseDateFrom}
                      onDateToChange={setPurchaseDateTo}
                    />
                  )
                }

                const displayText =
                  purchaseVendorFilters.length === 0 ? 'Any'
                    : purchaseVendorFilters.length === 1 ? purchaseVendorFilters[0]
                    : `${purchaseVendorFilters.length} selected`

                return (
                  <div key={key} className={styles.filterChipWrap}>
                    <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                      <button
                        className={styles.filterChipMain}
                        onClick={() => setOpenPurchaseValueDropdown(prev => prev === key ? null : key)}
                      >
                        <span className={styles.filterChipLabel}>Vendor</span>
                        <span className={`${styles.filterChipValues}${purchaseVendorFilters.length > 0 ? ` ${styles.filterChipValuesActive}` : ''}`}>
                          {displayText}
                        </span>
                        <ChevronDown
                          size={11}
                          className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`}
                        />
                      </button>
                      <button
                        className={styles.filterChipRemove}
                        onClick={() => removePurchaseFilterType(key)}
                        title="Remove Vendor filter"
                      >
                        <X size={11} />
                      </button>
                    </div>

                    {isOpen && (
                      <>
                        <div className={styles.filterBackdrop} onClick={() => setOpenPurchaseValueDropdown(null)} />
                        <div className={styles.valueDropdown}>
                          {stockVendors.map(vendor => {
                            const checked = purchaseVendorFilters.includes(vendor)
                            return (
                              <button
                                key={vendor}
                                className={`${styles.valueOption}${checked ? ` ${styles.valueOptionChecked}` : ''}`}
                                onClick={() => {
                                  setPurchaseVendorFilters(prev =>
                                    prev.includes(vendor) ? prev.filter(v => v !== vendor) : [...prev, vendor]
                                  )
                                }}
                              >
                                <span className={styles.valueOptionCheck}>
                                  {checked && <Check size={10} />}
                                </span>
                                {vendor}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {purchaseSearch && (
                <button className={styles.filterChip} onClick={() => setPurchaseSearch('')} title="Clear search">
                  <span className={styles.filterChipLabel}>Search:</span>
                  <span className={styles.filterChipValue}>{purchaseSearch}</span>
                  <X size={12} />
                </button>
              )}

              {PURCHASE_FILTER_DEFS.some(f => !activePurchaseFilterTypes.includes(f.key)) && activePurchaseFilterTypes.length > 0 && (
                <div className={styles.addFilterWrap}>
                  <button
                    className={styles.addFilterBtn}
                    onClick={() => { setAddPurchaseFilterDropdownOpen(v => !v); setPurchaseFilterTypeDropdownOpen(false) }}
                  >
                    <Plus size={12} />
                    Add Filter
                  </button>
                  {addPurchaseFilterDropdownOpen && (
                    <>
                      <div className={styles.filterBackdrop} onClick={() => setAddPurchaseFilterDropdownOpen(false)} />
                      <div className={styles.filterDropdown}>
                        {PURCHASE_FILTER_DEFS.filter(f => !activePurchaseFilterTypes.includes(f.key)).map(f => (
                          <button
                            key={f.key}
                            className={styles.filterOption}
                            onClick={() => addPurchaseFilterType(f.key)}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <button className={styles.filterClearAll} onClick={clearAllPurchaseFilters}>
                Clear all
              </button>
            </div>
          )}

          <div className={styles.panel}>
            {batchesLoading ? (
              <div className="empty-state">
                <p className="empty-state__desc">Loading purchases…</p>
              </div>
            ) : batchesLoadError ? (
              <div className="empty-state">
                <p className="empty-state__title">Could not load purchases</p>
                <p className="empty-state__desc">{batchesLoadError}</p>
              </div>
            ) : filteredPurchaseHistory.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">No purchases found</p>
                <p className="empty-state__desc">
                  {purchaseSearch || activePurchaseFilterCount > 0 ? 'Try adjusting your search or filter' : 'Purchases will appear here once received'}
                </p>
              </div>
            ) : (
              <table className={`data-table ${styles.purchaseHistoryTable}`}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Qty Received</th>
                    <th>Unit Cost</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPurchaseHistory.map(b => (
                    <tr key={b.id}>
                      <td>{formatDateShort(b.received_at)}</td>
                      <td>{b.supplier_name ?? <span className="text-tertiary">—</span>}</td>
                      <td>{b.quantity_received}</td>
                      <td>{formatINR(b.purchase_price)}</td>
                      <td>{formatINR(b.quantity_received * b.purchase_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination
              page={clampedPurchasePage}
              totalItems={filteredPurchaseHistory.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPurchasePage}
              itemLabel="purchases"
            />
          </div>
        </div>
      )}

      {/* Consumption */}
      {activeTab === 'consumption' && (
        <div>
          <div className={styles.stockFiltersRow}>
            <div className={styles.stockSearchWrap}>
              <Search size={14} className={styles.stockSearchIcon} />
              <input
                className={`form-input ${styles.stockSearchInput}`}
                placeholder="Search by reference..."
                value={consumptionSearch}
                onChange={e => setConsumptionSearch(e.target.value)}
              />
            </div>

            <span className={styles.consumptionTotal}>
              Total consumed: {filteredConsumptionEvents.reduce((s, e) => s + Math.abs(e.quantity_change), 0)} {item.unit_name}
            </span>

            <div className={styles.stockFilterWrap}>
              <button
                className={`btn btn--ghost ${styles.filterBtn}${activeConsumptionFilterCount > 0 ? ` ${styles.filterBtnActive}` : ''}`}
                onClick={() => { setConsumptionFilterTypeDropdownOpen(v => !v); setAddConsumptionFilterDropdownOpen(false) }}
              >
                <Filter size={14} />
                Filter
                {activeConsumptionFilterCount > 0 && (
                  <span className={styles.filterBadge}>{activeConsumptionFilterCount}</span>
                )}
              </button>
              {consumptionFilterTypeDropdownOpen && (
                <>
                  <div className={styles.filterBackdrop} onClick={() => setConsumptionFilterTypeDropdownOpen(false)} />
                  <div className={styles.filterDropdown}>
                    {CONSUMPTION_FILTER_DEFS.map(f => (
                      <button
                        key={f.key}
                        className={`${styles.filterOption}${activeConsumptionFilterTypes.includes(f.key) ? ` ${styles.filterOptionActive}` : ''}`}
                        onClick={() => addConsumptionFilterType(f.key)}
                      >
                        {f.label}
                        {activeConsumptionFilterTypes.includes(f.key) && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {(activeConsumptionFilterTypes.length > 0 || consumptionSearch) && (
            <div className={styles.resultSummaryRow}>
              <span className={styles.resultSummary}>
                <strong>{filteredConsumptionEvents.length}</strong> {filteredConsumptionEvents.length === 1 ? 'entry' : 'entries'}
                <span className={styles.resultSummarySep}>•</span>
              </span>

              {activeConsumptionFilterTypes.map(key => {
                const isOpen = openConsumptionValueDropdown === key

                if (key === 'date') {
                  return (
                    <DateFilterChip
                      key={key}
                      isOpen={isOpen}
                      onToggle={() => setOpenConsumptionValueDropdown(prev => prev === key ? null : key)}
                      onRemove={() => removeConsumptionFilterType(key)}
                      onBackdropClick={() => setOpenConsumptionValueDropdown(null)}
                      datePreset={consumptionDatePreset}
                      dateFrom={consumptionDateFrom}
                      dateTo={consumptionDateTo}
                      onPresetSelect={preset => applyDatePreset(preset, setConsumptionDatePreset, setConsumptionDateFrom, setConsumptionDateTo)}
                      onDateFromChange={setConsumptionDateFrom}
                      onDateToChange={setConsumptionDateTo}
                    />
                  )
                }

                const displayText =
                  consumptionSourceFilters.length === 0 ? 'Any'
                    : consumptionSourceFilters.length === 1
                      ? CONSUMPTION_SOURCE_OPTIONS.find(o => o.value === consumptionSourceFilters[0])?.label ?? consumptionSourceFilters[0]
                      : `${consumptionSourceFilters.length} selected`

                return (
                  <div key={key} className={styles.filterChipWrap}>
                    <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                      <button
                        className={styles.filterChipMain}
                        onClick={() => setOpenConsumptionValueDropdown(prev => prev === key ? null : key)}
                      >
                        <span className={styles.filterChipLabel}>Source</span>
                        <span className={`${styles.filterChipValues}${consumptionSourceFilters.length > 0 ? ` ${styles.filterChipValuesActive}` : ''}`}>
                          {displayText}
                        </span>
                        <ChevronDown
                          size={11}
                          className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`}
                        />
                      </button>
                      <button
                        className={styles.filterChipRemove}
                        onClick={() => removeConsumptionFilterType(key)}
                        title="Remove Source filter"
                      >
                        <X size={11} />
                      </button>
                    </div>

                    {isOpen && (
                      <>
                        <div className={styles.filterBackdrop} onClick={() => setOpenConsumptionValueDropdown(null)} />
                        <div className={styles.valueDropdown}>
                          {CONSUMPTION_SOURCE_OPTIONS.map(opt => {
                            const checked = consumptionSourceFilters.includes(opt.value)
                            return (
                              <button
                                key={opt.value}
                                className={`${styles.valueOption}${checked ? ` ${styles.valueOptionChecked}` : ''}`}
                                onClick={() => {
                                  setConsumptionSourceFilters(prev =>
                                    prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                                  )
                                }}
                              >
                                <span className={styles.valueOptionCheck}>
                                  {checked && <Check size={10} />}
                                </span>
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {consumptionSearch && (
                <button className={styles.filterChip} onClick={() => setConsumptionSearch('')} title="Clear search">
                  <span className={styles.filterChipLabel}>Search:</span>
                  <span className={styles.filterChipValue}>{consumptionSearch}</span>
                  <X size={12} />
                </button>
              )}

              <button className={styles.filterClearAll} onClick={clearAllConsumptionFilters}>
                Clear all
              </button>
            </div>
          )}

          <div className={styles.panel}>
            {movementsLoading ? (
              <div className="empty-state">
                <p className="empty-state__desc">Loading consumption history…</p>
              </div>
            ) : movementsLoadError ? (
              <div className="empty-state">
                <p className="empty-state__title">Could not load consumption history</p>
                <p className="empty-state__desc">{movementsLoadError}</p>
              </div>
            ) : filteredConsumptionEvents.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">No consumption records found</p>
                <p className="empty-state__desc">
                  {consumptionSearch || activeConsumptionFilterCount > 0
                    ? 'Try adjusting your search or filter'
                    : 'Consumption logging isn’t built yet, so nothing will appear here until it is.'}
                </p>
              </div>
            ) : (
              <table className={`data-table ${styles.consumptionTable}`}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Source</th>
                    <th>Qty Consumed</th>
                    <th>Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedConsumptionEvents.map(e => (
                    <tr key={e.id} title={e.notes ?? undefined}>
                      <td>{formatDateShort(e.created_at)}</td>
                      <td className={styles.barcodeText}>{e.reference_type ? `${e.reference_type} ${e.reference_id ?? ''}`.trim() : '—'}</td>
                      <td>
                        <span className={`badge badge--${CONSUMPTION_SOURCE_BADGE[e.movement_type] ?? 'neutral'}`}>
                          {CONSUMPTION_SOURCE_OPTIONS.find(o => o.value === e.movement_type)?.label ?? e.movement_type}
                        </span>
                      </td>
                      <td>{Math.abs(e.quantity_change)} {item.unit_name}</td>
                      <td>{e.branch_name ?? <span className="text-tertiary">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination
              page={clampedConsumptionPage}
              totalItems={filteredConsumptionEvents.length}
              pageSize={PAGE_SIZE}
              onPageChange={setConsumptionPage}
              itemLabel="entries"
            />
          </div>
        </div>
      )}

      {/* Analytics */}
      {activeTab === 'analytics' && (
        <div>
          <div className={styles.metricRow}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Latest Cost</span>
              <span className={styles.metricValue}>{formatINR(latestCost)}</span>
              <span className={`${styles.metricSub} ${styles.priceTrend} ${trendPct > 0 ? styles.priceUp : trendPct < 0 ? styles.priceDown : styles.priceFlat}`}>
                {trendPct > 0 ? '▲' : trendPct < 0 ? '▼' : '—'} {Math.abs(trendPct)}% vs last purchase
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Average Cost</span>
              <span className={styles.metricValue}>{formatINR(avgCost)}</span>
              <span className={styles.metricSub}>across {batchesAsc.length} purchase{batchesAsc.length === 1 ? '' : 's'}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Lowest Cost</span>
              <span className={styles.metricValue}>{formatINR(minCost)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Highest Cost</span>
              <span className={styles.metricValue}>{formatINR(maxCost)}</span>
            </div>
          </div>

          <div className={styles.panel} style={{ marginBottom: 'var(--space-5)' }}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Cost Trend</span>
            </div>
            {batchesAsc.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__desc">Cost trend will appear here once purchases are recorded.</p>
              </div>
            ) : (
              <div className={styles.chartWrap}>
                {batchesAsc.map(b => (
                  <div key={b.id} className={styles.chartBarCol}>
                    <span className={styles.chartBarValue}>{formatINR(b.purchase_price)}</span>
                    <div className={styles.chartBar} style={{ height: `${(b.purchase_price / maxChartCost) * 100}%` }} />
                    <span className={styles.chartBarLabel}>{formatDateShort(b.received_at, { withYear: false })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Vendor Comparison</span>
            </div>
            {vendorStats.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__desc">Vendor comparison will appear here once purchases are recorded.</p>
              </div>
            ) : (
              <table className={`data-table ${styles.vendorCompareTable}`}>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                    <th style={{ textAlign: 'right' }}>Total Qty Supplied</th>
                    <th style={{ textAlign: 'right' }}>Avg. Cost / Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vendorStats].sort((a, b) => a.avgCost - b.avgCost).map(v => (
                    <tr key={v.vendor}>
                      <td>{v.vendor}</td>
                      <td style={{ textAlign: 'right' }}>{v.orders}</td>
                      <td style={{ textAlign: 'right' }}>{v.totalQty}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(v.avgCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
