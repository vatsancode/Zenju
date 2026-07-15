'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Check, Filter, ChevronDown, Eye } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders, formatINR } from '@/lib/mock-data'
import type { MockPurchaseOrder, MockPurchaseOrderItem, PurchaseOrderStatus } from '@/lib/mock-data'
import CustomSelect from '@/components/ui/CustomSelect'
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

function genPoNumber(existing: MockPurchaseOrder[]) {
  const nums = existing.map(p => parseInt(p.po_number.split('-')[1] || '0', 10))
  const next = (nums.length ? Math.max(...nums) : 113) + 1
  return `PO-${String(next).padStart(4, '0')}`
}

type DraftItem = {
  id: string
  item_name: string
  variant_label: string
  unit: string
  qty_ordered: number | ''
  unit_cost: number | ''
}

function emptyDraftItem(): DraftItem {
  return { id: `${Date.now()}-${Math.random()}`, item_name: '', variant_label: '', unit: 'KG', qty_ordered: '', unit_cost: '' }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const router = useRouter()

  const [orders, setOrders] = useState<MockPurchaseOrder[]>(mockPurchaseOrders)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  const [showDrawer, setShowDrawer] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [suppliers, setSuppliers] = useState(mockSuppliers)
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyDraftItem()])

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

  const draftTotal = draftItems.reduce(
    (sum, i) => sum + Number(i.qty_ordered || 0) * Number(i.unit_cost || 0),
    0
  )

  function resetDrawer() {
    setSupplierId('')
    setAddingSupplier(false)
    setNewSupplierName('')
    setOrderDate(new Date().toISOString().slice(0, 10))
    setExpectedDate('')
    setNotes('')
    setDraftItems([emptyDraftItem()])
  }

  function closeDrawer() {
    resetDrawer()
    setShowDrawer(false)
  }

  function handleAddSupplier() {
    const name = newSupplierName.trim()
    if (!name) { setAddingSupplier(false); return }
    const created = { id: `s-${Date.now()}`, name, phone: '', email: '', notes: '' }
    setSuppliers(prev => [...prev, created])
    setSupplierId(created.id)
    setAddingSupplier(false)
    setNewSupplierName('')
  }

  function updateDraftItem(id: string, patch: Partial<DraftItem>) {
    setDraftItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
  }

  function addDraftItemRow() {
    setDraftItems(prev => [...prev, emptyDraftItem()])
  }

  function removeDraftItemRow(id: string) {
    setDraftItems(prev => (prev.length > 1 ? prev.filter(i => i.id !== id) : prev))
  }

  const canSave = supplierId
    && draftItems.some(i => i.item_name.trim() && Number(i.qty_ordered) > 0 && Number(i.unit_cost) > 0)

  function handleSave(status: 'draft' | 'ordered') {
    if (!canSave) return
    const items: MockPurchaseOrderItem[] = draftItems
      .filter(i => i.item_name.trim() && Number(i.qty_ordered) > 0)
      .map(i => ({
        id: `${Date.now()}-${Math.random()}`,
        item_name: i.item_name.trim(),
        variant_label: i.variant_label.trim() || '—',
        unit: i.unit,
        qty_ordered: Number(i.qty_ordered),
        qty_received: 0,
        unit_cost: Number(i.unit_cost),
      }))

    const created: MockPurchaseOrder = {
      id: `po-${Date.now()}`,
      po_number: genPoNumber(orders),
      supplier_id: supplierId,
      branch: 'Main Branch',
      order_date: orderDate,
      expected_date: expectedDate || null,
      status,
      notes: notes.trim(),
      items,
      created_at: new Date().toISOString(),
    }

    setOrders(prev => [created, ...prev])
    closeDrawer()
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.headerRow}>
        <h1>Purchase Orders</h1>
        <div className={styles.headerActions}>
          <button className="btn btn--primary btn--sm" onClick={() => setShowDrawer(true)} style={{ height: '32px' }}>
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
              <button className="btn btn--primary btn--sm" onClick={() => setShowDrawer(true)}>
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
                  <td>{new Date(po.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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

      {/* ── New Purchase Order Drawer ── */}
      {showDrawer && (
        <div className="overlay" onClick={closeDrawer}>
          <div className="drawer" style={{ width: '620px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="drawer__header">
              <h3 className="drawer__title">New Purchase Order</h3>
              <button className="drawer__close" onClick={closeDrawer}><X size={18} /></button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.drawerForm}>

                {/* Vendor */}
                <div className="form-group">
                  <label className="form-label form-label--required">Vendor</label>
                  {!addingSupplier ? (
                    <CustomSelect
                      value={supplierId}
                      placeholder="Select vendor"
                      options={[
                        ...suppliers.map(s => ({ value: s.id, label: s.name })),
                        { value: '__new__', label: '+ Add new vendor', isAction: true },
                      ]}
                      onChange={v => (v === '__new__' ? setAddingSupplier(true) : setSupplierId(v))}
                    />
                  ) : (
                    <div className={styles.inlineCreate}>
                      <input
                        className="form-input"
                        autoFocus
                        placeholder="Vendor name"
                        value={newSupplierName}
                        onChange={e => setNewSupplierName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddSupplier()
                          if (e.key === 'Escape') setAddingSupplier(false)
                        }}
                      />
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} onClick={handleAddSupplier}>
                        <Check size={15} />
                      </button>
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} onClick={() => setAddingSupplier(false)}>
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label form-label--required">Order Date</label>
                    <input className="form-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Expected Delivery <span className="text-tertiary font-normal">(Optional)</span></label>
                    <input className="form-input" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                  </div>
                </div>

                {/* Line items */}
                <div className={styles.sectionLabel}>Line Items</div>
                <div className={styles.lineItemsSection}>
                  {draftItems.map(item => (
                    <div key={item.id} className={styles.lineItemRow}>
                      <input
                        className={`form-input ${styles.lineItemName}`}
                        placeholder="Item name (e.g. Cashews)"
                        value={item.item_name}
                        onChange={e => updateDraftItem(item.id, { item_name: e.target.value })}
                      />
                      <input
                        className={`form-input ${styles.lineItemName}`}
                        placeholder="Variant (e.g. 250g Pack)"
                        value={item.variant_label}
                        onChange={e => updateDraftItem(item.id, { variant_label: e.target.value })}
                      />
                      <input
                        className={`form-input ${styles.lineItemQty}`}
                        type="number" min="0"
                        placeholder="Qty"
                        value={item.qty_ordered}
                        onChange={e => updateDraftItem(item.id, { qty_ordered: e.target.value === '' ? '' : Number(e.target.value) })}
                      />
                      <input
                        className={`form-input ${styles.lineItemCost}`}
                        type="number" min="0"
                        placeholder="Cost / unit"
                        value={item.unit_cost}
                        onChange={e => updateDraftItem(item.id, { unit_cost: e.target.value === '' ? '' : Number(e.target.value) })}
                      />
                      <span className={styles.lineItemTotal}>
                        {formatINR(Number(item.qty_ordered || 0) * Number(item.unit_cost || 0))}
                      </span>
                      <button
                        type="button"
                        className={styles.lineItemRemove}
                        disabled={draftItems.length <= 1}
                        onClick={() => removeDraftItemRow(item.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div className={styles.lineItemsFooter}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={addDraftItemRow}>
                      <Plus size={14} /> Add line
                    </button>
                    <span className={styles.grandTotal}>Total: {formatINR(draftTotal)}</span>
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Notes <span className="text-tertiary font-normal">(Optional)</span></label>
                  <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions, payment terms, etc." />
                </div>

              </div>
            </div>

            <div className={`drawer__footer ${styles.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={closeDrawer}>Cancel</button>
              <button className="btn btn--outline" disabled={!canSave} onClick={() => handleSave('draft')}>Save as Draft</button>
              <button className="btn btn--primary" disabled={!canSave} onClick={() => handleSave('ordered')}>Place Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
