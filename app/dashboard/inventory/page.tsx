'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, X, Check, Upload, Filter, ChevronDown } from 'lucide-react'
import { mockInventoryItems, formatINR } from '@/lib/mock-data'
import type { InventoryItem, StockUnit } from '@/types/database'
import styles from './inventory.module.css'

// ─── Form-local types ─────────────────────────────────────────────────────────

type VariantRow = {
  id: string
  code: string
  attributes: string[]  // values indexed to match form.selected_attributes
  quantity: number
}

type TaxLine = {
  id: string
  name: string
  percentage: number
}

type NewItemForm = {
  name: string
  // Attributes — selected from the shared attribute pool for this item's variants
  selected_attributes: string[]
  // Quantity
  has_variation: boolean
  quantity: number | ''
  variants: VariantRow[]
  // Item ID
  item_id: string
  // Unit
  unit: string
  // Category / subcategory
  category: string
  subcategory: string
  // Pricing
  purchase_price: number | ''
  price_mode: 'per_unit' | 'total'
  selling_price: number | ''
  taxes: TaxLine[]
  tax_inclusive: boolean
  // Stock
  par_stock: number | ''
  // Expiry
  has_expiry: boolean
  expires_within_days: number | ''
  // Notes
  description: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_UNITS = ['KG', 'Grams', 'Litres', 'ML', 'Pieces']

// ─── Custom select component ──────────────────────────────────────────────────

type SelectOption = { value: string; label: string; isAction?: boolean }

function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value && !o.isAction)

  return (
    <div className={styles.customSelectWrap}>
      <button
        type="button"
        className={`form-select ${styles.customSelectTrigger}`}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <span className={selected ? '' : 'text-tertiary'}>
          {selected?.label ?? placeholder}
        </span>
      </button>
      {open && (
        <div className={styles.customSelectDropdown}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={[
                styles.customSelectOption,
                opt.isAction ? styles.customSelectOptionAction : '',
                !opt.isAction && opt.value === value ? styles.customSelectOptionSelected : '',
              ].filter(Boolean).join(' ')}
              onMouseDown={e => {
                // Prevent browser from focusing the button — it unmounts on this click,
                // and its trailing focus would steal focus from the inline-create input.
                e.preventDefault()
                onChange(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genVariantCode(index: number) {
  return `VAR-${String(index + 1).padStart(3, '0')}`
}

function makeEmptyVariant(index: number, attrCount: number): VariantRow {
  return {
    id: `${Date.now()}-${index}-${Math.random()}`,
    code: genVariantCode(index),
    attributes: Array(attrCount).fill(''),
    quantity: 0,
  }
}

function emptyForm(): NewItemForm {
  return {
    name: '',
    selected_attributes: [],
    has_variation: false,
    quantity: 0,
    variants: [makeEmptyVariant(0, 0), makeEmptyVariant(1, 0)],
    item_id: '',
    unit: 'Pieces',
    category: '',
    subcategory: '',
    purchase_price: '',
    price_mode: 'per_unit',
    selling_price: '',
    taxes: [],
    tax_inclusive: true,
    par_stock: '',
    has_expiry: false,
    expires_within_days: '',
    description: '',
  }
}

// ─── Filter config ────────────────────────────────────────────────────────────

const FILTER_DEFS = [
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
] as const

type FilterKey = typeof FILTER_DEFS[number]['key']

const STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
] as const

// ─── Page component ───────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter()

  // ── Table state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [activeFilterTypes, setActiveFilterTypes] = useState<FilterKey[]>([])
  const [filterTypeDropdownOpen, setFilterTypeDropdownOpen] = useState(false)
  const [addFilterDropdownOpen, setAddFilterDropdownOpen] = useState(false)
  const [openValueDropdown, setOpenValueDropdown] = useState<FilterKey | null>(null)
  const [showAddDrawer, setShowAddDrawer] = useState(false)
  const [items, setItems] = useState<InventoryItem[]>(mockInventoryItems as InventoryItem[])

  // ── Edit / Modal state ────────────────────────────────────────────────────────
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showWasteModal, setShowWasteModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [arrivalQty, setArrivalQty] = useState(0)
  const [arrivalCostPrice, setArrivalCostPrice] = useState(0)
  const [wasteQty, setWasteQty] = useState(0)
  const [wasteReason, setWasteReason] = useState('')

  // ── Edit drawer extended state ────────────────────────────────────────────────
  const [editSubcategory, setEditSubcategory] = useState('')
  const [editTaxes, setEditTaxes] = useState<TaxLine[]>([])
  const [editTaxInclusive, setEditTaxInclusive] = useState(true)
  const [editHasVariation, setEditHasVariation] = useState(false)
  const [editVariants, setEditVariants] = useState<VariantRow[]>([])
  const [editAddingAttr, setEditAddingAttr] = useState(false)
  const [editNewAttrInput, setEditNewAttrInput] = useState('')
  const [editOriginalId, setEditOriginalId] = useState('')

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState<NewItemForm>(emptyForm())

  // ── Attribute pool (shared, created by user — starts empty) ─────────────────
  const [attributePool, setAttributePool] = useState<string[]>([])
  const [addingAttr, setAddingAttr] = useState(false)
  const [newAttrInput, setNewAttrInput] = useState('')

  // ── Unit management ─────────────────────────────────────────────────────────
  const [customUnits, setCustomUnits] = useState<string[]>([])
  const [addingUnit, setAddingUnit] = useState(false)
  const [newUnitInput, setNewUnitInput] = useState('')
  const allUnits = [...DEFAULT_UNITS, ...customUnits]

  // ── Category management ─────────────────────────────────────────────────────
  const existingCategories = Array.from(new Set(items.map(i => i.category)))
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const allCategories = Array.from(new Set([...existingCategories, ...customCategories]))

  // ── Subcategory management ──────────────────────────────────────────────────
  const [customSubcategories, setCustomSubcategories] = useState<string[]>([])
  const [addingSubcategory, setAddingSubcategory] = useState(false)
  const [newSubcategoryInput, setNewSubcategoryInput] = useState('')

  // ── Autocomplete ─────────────────────────────────────────────────────────────
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameSuggestions = form.name.trim().length >= 1
    ? items.filter(i => i.name.toLowerCase().includes(form.name.toLowerCase())).slice(0, 6)
    : []

  // ── Image ────────────────────────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const newCategoryInputRef = useRef<HTMLInputElement>(null)
  const newSubcategoryInputRef = useRef<HTMLInputElement>(null)
  const newUnitInputRef = useRef<HTMLInputElement>(null)

  // ── Edit drawer "+ Create new" state (Unit / Category / Subcategory) ─────────
  const [addingEditUnit, setAddingEditUnit] = useState(false)
  const [newEditUnitInput, setNewEditUnitInput] = useState('')
  const [addingEditCategory, setAddingEditCategory] = useState(false)
  const [newEditCategoryInput, setNewEditCategoryInput] = useState('')
  const [addingEditSubcategory, setAddingEditSubcategory] = useState(false)
  const [newEditSubcategoryInput, setNewEditSubcategoryInput] = useState('')
  const newEditUnitInputRef = useRef<HTMLInputElement>(null)
  const newEditCategoryInputRef = useRef<HTMLInputElement>(null)
  const newEditSubcategoryInputRef = useRef<HTMLInputElement>(null)

  // ── Auto-focus: focus inline inputs after they mount ─────────────────────────
  useEffect(() => { if (addingCategory) newCategoryInputRef.current?.focus() }, [addingCategory])
  useEffect(() => { if (addingSubcategory) newSubcategoryInputRef.current?.focus() }, [addingSubcategory])
  useEffect(() => { if (addingUnit) newUnitInputRef.current?.focus() }, [addingUnit])
  useEffect(() => { if (addingEditUnit) newEditUnitInputRef.current?.focus() }, [addingEditUnit])
  useEffect(() => { if (addingEditCategory) newEditCategoryInputRef.current?.focus() }, [addingEditCategory])
  useEffect(() => { if (addingEditSubcategory) newEditSubcategoryInputRef.current?.focus() }, [addingEditSubcategory])

  // ── Auto-focus tracking for dynamically added rows ───────────────────────────
  const [lastAddedVariantId, setLastAddedVariantId] = useState('')
  const [lastAddedTaxId, setLastAddedTaxId] = useState('')
  const [lastAddedEditTaxId, setLastAddedEditTaxId] = useState('')

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalQty = form.has_variation
    ? form.variants.reduce((s, v) => s + Number(v.quantity || 0), 0)
    : Number(form.quantity || 0)

  const purchasePricePerUnit = (() => {
    if (form.purchase_price === '') return 0
    if (form.price_mode === 'per_unit') return Number(form.purchase_price)
    return totalQty > 0 ? Number(form.purchase_price) / totalQty : 0
  })()

  // Attributes not yet selected for this item
  const availableAttributes = attributePool.filter(
    a => !form.selected_attributes.includes(a)
  )

  // Suggestions shown in the dropdown while the user types an attribute name
  const attrSuggestions = addingAttr
    ? availableAttributes.filter(
      a =>
        !newAttrInput.trim() ||
        a.toLowerCase().includes(newAttrInput.toLowerCase())
    )
    : []

  // ── Table derived ─────────────────────────────────────────────────────────────
  const tableCategories = Array.from(new Set(items.map(item => item.category)))

  const activeFilterCount = activeFilterTypes.length

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(item.category)
    const isOutOfStock = item.availability_status !== 'active'
    const isLowStock = !isOutOfStock && item.current_stock <= item.par_stock
    const isInStock = !isOutOfStock && !isLowStock
    const matchesStatus = statusFilters.length === 0 || statusFilters.some(s =>
      s === 'out_of_stock' ? isOutOfStock : s === 'low_stock' ? isLowStock : isInStock
    )
    return matchesSearch && matchesCategory && matchesStatus
  })

  const inventoryWorth = items.reduce(
    (sum, item) => sum + item.current_stock * item.cost_price,
    0
  )
  const lowStockCount = items.filter(
    item => item.current_stock <= item.par_stock && item.availability_status === 'active'
  ).length

  // ── Filter handlers ───────────────────────────────────────────────────────────

  function addFilterType(key: FilterKey) {
    setActiveFilterTypes(prev => prev.includes(key) ? prev : [...prev, key])
    setOpenValueDropdown(key)
    setFilterTypeDropdownOpen(false)
    setAddFilterDropdownOpen(false)
  }

  function removeFilterType(key: FilterKey) {
    setActiveFilterTypes(prev => prev.filter(k => k !== key))
    if (key === 'category') setCategoryFilters([])
    if (key === 'status') setStatusFilters([])
    if (openValueDropdown === key) setOpenValueDropdown(null)
  }

  function clearAllFilters() {
    setActiveFilterTypes([])
    setCategoryFilters([])
    setStatusFilters([])
    setOpenValueDropdown(null)
    setSearch('')
  }

  // ── Attribute handlers ────────────────────────────────────────────────────────

  function addSelectedAttribute(attrName: string) {
    if (form.selected_attributes.includes(attrName)) return
    setForm(prev => ({
      ...prev,
      selected_attributes: [...prev.selected_attributes, attrName],
      // Grow each variant row's attributes array by one empty slot
      variants: prev.variants.map(v => ({
        ...v,
        attributes: [...v.attributes, ''],
      })),
    }))
  }

  function removeSelectedAttribute(attrName: string) {
    const idx = form.selected_attributes.indexOf(attrName)
    if (idx === -1) return
    setForm(prev => ({
      ...prev,
      selected_attributes: prev.selected_attributes.filter(a => a !== attrName),
      // Remove the matching index from every variant row
      variants: prev.variants.map(v => ({
        ...v,
        attributes: v.attributes.filter((_, i) => i !== idx),
      })),
    }))
  }

  function handleCreateAttribute(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!attributePool.includes(trimmed)) {
      setAttributePool(prev => [...prev, trimmed])
    }
    addSelectedAttribute(trimmed)
    setNewAttrInput('')
    setAddingAttr(false)
  }

  // ── Other form handlers ───────────────────────────────────────────────────────

  function handleSelectSuggestion(item: InventoryItem) {
    setForm(prev => ({
      ...prev,
      name: item.name,
      category: item.category,
      unit: item.unit,
      purchase_price: item.cost_price,
      selling_price: item.mrp,
      par_stock: item.par_stock,
      description: item.notes || '',
    }))
    setShowSuggestions(false)
  }

  function handleAddUnit() {
    const unit = newUnitInput.trim()
    if (unit && !allUnits.includes(unit)) {
      setCustomUnits(prev => [...prev, unit])
    }
    if (unit) setForm(prev => ({ ...prev, unit }))
    setAddingUnit(false)
    setNewUnitInput('')
  }

  function handleAddCategory() {
    const cat = newCategoryInput.trim()
    if (cat && !allCategories.includes(cat)) {
      setCustomCategories(prev => [...prev, cat])
    }
    if (cat) setForm(prev => ({ ...prev, category: cat }))
    setAddingCategory(false)
    setNewCategoryInput('')
  }

  function handleAddSubcategory() {
    const sub = newSubcategoryInput.trim()
    if (sub && !customSubcategories.includes(sub)) {
      setCustomSubcategories(prev => [...prev, sub])
    }
    if (sub) setForm(prev => ({ ...prev, subcategory: sub }))
    setAddingSubcategory(false)
    setNewSubcategoryInput('')
  }

  // ── Edit-drawer "+ Create new" handlers ─────────────────────────────────────
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  function handleRemoveImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function handleAddVariantRow() {
    const newId = `${Date.now()}-${Math.random()}`
    setLastAddedVariantId(newId)
    setForm(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: newId,
          code: genVariantCode(prev.variants.length),
          attributes: Array(prev.selected_attributes.length).fill(''),
          quantity: 0,
        },
      ],
    }))
  }

  function updateVariantAttr(rowIdx: number, attrIdx: number, value: string) {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === rowIdx
          ? { ...v, attributes: v.attributes.map((a, j) => (j === attrIdx ? value : a)) }
          : v
      ),
    }))
  }

  function updateVariantField<K extends 'quantity' | 'code'>(
    rowIdx: number,
    key: K,
    value: VariantRow[K]
  ) {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === rowIdx ? { ...v, [key]: value } : v
      ),
    }))
  }

  function updateTax(taxIdx: number, key: keyof TaxLine, value: string | number) {
    setForm(prev => ({
      ...prev,
      taxes: prev.taxes.map((t, i) => (i === taxIdx ? { ...t, [key]: value } : t)),
    }))
  }

  function handleSaveItem() {
    if (!form.name.trim() || !form.category.trim()) return

    const created: InventoryItem = {
      id: form.item_id.trim() || Date.now().toString(),
      user_id: 'mock-user-1',
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit as StockUnit,
      current_stock: totalQty,
      par_stock: Number(form.par_stock || 0),
      cost_price: purchasePricePerUnit,
      mrp: Number(form.selling_price || 0),
      availability_status: 'active',
      notes: form.description.trim() || null,
      attributes: form.selected_attributes,
      variants: form.has_variation ? form.variants.map(v => ({
        id: v.id,
        code: v.code,
        attributes: [...v.attributes],
        quantity: v.quantity
      })) : undefined,
      created_at: new Date().toISOString(),
      supplier_id: null,
      branch_id: null,
    }

    setItems(prev => [...prev, created])
    handleCloseDrawer()
  }

  function handleCloseDrawer() {
    setForm(emptyForm())
    handleRemoveImage()
    setAddingUnit(false)
    setAddingCategory(false)
    setAddingSubcategory(false)
    setAddingAttr(false)
    setShowSuggestions(false)
    setShowAddDrawer(false)
  }

  function handleSaveEdit() {
    if (!editingItem) return
    const updated: InventoryItem = {
      ...editingItem,
      variants: editHasVariation ? editVariants.map(v => ({
        id: v.id,
        code: v.code,
        attributes: [...v.attributes],
        quantity: v.quantity
      })) : undefined,
      current_stock: editHasVariation
        ? editVariants.reduce((s, v) => s + Number(v.quantity || 0), 0)
        : editingItem.current_stock
    }
    setItems(prev => prev.map(i => i.id === editOriginalId ? updated : i))
    setShowEditDrawer(false)
    setEditingItem(null)
  }

  function handleStockArrival() {
    if (!selectedItem) return
    setItems(prev => prev.map(i => {
      if (i.id !== selectedItem.id) return i
      return {
        ...i,
        current_stock: i.current_stock + arrivalQty,
        ...(arrivalCostPrice > 0 ? { cost_price: arrivalCostPrice } : {}),
      }
    }))
    setShowStockModal(false)
    setSelectedItem(null)
  }

  function handleWaste() {
    if (!selectedItem) return
    setItems(prev => prev.map(i => {
      if (i.id !== selectedItem.id) return i
      return {
        ...i,
        current_stock: Math.max(0, i.current_stock - wasteQty),
      }
    }))
    setShowWasteModal(false)
    setSelectedItem(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page Header */}
      <div className={styles.headerRow}>
        <h1>Stocks</h1>
        <div className={styles.headerActions}>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setShowAddDrawer(true)}
            style={{ height: '32px' }}
          >
            <Plus size={18} /> Add Item
          </button>
        </div>
      </div>

      {/* Inventory Worth Banner */}
      <div className={styles.worthBanner}>
        <span className="text-secondary text-sm">Total stock worth</span>
        <span className={styles.worthValue}>{formatINR(inventoryWorth)}</span>
        {lowStockCount > 0 && (
          <span className="badge badge--warning">{lowStockCount} low stock</span>
        )}
      </div>

      {/* Freemium Banner */}
      {items.length >= 45 && (
        <div className="upgrade-banner">
          <p className="upgrade-banner__text">
            {items.length} of 50 inventory items used on free plan.
          </p>
          <Link href="/dashboard/settings/billing" className="btn btn--primary btn--sm">
            Upgrade
          </Link>
        </div>
      )}

      {/* Filters Row */}
      <div className={styles.filtersRow}>
        <div className={styles.searchWrap}>
          <input
            className="form-input"
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter button — opens type-selection dropdown */}
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

      {/* Active filter bar + result count — shown when any filter/search is active */}
      {(activeFilterTypes.length > 0 || search) && (
        <div className={styles.resultSummaryRow}>
          <span className={styles.resultSummary}>
            <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'item' : 'items'}
            <span className={styles.resultSummarySep}>•</span>
          </span>

          {/* Active filter chips */}
          {activeFilterTypes.map(key => {
            const isOpen = openValueDropdown === key
            const selectedValues = key === 'category' ? categoryFilters : statusFilters
            const label = key === 'category' ? 'Category' : 'Status'
            const options: readonly { value: string; label: string }[] =
              key === 'category'
                ? tableCategories.map(c => ({ value: c, label: c }))
                : STATUS_OPTIONS

            const displayText =
              selectedValues.length === 0 ? 'Any'
                : selectedValues.length === 1
                  ? (key === 'status'
                    ? STATUS_OPTIONS.find(o => o.value === selectedValues[0])?.label ?? selectedValues[0]
                    : selectedValues[0])
                  : `${selectedValues.length} selected`

            return (
              <div key={key} className={styles.filterChipWrap}>
                <div className={`${styles.filterChipInner}${isOpen ? ` ${styles.filterChipInnerOpen}` : ''}`}>
                  <button
                    className={styles.filterChipMain}
                    onClick={() => setOpenValueDropdown(prev => prev === key ? null : key)}
                  >
                    <span className={styles.filterChipLabel}>{label}</span>
                    <span className={`${styles.filterChipValues}${selectedValues.length > 0 ? ` ${styles.filterChipValuesActive}` : ''}`}>
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
                    title={`Remove ${label} filter`}
                  >
                    <X size={11} />
                  </button>
                </div>

                {isOpen && (
                  <>
                    <div className={styles.filterBackdrop} onClick={() => setOpenValueDropdown(null)} />
                    <div className={styles.valueDropdown}>
                      {options.map(opt => {
                        const checked = selectedValues.includes(opt.value)
                        return (
                          <button
                            key={opt.value}
                            className={`${styles.valueOption}${checked ? ` ${styles.valueOptionChecked}` : ''}`}
                            onClick={() => {
                              if (key === 'category') {
                                setCategoryFilters(prev =>
                                  prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                                )
                              } else {
                                setStatusFilters(prev =>
                                  prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                                )
                              }
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
          })}

          {/* Search chip */}
          {search && (
            <button className={styles.filterChip} onClick={() => setSearch('')} title="Clear search">
              <span className={styles.filterChipLabel}>Search:</span>
              <span className={styles.filterChipValue}>{search}</span>
              <X size={12} />
            </button>
          )}

          {/* + Add Filter (only when unused filter types remain) */}
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

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No items found</p>
            <p className="empty-state__desc">
              {search || categoryFilters.length > 0 || statusFilters.length > 0
                ? 'Try adjusting your filters'
                : 'Add your first inventory item to get started'}
            </p>
            {!search && categoryFilters.length === 0 && statusFilters.length === 0 && (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => setShowAddDrawer(true)}
              >
                Add Item
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className={styles.itemNameCol}>Item Name</th>
                <th className={styles.itemIdCol}>Item ID</th>
                <th className={styles.categoryCol}>Category</th>
                <th className={styles.stockCol}>Current Stock</th>
                <th className={styles.statusCol}>Status</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const isOutOfStock = item.availability_status === 'discontinued' || item.availability_status === 'out_of_stock'
                const isLowStock = !isOutOfStock && item.current_stock <= item.par_stock

                return (
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                  >
                    <td>{item.name}</td>
                    <td>
                      <div className={styles.itemIdCell}>
                        <span className={styles.itemIdCode}>{item.id}</span>
                        {item.variants && item.variants.length > 0 ? (
                          <span className={styles.variantIdMore}>
                            +{item.variants.length} variants
                          </span>
                        ) : item.attributes && item.attributes.length > 0 && (
                          <span className={styles.variantIdMore}>
                            {item.attributes.length} tags
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge--neutral">{item.category}</span>
                    </td>
                    <td>{item.current_stock} {item.unit}</td>
                    <td>
                      <span className={`badge badge--${isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}`}>
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className={styles.actions}>
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Edit item"
                          onClick={() => {
                            setEditingItem(item)
                            setEditOriginalId(item.id)
                            setEditSubcategory('')
                            setEditTaxes([])
                            setEditTaxInclusive(true)
                            setEditHasVariation(!!item.variants && item.variants.length > 0)
                            setEditVariants(item.variants && item.variants.length > 0
                              ? item.variants.map(v => ({
                                id: v.id,
                                code: v.code,
                                attributes: [...v.attributes],
                                quantity: v.quantity
                              }))
                              : [
                                makeEmptyVariant(0, item.attributes?.length ?? 0),
                                makeEmptyVariant(1, item.attributes?.length ?? 0),
                              ])
                            setEditAddingAttr(false)
                            setEditNewAttrInput('')
                            setShowEditDrawer(true)
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Record waste"
                          onClick={() => {
                            setSelectedItem(item)
                            setWasteQty(0)
                            setWasteReason('')
                            setShowWasteModal(true)
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add Item Drawer ── */}
      {showAddDrawer && (
        <div className="overlay" onClick={handleCloseDrawer}>
          <div
            className="drawer"
            style={{ width: '560px', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer__header">
              <h3 className="drawer__title">Add Stock Item</h3>
              <button className="drawer__close" onClick={handleCloseDrawer}><X size={18} /></button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.drawerForm}>

                {/* ── 1. Item Name with autocomplete ── */}
                <div className="form-group">
                  <label className="form-label form-label--required">Item Name</label>
                  <div className={styles.autocompleteWrap}>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. Cashews"
                      autoComplete="off"
                      value={form.name}
                      onChange={e => {
                        setForm(prev => ({ ...prev, name: e.target.value }))
                        setShowSuggestions(true)
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    />
                    {showSuggestions && nameSuggestions.length > 0 && (
                      <div className={styles.autocomplete}>
                        {nameSuggestions.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            className={styles.autocompleteItem}
                            onMouseDown={() => handleSelectSuggestion(item)}
                          >
                            <span>{item.name}</span>
                            <span className="text-secondary text-sm">{item.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="form-hint">
                    Name must be unique. Select a suggestion to pre-fill from an existing item.
                  </span>
                </div>

                {/* ── 2. Attributes ── */}
                <div className="form-group">
                  <label className="form-label">Attributes</label>

                  {/* Selected attribute chips */}
                  {form.selected_attributes.length > 0 && (
                    <div className={styles.attrChipsRow}>
                      {form.selected_attributes.map(attr => (
                        <span key={attr} className={styles.attrChip}>
                          {attr}
                          <button
                            type="button"
                            className={styles.attrChipRemove}
                            onClick={() => removeSelectedAttribute(attr)}
                            title={`Remove ${attr}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inline add — single step: type and press Enter */}
                  {addingAttr ? (
                    <div className={styles.attrAddRow}>
                      <div className={styles.attrInputWrap}>
                        <input
                          className="form-input"
                          autoFocus
                          placeholder="Type attribute name and press Enter…"
                          value={newAttrInput}
                          onChange={e => setNewAttrInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreateAttribute(newAttrInput)
                            if (e.key === 'Escape') {
                              setAddingAttr(false)
                              setNewAttrInput('')
                            }
                          }}
                        />
                        {/* Pool suggestions dropdown */}
                        {attrSuggestions.length > 0 && (
                          <div className={styles.attrSuggestions}>
                            {attrSuggestions.map(attr => (
                              <button
                                key={attr}
                                type="button"
                                className={styles.attrSuggestionItem}
                                onMouseDown={() => {
                                  addSelectedAttribute(attr)
                                  setNewAttrInput('')
                                  setAddingAttr(false)
                                }}
                              >
                                {attr}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                        title="Add attribute"
                        onClick={() => handleCreateAttribute(newAttrInput)}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                        title="Cancel"
                        onClick={() => {
                          setAddingAttr(false)
                          setNewAttrInput('')
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.addAttrBtn}
                      onClick={() => setAddingAttr(true)}
                    >
                      + Add attribute
                    </button>
                  )}

                  <span className="form-hint">
                    Attributes describe item characteristics (e.g. Organic, Premium, Seasonal).
                  </span>
                </div>

                {/* ── 3. Unit ── */}
                <div className="form-group">
                  <label className="form-label form-label--required">Unit</label>
                  {!addingUnit ? (
                    <CustomSelect
                      value={form.unit}
                      options={[
                        ...allUnits.map(u => ({ value: u, label: u })),
                        { value: '__new__', label: '+ Create new unit', isAction: true },
                      ]}
                      onChange={v => {
                        if (v === '__new__') {
                          setAddingUnit(true)
                        } else {
                          setForm(prev => ({ ...prev, unit: v }))
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.inlineCreate}>
                      <input
                        ref={newUnitInputRef}
                        className="form-input"
                        placeholder="e.g. Boxes, Cartons, Packets"
                        value={newUnitInput}
                        onChange={e => setNewUnitInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddUnit()
                          if (e.key === 'Escape') setAddingUnit(false)
                        }}
                      />
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                        title="Confirm"
                        onClick={handleAddUnit}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                        title="Cancel"
                        onClick={() => setAddingUnit(false)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ── 6. Image ── */}
                <div className="form-group">
                  <label className="form-label">
                    Image <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                  />
                  {imagePreview ? (
                    <div className={styles.imagePreviewWrap}>
                      <img
                        src={imagePreview}
                        alt="Item preview"
                        className={styles.imagePreviewImg}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <span className="text-sm text-secondary">Image selected</span>
                        <div className={styles.headerActions}>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => imageInputRef.current?.click()}
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={handleRemoveImage}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.imageUploadBtn}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Upload size={20} />
                      <span>Click to upload image</span>
                    </button>
                  )}
                </div>

                {/* ── Categorization ── */}
                <div className={styles.sectionLabel}>Categorization</div>

                {/* ── 7. Category ── */}
                <div className="form-group">
                  <label className="form-label form-label--required">Category</label>
                  {!addingCategory ? (
                    <CustomSelect
                      value={form.category}
                      placeholder="Select category"
                      options={[
                        ...allCategories.map(c => ({ value: c, label: c })),
                        { value: '__new__', label: '+ Create new category', isAction: true },
                      ]}
                      onChange={v => {
                        if (v === '__new__') {
                          setAddingCategory(true)
                        } else {
                          setForm(prev => ({ ...prev, category: v }))
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.inlineCreate}>
                      <input
                        ref={newCategoryInputRef}
                        className="form-input"
                        placeholder="e.g. Nuts, Spices, Beverages"
                        value={newCategoryInput}
                        onChange={e => setNewCategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddCategory()
                          if (e.key === 'Escape') setAddingCategory(false)
                        }}
                      />
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                        title="Confirm"
                        onClick={handleAddCategory}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                        title="Cancel"
                        onClick={() => setAddingCategory(false)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ── 8. Subcategory ── */}
                <div className="form-group">
                  <label className="form-label">
                    Subcategory <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  {!addingSubcategory ? (
                    <CustomSelect
                      value={form.subcategory}
                      placeholder="None"
                      options={[
                        { value: '', label: 'None' },
                        ...customSubcategories.map(s => ({ value: s, label: s })),
                        { value: '__new__', label: '+ Create new subcategory', isAction: true },
                      ]}
                      onChange={v => {
                        if (v === '__new__') {
                          setAddingSubcategory(true)
                        } else {
                          setForm(prev => ({ ...prev, subcategory: v }))
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.inlineCreate}>
                      <input
                        ref={newSubcategoryInputRef}
                        className="form-input"
                        placeholder="e.g. Premium, Organic, Salted"
                        value={newSubcategoryInput}
                        onChange={e => setNewSubcategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddSubcategory()
                          if (e.key === 'Escape') setAddingSubcategory(false)
                        }}
                      />
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                        title="Confirm"
                        onClick={handleAddSubcategory}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                        title="Cancel"
                        onClick={() => setAddingSubcategory(false)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Taxes ── */}
                <div className="form-group">
                  <div className={styles.fieldHeaderRow}>
                    <label className="form-label">
                      Taxes <span className="text-tertiary font-normal">(Optional)</span>
                    </label>
                    <label className={styles.toggleLabel}>
                      <span className="text-sm text-secondary">
                        {form.tax_inclusive ? 'Inclusive' : 'Exclusive'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.tax_inclusive}
                        className={`toggle ${form.tax_inclusive ? '' : 'toggle--off'}`}
                        onClick={() =>
                          setForm(prev => ({ ...prev, tax_inclusive: !prev.tax_inclusive }))
                        }
                      >
                        <span className="toggle__dot" />
                      </button>
                    </label>
                  </div>

                  {form.taxes.length > 0 && (
                    <div className={styles.taxSection}>
                      {form.taxes.map((tax, i) => (
                        <div key={tax.id} className={styles.taxRow}>
                          <input
                            className="form-input"
                            placeholder="Tax name (e.g. GST)"
                            autoFocus={tax.id === lastAddedTaxId}
                            value={tax.name}
                            onChange={e => updateTax(i, 'name', e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <div className={styles.taxPercentInput}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={tax.percentage || ''}
                              onChange={e => updateTax(i, 'percentage', Number(e.target.value))}
                            />
                            <span className={styles.taxPercentSuffix}>%</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ flexShrink: 0 }}
                            onClick={() =>
                              setForm(prev => ({
                                ...prev,
                                taxes: prev.taxes.filter((_, j) => j !== i),
                              }))
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className={styles.addAttrBtn}
                    style={{ marginTop: form.taxes.length > 0 ? 'var(--space-2)' : undefined }}
                    onClick={() => {
                      const newId = `${Date.now()}-${Math.random()}`
                      setLastAddedTaxId(newId)
                      setForm(prev => ({
                        ...prev,
                        taxes: [...prev.taxes, { id: newId, name: '', percentage: 0 }],
                      }))
                    }}
                  >
                    + Add tax
                  </button>

                  <span className="form-hint">
                    {form.tax_inclusive ? 'Tax included in item price.' : 'Tax charged on top of item price.'}
                  </span>
                </div>

                {/* ── 11. Expiry toggle ── */}
                <div className="form-group">
                  <div className={styles.fieldHeaderRow}>
                    <label className="form-label">Perishable — has expiry date</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.has_expiry}
                      className={`toggle ${form.has_expiry ? '' : 'toggle--off'}`}
                      onClick={() =>
                        setForm(prev => ({ ...prev, has_expiry: !prev.has_expiry }))
                      }
                    >
                      <span className="toggle__dot" />
                    </button>
                  </div>
                  {form.has_expiry && (
                    <div
                      className="form-group"
                      style={{ marginTop: 'var(--space-2)' }}
                    >
                      <label className="form-label">Expires within (days)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        placeholder="e.g. 30"
                        autoFocus
                        value={form.expires_within_days}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            expires_within_days:
                              e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                      />
                      <span className="form-hint">
                        Stock will be flagged for review as it approaches this expiry window.
                      </span>
                    </div>
                  )}
                </div>

                {/* ── 13. Description ── */}
                <div className="form-group">
                  <label className="form-label">
                    Description <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder="Additional notes or description about this item..."
                    value={form.description}
                    onChange={e =>
                      setForm(prev => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>

              </div>{/* drawerForm */}
            </div>{/* drawerScroll */}

            <div className={`drawer__footer ${styles.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={handleCloseDrawer}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSaveItem}
                disabled={!form.name.trim() || !form.category.trim()}
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Item Drawer ── */}
      {showEditDrawer && editingItem && (
        <div className="overlay" onClick={() => { setShowEditDrawer(false); setEditingItem(null) }}>
          <div
            className="drawer"
            style={{ width: '560px', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer__header">
              <h3 className="drawer__title">Edit Stock Item</h3>
              <button className="drawer__close" onClick={() => { setShowEditDrawer(false); setEditingItem(null) }}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.drawerForm}>

                {/* 1. Item Name */}
                <div className="form-group">
                  <label className="form-label form-label--required">Item Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editingItem.name}
                    onChange={e => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>

                {/* 2. Attributes */}
                <div className="form-group">
                  <label className="form-label">Attributes</label>
                  {(editingItem.attributes || []).length > 0 && (
                    <div className={styles.attrChipsRow}>
                      {(editingItem.attributes || []).map((attr, idx) => (
                        <span key={`${attr}-${idx}`} className={styles.attrChip}>
                          {attr}
                          <button
                            type="button"
                            className={styles.attrChipRemove}
                            onClick={() => {
                              setEditingItem(prev => {
                                if (!prev) return null
                                return { ...prev, attributes: (prev.attributes || []).filter((_, i) => i !== idx) }
                              })
                              setEditVariants(prev => prev.map(v => ({
                                ...v,
                                attributes: v.attributes.filter((_, i) => i !== idx),
                              })))
                            }}
                            title={`Remove ${attr}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {editAddingAttr ? (
                    <div className={styles.attrAddRow}>
                      <div className={styles.attrInputWrap}>
                        <input
                          className="form-input"
                          autoFocus
                          placeholder="Type attribute name and press Enter…"
                          value={editNewAttrInput}
                          onChange={e => setEditNewAttrInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const trimmed = editNewAttrInput.trim()
                              if (trimmed) {
                                setEditingItem(prev => prev ? { ...prev, attributes: [...(prev.attributes || []), trimmed] } : null)
                                setEditVariants(prev => prev.map(v => ({ ...v, attributes: [...v.attributes, ''] })))
                              }
                              setEditNewAttrInput('')
                              setEditAddingAttr(false)
                            }
                            if (e.key === 'Escape') { setEditAddingAttr(false); setEditNewAttrInput('') }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                        onClick={() => {
                          const trimmed = editNewAttrInput.trim()
                          if (trimmed) {
                            setEditingItem(prev => prev ? { ...prev, attributes: [...(prev.attributes || []), trimmed] } : null)
                            setEditVariants(prev => prev.map(v => ({ ...v, attributes: [...v.attributes, ''] })))
                          }
                          setEditNewAttrInput('')
                          setEditAddingAttr(false)
                        }}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                        onClick={() => { setEditAddingAttr(false); setEditNewAttrInput('') }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.addAttrBtn}
                      onClick={() => setEditAddingAttr(true)}
                    >
                      + Add attribute
                    </button>
                  )}
                  <span className="form-hint">
                    Attributes define what varies between variants (e.g. Size, Color).
                  </span>
                </div>

                {/* 5. Unit */}
                <div className="form-group">
                  <label className="form-label form-label--required">Unit</label>
                  {!addingEditUnit ? (
                    <CustomSelect
                      value={editingItem.unit}
                      options={[
                        ...allUnits.map(u => ({ value: u, label: u })),
                        { value: '__new__', label: '+ Create new unit', isAction: true },
                      ]}
                      onChange={v => {
                        if (v === '__new__') setAddingEditUnit(true)
                        else setEditingItem(prev => prev ? { ...prev, unit: v as StockUnit } : null)
                      }}
                    />
                  ) : (
                    <div className={styles.inlineCreate}>
                      <input
                        ref={newEditUnitInputRef}
                        className="form-input"
                        placeholder="e.g. Boxes, Cartons, Packets"
                        value={newEditUnitInput}
                        onChange={e => setNewEditUnitInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddEditUnit()
                          if (e.key === 'Escape') setAddingEditUnit(false)
                        }}
                      />
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} title="Confirm" onClick={handleAddEditUnit}>
                        <Check size={15} />
                      </button>
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} title="Cancel" onClick={() => setAddingEditUnit(false)}>
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Categorization */}
                <div className={styles.sectionLabel}>Categorization</div>

                {/* 5. Category */}
                <div className="form-group">
                  <label className="form-label form-label--required">Category</label>
                  {!addingEditCategory ? (
                    <CustomSelect
                      value={editingItem.category}
                      placeholder="Select category"
                      options={[
                        ...allCategories.map(c => ({ value: c, label: c })),
                        ...(!allCategories.includes(editingItem.category) && editingItem.category
                          ? [{ value: editingItem.category, label: editingItem.category }]
                          : []),
                        { value: '__new__', label: '+ Create new category', isAction: true },
                      ]}
                      onChange={v => {
                        if (v === '__new__') setAddingEditCategory(true)
                        else setEditingItem(prev => prev ? { ...prev, category: v } : null)
                      }}
                    />
                  ) : (
                    <div className={styles.inlineCreate}>
                      <input
                        ref={newEditCategoryInputRef}
                        className="form-input"
                        placeholder="e.g. Nuts, Spices, Beverages"
                        value={newEditCategoryInput}
                        onChange={e => setNewEditCategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddEditCategory()
                          if (e.key === 'Escape') setAddingEditCategory(false)
                        }}
                      />
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} title="Confirm" onClick={handleAddEditCategory}>
                        <Check size={15} />
                      </button>
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} title="Cancel" onClick={() => setAddingEditCategory(false)}>
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 6. Subcategory */}
                <div className="form-group">
                  <label className="form-label">
                    Subcategory <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  {!addingEditSubcategory ? (
                    <CustomSelect
                      value={editSubcategory}
                      placeholder="None"
                      options={[
                        { value: '', label: 'None' },
                        ...customSubcategories.map(s => ({ value: s, label: s })),
                        { value: '__new__', label: '+ Create new subcategory', isAction: true },
                      ]}
                      onChange={v => {
                        if (v === '__new__') setAddingEditSubcategory(true)
                        else setEditSubcategory(v)
                      }}
                    />
                  ) : (
                    <div className={styles.inlineCreate}>
                      <input
                        ref={newEditSubcategoryInputRef}
                        className="form-input"
                        placeholder="e.g. Premium, Organic, Salted"
                        value={newEditSubcategoryInput}
                        onChange={e => setNewEditSubcategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddEditSubcategory()
                          if (e.key === 'Escape') setAddingEditSubcategory(false)
                        }}
                      />
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} title="Confirm" onClick={handleAddEditSubcategory}>
                        <Check size={15} />
                      </button>
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} title="Cancel" onClick={() => setAddingEditSubcategory(false)}>
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 9. Taxes */}
                <div className="form-group">
                  <div className={styles.fieldHeaderRow}>
                    <label className="form-label">
                      Taxes <span className="text-tertiary font-normal">(Optional)</span>
                    </label>
                    <label className={styles.toggleLabel}>
                      <span className="text-sm text-secondary">
                        {editTaxInclusive ? 'Inclusive' : 'Exclusive'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editTaxInclusive}
                        className={`toggle ${editTaxInclusive ? '' : 'toggle--off'}`}
                        onClick={() => setEditTaxInclusive(v => !v)}
                      >
                        <span className="toggle__dot" />
                      </button>
                    </label>
                  </div>

                  {editTaxes.length > 0 && (
                    <div className={styles.taxSection}>
                      {editTaxes.map((tax, i) => (
                        <div key={tax.id} className={styles.taxRow}>
                          <input
                            className="form-input"
                            placeholder="Tax name (e.g. GST)"
                            autoFocus={tax.id === lastAddedEditTaxId}
                            value={tax.name}
                            onChange={e =>
                              setEditTaxes(prev =>
                                prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t)
                              )
                            }
                            style={{ flex: 1 }}
                          />
                          <div className={styles.taxPercentInput}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={tax.percentage || ''}
                              onChange={e =>
                                setEditTaxes(prev =>
                                  prev.map((t, j) => j === i ? { ...t, percentage: Number(e.target.value) } : t)
                                )
                              }
                            />
                            <span className={styles.taxPercentSuffix}>%</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ flexShrink: 0 }}
                            onClick={() =>
                              setEditTaxes(prev => prev.filter((_, j) => j !== i))
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className={styles.addAttrBtn}
                    style={{ marginTop: editTaxes.length > 0 ? 'var(--space-2)' : undefined }}
                    onClick={() => {
                      const newId = `${Date.now()}-${Math.random()}`
                      setLastAddedEditTaxId(newId)
                      setEditTaxes(prev => [...prev, { id: newId, name: '', percentage: 0 }])
                    }}
                  >
                    + Add tax
                  </button>

                  <span className="form-hint">
                    {editTaxInclusive ? 'Tax included in item price.' : 'Tax charged on top of item price.'}
                  </span>
                </div>

                {/* 11. Availability Status — toggle */}
                <div className="form-group">
                  <div className={styles.fieldHeaderRow}>
                    <label className="form-label">Active / Available</label>
                    <label className={styles.toggleLabel}>
                      <span className="text-sm text-secondary">
                        {editingItem.availability_status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editingItem.availability_status === 'active'}
                        className={`toggle ${editingItem.availability_status === 'active' ? '' : 'toggle--off'}`}
                        onClick={() => setEditingItem(prev => prev ? {
                          ...prev,
                          availability_status: prev.availability_status === 'active' ? 'out_of_stock' : 'active',
                        } : null)}
                      >
                        <span className="toggle__dot" />
                      </button>
                    </label>
                  </div>
                </div>

                {/* 12. Notes */}
                <div className="form-group">
                  <label className="form-label">
                    Notes <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    value={editingItem.notes ?? ''}
                    onChange={e => setEditingItem(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  />
                </div>

              </div>
            </div>

            <div className={`drawer__footer ${styles.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={() => { setShowEditDrawer(false); setEditingItem(null) }}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSaveEdit}
                disabled={!editingItem.name.trim() || !editingItem.category.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Waste Modal ── */}
      {showWasteModal && (
        <div className="modal-overlay" onClick={() => setShowWasteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal__title">Record Waste / Consumption</h3>

            <div className={styles.modalItemRow}>
              <span className="text-secondary text-sm">Item</span>
              <span>{selectedItem?.name}</span>
            </div>
            <div className={styles.modalItemRow}>
              <span className="text-secondary text-sm">Current Stock</span>
              <span>{selectedItem?.current_stock} {selectedItem?.unit}</span>
            </div>

            <div className="form-group">
              <label className="form-label form-label--required">
                Quantity Lost ({selectedItem?.unit})
              </label>
              <input
                className="form-input"
                type="number"
                min="0"
                max={selectedItem?.current_stock}
                value={wasteQty}
                onChange={e => setWasteQty(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason</label>
              <select
                className="form-select"
                value={wasteReason}
                onChange={e => setWasteReason(e.target.value)}
              >
                <option value="spoilage">Spoilage / Damage</option>
                <option value="consumption">Internal Consumption</option>
                <option value="other">Other</option>
              </select>
            </div>

            {wasteQty > 0 && (
              <div className={styles.modalPreview}>
                <div className="alert alert--warning">
                  <div className="alert__dot"></div>
                  <div>
                    <p className="alert__title">After this deduction</p>
                    <p className="alert__body">
                      Stock will be: {(selectedItem?.current_stock || 0) - wasteQty} {selectedItem?.unit}
                      {wasteQty > (selectedItem?.current_stock || 0) && (
                        <span className="text-danger"> — Cannot exceed current stock</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="modal__actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setShowWasteModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn--danger btn--sm"
                disabled={wasteQty > (selectedItem?.current_stock || 0)}
                onClick={handleWaste}
              >
                Confirm Deduction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
