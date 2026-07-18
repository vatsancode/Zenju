'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Package, ShoppingCart, Layers, TrendingUp, Search, Printer, Filter, ChevronDown, Check, Plus, X, Pencil } from 'lucide-react'
import { mockInventoryItems, mockSuppliers, mockUser, formatINR, formatDateShort } from '@/lib/mock-data'
import Pagination from '@/components/ui/Pagination'
import styles from '../variant.module.css'

const PAGE_SIZE = 10

type Tab = 'stock' | 'purchases' | 'consumption' | 'analytics'

// Local shape matching the records the Inventory pages build up in session state —
// kept independent of types/database.ts since this is a UI-only mock build.
interface LocalVariant { id: string; code: string; name?: string; attributes: string[]; quantity: number }
interface LocalItem {
  id: string
  name: string
  category: string
  unit: string
  cost_price: number
  mrp: number
  notes: string | null
  attributes: string[]
  variants?: LocalVariant[]
}

// Deterministic pseudo-random generator seeded from a string — keeps demo
// numbers stable across renders/navigations without needing shared state.
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

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

const TAX_RATE = 0.05

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

const CONSUMPTION_SOURCE_OPTIONS = [
  { value: 'sale', label: 'POS Sale' },
  { value: 'used', label: 'Used' },
  { value: 'adjustment', label: 'Stock Adjustment' },
  { value: 'waste', label: 'Waste / Damage' },
  { value: 'transfer', label: 'Branch Transfer' },
] as const

const CONSUMPTION_SOURCE_BADGE: Record<string, string> = {
  sale: 'success',
  used: 'info',
  adjustment: 'warning',
  waste: 'danger',
  transfer: 'neutral',
}

// ─── Log Consumption popup — mark a batch as used/waste/adjustment/transfer ──

const LOG_CONSUMPTION_TYPES = [
  { value: 'used', label: 'Used' },
  { value: 'waste', label: 'Waste / Damage' },
  { value: 'adjustment', label: 'Stock Adjustment' },
  { value: 'transfer', label: 'Transfer to Branch' },
] as const

type LogConsumptionType = typeof LOG_CONSUMPTION_TYPES[number]['value']

interface ConsumptionEvent {
  eventId: string
  date: string
  qty: number
  source: string
  reference: string
  branch: string
  notes?: string
  performedBy?: string
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

  const item = (mockInventoryItems as unknown as LocalItem[]).find(i => i.id === itemId) ?? null
  const variant = item?.variants?.find(v => v.id === variantId) ?? null

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

  const [loggedConsumptionEvents, setLoggedConsumptionEvents] = useState<ConsumptionEvent[]>([])
  const [showLogConsumptionModal, setShowLogConsumptionModal] = useState(false)
  const [logLotId, setLogLotId] = useState('')
  const [logQty, setLogQty] = useState<number | ''>('')
  const [logType, setLogType] = useState<LogConsumptionType>('used')
  const [logTransferBranch, setLogTransferBranch] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logPerformedBy, setLogPerformedBy] = useState(mockUser.name)
  const [logError, setLogError] = useState('')

  const displayName = item
    ? `${item.name}${variant?.code ? ` — ${variant.code}` : ''}`
    : 'Variant'

  // ── Demo data, deterministically generated from the variant/item id ──────
  const rand = useMemo(() => seededRandom(variantId || itemId || 'demo'), [variantId, itemId])

  const baseCost = item?.cost_price && item.cost_price > 0 ? item.cost_price : 400 + Math.round(rand() * 300)
  const sellingPrice = item?.mrp && item.mrp > 0 ? item.mrp : Math.round(baseCost * 1.3)

  const purchaseHistory = useMemo(() => {
    const now = Date.now()
    const entries: { date: string; vendor: string; qty: number; unit_cost: number }[] = []
    let cost = baseCost * 0.9
    for (let i = 5; i >= 0; i--) {
      cost = cost * (0.96 + rand() * 0.12)
      const vendor = mockSuppliers[Math.floor(rand() * mockSuppliers.length)]
      entries.push({
        date: new Date(now - i * 22 * 86400000).toISOString(),
        vendor: vendor?.name ?? 'Unknown vendor',
        qty: 10 + Math.round(rand() * 40),
        unit_cost: Math.round(cost),
      })
    }
    return entries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCost, rand])

  const stockLots = useMemo(() => {
    return purchaseHistory.map((p, i) => ({
      ...p,
      barcode: `890${String(Math.floor(rand() * 1_000_000_000)).padStart(9, '0')}`,
      isDeadStock: daysSince(p.date) > DEADSTOCK_DAYS,
      lotId: `${variantId || itemId}-${i}`,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseHistory])

  const stockVendors = useMemo(
    () => Array.from(new Set(stockLots.map(l => l.vendor))),
    [stockLots]
  )

  const filteredStockLots = useMemo(() => {
    return [...stockLots].reverse().filter(lot => {
      if (statusFilters.length > 0) {
        const matchesStatus = statusFilters.includes(lot.isDeadStock ? 'deadstock' : 'fresh')
        if (!matchesStatus) return false
      }
      if (vendorFilters.length > 0 && !vendorFilters.includes(lot.vendor)) return false
      if ((stockDateFrom || stockDateTo) && !matchesDateRange(lot.date, stockDateFrom, stockDateTo)) return false
      if (!stockSearch) return true
      const q = stockSearch.toLowerCase()
      return lot.vendor.toLowerCase().includes(q) || lot.barcode.includes(q)
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

  const purchaseHistoryWithTax = useMemo(() => {
    return purchaseHistory.map((p, i) => {
      const subtotal = p.qty * p.unit_cost
      const tax = Math.round(subtotal * TAX_RATE)
      return { ...p, subtotal, tax, total: subtotal + tax, purchaseId: `${variantId || itemId}-ph-${i}` }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseHistory])

  const filteredPurchaseHistory = useMemo(() => {
    return [...purchaseHistoryWithTax].reverse().filter(p => {
      if (purchaseVendorFilters.length > 0 && !purchaseVendorFilters.includes(p.vendor)) return false
      if ((purchaseDateFrom || purchaseDateTo) && !matchesDateRange(p.date, purchaseDateFrom, purchaseDateTo)) return false
      if (!purchaseSearch) return true
      return p.vendor.toLowerCase().includes(purchaseSearch.toLowerCase())
    })
  }, [purchaseHistoryWithTax, purchaseVendorFilters, purchaseSearch, purchaseDateFrom, purchaseDateTo])

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

  const generatedConsumptionEvents = useMemo((): ConsumptionEvent[] => {
    const now = Date.now()
    const sources = ['sale', 'sale', 'sale', 'adjustment', 'waste'] as const
    return Array.from({ length: 18 }).map((_, i) => {
      const source = sources[Math.floor(rand() * sources.length)]
      const prefix = source === 'sale' ? 'SALE' : source === 'adjustment' ? 'ADJ' : 'WASTE'
      return {
        eventId: `${variantId || itemId}-cons-${i}`,
        date: new Date(now - i * 9 * 86400000 - Math.round(rand() * 5 * 86400000)).toISOString(),
        qty: 1 + Math.round(rand() * 9),
        source,
        reference: `${prefix}-${1000 + Math.floor(rand() * 9000)}`,
        branch: 'Main Branch',
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rand])

  const consumptionEvents = useMemo(
    () => [...loggedConsumptionEvents, ...generatedConsumptionEvents],
    [loggedConsumptionEvents, generatedConsumptionEvents]
  )

  const filteredConsumptionEvents = useMemo(() => {
    return [...consumptionEvents].sort((a, b) => b.date.localeCompare(a.date)).filter(e => {
      if (consumptionSourceFilters.length > 0 && !consumptionSourceFilters.includes(e.source)) return false
      if ((consumptionDateFrom || consumptionDateTo) && !matchesDateRange(e.date, consumptionDateFrom, consumptionDateTo)) return false
      if (!consumptionSearch) return true
      return e.reference.toLowerCase().includes(consumptionSearch.toLowerCase())
    })
  }, [consumptionEvents, consumptionSourceFilters, consumptionSearch, consumptionDateFrom, consumptionDateTo])

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

  const selectedLogLot = stockLots.find(l => l.lotId === logLotId) ?? null

  function openLogConsumptionModal() {
    setLogLotId(stockLots[0]?.lotId ?? '')
    setLogQty('')
    setLogType('used')
    setLogTransferBranch('')
    setLogNotes('')
    setLogPerformedBy(mockUser.name)
    setLogError('')
    setShowLogConsumptionModal(true)
  }

  function closeLogConsumptionModal() {
    setShowLogConsumptionModal(false)
  }

  function handleLogConsumption() {
    if (!selectedLogLot) { setLogError('Please select a batch.'); return }
    if (!logQty || Number(logQty) <= 0) { setLogError('Enter a quantity greater than 0.'); return }
    if (Number(logQty) > selectedLogLot.qty) { setLogError(`Only ${selectedLogLot.qty} ${item?.unit ?? ''} available in this batch.`); return }
    if (logType === 'transfer' && !logTransferBranch) { setLogError('Select a destination branch.'); return }

    const prefix = logType === 'used' ? 'USED' : logType === 'waste' ? 'WASTE' : logType === 'adjustment' ? 'ADJ' : 'XFER'
    const newEvent: ConsumptionEvent = {
      eventId: `manual-${Date.now()}`,
      date: new Date().toISOString(),
      qty: Number(logQty),
      source: logType,
      reference: `${prefix}-${selectedLogLot.barcode.slice(-4)}`,
      branch: logType === 'transfer' ? logTransferBranch : 'Main Branch',
      notes: logNotes.trim() || undefined,
      performedBy: logPerformedBy.trim() || mockUser.name,
    }

    setLoggedConsumptionEvents(prev => [newEvent, ...prev])
    closeLogConsumptionModal()
    setActiveTab('consumption')
  }

  const latestCost = purchaseHistory[purchaseHistory.length - 1]?.unit_cost ?? baseCost
  const prevCost = purchaseHistory[purchaseHistory.length - 2]?.unit_cost ?? latestCost
  const avgCost = Math.round(purchaseHistory.reduce((s, p) => s + p.unit_cost, 0) / purchaseHistory.length)
  const minCost = Math.min(...purchaseHistory.map(p => p.unit_cost))
  const maxCost = Math.max(...purchaseHistory.map(p => p.unit_cost))
  const trendPct = prevCost > 0 ? Math.round(((latestCost - prevCost) / prevCost) * 100) : 0

  const vendorStats = useMemo(() => {
    const byVendor = new Map<string, { qty: number; totalCost: number; count: number }>()
    purchaseHistory.forEach(p => {
      const cur = byVendor.get(p.vendor) ?? { qty: 0, totalCost: 0, count: 0 }
      cur.qty += p.qty
      cur.totalCost += p.qty * p.unit_cost
      cur.count += 1
      byVendor.set(p.vendor, cur)
    })
    return Array.from(byVendor.entries()).map(([vendor, s]) => ({
      vendor,
      orders: s.count,
      avgCost: Math.round(s.totalCost / s.qty),
      totalQty: s.qty,
    }))
  }, [purchaseHistory])

  const maxChartCost = Math.max(...purchaseHistory.map(p => p.unit_cost))

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
              {variant?.code && <span className={styles.variantCode}>{variant.code}</span>}
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{item?.category ?? 'Uncategorized'}</span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{variant?.quantity ?? 0} {item?.unit ?? 'units'} in stock</span>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn--outline" onClick={openLogConsumptionModal}>
            <Layers size={14} />
            Consumption
          </button>
          <button className="btn btn--outline">
            <Pencil size={14} />
            Edit Variant
          </button>
        </div>
      </div>

      {/* Variant summary bar */}
      <div className={styles.variantSummaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Variant</span>
          <span className={styles.summaryValue}>{variant?.name || 'Unnamed'}</span>
        </div>

        {(item?.attributes ?? []).length > 0 && (
          <>
            <span className={styles.summaryDivider} />
            <div className={`${styles.summaryItem} ${styles.summaryItemAttrs}`}>
              <span className={styles.summaryLabel}>Attributes</span>
              <span
                className={styles.summaryAttrsText}
                title={(item?.attributes ?? []).map((attr, i) => `${attr}: ${variant?.attributes[i] || '—'}`).join(' · ')}
              >
                {(item?.attributes ?? []).map((attr, i) => `${attr}: ${variant?.attributes[i] || '—'}`).join(' · ')}
              </span>
            </div>
          </>
        )}

        <span className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Qty</span>
          <span className={styles.summaryValue}>{variant?.quantity ?? 0} {item?.unit ?? ''}</span>
        </div>

        <span className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Selling / Unit</span>
          <span className={styles.summaryValue}>{formatINR(sellingPrice)}</span>
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
                placeholder="Search by vendor or barcode..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
              />
            </div>

            {/* Filter button — opens type-selection dropdown */}
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

          {/* Active filter bar — shown when any filter/search is active */}
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

                // Stock Status filter
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

              {/* Search chip */}
              {stockSearch && (
                <button className={styles.filterChip} onClick={() => setStockSearch('')} title="Clear search">
                  <span className={styles.filterChipLabel}>Search:</span>
                  <span className={styles.filterChipValue}>{stockSearch}</span>
                  <X size={12} />
                </button>
              )}

              {/* + Add Filter */}
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
            {filteredStockLots.length === 0 ? (
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
                    <th>Purchase Date</th>
                    <th>Vendor</th>
                    <th>Qty</th>
                    <th>Barcode</th>
                    <th>Unit Cost</th>
                    <th>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStockLots.map(lot => (
                    <tr key={lot.lotId}>
                      <td>
                        <div className={styles.purchaseDateCell}>
                          <span>{formatDateShort(lot.date)}</span>
                          <span className={styles.daysChip}>{daysSince(lot.date)}d ago</span>
                        </div>
                      </td>
                      <td>{lot.vendor}</td>
                      <td>
                        <div className={styles.qtyCell}>
                          <span>{lot.qty} {item?.unit ?? ''}</span>
                          {lot.isDeadStock && <span className="badge badge--danger">Deadstock</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.barcodeCell}>
                          <span className={styles.barcodeText}>{lot.barcode}</span>
                          <button type="button" className={styles.printBtn} title="Print barcode">
                            <Printer size={13} />
                          </button>
                        </div>
                      </td>
                      <td>{formatINR(lot.unit_cost)}</td>
                      <td>{formatINR(lot.qty * lot.unit_cost)}</td>
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

            {/* Filter button — opens type-selection dropdown */}
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

          {/* Active filter bar — shown when any filter/search is active */}
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

                // Vendor filter
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

              {/* Search chip */}
              {purchaseSearch && (
                <button className={styles.filterChip} onClick={() => setPurchaseSearch('')} title="Clear search">
                  <span className={styles.filterChipLabel}>Search:</span>
                  <span className={styles.filterChipValue}>{purchaseSearch}</span>
                  <X size={12} />
                </button>
              )}

              {/* + Add Filter */}
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
            {filteredPurchaseHistory.length === 0 ? (
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
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th>Tax</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPurchaseHistory.map(p => (
                    <tr key={p.purchaseId}>
                      <td>{formatDateShort(p.date)}</td>
                      <td>{p.vendor}</td>
                      <td>{p.qty}</td>
                      <td>{formatINR(p.unit_cost)}</td>
                      <td>{formatINR(p.tax)}</td>
                      <td>{formatINR(p.total)}</td>
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
              Total consumed: {filteredConsumptionEvents.reduce((s, e) => s + e.qty, 0)} {item?.unit ?? 'units'}
            </span>

            {/* Filter button — opens type-selection dropdown */}
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

          {/* Active filter bar — shown when any filter/search is active */}
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

                // Source filter
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

              {/* Search chip */}
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
            {filteredConsumptionEvents.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">No consumption records found</p>
                <p className="empty-state__desc">
                  {consumptionSearch || activeConsumptionFilterCount > 0 ? 'Try adjusting your search or filter' : 'Consumption will appear here as stock is sold or adjusted'}
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
                    <th>Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedConsumptionEvents.map(e => (
                    <tr key={e.eventId} title={e.notes}>
                      <td>{formatDateShort(e.date)}</td>
                      <td className={styles.barcodeText}>{e.reference}</td>
                      <td>
                        <span className={`badge badge--${CONSUMPTION_SOURCE_BADGE[e.source] ?? 'neutral'}`}>
                          {CONSUMPTION_SOURCE_OPTIONS.find(o => o.value === e.source)?.label}
                        </span>
                      </td>
                      <td>{e.qty} {item?.unit ?? ''}</td>
                      <td>{e.branch}</td>
                      <td>{e.performedBy ?? <span className="text-tertiary">—</span>}</td>
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
              <span className={styles.metricSub}>across last {purchaseHistory.length} purchases</span>
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
            <div className={styles.chartWrap}>
              {purchaseHistory.map((p, i) => (
                <div key={i} className={styles.chartBarCol}>
                  <span className={styles.chartBarValue}>{formatINR(p.unit_cost)}</span>
                  <div className={styles.chartBar} style={{ height: `${(p.unit_cost / maxChartCost) * 100}%` }} />
                  <span className={styles.chartBarLabel}>{formatDateShort(p.date, { withYear: false })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Vendor Comparison</span>
            </div>
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
          </div>
        </div>
      )}

      {/* ── Log Consumption popup ── */}
      {showLogConsumptionModal && (
        <div className="modal-overlay" onClick={closeLogConsumptionModal}>
          <div className={`modal ${styles.logConsumptionModal}`} onClick={e => e.stopPropagation()}>
            <h3 className={`modal__title ${styles.logModalHeader}`}>Log Consumption</h3>

            <div className={styles.logConsumptionFormScroll}>
            <div className={styles.logConsumptionForm}>
              <div className="form-group">
                <label className="form-label form-label--required">Batch</label>
                <select
                  className="form-select"
                  value={logLotId}
                  onChange={e => setLogLotId(e.target.value)}
                >
                  {stockLots.length === 0 && <option value="">No stock lots available</option>}
                  {stockLots.map(lot => (
                    <option key={lot.lotId} value={lot.lotId}>
                      {formatDateShort(lot.date)} · {lot.vendor} · {lot.qty} {item?.unit ?? ''} available
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label form-label--required">Quantity</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max={selectedLogLot?.qty}
                  placeholder={selectedLogLot ? `Up to ${selectedLogLot.qty} ${item?.unit ?? ''}` : 'Quantity'}
                  value={logQty}
                  onChange={e => setLogQty(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label form-label--required">Type</label>
                <div className={styles.logTypeGrid}>
                  {LOG_CONSUMPTION_TYPES.map(t => (
                    <label key={t.value} className={`radio-wrap ${styles.logTypeOption}`}>
                      <span className={`radio ${logType !== t.value ? 'radio--unchecked' : ''}`}>
                        {logType === t.value && <span className="radio__dot" />}
                      </span>
                      <input
                        type="radio"
                        name="logType"
                        value={t.value}
                        checked={logType === t.value}
                        onChange={() => setLogType(t.value)}
                        className={styles.hiddenRadioInput}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              {logType === 'transfer' && (
                <div className="form-group">
                  <label className="form-label form-label--required">Destination Branch</label>
                  <select
                    className="form-select"
                    value={logTransferBranch}
                    onChange={e => setLogTransferBranch(e.target.value)}
                  >
                    <option value="">Select branch</option>
                    <option value="Main Branch">Main Branch</option>
                  </select>
                  <span className="form-hint">Only one branch is set up right now — more branches can be added in Settings later.</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Logged by</label>
                <input
                  className="form-input"
                  placeholder="Staff name"
                  value={logPerformedBy}
                  onChange={e => setLogPerformedBy(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes <span className="text-tertiary font-normal">(Optional)</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="Reason or additional context..."
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                />
              </div>

              {logError && <div className="form-error">{logError}</div>}
            </div>
            </div>

            <div className={`modal__actions ${styles.logModalFooter}`}>
              <button className="btn btn--ghost" onClick={closeLogConsumptionModal}>Cancel</button>
              <button className="btn btn--primary" onClick={handleLogConsumption}>Log Consumption</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
