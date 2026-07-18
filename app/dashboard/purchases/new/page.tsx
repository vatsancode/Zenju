'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Check, ChevronDown, ChevronUp, Upload, FileText } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders, formatINR } from '@/lib/mock-data'
import type { MockPurchaseOrder, MockPurchaseOrderItem, PurchaseOrderStatus, PaymentStatus } from '@/lib/mock-data'
import CustomSelect from '@/components/ui/CustomSelect'
import AddProductModal, { type PickedLine } from '@/components/purchases/AddProductModal'
import styles from '../purchases.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

const PURCHASE_STATUS_OPTIONS: { value: PurchaseOrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
]

const DEFAULT_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque']

type Step = 'details' | 'items'

// ─── Page ───────────────────────────────────────────────────────────────────

export default function NewPurchaseOrderPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('details')

  // ── Vendor & order info ────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState(mockSuppliers)
  const [supplierId, setSupplierId] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')

  // ── Purchase status ─────────────────────────────────────────────────────────
  const [status, setStatus] = useState<PurchaseOrderStatus>('draft')
  const [expectedDate, setExpectedDate] = useState('')
  const [receivedDate, setReceivedDate] = useState('')

  // ── Payment status ──────────────────────────────────────────────────────────
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending')
  const [paidAmount, setPaidAmount] = useState<number | ''>('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false)
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('')

  // ── Line items & notes ──────────────────────────────────────────────────────
  const [notes, setNotes] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)

  // ── Invoice attachment ──────────────────────────────────────────────────────
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const invoiceInputRef = useRef<HTMLInputElement>(null)

  function handleInvoiceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setInvoiceFile(file)
    e.target.value = ''
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const draftTotal = draftItems.reduce(
    (sum, i) => sum + Number(i.qty_ordered || 0) * Number(i.unit_cost || 0),
    0
  )
  const draftItemCount = draftItems.filter(i => i.item_name.trim()).length

  function handleAddSupplier() {
    const name = newSupplierName.trim()
    if (!name) { setAddingSupplier(false); return }
    const created = { id: `s-${Date.now()}`, name, phone: '', email: '', notes: '' }
    setSuppliers(prev => [...prev, created])
    setSupplierId(created.id)
    setAddingSupplier(false)
    setNewSupplierName('')
  }

  function handleAddPaymentMethod() {
    const name = newPaymentMethodName.trim()
    if (!name) { setAddingPaymentMethod(false); return }
    setPaymentMethods(prev => (prev.includes(name) ? prev : [...prev, name]))
    setPaymentMethod(name)
    setAddingPaymentMethod(false)
    setNewPaymentMethodName('')
  }

  function updateDraftItem(id: string, patch: Partial<DraftItem>) {
    setDraftItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
  }

  function removeDraftItemRow(id: string) {
    setDraftItems(prev => prev.filter(i => i.id !== id))
  }

  function handleAddPickedLines(lines: PickedLine[]) {
    setDraftItems(prev => [
      ...prev,
      ...lines.map(l => ({
        id: `${Date.now()}-${Math.random()}`,
        item_name: l.item_name,
        variant_label: l.variant_label,
        unit: l.unit,
        qty_ordered: l.qty_ordered as number | '',
        unit_cost: l.unit_cost as number | '',
      })),
    ])
    setShowAddProductModal(false)
  }

  const detailsSummary = supplierId
    ? suppliers.find(s => s.id === supplierId)?.name ?? 'Vendor selected'
    : 'No vendor selected yet'

  const canSave = !!supplierId
    && draftItems.some(i => i.item_name.trim() && Number(i.qty_ordered) > 0 && Number(i.unit_cost) > 0)

  function handleCancel() {
    router.push('/dashboard/purchases')
  }

  function handleSave() {
    if (!canSave) return
    const items: MockPurchaseOrderItem[] = draftItems
      .filter(i => i.item_name.trim() && Number(i.qty_ordered) > 0)
      .map(i => ({
        id: `${Date.now()}-${Math.random()}`,
        item_name: i.item_name.trim(),
        variant_label: i.variant_label.trim() || '—',
        unit: i.unit,
        qty_ordered: Number(i.qty_ordered),
        qty_received: status === 'received' ? Number(i.qty_ordered) : 0,
        unit_cost: Number(i.unit_cost),
      }))

    const created: MockPurchaseOrder = {
      id: `po-${Date.now()}`,
      po_number: genPoNumber(mockPurchaseOrders),
      supplier_id: supplierId,
      branch: 'Main Branch',
      order_date: orderDate || null,
      expected_date: status === 'ordered' ? (expectedDate || null) : null,
      received_date: status === 'received' ? (receivedDate || null) : null,
      invoice_number: invoiceNumber.trim(),
      status,
      payment_status: paymentStatus,
      paid_amount: paymentStatus === 'partially_paid' && paidAmount !== '' ? Number(paidAmount) : null,
      payment_date: paymentStatus === 'paid' ? (paymentDate || null) : null,
      payment_method: paymentStatus === 'paid' ? (paymentMethod || null) : null,
      notes: notes.trim(),
      items,
      created_at: new Date().toISOString(),
      invoice_file_name: invoiceFile?.name,
      // Object URL only lives for this browser session — fine for a
      // no-backend mock, but won't survive a page reload.
      invoice_file_url: invoiceFile ? URL.createObjectURL(invoiceFile) : undefined,
    }

    // UI-only mock: mutate the shared array so the Purchases list picks it
    // up on next mount — this app has no backend to persist to yet.
    mockPurchaseOrders.unshift(created)
    router.push('/dashboard/purchases')
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <button className={styles.backArrow} onClick={handleCancel} title="Back to Purchase Orders">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.poTitle}>New Purchase Order</h1>
          </div>
        </div>
      </div>

      <div className={styles.newPoLayout}>
        {/* ── Main form column ── */}
        <div className={styles.newPoMain}>

          {/* ── Step 1: Order Details (collapsible) ── */}
          <div className="card">
            <button
              type="button"
              className={styles.newPoStepHeader}
              onClick={() => setStep(step === 'details' ? 'items' : 'details')}
            >
              <span className={styles.sectionLabel}>Order Details</span>
              {step === 'details' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {step !== 'details' && (
              <div className={styles.newPoCollapsedSummary}>{detailsSummary}</div>
            )}

            {step === 'details' && (
              <div className={styles.newPoDetailSections}>

                {/* Vendor & order info */}
                <div className={styles.newPoDetailSection}>
                  <span className={styles.newPoSubLabel}>Vendor &amp; Order Info</span>
                  <div className={styles.newPoFormGrid}>
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

                    <div className="form-group">
                      <label className="form-label">Order Date <span className="text-tertiary font-normal">(Optional)</span></label>
                      <input className="form-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Invoice Number <span className="text-tertiary font-normal">(Optional)</span></label>
                      <input
                        className="form-input"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-2201"
                      />
                    </div>
                  </div>
                </div>

                {/* Purchase status */}
                <div className={styles.newPoDetailSection}>
                  <span className={styles.newPoSubLabel}>Purchase Status</span>
                  <div className={styles.newPoStatusRow}>
                    <div className={`form-group ${styles.newPoStatusField}`}>
                      <label className="form-label form-label--required">Status</label>
                      <CustomSelect
                        value={status}
                        options={PURCHASE_STATUS_OPTIONS}
                        onChange={v => setStatus(v as PurchaseOrderStatus)}
                      />
                    </div>

                    {status === 'ordered' && (
                      <div className={styles.newPoConditionalPanel}>
                        <div className="form-group">
                          <label className="form-label">Expected Delivery <span className="text-tertiary font-normal">(Optional)</span></label>
                          <input className="form-input" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                        </div>
                      </div>
                    )}

                    {status === 'received' && (
                      <div className={styles.newPoConditionalPanel}>
                        <div className="form-group">
                          <label className="form-label">Received Date <span className="text-tertiary font-normal">(Optional)</span></label>
                          <input className="form-input" type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment */}
                <div className={styles.newPoDetailSection}>
                  <span className={styles.newPoSubLabel}>Payment</span>
                  <div className={styles.newPoStatusRow}>
                    <div className={`form-group ${styles.newPoStatusField}`}>
                      <label className="form-label form-label--required">Payment Status</label>
                      <CustomSelect
                        value={paymentStatus}
                        options={PAYMENT_STATUS_OPTIONS}
                        onChange={v => setPaymentStatus(v as PaymentStatus)}
                      />
                    </div>

                    {paymentStatus === 'partially_paid' && (
                      <div className={styles.newPoConditionalPanel}>
                        <div className="form-group">
                          <label className="form-label form-label--required">Paid Amount</label>
                          <div className="input-prefix">
                            <span className="input-prefix__label">₹</span>
                            <input
                              className="form-input"
                              type="number" min="0"
                              value={paidAmount}
                              onChange={e => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentStatus === 'paid' && (
                      <div className={`${styles.newPoConditionalPanel} ${styles.newPoConditionalPanelWide}`}>
                        <div className="form-group">
                          <label className="form-label">Payment Date <span className="text-tertiary font-normal">(Optional)</span></label>
                          <input className="form-input" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label form-label--required">Payment Method</label>
                          {!addingPaymentMethod ? (
                            <CustomSelect
                              value={paymentMethod}
                              placeholder="Select method"
                              options={[
                                ...paymentMethods.map(m => ({ value: m, label: m })),
                                { value: '__new__', label: '+ Create new method', isAction: true },
                              ]}
                              onChange={v => (v === '__new__' ? setAddingPaymentMethod(true) : setPaymentMethod(v))}
                            />
                          ) : (
                            <div className={styles.inlineCreate}>
                              <input
                                className="form-input"
                                autoFocus
                                placeholder="e.g. Net Banking"
                                value={newPaymentMethodName}
                                onChange={e => setNewPaymentMethodName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleAddPaymentMethod()
                                  if (e.key === 'Escape') setAddingPaymentMethod(false)
                                }}
                              />
                              <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} onClick={handleAddPaymentMethod}>
                                <Check size={15} />
                              </button>
                              <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} onClick={() => setAddingPaymentMethod(false)}>
                                <X size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.newPoStepFooter}>
                  <button type="button" className="btn btn--primary btn--sm" disabled={!supplierId} onClick={() => setStep('items')}>
                    Next: Line Items
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Step 2: Line Items (collapsible) ── */}
          <div className="card">
            <div className={styles.newPoStepHeaderRow}>
              <button
                type="button"
                className={styles.newPoStepToggle}
                onClick={() => setStep(step === 'items' ? 'details' : 'items')}
              >
                <span className={styles.sectionLabel}>Line Items</span>
                {step === 'items' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {step === 'items' && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowAddProductModal(true)}>
                  <Plus size={14} /> Add Product
                </button>
              )}
            </div>

            {step !== 'items' && (
              <div className={styles.newPoCollapsedSummary}>
                {draftItemCount} item{draftItemCount !== 1 ? 's' : ''} · Total: {formatINR(draftTotal)}
              </div>
            )}

            {step === 'items' && (
              draftItems.length === 0 ? (
                <div className={styles.lineItemsEmpty}>
                  <p>No products added yet.</p>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowAddProductModal(true)}>
                    <Plus size={14} /> Add Product
                  </button>
                </div>
              ) : (
                <div className={styles.lineItemsTable}>
                  <div className={`${styles.lineItemGrid} ${styles.lineItemsHead}`}>
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Cost / Unit</span>
                    <span className={styles.lineItemsHeadRight}>Amount</span>
                    <span />
                  </div>

                  {draftItems.map(item => (
                    <div key={item.id} className={`${styles.lineItemGrid} ${styles.lineItemRow}`}>
                      <div className={styles.lineItemProduct}>
                        <span className={styles.lineItemName}>{item.item_name}</span>
                        {item.variant_label && item.variant_label !== '—' && (
                          <span className={styles.lineItemVariant}>{item.variant_label}</span>
                        )}
                      </div>
                      <input
                        className={`form-input ${styles.lineItemInput}`}
                        type="number" min="0"
                        placeholder="0"
                        value={item.qty_ordered}
                        onChange={e => updateDraftItem(item.id, { qty_ordered: e.target.value === '' ? '' : Number(e.target.value) })}
                      />
                      <div className={`input-prefix ${styles.lineItemCostWrap}`}>
                        <span className="input-prefix__label">₹</span>
                        <input
                          className={`form-input ${styles.lineItemInput}`}
                          type="number" min="0"
                          placeholder="0"
                          value={item.unit_cost}
                          onChange={e => updateDraftItem(item.id, { unit_cost: e.target.value === '' ? '' : Number(e.target.value) })}
                        />
                      </div>
                      <span className={styles.lineItemTotal}>
                        {formatINR(Number(item.qty_ordered || 0) * Number(item.unit_cost || 0))}
                      </span>
                      <button
                        type="button"
                        className={styles.lineItemRemove}
                        onClick={() => removeDraftItemRow(item.id)}
                        title="Remove line"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  <div className={styles.lineItemsFooter}>
                    <div className={styles.grandTotalBlock}>
                      <span className={styles.grandTotalLabel}>Total</span>
                      <span className={styles.grandTotal}>{formatINR(draftTotal)}</span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="card">
            <div className="form-group">
              <label className="form-label">Notes <span className="text-tertiary font-normal">(Optional)</span></label>
              <textarea
                className="form-textarea"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Delivery instructions, payment terms, etc."
              />
            </div>
          </div>
        </div>

        {/* ── Sticky summary sidebar ── */}
        <div className={styles.newPoSidebar}>
          <div className={`card ${styles.newPoSummaryCard}`}>
            <div className={styles.sectionLabel}>Summary</div>
            <div className={styles.newPoSummaryRow}>
              <span className="text-secondary text-sm">Line items</span>
              <span className={styles.newPoSummaryValue}>{draftItemCount}</span>
            </div>
            <div className={styles.newPoSummaryRow}>
              <span className="text-secondary text-sm">Total</span>
              <span className={styles.newPoSummaryValue}>{formatINR(draftTotal)}</span>
            </div>

            <div className={styles.newPoSummaryActions}>
              <button className="btn btn--primary" disabled={!canSave} onClick={handleSave}>
                Save Purchase Order
              </button>
              <button className="btn btn--ghost" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>

          <div className={`card ${styles.newPoInvoiceCard}`}>
            <div className={styles.sectionLabel}>Invoice</div>
            <input
              ref={invoiceInputRef}
              type="file"
              accept=".pdf,image/*"
              hidden
              onChange={handleInvoiceFile}
            />
            {!invoiceFile ? (
              <button type="button" className={styles.invoiceUploadZone} onClick={() => invoiceInputRef.current?.click()}>
                <Upload size={18} />
                <span>Upload invoice</span>
                <span className={styles.invoiceUploadHint}>PDF or image</span>
              </button>
            ) : (
              <div className={styles.invoiceFileRow}>
                <FileText size={18} className={styles.invoiceFileIcon} />
                <div className={styles.invoiceFileInfo}>
                  <span className={styles.invoiceFileName}>{invoiceFile.name}</span>
                  <span className={styles.invoiceFileSize}>{formatFileSize(invoiceFile.size)}</span>
                </div>
                <button type="button" className={styles.invoiceFileRemove} onClick={() => setInvoiceFile(null)} title="Remove">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onAdd={handleAddPickedLines}
        />
      )}
    </div>
  )
}
