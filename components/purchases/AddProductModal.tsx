'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, X, ChevronDown, Plus, Check,
} from 'lucide-react'
import { mockInventoryItems, formatDateShort } from '@/lib/mock-data'
import type { MockInventoryItem, MockInventoryVariant } from '@/lib/mock-data'
import CustomSelect from '@/components/ui/CustomSelect'
import styles from './AddProductModal.module.css'

export type PickedLine = {
  item_name: string
  variant_label: string
  unit: string
  qty_ordered: number
  unit_cost: number
}

type Selection = {
  itemId: string
  itemName: string
  unit: string
  variantId: string
  variantLabel: string
  qty: number
  cost: number
}

function totalQty(item: MockInventoryItem) {
  return (item.variants ?? []).reduce((sum, v) => sum + v.quantity, 0)
}

export default function AddProductModal({
  onClose,
  onAdd,
  costOptional = false,
}: {
  onClose: () => void
  onAdd: (lines: PickedLine[]) => void
  // The PO's vendor cost isn't known yet at Draft/Ordered — don't force it.
  costOptional?: boolean
}) {
  const [products, setProducts] = useState<MockInventoryItem[]>(mockInventoryItems)
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, Selection>>({})
  const [quickAddVariantFor, setQuickAddVariantFor] = useState<string | null>(null)
  const [creatingProduct, setCreatingProduct] = useState(false)

  // Selecting a variant should let the user type its qty immediately — no
  // extra click into the field. The qty input for the just-selected variant
  // gets focused and its value selected as soon as it mounts.
  const qtyInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [pendingFocusKey, setPendingFocusKey] = useState<string | null>(null)

  useEffect(() => {
    if (!pendingFocusKey) return
    const el = qtyInputRefs.current[pendingFocusKey]
    if (el) {
      el.focus()
      el.select()
    }
    setPendingFocusKey(null)
  }, [pendingFocusKey])

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category))).filter(Boolean),
    [products]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(p => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q)
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(p.category)
      return matchesSearch && matchesCategory
    })
  }, [products, search, selectedCategories])

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  // Rendered once at the top level (not inside the scrollable product list)
  // so its own fixed-position overlay isn't nested inside another
  // scrolling container, which was preventing the popup's internal
  // Attributes section from scrolling.
  const quickAddItem = quickAddVariantFor ? products.find(p => p.id === quickAddVariantFor) ?? null : null

  const selectedCount = Object.keys(selections).length

  function selectionKey(itemId: string, variantId: string) {
    return `${itemId}:${variantId}`
  }

  function toggleVariant(item: MockInventoryItem, variant: MockInventoryVariant) {
    const key = selectionKey(item.id, variant.id)
    const wasSelected = !!selections[key]
    setSelections(prev => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
      } else {
        next[key] = {
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          variantId: variant.id,
          variantLabel: variant.name || variant.code,
          qty: 1,
          cost: variant.cost_price ?? item.cost_price,
        }
      }
      return next
    })
    if (!wasSelected) setPendingFocusKey(key)
  }

  function updateSelection(key: string, patch: Partial<Selection>) {
    setSelections(prev => (prev[key] ? { ...prev, [key]: { ...prev[key], ...patch } } : prev))
  }

  function handleQuickAddVariant(
    item: MockInventoryItem,
    fields: { name: string; code: string; qty: number; unitCost: number; sellingPrice: number; attributes: string[] }
  ) {
    const variant: MockInventoryVariant = {
      id: `mock-v-${Date.now()}`,
      code: fields.code || `VAR-${Date.now()}`,
      name: fields.name,
      attributes: fields.attributes,
      quantity: 0,
      cost_price: fields.unitCost,
    }

    item.variants = [...(item.variants ?? [])]
    item.variants.push(variant)
    setProducts(prev => [...prev])
    toggleVariant(item, variant)
    // The values from the quick-add popup become the order selection.
    setSelections(prev => {
      const key = selectionKey(item.id, variant.id)
      return prev[key] ? { ...prev, [key]: { ...prev[key], qty: fields.qty, cost: fields.unitCost } } : prev
    })

    setQuickAddVariantFor(null)
  }

  // Adding a brand-new attribute column applies to the whole product, so
  // every existing variant needs the same empty slot to stay aligned.
  function handleAddAttributeToItem(item: MockInventoryItem, name: string) {
    const trimmed = name.trim()
    if (!trimmed || (item.attributes || []).includes(trimmed)) return
    item.attributes = [...(item.attributes || []), trimmed]
    item.variants = (item.variants ?? []).map(v => ({ ...v, attributes: [...v.attributes, ''] }))
    setProducts(prev => [...prev])
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{creatingProduct ? 'New Product' : 'Add Products'}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {!creatingProduct ? (
          <>
            <div className={styles.toolbar}>
              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  className={`form-input ${styles.searchInput}`}
                  placeholder="Search products…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.categoryFilter}>
                <button
                  type="button"
                  className={`${styles.categoryTrigger} ${selectedCategories.length > 0 ? styles.categoryTriggerActive : ''}`}
                  onClick={() => setCategoryOpen(v => !v)}
                >
                  <span>
                    {selectedCategories.length === 0
                      ? 'All Categories'
                      : selectedCategories.length === 1
                        ? selectedCategories[0]
                        : `${selectedCategories.length} Categories`}
                  </span>
                  <ChevronDown size={14} />
                </button>
                {categoryOpen && (
                  <>
                    <div className={styles.categoryBackdrop} onClick={() => setCategoryOpen(false)} />
                    <div className={styles.categoryDropdown}>
                      {categories.map(c => {
                        const checked = selectedCategories.includes(c)
                        return (
                          <button
                            key={c}
                            type="button"
                            className={styles.categoryOption}
                            onClick={() => toggleCategory(c)}
                          >
                            <span className={`checkbox ${checked ? '' : 'checkbox--unchecked'}`}>
                              {checked && <span className="checkbox__tick" />}
                            </span>
                            {c}
                          </button>
                        )
                      })}
                      {selectedCategories.length > 0 && (
                        <button
                          type="button"
                          className={styles.categoryClear}
                          onClick={() => setSelectedCategories([])}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={styles.body}>
              {filtered.length === 0 && (
                <div className={styles.emptyState}>No products match your search.</div>
              )}

              {filtered.map(item => {
                const variants = item.variants ?? []
                const singleVariant = variants.length === 1 ? variants[0] : null
                const isExpanded = expandedId === item.id
                const selectedInItem = variants.filter(v => selections[selectionKey(item.id, v.id)]).length
                const singleKey = singleVariant ? selectionKey(item.id, singleVariant.id) : null
                const singleSel = singleKey ? selections[singleKey] : undefined

                return (
                  <div key={item.id} className={`${styles.productGroup} ${isExpanded ? styles.productGroupExpanded : ''}`}>
                    <div
                      className={styles.productRow}
                      onClick={() => {
                        if (singleVariant) toggleVariant(item, singleVariant)
                        else setExpandedId(isExpanded ? null : item.id)
                      }}
                    >
                      <div className={styles.productMain}>
                        <div className={styles.productNameRow}>
                          <span className={styles.productName}>{item.name}</span>
                          <span className={styles.categoryTag}>{item.category}</span>
                          {!singleVariant && selectedInItem > 0 && !isExpanded && (
                            <span className={styles.selectedBadge}>{selectedInItem} selected</span>
                          )}
                        </div>
                        <div className={styles.productMeta}>
                          {variants.length} variant{variants.length !== 1 ? 's' : ''}
                          <span className={styles.metaDot}>·</span>
                          {totalQty(item)} {item.unit} in stock
                          <span className={styles.metaDot}>·</span>
                          updated {formatDateShort(item.updated_at, { withYear: false })}
                        </div>
                      </div>

                      {singleVariant && singleSel && singleKey && (
                        <div className={styles.qtyControl} onClick={e => e.stopPropagation()}>
                          <label className={styles.qtyLabel}>Qty</label>
                          <input
                            type="number" min="1"
                            className={`form-input ${styles.qtyInput}`}
                            value={singleSel.qty}
                            onChange={e => updateSelection(singleKey, { qty: Number(e.target.value) || 0 })}
                            ref={el => { qtyInputRefs.current[singleKey] = el }}
                          />
                        </div>
                      )}

                      {singleVariant && (
                        <button
                          type="button"
                          className={styles.hoverAddVariantBtn}
                          onClick={e => { e.stopPropagation(); setQuickAddVariantFor(item.id) }}
                          title="Add a new variant to this product"
                        >
                          <Plus size={13} /> Add variant
                        </button>
                      )}

                      <span className={styles.trailSlot}>
                        {singleVariant ? (
                          <span
                            role="checkbox"
                            aria-checked={!!singleSel}
                            className={`checkbox ${singleSel ? '' : 'checkbox--unchecked'}`}
                          >
                            {singleSel && <span className="checkbox__tick" />}
                          </span>
                        ) : (
                          <span className={`${styles.expandChevron} ${isExpanded ? styles.expandChevronOpen : ''}`}>
                            <ChevronDown size={16} />
                          </span>
                        )}
                      </span>
                    </div>

                    {!singleVariant && isExpanded && (
                      <div className={styles.variantPanel}>
                        <button
                          type="button"
                          className={styles.quickAddVariantToggle}
                          onClick={() => setQuickAddVariantFor(item.id)}
                        >
                          <Plus size={14} /> Add new variant
                        </button>

                        {variants.map(v => {
                          const key = selectionKey(item.id, v.id)
                          const sel = selections[key]
                          const checked = !!sel
                          return (
                            <div key={v.id} className={styles.variantRow} onClick={() => toggleVariant(item, v)}>
                              <div className={styles.variantMain}>
                                <div className={styles.variantName}>{v.name || v.code}</div>
                                <div className={styles.variantMeta}>
                                  {v.attributes.length > 0 ? `${v.attributes.join(' · ')} · ` : ''}{v.quantity} {item.unit} in stock
                                </div>
                              </div>
                              {checked && (
                                <div className={styles.qtyControl} onClick={e => e.stopPropagation()}>
                                  <label className={styles.qtyLabel}>Qty</label>
                                  <input
                                    type="number" min="1"
                                    className={`form-input ${styles.qtyInput}`}
                                    value={sel.qty}
                                    onChange={e => updateSelection(key, { qty: Number(e.target.value) || 0 })}
                                    ref={el => { qtyInputRefs.current[key] = el }}
                                  />
                                </div>
                              )}
                              <span className={styles.trailSlot}>
                                <span
                                  role="checkbox"
                                  aria-checked={checked}
                                  className={`checkbox ${checked ? '' : 'checkbox--unchecked'}`}
                                >
                                  {checked && <span className="checkbox__tick" />}
                                </span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={styles.newProductBar}>
              <button type="button" className={styles.newProductBtn} onClick={() => setCreatingProduct(true)}>
                <Plus size={15} /> Can&apos;t find it? Add a new product
              </button>
            </div>
          </>
        ) : (
          <CreateProductForm
            categories={categories}
            costOptional={costOptional}
            onCancel={() => setCreatingProduct(false)}
            onCreate={(item, variant) => {
              setProducts(prev => [item, ...prev])
              mockInventoryItems.unshift(item)
              toggleVariant(item, variant)
              setCreatingProduct(false)
            }}
          />
        )}

        {!creatingProduct && (
          <div className={styles.footer}>
            <span className={styles.footerCount}>
              <strong>{selectedCount}</strong> variant{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className={styles.footerActions}>
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={selectedCount === 0}
                onClick={() => {
                  onAdd(Object.values(selections).map(s => ({
                    item_name: s.itemName,
                    variant_label: s.variantLabel,
                    unit: s.unit,
                    qty_ordered: s.qty,
                    unit_cost: s.cost,
                  })))
                }}
              >
                Add {selectedCount > 0 ? `${selectedCount} ` : ''}to Purchase Order
              </button>
            </div>
          </div>
        )}
      </div>

      {quickAddItem && (
        <QuickAddVariantPopup
          defaultCost={quickAddItem.cost_price}
          defaultSellingPrice={quickAddItem.mrp}
          costOptional={costOptional}
          attributeNames={quickAddItem.attributes || []}
          onAddAttribute={name => handleAddAttributeToItem(quickAddItem, name)}
          onCancel={() => setQuickAddVariantFor(null)}
          onCreate={fields => handleQuickAddVariant(quickAddItem, fields)}
        />
      )}
    </div>
  )
}

function QuickAddVariantPopup({
  defaultCost,
  defaultSellingPrice,
  costOptional = false,
  attributeNames,
  onAddAttribute,
  onCreate,
  onCancel,
}: {
  defaultCost: number
  defaultSellingPrice: number
  costOptional?: boolean
  attributeNames: string[]
  onAddAttribute: (name: string) => void
  onCreate: (fields: { name: string; code: string; qty: number; unitCost: number; sellingPrice: number; attributes: string[] }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [qty, setQty] = useState<number | ''>(1)
  const [unitCost, setUnitCost] = useState<number | ''>(defaultCost || '')
  const [sellingPrice, setSellingPrice] = useState<number | ''>(defaultSellingPrice || '')
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})

  const canCreate = Number(qty) > 0 && (costOptional || Number(unitCost) > 0)

  function handleCreate() {
    if (!canCreate) return
    onCreate({
      name: name.trim(),
      code: code.trim(),
      qty: Number(qty),
      unitCost: Number(unitCost),
      sellingPrice: Number(sellingPrice) || 0,
      attributes: attributeNames.map(n => attrValues[n]?.trim() || ''),
    })
  }

  return (
    <div className={styles.miniOverlay} onMouseDown={onCancel}>
      <div className={styles.miniModal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.miniModalHeader}>
          <div className={styles.miniModalTitle}>New Variant</div>
        </div>

        <div className={styles.miniModalBody}>
          <div className="form-group">
            <label className="form-label">Variant name <span className="text-tertiary font-normal">(Optional)</span></label>
            <input
              className="form-input"
              placeholder="e.g. 1kg Pack"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Code <span className="text-tertiary font-normal">(Optional)</span></label>
            <input
              className="form-input"
              placeholder="Auto-generated if left blank"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
          </div>

          <div className={styles.createFormRow}>
            <div className="form-group">
              <label className="form-label form-label--required">Qty to order</label>
              <input
                type="number" min="1"
                className="form-input"
                value={qty}
                onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              {costOptional ? (
                <label className="form-label">Expected unit cost <span className="text-tertiary font-normal">(Optional)</span></label>
              ) : (
                <label className="form-label form-label--required">Unit cost</label>
              )}
              <div className="input-prefix">
                <span className="input-prefix__label">₹</span>
                <input
                  type="number" min="0"
                  className="form-input"
                  value={unitCost}
                  onChange={e => setUnitCost(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Selling price <span className="text-tertiary font-normal">(Optional)</span></label>
            <div className="input-prefix">
              <span className="input-prefix__label">₹</span>
              <input
                type="number" min="0"
                className="form-input"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <AttributesStrip
            names={attributeNames}
            values={attrValues}
            onValueChange={(attrName, value) => setAttrValues(prev => ({ ...prev, [attrName]: value }))}
            onAddName={onAddAttribute}
          />
        </div>

        <div className={styles.miniModalFooter}>
          <div className={styles.footerActions} style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn btn--primary" disabled={!canCreate} onClick={handleCreate}>
              Add Variant
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Collapsed by default — attributes (Size, Grade, Color…) are optional and
// most quick-adds don't need them, so the strip only expands on request.
// `onRemoveName` is omitted where names come from the product itself (this
// popup can only add to that list, not edit it out from under other variants).
function AttributesStrip({
  names,
  values,
  onValueChange,
  onAddName,
  onRemoveName,
}: {
  names: string[]
  values: Record<string, string>
  onValueChange: (name: string, value: string) => void
  onAddName: (name: string) => void
  onRemoveName?: (index: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')

  function confirmAddName() {
    const trimmed = newName.trim()
    if (!trimmed) { setAddingNew(false); return }
    onAddName(trimmed)
    setNewName('')
    setAddingNew(false)
  }

  return (
    <div className={styles.attrStripWrap}>
      <button
        type="button"
        className={styles.attrStripToggle}
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span>Attributes <span className="text-tertiary font-normal">(Optional)</span></span>
        <span className={`${styles.expandChevron} ${expanded ? styles.expandChevronOpen : ''}`}>
          <ChevronDown size={14} />
        </span>
      </button>

      {expanded && (
        <div className={styles.attrStripBody}>
          {names.length === 0 && !addingNew && (
            <p className={styles.attrStripEmpty}>No attributes yet — e.g. Size, Color, Grade.</p>
          )}

          {/* Own scroll region, capped short — so with many attributes the
              list scrolls internally instead of pushing the "Add attribute"
              button (and the rest of the popup) out of view. */}
          {names.length > 0 && (
            <div className={styles.attrStripFields}>
              {names.map((attrName, idx) => (
                <div className="form-group" key={`${attrName}-${idx}`}>
                  <label className={styles.attrStripFieldLabel}>
                    <span>{attrName}</span>
                    {onRemoveName && (
                      <button
                        type="button"
                        className={styles.attrToolbarChipRemove}
                        onClick={() => onRemoveName(idx)}
                        title={`Remove ${attrName}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </label>
                  <input
                    className="form-input"
                    placeholder={`e.g. ${attrName} value`}
                    value={values[attrName] ?? ''}
                    onChange={e => onValueChange(attrName, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {addingNew ? (
            <div className={styles.inlineCreate}>
              <input
                autoFocus
                className="form-input"
                placeholder="Attribute name, e.g. Size"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmAddName()
                  if (e.key === 'Escape') { setAddingNew(false); setNewName('') }
                }}
              />
              <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} onClick={confirmAddName}>
                <Check size={14} />
              </button>
              <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} onClick={() => { setAddingNew(false); setNewName('') }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" className={styles.attrStripAdd} onClick={() => setAddingNew(true)}>
              <Plus size={13} /> Add attribute
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function CreateProductForm({
  categories,
  costOptional = false,
  onCreate,
  onCancel,
}: {
  categories: string[]
  costOptional?: boolean
  onCreate: (item: MockInventoryItem, variant: MockInventoryVariant) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'Uncategorized')
  const [subcategory, setSubcategory] = useState('')
  const [unit, setUnit] = useState('KG')
  const [variantName, setVariantName] = useState('Default')
  const [qty, setQty] = useState<number | ''>(1)
  const [cost, setCost] = useState<number | ''>('')
  const [sellingPrice, setSellingPrice] = useState<number | ''>('')
  const [attributeNames, setAttributeNames] = useState<string[]>([])
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiresWithinDays, setExpiresWithinDays] = useState<number | ''>('')

  const canCreate = name.trim() && Number(qty) > 0 && (costOptional || Number(cost) > 0)

  function handleAddAttrName(attrName: string) {
    setAttributeNames(prev => (prev.includes(attrName) ? prev : [...prev, attrName]))
  }

  function handleRemoveAttrName(idx: number) {
    const removed = attributeNames[idx]
    setAttributeNames(prev => prev.filter((_, i) => i !== idx))
    setAttrValues(prev => {
      const next = { ...prev }
      delete next[removed]
      return next
    })
  }

  function handleCreate() {
    if (!canCreate) return
    const now = new Date().toISOString()
    const variant: MockInventoryVariant = {
      id: `mock-v-${Date.now()}`,
      code: `VAR-${Date.now()}`,
      name: variantName.trim() || 'Default',
      attributes: attributeNames.map(n => attrValues[n]?.trim() || ''),
      quantity: Number(qty),
      cost_price: Number(cost),
      selling_price: Number(sellingPrice) || undefined,
    }
    const item: MockInventoryItem = {
      id: `mock-${Date.now()}`,
      user_id: 'mock-user-1',
      name: name.trim(),
      category: category.trim() || 'Uncategorized',
      subcategory: subcategory.trim() || undefined,
      unit,
      current_stock: Number(qty),
      par_stock: 0,
      cost_price: Number(cost),
      mrp: Number(sellingPrice) || Number(cost),
      availability_status: 'active',
      notes: '',
      attributes: attributeNames,
      variants: [variant],
      created_at: now,
      updated_at: now,
      supplier_id: null,
      branch_id: null,
      has_expiry: hasExpiry,
      expires_within_days: hasExpiry && expiresWithinDays !== '' ? Number(expiresWithinDays) : null,
    }
    onCreate(item, variant)
  }

  return (
    <>
    <div className={styles.body}>
      <div className={styles.createForm}>
        <div className="form-group">
          <label className="form-label form-label--required">Product name</label>
          <input
            className="form-input"
            placeholder="e.g. Walnuts"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.createFormRow}>
          <div className="form-group">
            <label className="form-label">Category <span className="text-tertiary font-normal">(Optional)</span></label>
            <CustomSelect
              value={category}
              onChange={setCategory}
              placeholder="Uncategorized"
              options={[
                ...categories.map(c => ({ value: c, label: c })),
                { value: 'Uncategorized', label: 'Uncategorized' },
              ]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Subcategory <span className="text-tertiary font-normal">(Optional)</span></label>
            <input
              className="form-input"
              placeholder="e.g. Premium Grade"
              value={subcategory}
              onChange={e => setSubcategory(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.createFormRow}>
          <div className="form-group">
            <label className="form-label">Unit</label>
            <CustomSelect
              value={unit}
              onChange={setUnit}
              options={['KG', 'G', 'L', 'ML', 'PCS'].map(u => ({ value: u, label: u }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Variant name</label>
            <input
              className="form-input"
              placeholder="e.g. 500g Pack"
              value={variantName}
              onChange={e => setVariantName(e.target.value)}
            />
          </div>
        </div>

        <p className={styles.createFormHint}>You can add more variants to this product later from Inventory.</p>

        <div className={styles.createFormRow}>
          <div className="form-group">
            <label className="form-label form-label--required">Qty to order</label>
            <input
              type="number" min="1"
              className="form-input"
              value={qty}
              onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            {costOptional ? (
              <label className="form-label">Expected unit cost <span className="text-tertiary font-normal">(Optional)</span></label>
            ) : (
              <label className="form-label form-label--required">Unit cost</label>
            )}
            <div className="input-prefix">
              <span className="input-prefix__label">₹</span>
              <input
                type="number" min="0"
                className="form-input"
                value={cost}
                onChange={e => setCost(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Selling price <span className="text-tertiary font-normal">(Optional)</span></label>
          <div className="input-prefix">
            <span className="input-prefix__label">₹</span>
            <input
              type="number" min="0"
              className="form-input"
              value={sellingPrice}
              onChange={e => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-group">
          <div className={styles.fieldHeaderRow}>
            <label className="form-label">Enable Expiry Date</label>
            <button
              type="button"
              role="switch"
              aria-checked={hasExpiry}
              className={`toggle ${hasExpiry ? '' : 'toggle--off'}`}
              onClick={() => setHasExpiry(v => !v)}
            >
              <span className="toggle__dot" />
            </button>
          </div>
          <span className="form-hint">Track expiration dates and shelf life for this product</span>

          {hasExpiry && (
            <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
              <label className="form-label">Expires within (days)</label>
              <input
                className="form-input"
                type="number" min="1"
                placeholder="e.g. 30"
                autoFocus
                value={expiresWithinDays}
                onChange={e => setExpiresWithinDays(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          )}
        </div>

        <AttributesStrip
          names={attributeNames}
          values={attrValues}
          onValueChange={(attrName, value) => setAttrValues(prev => ({ ...prev, [attrName]: value }))}
          onAddName={handleAddAttrName}
          onRemoveName={handleRemoveAttrName}
        />
      </div>
    </div>

    <div className={styles.footer}>
      <div className={styles.footerActions} style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn--primary" disabled={!canCreate} onClick={handleCreate}>
          Create &amp; Add to Order
        </button>
      </div>
    </div>
    </>
  )
}
