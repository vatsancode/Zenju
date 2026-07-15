'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, PackageCheck, Ban, Truck } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders, formatINR } from '@/lib/mock-data'
import type { MockPurchaseOrder, PurchaseOrderStatus } from '@/lib/mock-data'
import styles from '../purchases.module.css'

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

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const initPo = mockPurchaseOrders.find(p => p.id === id) ?? null
  const [po, setPo] = useState<MockPurchaseOrder | null>(initPo)
  const [receiving, setReceiving] = useState(false)
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({})

  if (!po) {
    return (
      <div>
        <button className={styles.backArrow} onClick={() => router.push('/dashboard/purchases')} title="Back to Purchase Orders">
          <ArrowLeft size={16} />
        </button>
        <div className="empty-state">
          <p className="empty-state__title">Purchase order not found</p>
          <p className="empty-state__desc">The purchase order you are looking for does not exist.</p>
        </div>
      </div>
    )
  }

  const supplier = mockSuppliers.find(s => s.id === po.supplier_id)
  const total = po.items.reduce((sum, i) => sum + i.qty_ordered * i.unit_cost, 0)
  const canReceive = po.status === 'ordered' || po.status === 'partially_received'

  function startReceiving() {
    if (!po) return
    setReceiveQty(Object.fromEntries(po.items.map(i => [i.id, i.qty_ordered - i.qty_received])))
    setReceiving(true)
  }

  function confirmReceipt() {
    if (!po) return
    const updatedItems = po.items.map(i => ({
      ...i,
      qty_received: Math.min(i.qty_ordered, i.qty_received + (receiveQty[i.id] || 0)),
    }))
    const allReceived = updatedItems.every(i => i.qty_received >= i.qty_ordered)
    const anyReceived = updatedItems.some(i => i.qty_received > 0)
    const updated: MockPurchaseOrder = {
      ...po,
      items: updatedItems,
      status: allReceived ? 'received' : anyReceived ? 'partially_received' : po.status,
    }
    setPo(updated)
    setReceiving(false)
  }

  function markAsOrdered() {
    if (!po) return
    setPo({ ...po, status: 'ordered' })
  }

  function cancelOrder() {
    if (!po) return
    setPo({ ...po, status: 'cancelled' })
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <button className={styles.backArrow} onClick={() => router.push('/dashboard/purchases')} title="Back to Purchase Orders">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.poTitle}>{po.po_number}</h1>
            <div className={styles.poMeta}>
              <span className={`badge badge--${STATUS_BADGE[po.status]}`}>{STATUS_LABELS[po.status]}</span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{supplier?.name ?? 'Unknown vendor'}</span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{po.branch}</span>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          {po.status === 'draft' && (
            <button className="btn btn--primary btn--sm" onClick={markAsOrdered}>
              <Truck size={14} /> Place Order
            </button>
          )}
          {canReceive && !receiving && (
            <button className="btn btn--primary btn--sm" onClick={startReceiving}>
              <PackageCheck size={14} /> Receive Stock
            </button>
          )}
          {po.status !== 'received' && po.status !== 'cancelled' && (
            <button className="btn btn--outline btn--sm" onClick={cancelOrder}>
              <Ban size={14} /> Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className={styles.infoGrid}>
        <div className={styles.infoField}>
          <span className={styles.infoLabel}>Order Date</span>
          <span className={styles.infoValue}>{new Date(po.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
        <div className={styles.infoField}>
          <span className={styles.infoLabel}>Expected Delivery</span>
          <span className={styles.infoValue}>
            {po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </span>
        </div>
        <div className={styles.infoField}>
          <span className={styles.infoLabel}>Vendor Contact</span>
          <span className={styles.infoValue}>{supplier?.phone || supplier?.email || '—'}</span>
        </div>
        <div className={styles.infoField}>
          <span className={styles.infoLabel}>Total Amount</span>
          <span className={styles.infoValue}>{formatINR(total)}</span>
        </div>
      </div>

      {/* Line items */}
      <div className={styles.itemsPanel}>
        <div className={styles.itemsPanelHead}>
          <span className={styles.itemsPanelTitle}>Line Items ({po.items.length})</span>
          {receiving && <span className="text-sm text-secondary">Enter quantities actually received, then confirm</span>}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Variant</th>
              <th>Unit</th>
              <th style={{ textAlign: 'right' }}>Ordered</th>
              <th style={{ textAlign: 'right' }}>{receiving ? 'Receiving Now' : 'Received'}</th>
              <th style={{ textAlign: 'right' }}>Unit Cost</th>
              <th style={{ textAlign: 'right' }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map(item => (
              <tr key={item.id}>
                <td>{item.item_name}</td>
                <td>{item.variant_label}</td>
                <td>{item.unit}</td>
                <td style={{ textAlign: 'right' }}>{item.qty_ordered}</td>
                <td style={{ textAlign: 'right' }}>
                  {receiving ? (
                    <input
                      className={styles.receiveQtyInput}
                      type="number"
                      min={0}
                      max={item.qty_ordered - item.qty_received}
                      value={receiveQty[item.id] ?? 0}
                      onChange={e => setReceiveQty(prev => ({
                        ...prev,
                        [item.id]: Math.max(0, Math.min(item.qty_ordered - item.qty_received, Number(e.target.value))),
                      }))}
                    />
                  ) : (
                    `${item.qty_received} / ${item.qty_ordered}`
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>{formatINR(item.unit_cost)}</td>
                <td style={{ textAlign: 'right' }}>{formatINR(item.qty_ordered * item.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {po.notes && (
        <div className={styles.notesPanel}>
          <strong className="text-primary">Notes: </strong>{po.notes}
        </div>
      )}

      {receiving && (
        <div className={styles.footerActions}>
          <button className="btn btn--ghost" onClick={() => setReceiving(false)}>Cancel</button>
          <button className="btn btn--primary" onClick={confirmReceipt}>Confirm Receipt</button>
        </div>
      )}
    </div>
  )
}
