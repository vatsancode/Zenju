'use client'

import { useState, useMemo } from 'react'
import { Filter, ChevronDown, X, Check, Plus, Search, User, Receipt } from 'lucide-react'
import { mockSales, mockSaleItems, mockCustomers, formatINR, formatDateShort } from '@/lib/mock-data'
import styles from './sales.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'upi' | 'card'

type MockSale = typeof mockSales[number]
type MockSaleItem = typeof mockSaleItems[number]

// ─── Filter config ───────────────────────────────────────────────────────────

const FILTER_DEFS = [
  { key: 'payment', label: 'Payment' },
  { key: 'date', label: 'Date' },
  { key: 'customer', label: 'Customer' },
] as const

type FilterKey = typeof FILTER_DEFS[number]['key']

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
] as const

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  return formatDateShort(isoString)
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDateTime(isoString: string): string {
  return `${formatDate(isoString)}, ${formatTime(isoString)}`
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getPaymentBadgeClass(method: string): string {
  switch (method) {
    case 'cash': return styles.paymentCash
    case 'upi': return styles.paymentUpi
    case 'card': return styles.paymentCard
    default: return ''
  }
}

function getSaleItems(saleId: string): MockSaleItem[] {
  return mockSaleItems.filter(si => si.sale_id === saleId)
}

function getCustomer(customerId: string | null) {
  if (!customerId) return null
  return mockCustomers.find(c => c.id === customerId) ?? null
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function SalesHistoryPage() {
  // ── Filter state ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [paymentFilters, setPaymentFilters] = useState<string[]>([])
  const [datePreset, setDatePreset] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerFilters, setCustomerFilters] = useState<string[]>([])
  const [customerFilterSearch, setCustomerFilterSearch] = useState('')
  const [activeFilterTypes, setActiveFilterTypes] = useState<FilterKey[]>([])
  const [filterTypeDropdownOpen, setFilterTypeDropdownOpen] = useState(false)
  const [addFilterDropdownOpen, setAddFilterDropdownOpen] = useState(false)
  const [openValueDropdown, setOpenValueDropdown] = useState<FilterKey | null>(null)

  // ── Detail drawer state ────────────────────────────────────────────────────
  const [selectedSale, setSelectedSale] = useState<MockSale | null>(null)

  // ── Filter handlers ────────────────────────────────────────────────────────

  function addFilterType(key: FilterKey) {
    setActiveFilterTypes(prev => prev.includes(key) ? prev : [...prev, key])
    setOpenValueDropdown(key)
    setFilterTypeDropdownOpen(false)
    setAddFilterDropdownOpen(false)
  }

  function removeFilterType(key: FilterKey) {
    setActiveFilterTypes(prev => prev.filter(k => k !== key))
    if (key === 'payment') setPaymentFilters([])
    if (key === 'date') { setDatePreset(''); setDateFrom(''); setDateTo('') }
    if (key === 'customer') { setCustomerFilters([]); setCustomerFilterSearch('') }
    if (openValueDropdown === key) setOpenValueDropdown(null)
  }

  function clearAllFilters() {
    setActiveFilterTypes([])
    setPaymentFilters([])
    setDatePreset('')
    setDateFrom('')
    setDateTo('')
    setCustomerFilters([])
    setCustomerFilterSearch('')
    setOpenValueDropdown(null)
    setSearch('')
  }

  function handleDatePreset(preset: string) {
    setDatePreset(preset)
    const now = new Date()
    const today = getStartOfDay(now)

    if (preset === 'today') {
      setDateFrom(today.toISOString().slice(0, 10))
      setDateTo(now.toISOString().slice(0, 10))
    } else if (preset === 'yesterday') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      setDateFrom(yesterday.toISOString().slice(0, 10))
      setDateTo(yesterday.toISOString().slice(0, 10))
    } else if (preset === 'last7') {
      const d = new Date(today)
      d.setDate(d.getDate() - 7)
      setDateFrom(d.toISOString().slice(0, 10))
      setDateTo(now.toISOString().slice(0, 10))
    } else if (preset === 'last30') {
      const d = new Date(today)
      d.setDate(d.getDate() - 30)
      setDateFrom(d.toISOString().slice(0, 10))
      setDateTo(now.toISOString().slice(0, 10))
    }
    if (preset !== 'custom') {
      setOpenValueDropdown(null)
    }
  }

  // ── Filtered sales ─────────────────────────────────────────────────────────

  const filteredSales = useMemo(() => {
    return mockSales.filter(sale => {
      if (search) {
        const q = search.toLowerCase()
        const items = getSaleItems(sale.id)
        const matchesId = sale.id.includes(q)
        const matchesNote = sale.notes?.toLowerCase().includes(q)
        const matchesItem = items.some(si => si.catalogue_item_name.toLowerCase().includes(q))
        if (!matchesId && !matchesNote && !matchesItem) return false
      }

      if (paymentFilters.length > 0 && !paymentFilters.includes(sale.payment_method)) {
        return false
      }

      if (dateFrom) {
        const saleDate = new Date(sale.sold_at)
        const from = new Date(dateFrom + 'T00:00:00')
        if (saleDate < from) return false
      }
      if (dateTo) {
        const saleDate = new Date(sale.sold_at)
        const to = new Date(dateTo + 'T23:59:59')
        if (saleDate > to) return false
      }

      if (customerFilters.length > 0) {
        if (!sale.customer_id || !customerFilters.includes(sale.customer_id)) return false
      }

      return true
    })
  }, [search, paymentFilters, dateFrom, dateTo, customerFilters])

  // ── Summary stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.final_amount, 0)
    const totalTransactions = filteredSales.length
    const totalDiscount = filteredSales.reduce((sum, s) => sum + s.bill_discount_amount, 0)
    const totalItems = filteredSales.reduce((sum, s) => {
      return sum + getSaleItems(s.id).reduce((iSum, si) => iSum + si.quantity, 0)
    }, 0)
    const totalProfit = filteredSales.reduce((sum, s) => {
      const gross = getSaleItems(s.id).reduce(
        (p, si) => p + (si.unit_price - si.cost_price_at_sale) * si.quantity - si.item_discount_amount,
        0
      )
      return sum + gross - s.bill_discount_amount
    }, 0)
    return { totalRevenue, totalTransactions, totalDiscount, totalItems, totalProfit }
  }, [filteredSales])

  const activeFilterCount = activeFilterTypes.length

  const dateDisplayText = (() => {
    if (!datePreset) return 'Any'
    if (datePreset === 'custom') {
      if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`
      if (dateFrom) return `From ${dateFrom}`
      if (dateTo) return `Until ${dateTo}`
      return 'Custom'
    }
    return DATE_PRESETS.find(p => p.value === datePreset)?.label ?? 'Any'
  })()

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page Header */}
      <div className={styles.headerRow}>
        <div>
          <h1>Sales History</h1>
          <p className="text-secondary text-sm" style={{ marginTop: 'var(--space-1)' }}>
            View and filter past transactions
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className={`grid-4 ${styles.metricsGrid}`}>
        <div className="metric-card">
          <div className="metric-card__band metric-card__band--blue"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Total Revenue</p>
            <p className="metric-card__value metric-card__value--blue">
              {formatINR(stats.totalRevenue)}
            </p>
            <p className="metric-card__sub">{stats.totalTransactions} transactions</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__band metric-card__band--amber"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Items Sold</p>
            <p className="metric-card__value metric-card__value--amber">
              {stats.totalItems}
            </p>
            <p className="metric-card__sub">Across all transactions</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__band metric-card__band--green"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Total Profit</p>
            <p className="metric-card__value metric-card__value--green">
              {formatINR(stats.totalProfit)}
            </p>
            <p className="metric-card__sub">After cost of goods</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__band metric-card__band--navy"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Total Discounts</p>
            <p className="metric-card__value metric-card__value--navy">
              {formatINR(stats.totalDiscount)}
            </p>
            <p className="metric-card__sub">Bill-level discounts</p>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className={styles.filtersRow}>
        <div className={styles.searchWrap}>
          <input
            className="form-input"
            placeholder="Search by sale ID, item name, or notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterWrap}>
          <button
            className={`btn btn--ghost ${styles.filterBtn}${activeFilterCount > 0 ? ` ${styles.filterBtnActive}` : ''}`}
            onClick={() => { setFilterTypeDropdownOpen(v => !v); setAddFilterDropdownOpen(false) }}
          >
            <Filter size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className={styles.filterBadge}>{activeFilterCount}</span>
            )}
          </button>
          {filterTypeDropdownOpen && (
            <>
              <div className={styles.filterBackdrop} onClick={() => setFilterTypeDropdownOpen(false)} />
              <div className={styles.filterDropdown}>
                {FILTER_DEFS.map(f => (
                  <button
                    key={f.key}
                    className={`${styles.filterOption}${activeFilterTypes.includes(f.key) ? ` ${styles.filterOptionActive}` : ''}`}
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
      </div>

      {/* Active filter bar */}
      {(activeFilterTypes.length > 0 || search) && (
        <div className={styles.resultSummaryRow}>
          <span className={styles.resultSummary}>
            <strong>{filteredSales.length}</strong> {filteredSales.length === 1 ? 'sale' : 'sales'}
            <span className={styles.resultSummarySep}>•</span>
          </span>

          {activeFilterTypes.map(key => {
            const isOpen = openValueDropdown === key

            if (key === 'payment') {
              const displayText =
                paymentFilters.length === 0 ? 'Any'
                  : paymentFilters.length === 1
                    ? PAYMENT_OPTIONS.find(o => o.value === paymentFilters[0])?.label ?? paymentFilters[0]
                    : `${paymentFilters.length} selected`

              return (
                <div key={key} className={styles.filterChipWrap}>
                  <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                    <button
                      className={styles.filterChipMain}
                      onClick={() => setOpenValueDropdown(prev => prev === key ? null : key)}
                    >
                      <span className={styles.filterChipLabel}>Payment</span>
                      <span className={`${styles.filterChipValues}${paymentFilters.length > 0 ? ` ${styles.filterChipValuesActive}` : ''}`}>
                        {displayText}
                      </span>
                      <ChevronDown
                        size={11}
                        className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`}
                      />
                    </button>
                    <button
                      className={styles.filterChipRemove}
                      onClick={() => removeFilterType(key)}
                      title="Remove Payment filter"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {isOpen && (
                    <>
                      <div className={styles.filterBackdrop} onClick={() => setOpenValueDropdown(null)} />
                      <div className={styles.valueDropdown}>
                        {PAYMENT_OPTIONS.map(opt => {
                          const checked = paymentFilters.includes(opt.value)
                          return (
                            <button
                              key={opt.value}
                              className={`${styles.valueOption}${checked ? ` ${styles.valueOptionChecked}` : ''}`}
                              onClick={() => {
                                setPaymentFilters(prev =>
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
            }

            if (key === 'customer') {
              const filteredCustOptions = mockCustomers.filter(c => {
                if (!customerFilterSearch) return true
                const q = customerFilterSearch.toLowerCase()
                return c.name.toLowerCase().includes(q) || c.phone.includes(q)
              })

              const displayText =
                customerFilters.length === 0 ? 'Any'
                  : customerFilters.length === 1
                    ? mockCustomers.find(c => c.id === customerFilters[0])?.name ?? customerFilters[0]
                    : `${customerFilters.length} selected`

              return (
                <div key={key} className={styles.filterChipWrap}>
                  <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                    <button
                      className={styles.filterChipMain}
                      onClick={() => setOpenValueDropdown(prev => prev === key ? null : key)}
                    >
                      <span className={styles.filterChipLabel}>Customer</span>
                      <span className={`${styles.filterChipValues}${customerFilters.length > 0 ? ` ${styles.filterChipValuesActive}` : ''}`}>
                        {displayText}
                      </span>
                      <ChevronDown
                        size={11}
                        className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`}
                      />
                    </button>
                    <button
                      className={styles.filterChipRemove}
                      onClick={() => removeFilterType(key)}
                      title="Remove Customer filter"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {isOpen && (
                    <>
                      <div className={styles.filterBackdrop} onClick={() => { setOpenValueDropdown(null); setCustomerFilterSearch('') }} />
                      <div className={styles.valueDropdown} style={{ minWidth: 240 }}>
                        <div className={styles.customerSearchWrap}>
                          <Search size={12} className={styles.customerSearchIcon} />
                          <input
                            className={styles.customerSearchInput}
                            placeholder="Search customers..."
                            value={customerFilterSearch}
                            onChange={e => setCustomerFilterSearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className={styles.customerOptionsList}>
                          {filteredCustOptions.map(c => {
                            const checked = customerFilters.includes(c.id)
                            return (
                              <button
                                key={c.id}
                                className={`${styles.valueOption}${checked ? ` ${styles.valueOptionChecked}` : ''}`}
                                onClick={() => {
                                  setCustomerFilters(prev =>
                                    prev.includes(c.id) ? prev.filter(v => v !== c.id) : [...prev, c.id]
                                  )
                                }}
                              >
                                <span className={styles.valueOptionCheck}>
                                  {checked && <Check size={10} />}
                                </span>
                                <span className={styles.customerOptionInfo}>
                                  <span className={styles.customerOptionName}>{c.name}</span>
                                  <span className={styles.customerOptionPhone}>{c.phone}</span>
                                </span>
                              </button>
                            )
                          })}
                          {filteredCustOptions.length === 0 && (
                            <div className={styles.customerNoResults}>No customers found</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            }

            // Date filter
            return (
              <div key={key} className={styles.filterChipWrap}>
                <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                  <button
                    className={styles.filterChipMain}
                    onClick={() => setOpenValueDropdown(prev => prev === key ? null : key)}
                  >
                    <span className={styles.filterChipLabel}>Date</span>
                    <span className={`${styles.filterChipValues}${datePreset ? ` ${styles.filterChipValuesActive}` : ''}`}>
                      {dateDisplayText}
                    </span>
                    <ChevronDown
                      size={11}
                      className={`${styles.filterChipChevron}${isOpen ? ` ${styles.filterChipChevronOpen}` : ''}`}
                    />
                  </button>
                  <button
                    className={styles.filterChipRemove}
                    onClick={() => removeFilterType(key)}
                    title="Remove Date filter"
                  >
                    <X size={11} />
                  </button>
                </div>

                {isOpen && (
                  <>
                    <div className={styles.filterBackdrop} onClick={() => setOpenValueDropdown(null)} />
                    <div className={styles.valueDropdown} style={{ minWidth: 220 }}>
                      <div className={styles.datePresets}>
                        {DATE_PRESETS.map(opt => (
                          <button
                            key={opt.value}
                            className={`${styles.valueOption}${datePreset === opt.value ? ` ${styles.valueOptionChecked}` : ''}`}
                            onClick={() => handleDatePreset(opt.value)}
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
                            <input
                              type="date"
                              value={dateFrom}
                              onChange={e => setDateFrom(e.target.value)}
                            />
                          </div>
                          <div className={styles.dateFilterRow}>
                            <label>To</label>
                            <input
                              type="date"
                              value={dateTo}
                              onChange={e => setDateTo(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {/* Search chip */}
          {search && (
            <button className={styles.filterChip} onClick={() => setSearch('')} title="Clear search">
              <span className={styles.filterChipLabel}>Search:</span>
              <span className={styles.filterChipValue}>{search}</span>
              <X size={12} />
            </button>
          )}

          {/* + Add Filter */}
          {FILTER_DEFS.some(f => !activeFilterTypes.includes(f.key)) && activeFilterTypes.length > 0 && (
            <div className={styles.addFilterWrap}>
              <button
                className={styles.addFilterBtn}
                onClick={() => { setAddFilterDropdownOpen(v => !v); setFilterTypeDropdownOpen(false) }}
              >
                <Plus size={12} />
                Add Filter
              </button>
              {addFilterDropdownOpen && (
                <>
                  <div className={styles.filterBackdrop} onClick={() => setAddFilterDropdownOpen(false)} />
                  <div className={styles.filterDropdown}>
                    {FILTER_DEFS.filter(f => !activeFilterTypes.includes(f.key)).map(f => (
                      <button
                        key={f.key}
                        className={styles.filterOption}
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

          <button className={styles.filterClearAll} onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      )}

      {/* Sales Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredSales.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No sales found</p>
            <p className="empty-state__desc">
              {search || paymentFilters.length > 0 || datePreset
                ? 'Try adjusting your filters'
                : 'Sales will appear here once you make a transaction from POS'}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className={styles.colId}>#</th>
                <th className={styles.colDate}>Date & Time</th>
                <th className={styles.colCustomer}>Customer</th>
                <th className={styles.colItems}>Items</th>
                <th className={styles.colPayment}>Payment</th>
                <th className={styles.colSubtotal}>Subtotal</th>
                <th className={styles.colDiscount}>Discount</th>
                <th className={styles.colTotal}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(sale => {
                const items = getSaleItems(sale.id)
                const visibleItems = items.slice(0, 2)
                const remaining = items.length - 2

                return (
                  <tr
                    key={sale.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedSale(sale)}
                  >
                    <td>
                      <span className={styles.saleIdCode}>{sale.id}</span>
                    </td>
                    <td>
                      <div>
                        <div className="text-sm">{formatDate(sale.sold_at)}</div>
                        <div className="text-xs text-tertiary">{formatTime(sale.sold_at)}</div>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const customer = getCustomer(sale.customer_id)
                        if (!customer) return <span className="text-tertiary text-sm">Walk-in</span>
                        return (
                          <div className={styles.customerCell}>
                            <div className={styles.customerCellName}>{customer.name}</div>
                            <div className={styles.customerCellPhone}>{customer.phone}</div>
                          </div>
                        )
                      })()}
                    </td>
                    <td>
                      <div className={styles.itemsList}>
                        {visibleItems.map(si => (
                          <span key={si.id} className={styles.itemLine}>
                            {si.catalogue_item_name}
                            <span className={styles.itemLineQty}> × {si.quantity}</span>
                          </span>
                        ))}
                        {remaining > 0 && (
                          <span className={styles.moreItems}>+{remaining} more</span>
                        )}
                        {items.length === 0 && (
                          <span className="text-tertiary text-sm">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.paymentBadge} ${getPaymentBadgeClass(sale.payment_method)}`}>
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="text-sm">{formatINR(sale.subtotal_amount)}</td>
                    <td>
                      {sale.bill_discount_amount > 0 ? (
                        <span className={styles.discountAmount}>
                          -{formatINR(sale.bill_discount_amount)}
                        </span>
                      ) : (
                        <span className="text-tertiary text-sm">—</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.totalAmount}>{formatINR(sale.final_amount)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Sale Detail Drawer ── */}
      {selectedSale && (
        <div className="overlay" onClick={() => setSelectedSale(null)}>
          <div
            className="drawer"
            style={{ width: '480px', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer__header">
              <h3 className="drawer__title">
                <Receipt size={18} style={{ marginRight: 'var(--space-2)', verticalAlign: 'text-bottom' }} />
                Sale #{selectedSale.id}
              </h3>
              <button className="drawer__close" onClick={() => setSelectedSale(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.drawerSection}>
                {/* Sale Info */}
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Date & Time</span>
                  <span className={styles.infoValue}>{formatDateTime(selectedSale.sold_at)}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Payment Method</span>
                  <span className={`${styles.paymentBadge} ${getPaymentBadgeClass(selectedSale.payment_method)}`}>
                    {selectedSale.payment_method}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Sale ID</span>
                  <span className={styles.saleIdCode}>{selectedSale.id}</span>
                </div>

                {/* Items Breakdown */}
                <div className={styles.sectionLabel}>Items</div>
                <table className={styles.breakdownTable}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSaleItems(selectedSale.id).map(si => (
                      <tr key={si.id}>
                        <td>
                          <span className={styles.breakdownItemName}>{si.catalogue_item_name}</span>
                          {si.is_bundle && <span className={styles.breakdownBundle}>Bundle</span>}
                        </td>
                        <td>{si.quantity}</td>
                        <td>{formatINR(si.unit_price)}</td>
                        <td>{formatINR(si.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className={styles.totalsSection}>
                  <div className={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>{formatINR(selectedSale.subtotal_amount)}</span>
                  </div>
                  {selectedSale.bill_discount_amount > 0 && (
                    <div className={`${styles.totalRow} ${styles.totalRowDiscount}`}>
                      <span>Bill Discount</span>
                      <span>-{formatINR(selectedSale.bill_discount_amount)}</span>
                    </div>
                  )}
                  <div className={`${styles.totalRow} ${styles.totalRowFinal}`}>
                    <span>Total Paid</span>
                    <span>{formatINR(selectedSale.final_amount)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedSale.notes && (
                  <>
                    <div className={styles.sectionLabel}>Notes</div>
                    <div className={styles.notesBox}>{selectedSale.notes}</div>
                  </>
                )}
              </div>
            </div>

            <div className={`drawer__footer ${styles.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={() => setSelectedSale(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
