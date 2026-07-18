'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Plus, X, Trash2, Download, Eye, Check, Image as ImageIcon, Layers, FileText, Upload } from 'lucide-react'
import { mockInventoryItems, formatINR } from '@/lib/mock-data'
import type { InventoryItem, InventoryVariant, StockUnit } from '@/types/database'
import CustomSelect from '@/components/ui/CustomSelect'
import styles from './detail.module.css'
import inv from '../inventory.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'variants' | 'description' | 'images'

type DetailVariant = InventoryVariant & {
  name: string
  selling_price: number
}

type EditVariantRow = {
  id: string
  code: string
  attributes: string[]
  quantity: number
}

type TaxLine = { id: string; name: string; percentage: number }

type VariantRowDraft = { name: string; attributes: string[]; selling_price: number }

type ImageFile = {
  id: string
  name: string
  url: string
  size: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_UNITS = ['KG', 'Grams', 'Litres', 'ML', 'Pieces']

function makeEmptyEditVariant(index: number, attrCount: number): EditVariantRow {
  return {
    id: `${Date.now()}-${index}-${Math.random()}`,
    code: `VAR-${String(index + 1).padStart(3, '0')}`,
    attributes: Array(attrCount).fill(''),
    quantity: 0,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const initItem = (mockInventoryItems.find(i => i.id === id) as InventoryItem | undefined) ?? null

  // ── Main item state ────────────────────────────────────────────────────────
  const [item, setItem] = useState<InventoryItem | null>(initItem)
  const [activeTab, setActiveTab] = useState<Tab>('variants')

  // ── Variants tab state ─────────────────────────────────────────────────────
  const [variants, setVariants] = useState<DetailVariant[]>(() => {
    if (!initItem?.variants?.length) return []
    return initItem.variants.map(v => ({
      ...v,
      name: v.name ?? '',
      selling_price: initItem.mrp,
    }))
  })

  // ── Description tab state ──────────────────────────────────────────────────
  const [description, setDescription] = useState(initItem?.notes || '')
  const [descSaved, setDescSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Images tab state ───────────────────────────────────────────────────────
  const [images, setImages] = useState<ImageFile[]>(() => {
    if (!initItem) return []
    return [
      { id: 'demo-1', name: `${initItem.name.toLowerCase()}-front.jpg`, url: `https://placehold.co/400x400/e8ebef/52596a?text=${encodeURIComponent(initItem.name)}`, size: 245000 },
      { id: 'demo-2', name: `${initItem.name.toLowerCase()}-side.jpg`, url: `https://placehold.co/400x400/ebf5fb/1a5276?text=Side+View`, size: 189000 },
    ]
  })
  const [viewingImage, setViewingImage] = useState<ImageFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Row edit state (variants tab) ──────────────────────────────────────────
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<VariantRowDraft | null>(null)

  // ── Attribute toolbar state (variants tab) ─────────────────────────────────
  const [addingAttrInline, setAddingAttrInline] = useState(false)
  const [newAttrInlineInput, setNewAttrInlineInput] = useState('')

  // ── Edit drawer state ──────────────────────────────────────────────────────
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [editHasVariation, setEditHasVariation] = useState(false)
  const [editVariants, setEditVariants] = useState<EditVariantRow[]>([])
  const [editTaxes, setEditTaxes] = useState<TaxLine[]>([])
  const [editTaxInclusive, setEditTaxInclusive] = useState(true)
  const [lastAddedEditTaxId, setLastAddedEditTaxId] = useState('')

  // Edit drawer "create new" sub-states
  const [customUnits, setCustomUnits] = useState<string[]>([])
  const [addingEditUnit, setAddingEditUnit] = useState(false)
  const [newEditUnitInput, setNewEditUnitInput] = useState('')
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [addingEditCategory, setAddingEditCategory] = useState(false)
  const [newEditCategoryInput, setNewEditCategoryInput] = useState('')
  const [editSubcategory, setEditSubcategory] = useState('')
  const [customSubcategories, setCustomSubcategories] = useState<string[]>([])
  const [addingEditSubcategory, setAddingEditSubcategory] = useState(false)
  const [newEditSubcategoryInput, setNewEditSubcategoryInput] = useState('')

  const newEditUnitInputRef = useRef<HTMLInputElement>(null)
  const newEditCategoryInputRef = useRef<HTMLInputElement>(null)
  const newEditSubcategoryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (addingEditUnit) newEditUnitInputRef.current?.focus() }, [addingEditUnit])
  useEffect(() => { if (addingEditCategory) newEditCategoryInputRef.current?.focus() }, [addingEditCategory])
  useEffect(() => { if (addingEditSubcategory) newEditSubcategoryInputRef.current?.focus() }, [addingEditSubcategory])

  const allUnits = [...DEFAULT_UNITS, ...customUnits]
  const existingCategories = Array.from(new Set(mockInventoryItems.map(i => i.category)))
  const allCategories = Array.from(new Set([...existingCategories, ...customCategories]))

  // ── Handlers: description ──────────────────────────────────────────────────

  function handleDescriptionChange(value: string) {
    setDescription(value)
    setDescSaved(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setItem(prev => prev ? { ...prev, notes: value } : null)
      setDescSaved(true)
      setTimeout(() => setDescSaved(false), 2000)
    }, 800)
  }

  // ── Handlers: images ───────────────────────────────────────────────────────

  function handleAddImage(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file)
      setImages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, name: file.name, url, size: file.size }])
    })
    e.target.value = ''
  }

  function handleDownloadImage(img: ImageFile) {
    const a = document.createElement('a')
    a.href = img.url
    a.download = img.name
    a.click()
  }

  // ── Handlers: variants tab ─────────────────────────────────────────────────

  function handleAddVariantRow() {
    const attrCount = (item?.attributes || []).length
    setVariants(prev => [...prev, {
      id: `new-${Date.now()}`,
      code: '',
      name: '',
      attributes: Array(attrCount).fill(''),
      quantity: 0,
      selling_price: item?.mrp ?? 0,
    }])
  }

  function startEditRow(row: DetailVariant) {
    setEditingRowId(row.id)
    setRowDraft({ name: row.name, attributes: [...row.attributes], selling_price: row.selling_price })
  }

  function cancelEditRow() {
    setEditingRowId(null)
    setRowDraft(null)
  }

  function saveEditRow(index: number) {
    if (!rowDraft) return
    setVariants(prev => prev.map((v, i) => (i === index ? { ...v, ...rowDraft } : v)))
    setEditingRowId(null)
    setRowDraft(null)
  }

  // Single click navigates to the variant detail page; double click edits inline.
  // The single-click action is delayed so a second click can cancel it in time.
  const rowClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current) }
  }, [])

  function handleRowClick(row: DetailVariant) {
    if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current)
    rowClickTimerRef.current = setTimeout(() => {
      router.push(`/dashboard/inventory/${item!.id}/variant/${row.id}`)
    }, 220)
  }

  function handleRowDoubleClick(row: DetailVariant) {
    if (rowClickTimerRef.current) {
      clearTimeout(rowClickTimerRef.current)
      rowClickTimerRef.current = null
    }
    if (editingRowId !== row.id) startEditRow(row)
  }

  // ── Handlers: attribute toolbar ─────────────────────────────────────────────

  function handleAddAttribute(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if ((item?.attributes || []).includes(trimmed)) return
    setItem(prev => prev ? { ...prev, attributes: [...(prev.attributes || []), trimmed] } : null)
    setVariants(prev => prev.map(v => ({ ...v, attributes: [...v.attributes, ''] })))
    setNewAttrInlineInput('')
    setAddingAttrInline(false)
  }

  function handleRemoveAttribute(index: number) {
    setItem(prev => prev ? { ...prev, attributes: (prev.attributes || []).filter((_, i) => i !== index) } : null)
    setVariants(prev => prev.map(v => ({ ...v, attributes: v.attributes.filter((_, i) => i !== index) })))
  }

  // ── Handlers: open/close edit drawer ──────────────────────────────────────

  function openEditDrawer() {
    if (!item) return
    setEditingItem({ ...item })
    setEditHasVariation(!!item.variants?.length)
    setEditVariants(
      item.variants?.length
        ? item.variants.map(v => ({ id: v.id, code: v.code, attributes: [...v.attributes], quantity: v.quantity }))
        : [makeEmptyEditVariant(0, item.attributes?.length ?? 0), makeEmptyEditVariant(1, item.attributes?.length ?? 0)]
    )
    setEditTaxes([])
    setEditTaxInclusive(true)
    setEditSubcategory('')
    setAddingEditUnit(false)
    setAddingEditCategory(false)
    setAddingEditSubcategory(false)
    setShowEditDrawer(true)
  }

  function closeEditDrawer() {
    setShowEditDrawer(false)
    setEditingItem(null)
  }

  // ── Handlers: edit drawer inline creates ──────────────────────────────────

  function handleAddEditUnit() {
    const unit = newEditUnitInput.trim()
    if (unit && !allUnits.includes(unit)) setCustomUnits(prev => [...prev, unit])
    if (unit) setEditingItem(prev => prev ? { ...prev, unit: unit as StockUnit } : null)
    setAddingEditUnit(false)
    setNewEditUnitInput('')
  }

  function handleAddEditCategory() {
    const cat = newEditCategoryInput.trim()
    if (cat && !allCategories.includes(cat)) setCustomCategories(prev => [...prev, cat])
    if (cat) setEditingItem(prev => prev ? { ...prev, category: cat } : null)
    setAddingEditCategory(false)
    setNewEditCategoryInput('')
  }

  function handleAddEditSubcategory() {
    const sub = newEditSubcategoryInput.trim()
    if (sub && !customSubcategories.includes(sub)) setCustomSubcategories(prev => [...prev, sub])
    if (sub) setEditSubcategory(sub)
    setAddingEditSubcategory(false)
    setNewEditSubcategoryInput('')
  }

  // ── Handlers: save edit ────────────────────────────────────────────────────

  function handleSaveEdit() {
    if (!editingItem) return
    const updated: InventoryItem = {
      ...editingItem,
      variants: editHasVariation
        ? editVariants.map(v => ({ id: v.id, code: v.code, attributes: [...v.attributes], quantity: v.quantity }))
        : undefined,
      current_stock: editHasVariation
        ? editVariants.reduce((s, v) => s + Number(v.quantity || 0), 0)
        : editingItem.current_stock,
    }
    setItem(updated)
    // Reflect variant changes back to the variants tab
    if (editHasVariation && updated.variants?.length) {
      setVariants(updated.variants.map(v => ({
        ...v,
        name: v.name ?? '',
        selling_price: updated.mrp,
      })))
    }
    closeEditDrawer()
  }

  // ── Early return: item not found ───────────────────────────────────────────

  if (!item) {
    return (
      <div>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/inventory')}>
          <ArrowLeft size={16} />
          Back to Inventory
        </button>
        <div className="empty-state">
          <p className="empty-state__title">Item not found</p>
          <p className="empty-state__desc">The inventory item you are looking for does not exist.</p>
        </div>
      </div>
    )
  }

  const isOutOfStock = item.availability_status === 'discontinued' || item.availability_status === 'out_of_stock'
  const isLowStock = !isOutOfStock && item.current_stock <= item.par_stock
  const hasVariants = variants.length > 0

  return (
    <div>
      {/* ── Page header ── */}
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <button className={styles.backArrow} onClick={() => router.push('/dashboard/inventory')} title="Back to Inventory">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.itemTitle}>{item.name}</h1>
            <div className={styles.itemMeta}>
              <span className={`badge badge--${isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}`}>
                {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
              </span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{item.category}</span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{item.current_stock} {item.unit}</span>
            </div>
          </div>
        </div>
        <button className="btn btn--outline" onClick={openEditDrawer}>
          <Pencil size={14} />
          Edit Item
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'variants' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('variants')}
        >
          <Layers size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Variants
          {hasVariants && <span className={styles.tabCount}>{variants.length}</span>}
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'description' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('description')}
        >
          <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Description
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'images' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('images')}
        >
          <ImageIcon size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Images
          {images.length > 0 && <span className={styles.tabCount}>{images.length}</span>}
        </button>
      </div>

      {/* ── Variants tab ── */}
      {activeTab === 'variants' && (
        <div className={styles.variantPanel}>
          {/* ── Attribute toolbar ── */}
          <div className={styles.attrToolbar}>
            <span className={styles.attrToolbarLabel}>Columns</span>
            {(item.attributes || []).map((attr, idx) => (
              <span key={`${attr}-${idx}`} className={styles.attrToolbarChip}>
                {attr}
                <button type="button" className={styles.attrToolbarChipRemove}
                  onClick={() => handleRemoveAttribute(idx)} title={`Remove ${attr} column`}>
                  <X size={11} />
                </button>
              </span>
            ))}
            {addingAttrInline ? (
              <span className={styles.attrToolbarInlineInput}>
                <input
                  autoFocus
                  placeholder="e.g. Size, Color…"
                  value={newAttrInlineInput}
                  onChange={e => setNewAttrInlineInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddAttribute(newAttrInlineInput)
                    if (e.key === 'Escape') { setAddingAttrInline(false); setNewAttrInlineInput('') }
                  }}
                />
                <button type="button"
                  className={`${styles.attrToolbarMiniBtn} ${styles.attrToolbarMiniConfirm}`}
                  onClick={() => handleAddAttribute(newAttrInlineInput)}>
                  <Check size={13} />
                </button>
                <button type="button"
                  className={`${styles.attrToolbarMiniBtn} ${styles.attrToolbarMiniCancel}`}
                  onClick={() => { setAddingAttrInline(false); setNewAttrInlineInput('') }}>
                  <X size={13} />
                </button>
              </span>
            ) : (
              <button type="button" className={styles.attrToolbarAdd}
                onClick={() => setAddingAttrInline(true)}>
                <Plus size={12} /> Add column
              </button>
            )}
          </div>

          {/* ── Table ── */}
          {hasVariants ? (
            <>
              <div className={styles.variantScrollWrap}>
                <table className={styles.variantTableFull}>
                  <thead>
                    <tr>
                      <th>Variant Name</th>
                      {(item.attributes || []).map(attr => <th key={attr}>{attr}</th>)}
                      <th className={styles.colQty}>Qty</th>
                      <th className={styles.colSelling}>Selling / Unit</th>
                      <th className={styles.colActions} />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((row, ri) => {
                      const isEditing = editingRowId === row.id
                      return (
                        <tr
                          key={row.id}
                          className={isEditing ? styles.rowEditing : ''}
                          onClick={() => { if (!isEditing) handleRowClick(row) }}
                          onDoubleClick={() => handleRowDoubleClick(row)}
                          style={{ cursor: isEditing ? 'default' : 'pointer' }}
                        >
                          <td>
                            {isEditing ? (
                              <input
                                className={`form-input ${styles.variantInput}`}
                                value={rowDraft?.name ?? ''}
                                placeholder="Optional"
                                autoFocus
                                onChange={e => setRowDraft(d => d && { ...d, name: e.target.value })}
                              />
                            ) : (
                              <span className={styles.variantDisplayText}>
                                {row.name || <span className="text-tertiary">Unnamed</span>}
                              </span>
                            )}
                          </td>
                          {(item.attributes || []).map((attr, ai) => (
                            <td key={attr}>
                              {isEditing ? (
                                <input
                                  className={`form-input ${styles.variantInput}`}
                                  placeholder={attr}
                                  value={rowDraft?.attributes[ai] ?? ''}
                                  onChange={e => {
                                    const val = e.target.value
                                    setRowDraft(d => d && { ...d, attributes: d.attributes.map((a, j) => j === ai ? val : a) })
                                  }}
                                />
                              ) : (
                                <span className={styles.variantDisplayText}>
                                  {row.attributes[ai] || <span className="text-tertiary">—</span>}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className={styles.colQty}>
                            <span className={styles.qtyDisplayText} title="Quantity updates automatically from Purchases and Consumption">
                              {row.quantity} {item.unit}
                            </span>
                          </td>
                          <td className={styles.colSelling}>
                            {isEditing ? (
                              <div className={styles.compactCurrency}>
                                <span className={styles.compactCurrencySymbol}>₹</span>
                                <input
                                  className={styles.compactCurrencyInput}
                                  type="number" min="0"
                                  value={rowDraft?.selling_price ?? 0}
                                  onChange={e => setRowDraft(d => d && { ...d, selling_price: Number(e.target.value) })}
                                />
                              </div>
                            ) : (
                              <span className={styles.variantDisplayText}>{formatINR(row.selling_price)}</span>
                            )}
                          </td>
                          <td className={styles.colActions} onClick={e => e.stopPropagation()}>
                            <div className={styles.actionsRow}>
                              {isEditing ? (
                                <>
                                  <button
                                    className={`${styles.removeBtn} ${styles.saveBtn}`}
                                    onClick={() => saveEditRow(ri)}
                                    title="Save changes"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    className={styles.removeBtn}
                                    onClick={cancelEditRow}
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className={styles.removeBtn}
                                    onClick={() => startEditRow(row)}
                                    title="Edit variant"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    className={styles.removeBtn}
                                    onClick={() => router.push(`/dashboard/inventory/${item.id}/variant/${row.id}`)}
                                    title="View variant details"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    className={styles.removeBtn}
                                    onClick={() => setVariants(prev => prev.filter((_, i) => i !== ri))}
                                    disabled={variants.length <= 1}
                                    title="Remove variant"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className={styles.variantFooterBar}>
                <button className="btn btn--ghost btn--sm" onClick={handleAddVariantRow}>
                  <Plus size={14} /> Add variant
                </button>
                <span className={styles.variantSummary}>
                  {variants.length} variant{variants.length !== 1 ? 's' : ''} &middot; Total: <strong>{variants.reduce((s, v) => s + Number(v.quantity || 0), 0)}</strong> {item.unit}
                </span>
              </div>
            </>
          ) : (
            <div className={styles.noVariants}>
              <div className={styles.noVariantsIcon}><Layers size={24} /></div>
              <p className={styles.noVariantsTitle}>No variants yet</p>
              <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                Add columns above, then add variant rows below.
              </p>
              <button className="btn btn--outline btn--sm" onClick={handleAddVariantRow}>
                <Plus size={13} /> Add first variant
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Description tab ── */}
      {activeTab === 'description' && (
        <div className={styles.descPanel}>
          <label className="form-label">Item Description</label>
          <textarea
            className={styles.descTextarea}
            value={description}
            onChange={e => handleDescriptionChange(e.target.value)}
            placeholder="Add a description — storage notes, supplier info, handling instructions…"
          />
          <div className={styles.descFooter}>
            <span className={styles.descHint}>Changes are saved automatically</span>
            {descSaved && (
              <span className={styles.descSaved}><Check size={13} /> Saved</span>
            )}
          </div>
        </div>
      )}

      {/* ── Images tab ── */}
      {activeTab === 'images' && (
        <>
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleAddImage} />
          <div className={styles.imageGrid}>
            <button className={styles.imageUploadCard} onClick={() => fileInputRef.current?.click()}>
              <Upload size={24} />
              Add Image
            </button>
            {images.map(img => (
              <div key={img.id} className={styles.imageCard}>
                <img className={styles.imageThumb} src={img.url} alt={img.name}
                  onClick={() => setViewingImage(img)} style={{ cursor: 'zoom-in' }} />
                <div className={styles.imageActions}>
                  <button className={styles.imageActionBtn} title="View" onClick={() => setViewingImage(img)}><Eye size={15} /></button>
                  <button className={styles.imageActionBtn} title="Download" onClick={() => handleDownloadImage(img)}><Download size={15} /></button>
                  <button className={`${styles.imageActionBtn} ${styles.imageActionBtnDanger}`} title="Delete"
                    onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
          {viewingImage && (
            <div className={styles.viewerOverlay} onClick={() => setViewingImage(null)}>
              <button className={styles.viewerClose} onClick={() => setViewingImage(null)}><X size={20} /></button>
              <img className={styles.viewerImg} src={viewingImage.url} alt={viewingImage.name}
                onClick={e => e.stopPropagation()} style={{ cursor: 'default' }} />
            </div>
          )}
        </>
      )}

      {/* ── Edit Item Drawer ── */}
      {showEditDrawer && editingItem && (
        <div className="overlay" onClick={closeEditDrawer}>
          <div className="drawer" style={{ width: '560px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="drawer__header">
              <h3 className="drawer__title">Edit Stock Item</h3>
              <button className="drawer__close" onClick={closeEditDrawer}><X size={18} /></button>
            </div>

            <div className={inv.drawerScroll}>
              <div className={inv.drawerForm}>

                {/* 1. Item Name */}
                <div className="form-group">
                  <label className="form-label form-label--required">Item Name</label>
                  <input className="form-input" type="text" value={editingItem.name}
                    onChange={e => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} />
                </div>

                {/* Unit */}
                <div className="form-group">
                  <label className="form-label form-label--required">Unit</label>
                  {!addingEditUnit ? (
                    <CustomSelect value={editingItem.unit}
                      options={[...allUnits.map(u => ({ value: u, label: u })), { value: '__new__', label: '+ Create new unit', isAction: true }]}
                      onChange={v => { if (v === '__new__') setAddingEditUnit(true); else setEditingItem(prev => prev ? { ...prev, unit: v as StockUnit } : null) }} />
                  ) : (
                    <div className={inv.inlineCreate}>
                      <input ref={newEditUnitInputRef} className="form-input" placeholder="e.g. Boxes, Cartons"
                        value={newEditUnitInput} onChange={e => setNewEditUnitInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddEditUnit(); if (e.key === 'Escape') setAddingEditUnit(false) }} />
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnConfirm}`} onClick={handleAddEditUnit}><Check size={15} /></button>
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnCancel}`} onClick={() => setAddingEditUnit(false)}><X size={15} /></button>
                    </div>
                  )}
                </div>

                {/* Categorization */}
                <div className={inv.sectionLabel}>Categorization</div>

                {/* 6. Category */}
                <div className="form-group">
                  <label className="form-label form-label--required">Category</label>
                  {!addingEditCategory ? (
                    <CustomSelect value={editingItem.category} placeholder="Select category"
                      options={[...allCategories.map(c => ({ value: c, label: c })), { value: '__new__', label: '+ Create new category', isAction: true }]}
                      onChange={v => { if (v === '__new__') setAddingEditCategory(true); else setEditingItem(prev => prev ? { ...prev, category: v } : null) }} />
                  ) : (
                    <div className={inv.inlineCreate}>
                      <input ref={newEditCategoryInputRef} className="form-input" placeholder="e.g. Nuts, Spices"
                        value={newEditCategoryInput} onChange={e => setNewEditCategoryInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddEditCategory(); if (e.key === 'Escape') setAddingEditCategory(false) }} />
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnConfirm}`} onClick={handleAddEditCategory}><Check size={15} /></button>
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnCancel}`} onClick={() => setAddingEditCategory(false)}><X size={15} /></button>
                    </div>
                  )}
                </div>

                {/* 7. Subcategory */}
                <div className="form-group">
                  <label className="form-label">Subcategory <span className="text-tertiary font-normal">(Optional)</span></label>
                  {!addingEditSubcategory ? (
                    <CustomSelect value={editSubcategory} placeholder="None"
                      options={[{ value: '', label: 'None' }, ...customSubcategories.map(s => ({ value: s, label: s })), { value: '__new__', label: '+ Create new subcategory', isAction: true }]}
                      onChange={v => { if (v === '__new__') setAddingEditSubcategory(true); else setEditSubcategory(v) }} />
                  ) : (
                    <div className={inv.inlineCreate}>
                      <input ref={newEditSubcategoryInputRef} className="form-input" placeholder="e.g. Premium, Organic"
                        value={newEditSubcategoryInput} onChange={e => setNewEditSubcategoryInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddEditSubcategory(); if (e.key === 'Escape') setAddingEditSubcategory(false) }} />
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnConfirm}`} onClick={handleAddEditSubcategory}><Check size={15} /></button>
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnCancel}`} onClick={() => setAddingEditSubcategory(false)}><X size={15} /></button>
                    </div>
                  )}
                </div>

                {/* 10. Taxes */}
                <div className="form-group">
                  <div className={inv.fieldHeaderRow}>
                    <label className="form-label">Taxes <span className="text-tertiary font-normal">(Optional)</span></label>
                    <label className={inv.toggleLabel}>
                      <span className="text-sm text-secondary">{editTaxInclusive ? 'Inclusive' : 'Exclusive'}</span>
                      <button type="button" role="switch" aria-checked={editTaxInclusive}
                        className={`toggle ${editTaxInclusive ? '' : 'toggle--off'}`}
                        onClick={() => setEditTaxInclusive(v => !v)}>
                        <span className="toggle__dot" />
                      </button>
                    </label>
                  </div>
                  {editTaxes.length > 0 && (
                    <div className={inv.taxSection}>
                      {editTaxes.map((tax, i) => (
                        <div key={tax.id} className={inv.taxRow}>
                          <input className="form-input" placeholder="Tax name (e.g. GST)"
                            autoFocus={tax.id === lastAddedEditTaxId}
                            value={tax.name}
                            onChange={e => setEditTaxes(prev => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t))}
                            style={{ flex: 1 }} />
                          <div className={inv.taxPercentInput}>
                            <input type="number" min="0" max="100" placeholder="0"
                              value={tax.percentage || ''}
                              onChange={e => setEditTaxes(prev => prev.map((t, j) => j === i ? { ...t, percentage: Number(e.target.value) } : t))} />
                            <span className={inv.taxPercentSuffix}>%</span>
                          </div>
                          <button type="button" className="btn btn--ghost btn--sm" style={{ flexShrink: 0 }}
                            onClick={() => setEditTaxes(prev => prev.filter((_, j) => j !== i))}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className={inv.addAttrBtn}
                    style={{ marginTop: editTaxes.length > 0 ? 'var(--space-2)' : undefined }}
                    onClick={() => {
                      const newId = `${Date.now()}-${Math.random()}`
                      setLastAddedEditTaxId(newId)
                      setEditTaxes(prev => [...prev, { id: newId, name: '', percentage: 0 }])
                    }}>+ Add tax</button>
                  <span className="form-hint">
                    {editTaxInclusive ? 'Tax included in item price.' : 'Tax charged on top of item price.'}
                  </span>
                </div>

                {/* 12. Status */}
                <div className="form-group">
                  <div className={inv.fieldHeaderRow}>
                    <label className="form-label">Active / Available</label>
                    <label className={inv.toggleLabel}>
                      <span className="text-sm text-secondary">
                        {editingItem.availability_status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      <button type="button" role="switch"
                        aria-checked={editingItem.availability_status === 'active'}
                        className={`toggle ${editingItem.availability_status === 'active' ? '' : 'toggle--off'}`}
                        onClick={() => setEditingItem(prev => prev ? {
                          ...prev, availability_status: prev.availability_status === 'active' ? 'out_of_stock' : 'active'
                        } : null)}>
                        <span className="toggle__dot" />
                      </button>
                    </label>
                  </div>
                </div>

                {/* 13. Notes */}
                <div className="form-group">
                  <label className="form-label">Notes <span className="text-tertiary font-normal">(Optional)</span></label>
                  <textarea className="form-textarea" value={editingItem.notes ?? ''}
                    onChange={e => setEditingItem(prev => prev ? { ...prev, notes: e.target.value } : null)} />
                </div>

              </div>
            </div>

            <div className={`drawer__footer ${inv.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={closeEditDrawer}>Cancel</button>
              <button className="btn btn--primary"
                onClick={handleSaveEdit}
                disabled={!editingItem.name.trim() || !editingItem.category.trim()}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
