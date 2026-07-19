'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Filter, ChevronDown, X, Eye } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders, formatINR, formatDateShort } from '@/lib/mock-data'
import type { MockPurchaseOrder, PurchaseOrderStatus } from '@/lib/mock-data'
import { useSetPageTitle } from '@/components/layout/PageTitleContext'
import Button from '@/components/ui/Button'
import styles from './purchases.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

function poTotal(po: MockPurchaseOrder) {
  return po.items.reduce((sum, i) => sum + i.qty_ordered * i.unit_cost, 0)
}

function supplierName(id: string) {
  return mockSuppliers.find(s => s.id === id)?.name ?? 'Unknown vendor'
}

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
}

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  draft: 'draft',
  ordered: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'danger',
}

// ─── Filter config ────────────────────────────────────────────────────────

const FILTER_DEFS = [
  { key: 'status', label: 'Status' },
  { key: 'timeline', label: 'Order Date' },
] as const

type FilterKey = typeof FILTER_DEFS[number]['key']

type TimelineValue = '7d' | '30d' | '90d' | 'year' | 'custom'

const TIMELINE_OPTIONS: { value: TimelineValue; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
]

function matchesTimeline(po: MockPurchaseOrder, timeline: TimelineValue | null, customFrom: string, customTo: string): boolean {
  if (!timeline || !po.order_date) return true
  const orderDate = new Date(po.order_date)
  if (timeline === 'custom') {
    if (customFrom && orderDate < new Date(customFrom)) return false
    if (customTo && orderDate > new Date(customTo)) return false
    return true
  }
  const now = new Date()
  if (timeline === 'year') return orderDate.getFullYear() === now.getFullYear()
  const days = timeline === '7d' ? 7 : timeline === '30d' ? 30 : 90
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  return orderDate >= cutoff && orderDate <= now
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const router = useRouter()
  useSetPageTitle('Purchase Orders')

  const [orders] = useState<MockPurchaseOrder[]>(mockPurchaseOrders)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus[]>([])
  const [timelineFilter, setTimelineFilter] = useState<TimelineValue | null>(null)
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [activeFilterTypes, setActiveFilterTypes] = useState<FilterKey[]>([])
  const [filterTypeDropdownOpen, setFilterTypeDropdownOpen] = useState(false)
  const [addFilterDropdownOpen, setAddFilterDropdownOpen] = useState(false)
  const [openValueDropdown, setOpenValueDropdown] = useState<FilterKey | null>(null)

  const [suppliers] = useState(mockSuppliers)

  const activeFilterCount = activeFilterTypes.length

  const filteredOrders = orders.filter(po => {
    const matchesSearch = !search
      || po.po_number.toLowerCase().includes(search.toLowerCase())
      || supplierName(po.supplier_id).toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(po.status)
    return matchesSearch && matchesStatus && matchesTimeline(po, timelineFilter, customDateFrom, customDateTo)
  })

  // ── Filter handlers ─────────────────────────────────────────────────────

  function addFilterType(key: FilterKey) {
    setActiveFilterTypes(prev => prev.includes(key) ? prev : [...prev, key])
    setOpenValueDropdown(key)
    setFilterTypeDropdownOpen(false)
    setAddFilterDropdownOpen(false)
  }

  function removeFilterType(key: FilterKey) {
    setActiveFilterTypes(prev => prev.filter(k => k !== key))
    if (key === 'status') setStatusFilter([])
    if (key === 'timeline') { setTimelineFilter(null); setCustomDateFrom(''); setCustomDateTo('') }
    if (openValueDropdown === key) setOpenValueDropdown(null)
  }

  function clearAllFilters() {
    setActiveFilterTypes([])
    setStatusFilter([])
    setTimelineFilter(null)
    setCustomDateFrom('')
    setCustomDateTo('')
    setOpenValueDropdown(null)
    setSearch('')
  }

  const pendingCount = orders.filter(po => po.status === 'ordered' || po.status === 'partially_received').length
  const thisMonthSpend = orders
    .filter(po => po.status === 'received' || po.status === 'partially_received')
    .reduce((sum, po) => sum + poTotal(po), 0)

  return (
    <div>
      {/* Summary */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className="text-secondary text-sm">Spend (received orders)</span>
          <span className={styles.summaryValue}>{formatINR(thisMonthSpend)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className="text-secondary text-sm">Pending orders</span>
          <span className={styles.summaryValue}>{pendingCount}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className="text-secondary text-sm">Total vendors</span>
          <span className={styles.summaryValue}>{suppliers.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.searchWrap}>
          <input
            className="form-input"
            placeholder="Search PO number or vendor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter button — opens type-selection dropdown */}
        <div className="filterWrap">
          <button
            className={`btn btn--ghost filterBtn${activeFilterCount > 0 ? ' filterBtnActive' : ''}`}
            onClick={() => { setFilterTypeDropdownOpen(v => !v); setAddFilterDropdownOpen(false) }}
          >
            <Filter size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="filterBadge">{activeFilterCount}</span>
            )}
          </button>
          {filterTypeDropdownOpen && (
            <>
              <div className="filterBackdrop" onClick={() => setFilterTypeDropdownOpen(false)} />
              <div className="filterDropdown">
                {FILTER_DEFS.map(f => (
                  <button
                    key={f.key}
                    className={`filterOption${activeFilterTypes.includes(f.key) ? ' filterOptionActive' : ''}`}
                    onClick={() => addFilterType(f.key)}
                  >
                    {f.label}
                    {activeFilterTypes.includes(f.key) && <Check size={13} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <Button size="sm" icon={<Plus size={18} />} onClick={() => router.push('/dashboard/purchases/new')}>
          New Purchase Order
        </Button>
      </div>

      {/* Active filter bar + result count — shown when any filter/search is active */}
      {(activeFilterTypes.length > 0 || search) && (
        <div className="resultSummaryRow">
          <span className="resultSummary">
            <strong>{filteredOrders.length}</strong> {filteredOrders.length === 1 ? 'order' : 'orders'}
            <span className="resultSummarySep">•</span>
          </span>

          {/* Active filter chips */}
          {activeFilterTypes.map(key => {
            const isOpen = openValueDropdown === key
            const isStatus = key === 'status'
            const label = isStatus ? 'Status' : 'Order Date'

            const displayText = isStatus
              ? (statusFilter.length === 0 ? 'Any'
                : statusFilter.length === 1 ? STATUS_LABELS[statusFilter[0]]
                  : `${statusFilter.length} selected`)
              : timelineFilter === 'custom'
                ? (customDateFrom || customDateTo
                  ? `${customDateFrom ? formatDateShort(customDateFrom) : '…'} – ${customDateTo ? formatDateShort(customDateTo) : '…'}`
                  : 'Custom range')
                : (TIMELINE_OPTIONS.find(o => o.value === timelineFilter)?.label ?? 'Any')

            const hasValue = isStatus ? statusFilter.length > 0 : timelineFilter !== null

            return (
              <div key={key} className="filterChipWrap">
                <div className={`filterChipInner${isOpen ? ' filterChipInnerOpen' : ''}`}>
                  <button
                    className="filterChipMain"
                    onClick={() => setOpenValueDropdown(prev => prev === key ? null : key)}
                  >
                    <span className="filterChipLabel">{label}</span>
                    <span className={`filterChipValues${hasValue ? ' filterChipValuesActive' : ''}`}>
                      {displayText}
                    </span>
                    <ChevronDown
                      size={11}
                      className={`filterChipChevron${isOpen ? ' filterChipChevronOpen' : ''}`}
                    />
                  </button>
                  <button
                    className="filterChipRemove"
                    onClick={() => removeFilterType(key)}
                    title={`Remove ${label} filter`}
                  >
                    <X size={11} />
                  </button>
                </div>

                {isOpen && (
                  <>
                    <div className="filterBackdrop" onClick={() => setOpenValueDropdown(null)} />
                    <div className={`valueDropdown${!isStatus ? ` ${styles.valueDropdownWide}` : ''}`}>
                      {isStatus
                        ? (Object.keys(STATUS_LABELS) as PurchaseOrderStatus[]).map(s => {
                          const checked = statusFilter.includes(s)
                          return (
                            <button
                              key={s}
                              className={`valueOption${checked ? ' valueOptionChecked' : ''}`}
                              onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                            >
                              <span className="valueOptionCheck">
                                {checked && <Check size={10} />}
                              </span>
                              {STATUS_LABELS[s]}
                            </button>
                          )
                        })
                        : <>
                          {TIMELINE_OPTIONS.map(opt => {
                            const checked = timelineFilter === opt.value
                            return (
                              <button
                                key={opt.value}
                                className={`valueOption${checked ? ' valueOptionChecked' : ''}`}
                                onClick={() => setTimelineFilter(prev => prev === opt.value ? null : opt.value)}
                              >
                                <span className="valueOptionCheck">
                                  {checked && <Check size={10} />}
                                </span>
                                {opt.label}
                              </button>
                            )
                          })}
                          {timelineFilter === 'custom' && (
                            <div className={styles.customRangeRow}>
                              <input
                                type="date"
                                className="form-input"
                                value={customDateFrom}
                                max={customDateTo || undefined}
                                onChange={e => setCustomDateFrom(e.target.value)}
                              />
                              <span className={styles.customRangeSep}>to</span>
                              <input
                                type="date"
                                className="form-input"
                                value={customDateTo}
                                min={customDateFrom || undefined}
                                onChange={e => setCustomDateTo(e.target.value)}
                              />
                            </div>
                          )}
                        </>}
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {/* Search chip */}
          {search && (
            <button className="filterChip" onClick={() => setSearch('')} title="Clear search">
              <span className="filterChipLabel">Search:</span>
              <span className="filterChipValue">{search}</span>
              <X size={12} />
            </button>
          )}

          {/* + Add Filter (only when unused filter types remain) */}
          {FILTER_DEFS.some(f => !activeFilterTypes.includes(f.key)) && activeFilterTypes.length > 0 && (
            <div className="addFilterWrap">
              <button
                className="addFilterBtn"
                onClick={() => { setAddFilterDropdownOpen(v => !v); setFilterTypeDropdownOpen(false) }}
              >
                <Plus size={12} />
                Add Filter
              </button>
              {addFilterDropdownOpen && (
                <>
                  <div className="filterBackdrop" onClick={() => setAddFilterDropdownOpen(false)} />
                  <div className="filterDropdown">
                    {FILTER_DEFS.filter(f => !activeFilterTypes.includes(f.key)).map(f => (
                      <button
                        key={f.key}
                        className="filterOption"
                        onClick={() => addFilterType(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button className="filterClearAll" onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No purchase orders found</p>
            <p className="empty-state__desc">
              {search || activeFilterTypes.length > 0 ? 'Try adjusting your filters' : 'Create your first purchase order to start tracking incoming stock'}
            </p>
            {!search && activeFilterTypes.length === 0 && (
              <Button size="sm" onClick={() => router.push('/dashboard/purchases/new')}>
                New Purchase Order
              </Button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className={styles.poNumberCol}>PO Number</th>
                <th className={styles.vendorCol}>Vendor</th>
                <th className={styles.dateCol}>Order Date</th>
                <th className={styles.itemsCol}>Items</th>
                <th className={styles.totalCol}>Total</th>
                <th className={styles.statusCol}>Status</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(po => (
                <tr key={po.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/purchases/${po.id}`)}>
                  <td><span className={styles.poNumberCode}>{po.po_number}</span></td>
                  <td>{supplierName(po.supplier_id)}</td>
                  <td>{po.order_date ? formatDateShort(po.order_date) : '—'}</td>
                  <td>{po.items.length} item{po.items.length !== 1 ? 's' : ''}</td>
                  <td>{formatINR(poTotal(po))}</td>
                  <td>
                    <span className={`badge badge--${STATUS_BADGE[po.status]}`}>{STATUS_LABELS[po.status]}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<Eye size={14} />}
                        aria-label="View purchase order"
                        title="View purchase order"
                        onClick={() => router.push(`/dashboard/purchases/${po.id}`)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
