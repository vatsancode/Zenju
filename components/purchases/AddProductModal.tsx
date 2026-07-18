'use client'

import { useMemo, useState } from 'react'
import {
  Search, X, ChevronDown, Plus,
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
}: {
  onClose: () => void
  onAdd: (lines: PickedLine[]) => void
}) {
  const [products, setProducts] = useState<MockInventoryItem[]>(mockInventoryItems)
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, Selection>>({})
  const [quickAddVariantFor, setQuickAddVariantFor] = useState<string | null>(null)
  const [creatingProduct, setCreatingProduct] = useState(false)

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

  const selectedCount = Object.keys(selections).length

  function selectionKey(itemId: string, variantId: string) {
    return `${itemId}:${variantId}`
  }

  function toggleVariant(item: MockInventoryItem, variant: MockInventoryVariant) {
    const key = selectionKey(item.id, variant.id)
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
  }

  function updateSelection(key: string, patch: Partial<Selection>) {
    setSelections(prev => (prev[key] ? { ...prev, [key]: { ...prev[key], ...patch } } : prev))
  }

  function handleQuickAddVariant(
    item: MockInventoryItem,
    fields: { name: string; code: string; qty: number; unitCost: number; sellingPrice: number }
  ) {
    const variant: MockInventoryVariant = {
      id: `mock-v-${Date.now()}`,
      code: fields.code || `VAR-${Date.now()}`,
      name: fields.name,
      attributes: [],
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

                    {singleVariant && quickAddVariantFor === item.id && (
                      <QuickAddVariantPopup
                        defaultCost={item.cost_price}
                        defaultSellingPrice={item.mrp}
                        onCancel={() => setQuickAddVariantFor(null)}
                        onCreate={fields => handleQuickAddVariant(item, fields)}
                      />
                    )}

                    {!singleVariant && isExpanded && (
                      <div className={styles.variantPanel}>
                        <button
                          type="button"
                          className={styles.quickAddVariantToggle}
                          onClick={() => setQuickAddVariantFor(item.id)}
                        >
                          <Plus size={14} /> Add new variant
                        </button>

                        {quickAddVariantFor === item.id && (
                          <QuickAddVariantPopup
                            defaultCost={item.cost_price}
                            defaultSellingPrice={item.mrp}
                            onCancel={() => setQuickAddVariantFor(null)}
                            onCreate={fields => handleQuickAddVariant(item, fields)}
                          />
                        )}

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
    </div>
  )
}

function QuickAddVariantPopup({
  defaultCost,
  defaultSellingPrice,
  onCreate,
  onCancel,
}: {
  defaultCost: number
  defaultSellingPrice: number
  onCreate: (fields: { name: string; code: string; qty: number; unitCost: number; sellingPrice: number }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [qty, setQty] = useState<number | ''>(1)
  const [unitCost, setUnitCost] = useState<number | ''>(defaultCost || '')
  const [sellingPrice, setSellingPrice] = useState<number | ''>(defaultSellingPrice || '')

  const canCreate = name.trim() && Number(qty) > 0 && Number(unitCost) > 0

  function handleCreate() {
    if (!canCreate) return
    onCreate({
      name: name.trim(),
      code: code.trim(),
      qty: Number(qty),
      unitCost: Number(unitCost),
      sellingPrice: Number(sellingPrice) || 0,
    })
  }

  return (
    <div className={styles.miniOverlay} onMouseDown={onCancel}>
      <div className={styles.miniModal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.miniModalTitle}>New Variant</div>

        <div className="form-group">
          <label className="form-label form-label--required">Variant name</label>
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
            <label className="form-label form-label--required">Unit cost</label>
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

        <div className={styles.footerActions} style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!canCreate} onClick={handleCreate}>
            Add Variant
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateProductForm({
  categories,
  onCreate,
  onCancel,
}: {
  categories: string[]
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

  const canCreate = name.trim() && Number(qty) > 0 && Number(cost) > 0

  function handleCreate() {
    if (!canCreate) return
    const now = new Date().toISOString()
    const variant: MockInventoryVariant = {
      id: `mock-v-${Date.now()}`,
      code: `VAR-${Date.now()}`,
      name: variantName.trim() || 'Default',
      attributes: [],
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
      attributes: [],
      variants: [variant],
      created_at: now,
      updated_at: now,
      supplier_id: null,
      branch_id: null,
    }
    onCreate(item, variant)
  }

  return (
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
            <label className="form-label form-label--required">Unit cost</label>
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

        <div className={styles.footerActions} style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!canCreate} onClick={handleCreate}>
            Create &amp; Add to Order
          </button>
        </div>
      </div>
    </div>
  )
}
