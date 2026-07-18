'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Filter, ChevronDown, Eye } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders, formatINR, formatDateShort } from '@/lib/mock-data'
import type { MockPurchaseOrder, PurchaseOrderStatus } from '@/lib/mock-data'
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
  draft: 'neutral',
  ordered: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'danger',
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const router = useRouter()

  const [orders] = useState<MockPurchaseOrder[]>(mockPurchaseOrders)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  const [suppliers] = useState(mockSuppliers)

  const filteredOrders = orders.filter(po => {
    const matchesSearch = !search
      || po.po_number.toLowerCase().includes(search.toLowerCase())
      || supplierName(po.supplier_id).toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(po.status)
    return matchesSearch && matchesStatus
  })

  const pendingCount = orders.filter(po => po.status === 'ordered' || po.status === 'partially_received').length
  const thisMonthSpend = orders
    .filter(po => po.status === 'received' || po.status === 'partially_received')
    .reduce((sum, po) => sum + poTotal(po), 0)

  return (
    <div>
      {/* Header */}
      <div className={styles.headerRow}>
        <h1>Purchase Orders</h1>
        <div className={styles.headerActions}>
          <button className="btn btn--primary btn--sm" onClick={() => router.push('/dashboard/purchases/new')} style={{ height: '32px' }}>
            <Plus size={18} /> New Purchase Order
          </button>
        </div>
      </div>

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

        <div className={styles.selectWrap} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            className={`btn btn--ghost ${statusFilter.length > 0 ? styles.filterBtnActive : ''}`}
            style={{ width: '100%', justifyContent: 'space-between' }}
            onClick={() => setStatusDropdownOpen(v => !v)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={14} />
              {statusFilter.length === 0 ? 'All statuses' : `${statusFilter.length} selected`}
            </span>
            <ChevronDown size={14} />
          </button>
          {statusDropdownOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setStatusDropdownOpen(false)} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-dropdown)', minWidth: 200, overflow: 'hidden',
              }}>
                {(Object.keys(STATUS_LABELS) as PurchaseOrderStatus[]).map(s => {
                  const checked = statusFilter.includes(s)
                  return (
                    <button
                      key={s}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        fontSize: 'var(--text-sm)', color: checked ? 'var(--color-brand-blue)' : 'var(--color-text-primary)',
                      }}
                      onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    >
                      {checked ? <Check size={13} /> : <span style={{ width: 13 }} />}
                      {STATUS_LABELS[s]}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No purchase orders found</p>
            <p className="empty-state__desc">
              {search || statusFilter.length > 0 ? 'Try adjusting your filters' : 'Create your first purchase order to start tracking incoming stock'}
            </p>
            {!search && statusFilter.length === 0 && (
              <button className="btn btn--primary btn--sm" onClick={() => router.push('/dashboard/purchases/new')}>
                New Purchase Order
              </button>
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
                      <button
                        className="btn btn--ghost btn--sm"
                        title="View purchase order"
                        onClick={() => router.push(`/dashboard/purchases/${po.id}`)}
                      >
                        <Eye size={14} />
                      </button>
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
