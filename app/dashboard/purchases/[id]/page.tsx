'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Ban, Truck, FileText, Plus, Info, X, Pencil, Paperclip, Eye } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders, formatINR, formatDateShort } from '@/lib/mock-data'
import type { MockPurchaseOrder, MockReceiptHistoryEntry, MockPaymentHistoryEntry, PurchaseOrderStatus, PaymentStatus } from '@/lib/mock-data'
import CustomSelect from '@/components/ui/CustomSelect'
import styles from '../purchases.module.css'

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque']

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

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const initPo = mockPurchaseOrders.find(p => p.id === id) ?? null
  const [po, setPo] = useState<MockPurchaseOrder | null>(initPo)
  const [receivingItemId, setReceivingItemId] = useState<string | null>(null)
  const [receiveQty, setReceiveQty] = useState<number | ''>('')
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [historyForItemId, setHistoryForItemId] = useState<string | null>(null)
  const [loggingPayment, setLoggingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('')
  const [paymentDateInput, setPaymentDateInput] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentMethodInput, setPaymentMethodInput] = useState(PAYMENT_METHODS[0])
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview')

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

  function startReceivingItem(itemId: string) {
    setReceivingItemId(itemId)
    setReceiveQty('')
    setReceiveDate(new Date().toISOString().slice(0, 10))
  }

  function cancelReceivingItem() {
    setReceivingItemId(null)
    setReceiveQty('')
  }

  function confirmReceiveItem(itemId: string) {
    if (!po) return
    const addQty = Number(receiveQty)
    if (!addQty || addQty <= 0 || !receiveDate) return

    const receivedItem = po.items.find(i => i.id === itemId)
    const updatedItems = po.items.map(i =>
      i.id === itemId ? { ...i, qty_received: Math.min(i.qty_ordered, i.qty_received + addQty) } : i
    )
    const allReceived = updatedItems.every(i => i.qty_received >= i.qty_ordered)
    const anyReceived = updatedItems.some(i => i.qty_received > 0)

    setPo({
      ...po,
      items: updatedItems,
      status: allReceived ? 'received' : anyReceived ? 'partially_received' : po.status,
      // Keep the order's received_date as the latest delivery date logged
      // across all items — unless the user has set it manually to something later.
      received_date: anyReceived && (!po.received_date || receiveDate > po.received_date) ? receiveDate : po.received_date,
      receipt_history: receivedItem
        ? [
            {
              id: `rh-${Date.now()}`,
              item_id: itemId,
              date: receiveDate,
              item_name: receivedItem.item_name,
              variant_label: receivedItem.variant_label,
              qty: addQty,
            },
            ...(po.receipt_history ?? []),
          ]
        : po.receipt_history,
    })
    setReceivingItemId(null)
    setReceiveQty('')
  }

  function handleReceivedDateChange(value: string) {
    if (!po) return
    setPo({ ...po, received_date: value || null })
  }

  function handlePaymentStatusChange(value: string) {
    if (!po) return
    const status = value as PaymentStatus
    setPo({
      ...po,
      payment_status: status,
      paid_amount: status === 'pending' ? null : po.paid_amount,
    })
  }

  function startLoggingPayment() {
    setLoggingPayment(true)
    setPaymentAmount('')
    setPaymentDateInput(new Date().toISOString().slice(0, 10))
    setPaymentMethodInput(PAYMENT_METHODS[0])
  }

  function confirmLogPayment() {
    if (!po) return
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0 || !paymentDateInput) return

    const paidSoFar = (po.paid_amount ?? 0) + amount
    const status: PaymentStatus = paidSoFar >= total ? 'paid' : 'partially_paid'

    setPo({
      ...po,
      payment_status: status,
      paid_amount: paidSoFar,
      payment_date: paymentDateInput,
      payment_method: paymentMethodInput,
      payment_history: [
        { id: `ph-${Date.now()}`, date: paymentDateInput, amount, method: paymentMethodInput },
        ...(po.payment_history ?? []),
      ],
    })
    setLoggingPayment(false)
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
            <button className="btn btn--outline btn--sm" onClick={() => router.push(`/dashboard/purchases/${po.id}/edit`)}>
              <Pencil size={14} /> Edit
            </button>
          )}
          {po.status === 'draft' && (
            <button className="btn btn--primary btn--sm" onClick={markAsOrdered}>
              <Truck size={14} /> Place Order
            </button>
          )}
          {po.status !== 'received' && po.status !== 'cancelled' && (
            <button className="btn btn--outline btn--sm" onClick={cancelOrder}>
              <Ban size={14} /> Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'documents' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <Paperclip size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Documents
        </button>
      </div>

      {activeTab === 'documents' && (
        <div className={styles.documentsPanel}>
          {po.invoice_file_url ? (
            <div className={styles.documentCard}>
              <div className={styles.documentCardIcon}>
                <FileText size={18} />
              </div>
              <div className={styles.documentCardInfo}>
                <span className={styles.documentCardName}>{po.invoice_file_name || 'Invoice'}</span>
                {po.invoice_number && <span className="text-secondary text-sm">Invoice #{po.invoice_number}</span>}
              </div>
              <a
                href={po.invoice_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--outline btn--sm"
                title={po.invoice_file_name}
              >
                <Eye size={14} /> View
              </a>
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state__title">No invoice uploaded</p>
              <p className="empty-state__desc">Attach an invoice from the edit screen to see it here.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          {/* Info grid */}
          <div className={styles.infoGrid}>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Order Date</span>
              <span className={styles.infoValue}>{po.order_date ? formatDateShort(po.order_date) : '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Expected Delivery</span>
              <span className={styles.infoValue}>{po.expected_date ? formatDateShort(po.expected_date) : '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Received Date</span>
              <input
                type="date"
                className={`form-input ${styles.receivedDateInput}`}
                value={po.received_date ?? ''}
                onChange={e => handleReceivedDateChange(e.target.value)}
              />
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Vendor Contact</span>
              <span className={styles.infoValue}>{supplier?.phone || supplier?.email || '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Total Amount</span>
              <span className={styles.infoValue}>{formatINR(total)}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Invoice Number</span>
              <span className={styles.infoValue}>{po.invoice_number || '—'}</span>
            </div>
            <div className={`${styles.infoField} ${styles.infoFieldWide}`}>
              <span className={styles.infoLabel}>Payment Status</span>
              <div className={styles.paymentRow}>
                <div className={styles.paymentStatusSelect}>
                  <CustomSelect
                    value={po.payment_status}
                    onChange={handlePaymentStatusChange}
                    options={[
                      { value: 'pending', label: 'Pending' },
                      { value: 'partially_paid', label: 'Partially Paid' },
                      { value: 'paid', label: 'Paid' },
                    ]}
                  />
                </div>

                {po.payment_status !== 'pending' && (
                  <span className="text-secondary text-sm">
                    {formatINR(po.paid_amount ?? 0)} paid
                    {po.payment_status === 'partially_paid' && (
                      <> · {formatINR(Math.max(0, total - (po.paid_amount ?? 0)))} remaining</>
                    )}
                  </span>
                )}

                {po.payment_status !== 'paid' && (
                  <button type="button" className={styles.receiveAddBtn} onClick={startLoggingPayment} title="Log a payment">
                    <Plus size={13} />
                  </button>
                )}
                {(po.payment_history ?? []).length > 1 && (
                  <button type="button" className={styles.infoIconBtn} onClick={() => setShowPaymentHistory(true)} title="View payment history">
                    <Info size={13} />
                  </button>
                )}
              </div>

              {loggingPayment && (
                <LogPaymentPopup
                  remaining={Math.max(0, total - (po.paid_amount ?? 0))}
                  amount={paymentAmount}
                  onAmountChange={setPaymentAmount}
                  date={paymentDateInput}
                  onDateChange={setPaymentDateInput}
                  method={paymentMethodInput}
                  onMethodChange={setPaymentMethodInput}
                  onConfirm={confirmLogPayment}
                  onCancel={() => setLoggingPayment(false)}
                />
              )}

              {showPaymentHistory && (
                <PaymentHistoryPopup
                  entries={po.payment_history ?? []}
                  onClose={() => setShowPaymentHistory(false)}
                />
              )}
            </div>
          </div>

          {/* Line items */}
          <div className={styles.itemsPanel}>
            <div className={styles.itemsPanelHead}>
              <span className={styles.itemsPanelTitle}>Line Items ({po.items.length})</span>
              {canReceive && <span className="text-sm text-secondary">Hover a row to log stock received</span>}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Variant</th>
                  <th>Unit</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Unit Cost</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map(item => {
                  const remaining = item.qty_ordered - item.qty_received
                  const isReceivingThis = receivingItemId === item.id
                  const itemHistory = (po.receipt_history ?? []).filter(h => h.item_id === item.id)
                  return (
                    <tr key={item.id} className={styles.lineItemDetailRow}>
                      <td>{item.item_name}</td>
                      <td>{item.variant_label}</td>
                      <td>{item.unit}</td>
                      <td>{item.qty_ordered}</td>
                      <td>
                        <div className={styles.receiveDisplay}>
                          <span>{item.qty_received} / {item.qty_ordered}</span>
                          {canReceive && (
                            <button
                              type="button"
                              className={styles.receiveAddBtn}
                              onClick={() => startReceivingItem(item.id)}
                              disabled={remaining <= 0}
                              title="Log stock received"
                            >
                              <Plus size={13} />
                            </button>
                          )}
                          {itemHistory.length > 1 && (
                            <button
                              type="button"
                              className={styles.infoIconBtn}
                              onClick={() => setHistoryForItemId(item.id)}
                              title="View delivery history"
                            >
                              <Info size={13} />
                            </button>
                          )}
                        </div>

                        {isReceivingThis && (
                          <ReceiveStockPopup
                            itemName={item.item_name}
                            variantLabel={item.variant_label}
                            remaining={remaining}
                            qty={receiveQty}
                            onQtyChange={setReceiveQty}
                            date={receiveDate}
                            onDateChange={setReceiveDate}
                            onConfirm={() => confirmReceiveItem(item.id)}
                            onCancel={cancelReceivingItem}
                          />
                        )}

                        {historyForItemId === item.id && (
                          <ReceiptHistoryPopup
                            itemName={item.item_name}
                            variantLabel={item.variant_label}
                            entries={itemHistory}
                            onClose={() => setHistoryForItemId(null)}
                          />
                        )}
                      </td>
                      <td>{formatINR(item.unit_cost)}</td>
                      <td>{formatINR(item.qty_ordered * item.unit_cost)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {po.notes && (
            <div className={styles.notesPanel}>
              <strong className="text-primary">Notes: </strong>{po.notes}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LogPaymentPopup({
  remaining,
  amount,
  onAmountChange,
  date,
  onDateChange,
  method,
  onMethodChange,
  onConfirm,
  onCancel,
}: {
  remaining: number
  amount: number | ''
  onAmountChange: (value: number | '') => void
  date: string
  onDateChange: (value: string) => void
  method: string
  onMethodChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const canConfirm = Number(amount) > 0 && !!date

  return (
    <div className={styles.receivePopupOverlay} onMouseDown={onCancel}>
      <div className={styles.receivePopup} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.receivePopupTitle}>Log Payment</div>
        <p className={styles.receivePopupSubtitle}>{formatINR(remaining)} remaining on this order</p>

        <div className={styles.receivePopupRow}>
          <div className="form-group">
            <label className="form-label form-label--required">Amount paid</label>
            <div className="input-prefix">
              <span className="input-prefix__label">₹</span>
              <input
                className="form-input"
                type="number"
                min={1}
                max={remaining || undefined}
                placeholder="0"
                autoFocus
                value={amount}
                onChange={e => onAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && canConfirm) onConfirm()
                  if (e.key === 'Escape') onCancel()
                }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label form-label--required">Date paid</label>
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={e => onDateChange(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label form-label--required">Payment method</label>
          <CustomSelect
            value={method}
            onChange={onMethodChange}
            options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
          />
        </div>

        <div className={styles.receivePopupActions}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!canConfirm} onClick={onConfirm}>
            Add Payment
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentHistoryPopup({
  entries,
  onClose,
}: {
  entries: MockPaymentHistoryEntry[]
  onClose: () => void
}) {
  return (
    <div className={styles.receivePopupOverlay} onMouseDown={onClose}>
      <div className={styles.receivePopup} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.historyPopupHead}>
          <div className={styles.receivePopupTitle}>Payment History</div>
          <button type="button" className={styles.receiveIconBtn} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.historyList}>
          {entries.map(entry => (
            <div key={entry.id} className={styles.historyRow}>
              <span className={styles.historyQty}>{formatINR(entry.amount)}</span>
              <span className="text-secondary text-sm">{entry.method}</span>
              <span className={styles.historyDate}>{formatDateShort(entry.date)}</span>
            </div>
          ))}
        </div>

        <div className={styles.receivePopupActions}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function ReceiptHistoryPopup({
  itemName,
  variantLabel,
  entries,
  onClose,
}: {
  itemName: string
  variantLabel: string
  entries: MockReceiptHistoryEntry[]
  onClose: () => void
}) {
  return (
    <div className={styles.receivePopupOverlay} onMouseDown={onClose}>
      <div className={styles.receivePopup} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.historyPopupHead}>
          <div>
            <div className={styles.receivePopupTitle}>Delivery History</div>
            <p className={styles.receivePopupSubtitle}>
              {itemName}{variantLabel && variantLabel !== '—' ? ` · ${variantLabel}` : ''}
            </p>
          </div>
          <button type="button" className={styles.receiveIconBtn} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.historyList}>
          {entries.map(entry => (
            <div key={entry.id} className={styles.historyRow}>
              <span className={styles.historyQty}>+{entry.qty}</span>
              <span className={styles.historyDate}>{formatDateShort(entry.date)}</span>
            </div>
          ))}
        </div>

        <div className={styles.receivePopupActions}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function ReceiveStockPopup({
  itemName,
  variantLabel,
  remaining,
  qty,
  onQtyChange,
  date,
  onDateChange,
  onConfirm,
  onCancel,
}: {
  itemName: string
  variantLabel: string
  remaining: number
  qty: number | ''
  onQtyChange: (value: number | '') => void
  date: string
  onDateChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const canConfirm = Number(qty) > 0 && !!date

  return (
    <div className={styles.receivePopupOverlay} onMouseDown={onCancel}>
      <div className={styles.receivePopup} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.receivePopupTitle}>Log Stock Received</div>
        <p className={styles.receivePopupSubtitle}>
          {itemName}{variantLabel && variantLabel !== '—' ? ` · ${variantLabel}` : ''}
        </p>

        <div className={styles.receivePopupRow}>
          <div className="form-group">
            <label className="form-label form-label--required">Qty received</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={remaining}
              placeholder="Qty"
              autoFocus
              value={qty}
              onChange={e => onQtyChange(e.target.value === '' ? '' : Number(e.target.value))}
              onKeyDown={e => {
                if (e.key === 'Enter' && canConfirm) onConfirm()
                if (e.key === 'Escape') onCancel()
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label form-label--required">Date received</label>
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={e => onDateChange(e.target.value)}
            />
          </div>
        </div>
        <p className="form-hint">{remaining} still pending out of the order</p>

        <div className={styles.receivePopupActions}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!canConfirm} onClick={onConfirm}>
            Add to Received
          </button>
        </div>
      </div>
    </div>
  )
}
