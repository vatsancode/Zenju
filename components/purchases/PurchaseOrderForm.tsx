'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Check, ChevronDown, ChevronUp, ChevronRight, Upload, FileText, Eye, Truck, PackageOpen, PackageCheck, Ban, Trash2, type LucideIcon } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders, formatINR, formatDateShort } from '@/lib/mock-data'
import type { MockPurchaseOrder, MockPurchaseOrderItem, PurchaseOrderStatus, PaymentStatus } from '@/lib/mock-data'
import CustomSelect from '@/components/ui/CustomSelect'
import AddProductModal, { type PickedLine } from '@/components/purchases/AddProductModal'
import styles from '@/app/dashboard/purchases/purchases.module.css'

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
  // Editable once stock starts arriving; defaults to the ordered qty until
  // the user adjusts it for a partial or short delivery.
  qty_received?: number | ''
}

const PURCHASE_STATUS_OPTIONS: { value: PurchaseOrderStatus; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'draft', label: 'Draft', icon: FileText, hint: 'Not sent to the vendor yet — you can keep editing.' },
  { value: 'ordered', label: 'Ordered', icon: Truck, hint: 'Placed with the vendor, awaiting delivery.' },
  { value: 'partially_received', label: 'Partially Received', icon: PackageOpen, hint: 'Some of the stock has arrived — the rest is still on the way.' },
  { value: 'received', label: 'Received', icon: PackageCheck, hint: 'Stock has already arrived.' },
  { value: 'cancelled', label: 'Cancelled', icon: Ban, hint: 'This order was called off.' },
]

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string; hint: string }[] = [
  { value: 'pending', label: 'Pending', hint: 'Nothing paid to the vendor yet.' },
  { value: 'partially_paid', label: 'Partially Paid', hint: 'Some amount has been paid.' },
  { value: 'paid', label: 'Paid', hint: 'Fully settled with the vendor.' },
]

const DEFAULT_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque']

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  draft: 'draft',
  ordered: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'danger',
}

const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  pending: 'warning',
  partially_paid: 'info',
  paid: 'success',
}

// Linear progressions used by the collapsed-header steppers. `cancelled` sits
// outside this flow — it's a terminal state you only reach from the full form.
const STATUS_STEP_SEQUENCE: PurchaseOrderStatus[] = ['draft', 'ordered', 'partially_received', 'received']
const PAYMENT_STEP_SEQUENCE: PaymentStatus[] = ['pending', 'partially_paid', 'paid']

type Step = 'details' | 'items'

// The label half of the pill opens a dropdown to jump straight to any status;
// the chevron half keeps the quick "advance one step" behaviour. Shared
// between the order-status and payment-status pills since both need it.
function StepperPill<T extends string>({
  value,
  options,
  badgeKey,
  canAdvance,
  onAdvance,
  onSelect,
  advanceTitle,
}: {
  value: T
  options: { value: T; label: string; icon?: LucideIcon }[]
  badgeKey: string
  canAdvance: boolean
  onAdvance: () => void
  onSelect: (v: T) => void
  advanceTitle: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const currentLabel = options.find(o => o.value === value)?.label ?? value

  return (
    <div className={styles.statusStepperGroup} ref={containerRef}>
      <div className={`${styles.statusStepper} ${styles[`statusStepper--${badgeKey}`]}`}>
        <button
          type="button"
          className={styles.statusStepperLabel}
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {currentLabel}
        </button>
        {canAdvance && (
          <button
            type="button"
            className={styles.statusStepperChevron}
            onClick={e => { e.stopPropagation(); onAdvance() }}
            title={advanceTitle}
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className={styles.statusDropdown} role="listbox">
          {options.map(opt => {
            const Icon = opt.icon
            const isActive = value === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`${styles.statusDropdownItem} ${isActive ? styles.statusDropdownItemActive : ''}`}
                onClick={e => { e.stopPropagation(); onSelect(opt.value); setOpen(false) }}
              >
                {Icon && <Icon size={14} />}
                <span>{opt.label}</span>
                {isActive && <Check size={14} className={styles.statusDropdownCheck} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PurchaseOrderForm({ editPo }: { editPo?: MockPurchaseOrder }) {
  const router = useRouter()
  const isEditing = !!editPo

  const [step, setStep] = useState<Step>('details')

  // ── Vendor & order info ────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState(mockSuppliers)
  const [supplierId, setSupplierId] = useState(editPo?.supplier_id ?? '')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [orderDate, setOrderDate] = useState(editPo?.order_date ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(editPo?.invoice_number ?? '')

  // ── Purchase status ─────────────────────────────────────────────────────────
  const [status, setStatus] = useState<PurchaseOrderStatus>(editPo?.status ?? 'draft')
  const [expectedDate, setExpectedDate] = useState(editPo?.expected_date ?? '')
  const [receivedDate, setReceivedDate] = useState(editPo?.received_date ?? '')

  // ── Payment status ──────────────────────────────────────────────────────────
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(editPo?.payment_status ?? 'pending')
  const [paidAmount, setPaidAmount] = useState<number | ''>(editPo?.paid_amount ?? '')
  const [paymentDate, setPaymentDate] = useState(editPo?.payment_date ?? '')
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState(editPo?.payment_method ?? '')
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false)
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('')
  // Picking "Partially Paid" from the collapsed header's dropdown has no
  // expanded form nearby to enter an amount in, so ask for it right there.
  const [showPaidAmountPrompt, setShowPaidAmountPrompt] = useState(false)

  // ── Line items & notes ──────────────────────────────────────────────────────
  const [notes, setNotes] = useState(editPo?.notes ?? '')
  const [draftItems, setDraftItems] = useState<DraftItem[]>(
    editPo?.items.map(i => ({
      id: i.id,
      item_name: i.item_name,
      variant_label: i.variant_label,
      unit: i.unit,
      qty_ordered: i.qty_ordered,
      unit_cost: i.unit_cost,
      qty_received: i.qty_received,
    })) ?? []
  )
  const [showAddProductModal, setShowAddProductModal] = useState(false)

  // ── Invoice attachment ──────────────────────────────────────────────────────
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceRemoved, setInvoiceRemoved] = useState(false)
  const invoiceInputRef = useRef<HTMLInputElement>(null)

  function handleInvoiceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setInvoiceFile(file)
      setInvoiceRemoved(false)
    }
    e.target.value = ''
  }

  const invoiceFileUrl = useMemo(
    () => invoiceFile ? URL.createObjectURL(invoiceFile) : invoiceRemoved ? undefined : editPo?.invoice_file_url,
    [invoiceFile, invoiceRemoved, editPo?.invoice_file_url]
  )

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Before receipt, totals track what was ordered; once stock starts arriving,
  // they track what actually came in (falling back to the ordered qty until
  // the user records an actual received count).
  const isReceivedFlow = status === 'received' || status === 'partially_received'
  // Ordered qty only earns its own column when it can differ from what came
  // in — once an order is fully Received the two numbers should match anyway.
  const showOrderedQtyCol = status === 'partially_received'
  const lineItemGridStyle = showOrderedQtyCol ? { gridTemplateColumns: '2fr 0.6fr 0.7fr 0.9fr 130px 64px' } : undefined
  function receivedQtyValue(item: DraftItem): number | '' {
    return item.qty_received !== undefined && item.qty_received !== '' ? item.qty_received : item.qty_ordered
  }
  function lineQty(item: DraftItem) {
    return isReceivedFlow ? Number(receivedQtyValue(item) || 0) : Number(item.qty_ordered || 0)
  }

  const draftTotal = draftItems.reduce(
    (sum, i) => sum + lineQty(i) * Number(i.unit_cost || 0),
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

  const statusStepIndex = STATUS_STEP_SEQUENCE.indexOf(status)
  const canAdvanceStatus = statusStepIndex !== -1 && statusStepIndex < STATUS_STEP_SEQUENCE.length - 1
  function advanceStatus() {
    if (!canAdvanceStatus) return
    setStatus(STATUS_STEP_SEQUENCE[statusStepIndex + 1])
  }

  const paymentStepIndex = PAYMENT_STEP_SEQUENCE.indexOf(paymentStatus)
  const canAdvancePayment = paymentStepIndex !== -1 && paymentStepIndex < PAYMENT_STEP_SEQUENCE.length - 1

  function handlePaymentStatusChange(next: PaymentStatus) {
    setPaymentStatus(next)
    if (next === 'partially_paid') setShowPaidAmountPrompt(true)
  }

  function advancePayment() {
    if (!canAdvancePayment) return
    handlePaymentStatusChange(PAYMENT_STEP_SEQUENCE[paymentStepIndex + 1])
  }

  // Before stock is received, the vendor's actual price may not be known yet —
  // qty is the only thing required so a draft/ordered PO can still be saved.
  const isPreReceipt = status === 'draft' || status === 'ordered'

  const canSave = !!supplierId
    && draftItems.some(i => i.item_name.trim()
      && (isReceivedFlow || Number(i.qty_ordered) > 0)
      && (isPreReceipt || Number(i.unit_cost) > 0)
      && (!isReceivedFlow || Number(receivedQtyValue(i) || 0) > 0))

  function handleCancel() {
    router.push(isEditing ? `/dashboard/purchases/${editPo!.id}` : '/dashboard/purchases')
  }

  function handleSave() {
    if (!canSave) return
    const items: MockPurchaseOrderItem[] = draftItems
      .filter(i => i.item_name.trim() && (isReceivedFlow ? Number(receivedQtyValue(i) || 0) > 0 : Number(i.qty_ordered) > 0))
      .map(i => ({
        id: i.id,
        item_name: i.item_name.trim(),
        variant_label: i.variant_label.trim() || '—',
        unit: i.unit,
        qty_ordered: Number(i.qty_ordered),
        qty_received: isReceivedFlow ? Number(receivedQtyValue(i) || 0) : Number(i.qty_received || 0),
        unit_cost: Number(i.unit_cost),
      }))

    if (isEditing) {
      const updated: MockPurchaseOrder = {
        ...editPo!,
        supplier_id: supplierId,
        order_date: orderDate || null,
        expected_date: status === 'ordered' ? (expectedDate || null) : editPo!.expected_date,
        received_date: isReceivedFlow ? (receivedDate || null) : editPo!.received_date,
        invoice_number: invoiceNumber.trim(),
        status,
        payment_status: paymentStatus,
        paid_amount: paymentStatus === 'partially_paid' && paidAmount !== '' ? Number(paidAmount) : editPo!.paid_amount,
        payment_date: paymentStatus === 'paid' ? (paymentDate || editPo!.payment_date) : editPo!.payment_date,
        payment_method: paymentStatus === 'paid' ? (paymentMethod || editPo!.payment_method) : editPo!.payment_method,
        notes: notes.trim(),
        items,
        invoice_file_name: invoiceFile ? invoiceFile.name : invoiceRemoved ? undefined : editPo!.invoice_file_name,
        invoice_file_url: invoiceFile ? URL.createObjectURL(invoiceFile) : invoiceRemoved ? undefined : editPo!.invoice_file_url,
      }

      // UI-only mock: mutate the shared array in place so every page reading
      // mockPurchaseOrders sees the update — this app has no backend yet.
      const idx = mockPurchaseOrders.findIndex(p => p.id === editPo!.id)
      if (idx !== -1) mockPurchaseOrders[idx] = updated
      router.push(`/dashboard/purchases/${editPo!.id}`)
      return
    }

    const created: MockPurchaseOrder = {
      id: `po-${Date.now()}`,
      po_number: genPoNumber(mockPurchaseOrders),
      supplier_id: supplierId,
      branch: 'Main Branch',
      order_date: orderDate || null,
      expected_date: status === 'ordered' ? (expectedDate || null) : null,
      received_date: isReceivedFlow ? (receivedDate || null) : null,
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
          <button className={styles.backArrow} onClick={handleCancel} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.poTitle}>{isEditing ? `Edit ${editPo!.po_number}` : 'New Purchase Order'}</h1>
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
              <div className={`${styles.newPoCollapsedSummary} ${styles.newPoCollapsedDetails}`}>
                <button
                  type="button"
                  className={styles.newPoCollapsedSummaryMain}
                  onClick={() => setStep('details')}
                >
                  <span className={styles.newPoCollapsedVendor}>{detailsSummary}</span>
                  <span className={styles.newPoCollapsedVendorHint}>Edit details</span>
                </button>

                <div className={styles.newPoCollapsedGrid}>
                  <div className={styles.newPoCollapsedField}>
                    <span className={styles.newPoCollapsedFieldLabel}>Order Status</span>
                    <StepperPill
                      value={status}
                      options={PURCHASE_STATUS_OPTIONS}
                      badgeKey={STATUS_BADGE[status]}
                      canAdvance={canAdvanceStatus}
                      onAdvance={advanceStatus}
                      onSelect={setStatus}
                      advanceTitle={canAdvanceStatus ? `Advance to ${PURCHASE_STATUS_OPTIONS[PURCHASE_STATUS_OPTIONS.findIndex(o => o.value === status) + 1]?.label}` : 'Order status'}
                    />
                  </div>

                  <div className={styles.newPoCollapsedField}>
                    <span className={styles.newPoCollapsedFieldLabel}>Payment</span>
                    <StepperPill
                      value={paymentStatus}
                      options={PAYMENT_STATUS_OPTIONS}
                      badgeKey={PAYMENT_STATUS_BADGE[paymentStatus]}
                      canAdvance={canAdvancePayment}
                      onAdvance={advancePayment}
                      onSelect={handlePaymentStatusChange}
                      advanceTitle={canAdvancePayment ? `Advance to ${PAYMENT_STATUS_OPTIONS[PAYMENT_STATUS_OPTIONS.findIndex(o => o.value === paymentStatus) + 1]?.label}` : 'Payment status'}
                    />
                  </div>

                  {orderDate && (
                    <div className={styles.newPoCollapsedField}>
                      <span className={styles.newPoCollapsedFieldLabel}>Order Date</span>
                      <span className={styles.newPoCollapsedFieldValue}>{formatDateShort(orderDate)}</span>
                    </div>
                  )}

                  {invoiceNumber && (
                    <div className={styles.newPoCollapsedField}>
                      <span className={styles.newPoCollapsedFieldLabel}>Invoice Number</span>
                      <span className={styles.newPoCollapsedFieldValue}>{invoiceNumber}</span>
                    </div>
                  )}

                  {status === 'ordered' && expectedDate && (
                    <div className={styles.newPoCollapsedField}>
                      <span className={styles.newPoCollapsedFieldLabel}>Expected Delivery</span>
                      <span className={styles.newPoCollapsedFieldValue}>{formatDateShort(expectedDate)}</span>
                    </div>
                  )}

                  {isReceivedFlow && receivedDate && (
                    <div className={styles.newPoCollapsedField}>
                      <span className={styles.newPoCollapsedFieldLabel}>Received Date</span>
                      <span className={styles.newPoCollapsedFieldValue}>{formatDateShort(receivedDate)}</span>
                    </div>
                  )}

                  {paymentStatus === 'partially_paid' && paidAmount !== '' && (
                    <div className={styles.newPoCollapsedField}>
                      <span className={styles.newPoCollapsedFieldLabel}>Paid Amount</span>
                      <span className={styles.newPoCollapsedFieldValue}>{formatINR(Number(paidAmount))}</span>
                    </div>
                  )}

                  {paymentStatus === 'paid' && paymentDate && (
                    <div className={styles.newPoCollapsedField}>
                      <span className={styles.newPoCollapsedFieldLabel}>Payment Date</span>
                      <span className={styles.newPoCollapsedFieldValue}>{formatDateShort(paymentDate)}</span>
                    </div>
                  )}

                  {paymentStatus === 'paid' && paymentMethod && (
                    <div className={styles.newPoCollapsedField}>
                      <span className={styles.newPoCollapsedFieldLabel}>Payment Method</span>
                      <span className={styles.newPoCollapsedFieldValue}>{paymentMethod}</span>
                    </div>
                  )}
                </div>
              </div>
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

                {/* Purchase status — segmented picker */}
                <div className={styles.newPoDetailSection}>
                  <div className={styles.segmentHead}>
                    <span className={styles.newPoSubLabel}>Order Status</span>
                    <span className={styles.segmentHint}>
                      {PURCHASE_STATUS_OPTIONS.find(o => o.value === status)?.hint}
                    </span>
                  </div>
                  <div className={styles.segmented} role="radiogroup" aria-label="Order status">
                    {PURCHASE_STATUS_OPTIONS.map(opt => {
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={status === opt.value}
                          className={`${styles.segmentBtn} ${status === opt.value ? styles.segmentBtnActive : ''}`}
                          onClick={() => setStatus(opt.value)}
                        >
                          <Icon size={15} />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  {status === 'ordered' && (
                    <div className={styles.statusStrip}>
                      <div className="form-group">
                        <label className="form-label">Expected Delivery <span className="text-tertiary font-normal">(Optional)</span></label>
                        <input className="form-input" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {isReceivedFlow && (
                    <div className={styles.statusStrip}>
                      <div className="form-group">
                        <label className="form-label">Received Date <span className="text-tertiary font-normal">(Optional)</span></label>
                        <input className="form-input" type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment — segmented picker */}
                <div className={styles.newPoDetailSection}>
                  <div className={styles.segmentHead}>
                    <span className={styles.newPoSubLabel}>Payment</span>
                    <span className={styles.segmentHint}>
                      {PAYMENT_STATUS_OPTIONS.find(o => o.value === paymentStatus)?.hint}
                    </span>
                  </div>
                  <div className={styles.segmented} role="radiogroup" aria-label="Payment status">
                    {PAYMENT_STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={paymentStatus === opt.value}
                        className={`${styles.segmentBtn} ${paymentStatus === opt.value ? styles.segmentBtnActive : ''}`}
                        onClick={() => setPaymentStatus(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {paymentStatus === 'partially_paid' && (
                    <div className={styles.statusStrip}>
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
                    <div className={styles.statusStrip}>
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
                className={`${styles.newPoStepToggle} ${styles.newPoStepToggleGrow}`}
                onClick={() => setStep(step === 'items' ? 'details' : 'items')}
              >
                <span className={styles.sectionLabel}>Line Items</span>
                {step === 'items' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {step === 'items' && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={e => { e.stopPropagation(); setShowAddProductModal(true) }}
                >
                  <Plus size={14} /> Add Product
                </button>
              )}
            </div>

            {step !== 'items' && (
              <button
                type="button"
                className={`${styles.newPoCollapsedSummary} ${styles.newPoCollapsedSummaryClickable}`}
                onClick={() => setStep('items')}
              >
                {draftItemCount} item{draftItemCount !== 1 ? 's' : ''} · Total: {formatINR(draftTotal)}
              </button>
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
                  <div className={`${styles.lineItemGrid} ${styles.lineItemsHead}`} style={lineItemGridStyle}>
                    <span>Product</span>
                    {showOrderedQtyCol && <span>Ordered Qty (Optional)</span>}
                    <span>{isReceivedFlow ? 'Received Qty' : isPreReceipt ? 'Ordered Qty' : 'Qty'}</span>
                    <span>{isReceivedFlow ? 'Unit Cost' : isPreReceipt ? 'Expected Price/Unit (Optional)' : 'Cost / Unit'}</span>
                    <span className={styles.lineItemsHeadRight}>{isReceivedFlow ? 'Total Amount' : isPreReceipt ? 'Expected Amount' : 'Amount'}</span>
                    <span className={styles.lineItemsHeadActions}>Actions</span>
                  </div>

                  {draftItems.map(item => (
                    <div key={item.id} className={`${styles.lineItemGrid} ${styles.lineItemRow}`} style={lineItemGridStyle}>
                      <div className={styles.lineItemProduct}>
                        <span className={styles.lineItemName}>{item.item_name}</span>
                        {item.variant_label && item.variant_label !== '—' && (
                          <span className={styles.lineItemVariant}>{item.variant_label}</span>
                        )}
                      </div>
                      {showOrderedQtyCol && (
                        <input
                          className={`form-input ${styles.lineItemInput}`}
                          type="number" min="0"
                          placeholder="0"
                          value={item.qty_ordered}
                          onChange={e => updateDraftItem(item.id, { qty_ordered: e.target.value === '' ? '' : Number(e.target.value) })}
                        />
                      )}
                      <input
                        className={`form-input ${styles.lineItemInput}`}
                        type="number" min="0"
                        placeholder="0"
                        value={isReceivedFlow ? receivedQtyValue(item) : item.qty_ordered}
                        onChange={e => updateDraftItem(item.id, isReceivedFlow
                          ? { qty_received: e.target.value === '' ? '' : Number(e.target.value) }
                          : { qty_ordered: e.target.value === '' ? '' : Number(e.target.value) })}
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
                        {formatINR(lineQty(item) * Number(item.unit_cost || 0))}
                      </span>
                      <button
                        type="button"
                        className={styles.lineItemRemove}
                        onClick={() => removeDraftItemRow(item.id)}
                        title="Delete line"
                      >
                        <Trash2 size={14} />
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
                {isEditing ? 'Save Changes' : 'Save Purchase Order'}
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
            {!invoiceFile && (invoiceRemoved || !editPo?.invoice_file_name) ? (
              <button type="button" className={styles.invoiceUploadZone} onClick={() => invoiceInputRef.current?.click()}>
                <Upload size={18} />
                <span>Upload invoice</span>
                <span className={styles.invoiceUploadHint}>PDF or image</span>
              </button>
            ) : (
              <div className={styles.invoiceFileRow}>
                <FileText size={18} className={styles.invoiceFileIcon} />
                <div className={styles.invoiceFileInfo}>
                  <span className={styles.invoiceFileName}>{invoiceFile?.name ?? editPo?.invoice_file_name}</span>
                  {invoiceFile && <span className={styles.invoiceFileSize}>{formatFileSize(invoiceFile.size)}</span>}
                </div>
                {invoiceFileUrl && (
                  <a
                    href={invoiceFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.invoiceFileView}
                    title="View invoice"
                  >
                    <Eye size={14} />
                  </a>
                )}
                <button
                  type="button"
                  className={styles.invoiceFileRemove}
                  onClick={() => {
                    setInvoiceFile(null)
                    setInvoiceRemoved(true)
                  }}
                  title="Remove"
                >
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
          costOptional={isPreReceipt}
        />
      )}

      {showPaidAmountPrompt && (
        <div className={styles.receivePopupOverlay} onMouseDown={() => setShowPaidAmountPrompt(false)}>
          <div className={styles.receivePopup} onMouseDown={e => e.stopPropagation()}>
            <div className={styles.receivePopupTitle}>Paid Amount</div>
            <p className={styles.receivePopupSubtitle}>How much has been paid to the vendor so far?</p>

            <div className="form-group">
              <label className="form-label form-label--required">Amount</label>
              <div className="input-prefix">
                <span className="input-prefix__label">₹</span>
                <input
                  className="form-input"
                  type="number" min="0"
                  autoFocus
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter' && Number(paidAmount) > 0) setShowPaidAmountPrompt(false) }}
                />
              </div>
            </div>

            <div className={styles.receivePopupActions}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowPaidAmountPrompt(false)}>Skip</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!(Number(paidAmount) > 0)}
                onClick={() => setShowPaidAmountPrompt(false)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
