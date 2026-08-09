'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, X, Check, Filter, ChevronDown, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import PricingFields from '@/components/inventory/PricingFields'
import { useSetPageTitle } from '@/components/layout/PageTitleContext'
import type { InventoryItemWithDetails } from '@/lib/services/inventory'
import type { CategoryWithCount } from '@/lib/services/categories'
import type { UnitWithUsage } from '@/lib/services/units'
import type { AttributeWithUsage } from '@/lib/services/attributes'
import type { VariantWithDetails } from '@/lib/services/variants'
import { stashCreatedProduct } from '@/lib/utils/nav-handoff'
import { loadLastUsedProductFields, saveLastUsedProductFields } from '@/lib/utils/last-used'
import styles from './inventory.module.css'

// ─── Form-local types ─────────────────────────────────────────────────────────

type ToastState = {
  message: string
  type: 'success' | 'warning' | 'danger' | 'info'
}

type BaseItemForm = {
  name: string
  // Attributes — selected from the shared attribute pool; these define what
  // will vary between this product's variants (created in a later step).
  selected_attributes: string[]
  // Unit
  unit: string
  // Category / subcategory
  category: string
  subcategory: string
  // Expiry
  has_expiry: boolean
  // Notes
  description: string
}

// Edit Product touches the fields above plus has_variants/pricing below.
// Pricing is only editable here for a product with no variants — with
// multiple variants, there's no single "the" price to show, so the drawer
// hides these and points to the per-variant editor on the product page
// instead. Stock isn't editable here at all — it only ever changes via
// Purchases/Consumption, same as the product detail page.
type EditItemForm = BaseItemForm & {
  // Freely toggleable when the product has at most one variant; locked on
  // once there are 2+ (see editingItemVariantCount) — turning it off would
  // leave no well-defined single default variant.
  has_variants: boolean
  purchase_cost: number | ''
  target_profit_percent: number | ''
  selling_price: number | ''
  pricing_driven_by: 'target_profit' | 'selling_price'
}

type StockRow = { quantity: number | ''; expiry_date: string }

type NewItemForm = BaseItemForm & {
  // Product/variant code — label depends on has_variants; left blank, the
  // backend auto-generates one (VAR-001, or the variant name for a
  // has_variants product).
  code: string
  // Has variants — when true, this first variant needs an explicit name;
  // when false, it's the product's only ("VAR-001") variant.
  has_variants: boolean
  variant_name: string
  // Stock & Pricing — collected at creation so a product can be sold and
  // stocked the moment it's saved, instead of needing 2 more steps after.
  purchase_cost: number | ''
  target_profit_percent: number | ''
  selling_price: number | ''
  // Selling price and target profit % are two views of the same math —
  // whichever one the user last typed into directly "wins", and edits to
  // the other two fields (cost, or the non-driving field) recompute it to
  // stay consistent. Defaults to 'target_profit', matching the original
  // cost + profit% -> price direction.
  pricing_driven_by: 'target_profit' | 'selling_price'
  stock_rows: StockRow[]
}

// ─── Custom select component ──────────────────────────────────────────────────

type SelectOption = { value: string; label: string; isAction?: boolean }

function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
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
        disabled={disabled}
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

function emptyBaseForm(): BaseItemForm {
  return {
    name: '',
    selected_attributes: [],
    unit: '',
    category: '',
    subcategory: '',
    has_expiry: false,
    description: '',
  }
}

function emptyEditForm(): EditItemForm {
  return {
    ...emptyBaseForm(),
    has_variants: false,
    purchase_cost: '',
    target_profit_percent: '',
    selling_price: '',
    pricing_driven_by: 'target_profit',
  }
}

function emptyForm(): NewItemForm {
  return {
    ...emptyBaseForm(),
    code: '',
    has_variants: false,
    variant_name: '',
    purchase_cost: '',
    target_profit_percent: '',
    selling_price: '',
    pricing_driven_by: 'target_profit',
    stock_rows: [{ quantity: '', expiry_date: '' }],
  }
}

// ─── Filter config ────────────────────────────────────────────────────────────

const FILTER_DEFS = [
  { key: 'category', label: 'Category' },
] as const

type FilterKey = typeof FILTER_DEFS[number]['key']

// ─── Page component ───────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter()
  useSetPageTitle('Products')

  // ── Table state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [activeFilterTypes, setActiveFilterTypes] = useState<FilterKey[]>([])
  const [filterTypeDropdownOpen, setFilterTypeDropdownOpen] = useState(false)
  const [addFilterDropdownOpen, setAddFilterDropdownOpen] = useState(false)
  const [openValueDropdown, setOpenValueDropdown] = useState<FilterKey | null>(null)
  const [showAddDrawer, setShowAddDrawer] = useState(false)
  const [items, setItems] = useState<InventoryItemWithDetails[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsLoadError, setItemsLoadError] = useState('')

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState<NewItemForm>(emptyForm())
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  // Attributes/Description are optional — collapsed by default so the form
  // reads as short; expanding is a deliberate opt-in, not a default cost.
  const [showMoreDetails, setShowMoreDetails] = useState(false)

  // ── Attributes — loaded from the real Settings-managed data ──────────────────
  const [attributes, setAttributes] = useState<AttributeWithUsage[]>([])
  const [attributesLoading, setAttributesLoading] = useState(true)
  const [attributesLoadError, setAttributesLoadError] = useState('')
  const [attributeSaving, setAttributeSaving] = useState(false)
  const [addingAttr, setAddingAttr] = useState(false)
  const [newAttrInput, setNewAttrInput] = useState('')

  // ── Units — loaded from the real Settings-managed data ───────────────────────
  const [units, setUnits] = useState<UnitWithUsage[]>([])
  const [unitsLoading, setUnitsLoading] = useState(true)
  const [unitsLoadError, setUnitsLoadError] = useState('')
  const [addingUnit, setAddingUnit] = useState(false)
  const [newUnitInput, setNewUnitInput] = useState('')
  const [unitSaving, setUnitSaving] = useState(false)
  const allUnits = units.map(u => u.name)

  // ── Categories — loaded from the real Settings-managed data ──────────────────
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesLoadError, setCategoriesLoadError] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const rootCategories = categories.filter(c => c.parent_id === null)
  const allCategories = rootCategories.map(c => c.name)

  function getSubcategoriesFor(categoryName: string): CategoryWithCount[] {
    const parent = rootCategories.find(c => c.name === categoryName)
    return parent ? categories.filter(c => c.parent_id === parent.id) : []
  }

  // ── Subcategory management — real children of the selected category ─────────
  const [addingSubcategory, setAddingSubcategory] = useState(false)
  const [newSubcategoryInput, setNewSubcategoryInput] = useState('')
  const [subcategorySaving, setSubcategorySaving] = useState(false)

  // ── Autocomplete ─────────────────────────────────────────────────────────────
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameSuggestions = form.name.trim().length >= 1
    ? items.filter(i => i.name.toLowerCase().includes(form.name.toLowerCase())).slice(0, 6)
    : []

  const newCategoryInputRef = useRef<HTMLInputElement>(null)
  const newSubcategoryInputRef = useRef<HTMLInputElement>(null)
  const newUnitInputRef = useRef<HTMLInputElement>(null)

  // ── Edit drawer — kept as a separate form/state block from the Add drawer
  // so both can't clobber each other if a user somehow has both open.
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  // Snapshot of the variant count when Edit opened — used only to decide
  // whether the Has Variants toggle is locked on; doesn't change live as
  // the toggle itself is flipped.
  const [editingItemVariantCount, setEditingItemVariantCount] = useState(0)
  const [editForm, setEditForm] = useState<EditItemForm>(emptyEditForm())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  // Attributes/Description — collapsed by default like Add Product, but
  // opened automatically when the product already has values there, so
  // editing never hides existing data behind a click.
  const [showEditMoreDetails, setShowEditMoreDetails] = useState(false)
  // Pricing for a single-variant product — loaded separately since the
  // listing row doesn't carry the variant's id/prices. Null id means "no
  // variants to edit pricing for" or "still loading".
  const [editVariantId, setEditVariantId] = useState<string | null>(null)
  const [editVariantLoading, setEditVariantLoading] = useState(false)
  // Set when the server reports that removing an attribute would delete
  // real variant data — shown as a confirm popup before retrying with
  // confirm_attribute_removal: true.
  const [confirmAttrRemoval, setConfirmAttrRemoval] = useState<string[] | null>(null)
  const [editAddingAttr, setEditAddingAttr] = useState(false)
  const [editNewAttrInput, setEditNewAttrInput] = useState('')
  const [editAddingUnit, setEditAddingUnit] = useState(false)
  const [newEditUnitInput, setNewEditUnitInput] = useState('')
  const [editAddingCategory, setEditAddingCategory] = useState(false)
  const [newEditCategoryInput, setNewEditCategoryInput] = useState('')
  const [editAddingSubcategory, setEditAddingSubcategory] = useState(false)
  const [newEditSubcategoryInput, setNewEditSubcategoryInput] = useState('')
  const newEditCategoryInputRef = useRef<HTMLInputElement>(null)
  const newEditSubcategoryInputRef = useRef<HTMLInputElement>(null)
  const newEditUnitInputRef = useRef<HTMLInputElement>(null)

  const editAvailableAttributes = attributes
    .map(a => a.name)
    .filter(a => !editForm.selected_attributes.includes(a))
  const editAttrSuggestions = editAddingAttr
    ? editAvailableAttributes.filter(
      a =>
        !editNewAttrInput.trim() ||
        a.toLowerCase().includes(editNewAttrInput.toLowerCase())
    )
    : []

  // ── Delete product ────────────────────────────────────────────────────────────
  // The server is the source of truth for whether a product is deletable
  // (no purchase/sales history on any of its variants) — the button always
  // shows, and a blocked delete surfaces the server's reason in the confirm
  // dialog instead of trying to precompute deletability on the client.
  const [deleteTarget, setDeleteTarget] = useState<InventoryItemWithDetails | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Load items, categories, units, attributes from the server ────────────────
  async function loadItems() {
    setItemsLoading(true)
    setItemsLoadError('')
    try {
      const res = await fetch('/api/inventory')
      const body = await res.json()
      if (!res.ok) { setItemsLoadError(body.error || 'Could not load products.'); return }
      setItems(body.data)
    } catch {
      setItemsLoadError('Could not load products. Please check your connection.')
    } finally {
      setItemsLoading(false)
    }
  }

  async function loadCategories() {
    setCategoriesLoading(true)
    setCategoriesLoadError('')
    try {
      const res = await fetch('/api/categories')
      const body = await res.json()
      if (!res.ok) { setCategoriesLoadError(body.error || 'Could not load categories.'); return }
      setCategories(body.data)
    } catch {
      setCategoriesLoadError('Could not load categories. Please check your connection.')
    } finally {
      setCategoriesLoading(false)
    }
  }

  async function loadUnits() {
    setUnitsLoading(true)
    setUnitsLoadError('')
    try {
      const res = await fetch('/api/units')
      const body = await res.json()
      if (!res.ok) { setUnitsLoadError(body.error || 'Could not load units.'); return }
      setUnits(body.data)
    } catch {
      setUnitsLoadError('Could not load units. Please check your connection.')
    } finally {
      setUnitsLoading(false)
    }
  }

  async function loadAttributes() {
    setAttributesLoading(true)
    setAttributesLoadError('')
    try {
      const res = await fetch('/api/attributes')
      const body = await res.json()
      if (!res.ok) { setAttributesLoadError(body.error || 'Could not load attributes.'); return }
      setAttributes(body.data)
    } catch {
      setAttributesLoadError('Could not load attributes. Please check your connection.')
    } finally {
      setAttributesLoading(false)
    }
  }

  useEffect(() => { loadItems() }, [])
  useEffect(() => { loadCategories() }, [])
  useEffect(() => { loadUnits() }, [])
  useEffect(() => { loadAttributes() }, [])

  // ── Auto-focus: focus inline inputs after they mount ─────────────────────────
  useEffect(() => { if (addingCategory) newCategoryInputRef.current?.focus() }, [addingCategory])
  useEffect(() => { if (addingSubcategory) newSubcategoryInputRef.current?.focus() }, [addingSubcategory])
  useEffect(() => { if (addingUnit) newUnitInputRef.current?.focus() }, [addingUnit])
  useEffect(() => { if (editAddingCategory) newEditCategoryInputRef.current?.focus() }, [editAddingCategory])
  useEffect(() => { if (editAddingSubcategory) newEditSubcategoryInputRef.current?.focus() }, [editAddingSubcategory])
  useEffect(() => { if (editAddingUnit) newEditUnitInputRef.current?.focus() }, [editAddingUnit])

  // Attributes not yet selected for this item
  const availableAttributes = attributes
    .map(a => a.name)
    .filter(a => !form.selected_attributes.includes(a))

  // Suggestions shown in the dropdown while the user types an attribute name
  const attrSuggestions = addingAttr
    ? availableAttributes.filter(
      a =>
        !newAttrInput.trim() ||
        a.toLowerCase().includes(newAttrInput.toLowerCase())
    )
    : []

  // ── Table derived ─────────────────────────────────────────────────────────────
  const tableCategories = Array.from(
    new Set(items.map(item => item.category_name).filter((c): c is string => !!c))
  )

  const activeFilterCount = activeFilterTypes.length

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilters.length === 0 || (item.category_name != null && categoryFilters.includes(item.category_name))
    return matchesSearch && matchesCategory
  })

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
    if (openValueDropdown === key) setOpenValueDropdown(null)
  }

  function clearAllFilters() {
    setActiveFilterTypes([])
    setCategoryFilters([])
    setOpenValueDropdown(null)
    setSearch('')
  }

  // ── Attribute handlers ────────────────────────────────────────────────────────

  function addSelectedAttribute(attrName: string) {
    if (form.selected_attributes.includes(attrName)) return
    setForm(prev => ({
      ...prev,
      selected_attributes: [...prev.selected_attributes, attrName],
    }))
  }

  function removeSelectedAttribute(attrName: string) {
    setForm(prev => ({
      ...prev,
      selected_attributes: prev.selected_attributes.filter(a => a !== attrName),
    }))
  }

  // Looks up an existing attribute by name (case-insensitive) or creates it
  // for real via the API — shared by both the Add and Edit drawer pickers,
  // since "type a name, get back the matching or newly-created attribute"
  // is the same operation either way.
  async function resolveOrCreateAttribute(name: string): Promise<AttributeWithUsage | null> {
    const trimmed = name.trim()
    if (!trimmed) return null

    const existing = attributes.find(a => a.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing

    if (attributeSaving) return null
    setAttributeSaving(true)
    try {
      const res = await fetch('/api/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const body = await res.json()
      if (!res.ok) {
        setAttributesLoadError(body.error || 'Could not create attribute.')
        return null
      }
      const created: AttributeWithUsage = { ...body.data, in_use: false }
      setAttributes(prev => [...prev, created])
      showToast(`"${created.name}" attribute created`)
      return created
    } catch {
      setAttributesLoadError('Could not create attribute. Please check your connection.')
      return null
    } finally {
      setAttributeSaving(false)
    }
  }

  async function handleCreateAttribute(name: string) {
    const attr = await resolveOrCreateAttribute(name)
    if (!attr) return
    addSelectedAttribute(attr.name)
    setNewAttrInput('')
    setAddingAttr(false)
  }

  function addEditSelectedAttribute(attrName: string) {
    if (editForm.selected_attributes.includes(attrName)) return
    setEditForm(prev => ({ ...prev, selected_attributes: [...prev.selected_attributes, attrName] }))
  }

  function removeEditSelectedAttribute(attrName: string) {
    setEditForm(prev => ({ ...prev, selected_attributes: prev.selected_attributes.filter(a => a !== attrName) }))
  }

  async function handleCreateEditAttribute(name: string) {
    const attr = await resolveOrCreateAttribute(name)
    if (!attr) return
    addEditSelectedAttribute(attr.name)
    setEditNewAttrInput('')
    setEditAddingAttr(false)
  }

  // ── Other form handlers ───────────────────────────────────────────────────────

  function handleSelectSuggestion(item: InventoryItemWithDetails) {
    setForm(prev => ({
      ...prev,
      name: item.name,
      category: item.category_name ?? '',
      subcategory: '',
      unit: item.unit_name,
      has_expiry: item.has_expiry,
      description: item.notes ?? '',
      selected_attributes: [...item.attribute_names],
    }))
    if (item.attribute_names.length > 0 || item.notes) setShowMoreDetails(true)
    setShowSuggestions(false)
  }

  async function createUnitRemote(name: string): Promise<UnitWithUsage | null> {
    if (unitSaving) return null
    setUnitSaving(true)
    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Quick-created here with no decimals toggle in this compact UI —
        // defaults to allowed, since most stock units (KG, Litres) are
        // fractional in practice; adjustable later in Settings.
        body: JSON.stringify({ name, allows_decimal: true }),
      })
      const body = await res.json()
      if (!res.ok) {
        setUnitsLoadError(body.error || 'Could not create unit.')
        return null
      }
      const created: UnitWithUsage = { ...body.data, in_use: false }
      setUnits(prev => [...prev, created])
      showToast(`"${created.name}" unit created`)
      return created
    } catch {
      setUnitsLoadError('Could not create unit. Please check your connection.')
      return null
    } finally {
      setUnitSaving(false)
    }
  }

  async function createCategoryRemote(name: string, parentId: string | null): Promise<CategoryWithCount | null> {
    const setSaving = parentId === null ? setCategorySaving : setSubcategorySaving
    if (parentId === null ? categorySaving : subcategorySaving) return null
    setSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId }),
      })
      const body = await res.json()
      if (!res.ok) {
        setCategoriesLoadError(body.error || 'Could not create category.')
        return null
      }
      const created: CategoryWithCount = { ...body.data, item_count: 0 }
      setCategories(prev => [...prev, created])
      showToast(`"${created.name}" ${parentId === null ? 'category' : 'subcategory'} created`)
      return created
    } catch {
      setCategoriesLoadError('Could not create category. Please check your connection.')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleAddUnit() {
    const name = newUnitInput.trim()
    if (!name) { setAddingUnit(false); return }
    const created = await createUnitRemote(name)
    if (!created) return
    setForm(prev => ({ ...prev, unit: created.name }))
    setAddingUnit(false)
    setNewUnitInput('')
  }

  async function handleAddCategory() {
    const name = newCategoryInput.trim()
    if (!name) { setAddingCategory(false); return }
    const created = await createCategoryRemote(name, null)
    if (!created) return
    // A new parent category invalidates whatever subcategory was picked —
    // it belonged to the previous category, not this one.
    setForm(prev => ({ ...prev, category: created.name, subcategory: '' }))
    setAddingCategory(false)
    setNewCategoryInput('')
  }

  async function handleAddSubcategory() {
    const name = newSubcategoryInput.trim()
    if (!name) { setAddingSubcategory(false); return }
    const parent = rootCategories.find(c => c.name === form.category)
    if (!parent) return
    const created = await createCategoryRemote(name, parent.id)
    if (!created) return
    setForm(prev => ({ ...prev, subcategory: created.name }))
    setAddingSubcategory(false)
    setNewSubcategoryInput('')
  }

  async function handleAddEditUnit() {
    const name = newEditUnitInput.trim()
    if (!name) { setEditAddingUnit(false); return }
    const created = await createUnitRemote(name)
    if (!created) return
    setEditForm(prev => ({ ...prev, unit: created.name }))
    setEditAddingUnit(false)
    setNewEditUnitInput('')
  }

  async function handleAddEditCategory() {
    const name = newEditCategoryInput.trim()
    if (!name) { setEditAddingCategory(false); return }
    const created = await createCategoryRemote(name, null)
    if (!created) return
    setEditForm(prev => ({ ...prev, category: created.name, subcategory: '' }))
    setEditAddingCategory(false)
    setNewEditCategoryInput('')
  }

  async function handleAddEditSubcategory() {
    const name = newEditSubcategoryInput.trim()
    if (!name) { setEditAddingSubcategory(false); return }
    const parent = rootCategories.find(c => c.name === editForm.category)
    if (!parent) return
    const created = await createCategoryRemote(name, parent.id)
    if (!created) return
    setEditForm(prev => ({ ...prev, subcategory: created.name }))
    setEditAddingSubcategory(false)
    setNewEditSubcategoryInput('')
  }

  // Opens the edit drawer prefilled from the item — splits its category
  // back into category/subcategory the same way the create form collects
  // them, by walking up to find whether it's a root category or a child.
  async function handleOpenEdit(item: InventoryItemWithDetails) {
    const own = item.category_id ? categories.find(c => c.id === item.category_id) : null
    const isRoot = own ? own.parent_id === null : true
    const parent = own && !isRoot ? categories.find(c => c.id === own.parent_id) : null

    setEditingItemId(item.id)
    setEditingItemVariantCount(item.variant_count)
    setEditForm({
      ...emptyEditForm(),
      name: item.name,
      selected_attributes: [...item.attribute_names],
      unit: item.unit_name,
      category: isRoot ? (own?.name ?? '') : (parent?.name ?? ''),
      subcategory: isRoot ? '' : (own?.name ?? ''),
      has_expiry: item.has_expiry,
      has_variants: item.has_variants,
      description: item.notes ?? '',
    })
    setEditAddingAttr(false)
    setEditAddingUnit(false)
    setEditAddingCategory(false)
    setEditAddingSubcategory(false)
    setEditError('')
    setConfirmAttrRemoval(null)
    setEditVariantId(null)
    setShowEditMoreDetails(item.attribute_names.length > 0 || !!item.notes)
    setShowEditDrawer(true)

    // Pricing only applies to a single, unambiguous variant — fetch it
    // whenever there's at most one, regardless of the has_variants flag's
    // current value, since the toggle can be flipped live in this drawer
    // (see the toggle's onClick) and pricing needs to be ready either way.
    if (item.variant_count <= 1) {
      setEditVariantLoading(true)
      try {
        const res = await fetch(`/api/inventory/${item.id}/variants`)
        const body = await res.json()
        const variant = res.ok ? (body.data as VariantWithDetails[])[0] : null
        if (variant) {
          setEditVariantId(variant.id)
          setEditForm(prev => ({
            ...prev,
            purchase_cost: variant.purchase_price ?? '',
            target_profit_percent: variant.target_profit_percent ?? '',
            selling_price: variant.selling_price ?? '',
          }))
        }
      } catch {
        // Pricing fields just stay blank — editable name/category/etc. still work.
      } finally {
        setEditVariantLoading(false)
      }
    }
  }

  function handleCloseEditDrawer() {
    setShowEditDrawer(false)
    setEditingItemId(null)
    setEditingItemVariantCount(0)
    setEditForm(emptyEditForm())
    setEditAddingAttr(false)
    setEditAddingUnit(false)
    setEditAddingCategory(false)
    setEditAddingSubcategory(false)
    setEditError('')
    setConfirmAttrRemoval(null)
    setEditVariantId(null)
    setShowEditMoreDetails(false)
  }

  function handleDeleteItem(item: InventoryItemWithDetails) {
    setDeleteTarget(item)
    setDeleteError('')
  }

  async function confirmDeleteItem() {
    if (!deleteTarget || deleteSaving) return
    setDeleteSaving(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/inventory/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        setDeleteError(body.error || 'Could not delete the product.')
        return
      }
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
      showToast(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
    } catch {
      setDeleteError('Could not delete the product. Please check your connection.')
    } finally {
      setDeleteSaving(false)
    }
  }

  async function handleSaveEdit(confirmAttributeRemoval = false) {
    if (!editingItemId || !editForm.name.trim() || !editForm.unit || editSaving) return

    const unit = units.find(u => u.name === editForm.unit)
    if (!unit) { setEditError('Please select a valid unit.'); return }

    const category = editForm.subcategory
      ? getSubcategoriesFor(editForm.category).find(c => c.name === editForm.subcategory)
      : editForm.category
        ? rootCategories.find(c => c.name === editForm.category)
        : null
    if ((editForm.subcategory || editForm.category) && !category) {
      setEditError('Please select a valid category.')
      return
    }

    const attributeIds = editForm.selected_attributes
      .map(name => attributes.find(a => a.name === name)?.id)
      .filter((id): id is string => !!id)

    const editingPricing = !editForm.has_variants && !!editVariantId
    if (editingPricing) {
      if (editForm.purchase_cost === '' || Number(editForm.purchase_cost) <= 0) {
        setEditError('Purchase cost must be a positive number.')
        return
      }
      if (editForm.selling_price === '' || Number(editForm.selling_price) <= 0) {
        setEditError('Selling price must be a positive number.')
        return
      }
    }

    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/inventory/${editingItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          category_id: category?.id ?? null,
          unit_id: unit.id,
          has_expiry: editForm.has_expiry,
          has_variants: editForm.has_variants,
          notes: editForm.description.trim() || null,
          attribute_ids: attributeIds,
          confirm_attribute_removal: confirmAttributeRemoval,
        }),
      })
      const body = await res.json()

      if (!res.ok) {
        if (body.requires_confirmation) {
          setConfirmAttrRemoval(body.affected_attributes ?? [])
          return
        }
        setEditError(body.error || 'Could not save the product.')
        return
      }

      let updatedItem = body.data

      if (editingPricing) {
        const variantRes = await fetch(`/api/inventory/${editingItemId}/variants/${editVariantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchase_price: Number(editForm.purchase_cost),
            selling_price: Number(editForm.selling_price),
            target_profit_percent: editForm.target_profit_percent === '' ? null : Number(editForm.target_profit_percent),
          }),
        })
        const variantBody = await variantRes.json()
        if (!variantRes.ok) {
          setItems(prev => prev.map(item => item.id === editingItemId ? updatedItem : item))
          setEditError(variantBody.error || 'Product saved, but pricing could not be updated.')
          return
        }
      }

      setItems(prev => prev.map(item => item.id === editingItemId ? updatedItem : item))
      showToast(`"${updatedItem.name}" updated`)
      handleCloseEditDrawer()
    } catch {
      setEditError('Could not save the product. Please check your connection.')
    } finally {
      setEditSaving(false)
    }
  }

  function handleCloseDrawer() {
    setForm(emptyForm())
    setCreateError('')
    setAddingUnit(false)
    setAddingCategory(false)
    setAddingSubcategory(false)
    setAddingAttr(false)
    setShowSuggestions(false)
    setShowMoreDetails(false)
    setShowAddDrawer(false)
  }

  // Pre-fills unit/category/subcategory from the last product created —
  // only if that value still exists (a category could've been renamed or
  // deleted since), otherwise it's left blank like normal.
  function openAddDrawer() {
    const last = loadLastUsedProductFields()
    const base = emptyForm()
    const unit = last.unit && allUnits.includes(last.unit) ? last.unit : base.unit
    const category = last.category && allCategories.includes(last.category) ? last.category : base.category
    const subcategory = category && last.subcategory && getSubcategoriesFor(category).some(s => s.name === last.subcategory)
      ? last.subcategory
      : base.subcategory
    setForm({ ...base, unit, category, subcategory })
    setShowAddDrawer(true)
  }

  async function handleSaveItem() {
    if (!form.name.trim() || !form.unit || createSaving) return

    const unit = units.find(u => u.name === form.unit)
    if (!unit) { setCreateError('Please select a valid unit.'); return }

    const category = form.subcategory
      ? getSubcategoriesFor(form.category).find(c => c.name === form.subcategory)
      : form.category
        ? rootCategories.find(c => c.name === form.category)
        : null
    if ((form.subcategory || form.category) && !category) { setCreateError('Please select a valid category.'); return }

    if (form.has_variants && !form.variant_name.trim()) {
      setCreateError('Variant name is required.')
      return
    }
    if (form.purchase_cost === '' || Number(form.purchase_cost) <= 0) {
      setCreateError('Purchase cost must be a positive number.')
      return
    }
    if (form.selling_price === '' || Number(form.selling_price) <= 0) {
      setCreateError('Selling price must be a positive number.')
      return
    }
    for (const row of form.stock_rows) {
      const qty = row.quantity === '' ? 0 : Number(row.quantity)
      if (qty < 0) {
        setCreateError('Stock quantity cannot be negative.')
        return
      }
      if (form.has_expiry && qty > 0 && !row.expiry_date) {
        setCreateError('Batches with stock need an expiry date for a perishable product.')
        return
      }
    }

    const attributeIds = form.selected_attributes
      .map(name => attributes.find(a => a.name === name)?.id)
      .filter((id): id is string => !!id)

    setCreateSaving(true)
    setCreateError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          category_id: category?.id ?? null,
          unit_id: unit.id,
          has_expiry: form.has_expiry,
          notes: form.description.trim() || null,
          attribute_ids: attributeIds,
          has_variants: form.has_variants,
          variant_name: form.has_variants ? form.variant_name.trim() : null,
          code: form.code.trim() || null,
          purchase_cost: Number(form.purchase_cost),
          target_profit_percent: form.target_profit_percent === '' ? null : Number(form.target_profit_percent),
          selling_price: Number(form.selling_price),
          stock_rows: form.stock_rows.map(row => ({
            quantity: Number(row.quantity),
            expiry_date: form.has_expiry ? row.expiry_date : null,
          })),
        }),
      })
      const body = await res.json()
      if (!res.ok) { setCreateError(body.error || 'Could not create the product.'); return }

      saveLastUsedProductFields({ unit: form.unit, category: form.category, subcategory: form.subcategory })

      const { item, variant } = body.data
      const totalStock = form.stock_rows.reduce(
        (sum, row) => sum + (row.quantity === '' ? 0 : Number(row.quantity)),
        0
      )
      // The variant just created has no attribute values or purchase history
      // yet — attribute_values/current_stock below are what a freshly
      // created variant always looks like, not values fetched from the server.
      stashCreatedProduct(item.id, {
        item,
        variant: { ...variant, attribute_values: [], current_stock: totalStock },
      })

      // Navigate immediately, without closing the drawer first — the drawer
      // stays on screen until the route actually swaps, instead of briefly
      // revealing the listing table underneath before the next page is ready.
      if (form.has_variants) {
        router.push(`/dashboard/inventory/${item.id}?new=1`)
      } else {
        router.push(`/dashboard/inventory/${item.id}/variant/${variant.id}`)
      }
    } catch {
      setCreateError('Could not create the product. Please check your connection.')
    } finally {
      setCreateSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Freemium Banner */}
      {items.length >= 45 && (
        <div className="upgrade-banner">
          <p className="upgrade-banner__text">
            {items.length} of 50 products used on free plan.
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
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter button — opens type-selection dropdown */}
        <div className="filterWrap">
          <button
            className={`btn btn--ghost filterBtn${activeFilterCount > 0 ? ' filterBtnActive' : ''}`}
            onClick={() => { setFilterTypeDropdownOpen(v => !v); setAddFilterDropdownOpen(false) }}
          >
            <Filter size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="filterBadge">{activeFilterCount}</span>
            )}
          </button>
          {filterTypeDropdownOpen && (
            <>
              <div className="filterBackdrop" onClick={() => setFilterTypeDropdownOpen(false)} />
              <div className="filterDropdown">
                {FILTER_DEFS.map(f => (
                  <button
                    key={f.key}
                    className={`filterOption${activeFilterTypes.includes(f.key) ? ' filterOptionActive' : ''}`}
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

        <Button size="sm" icon={<Plus size={18} />} onClick={openAddDrawer}>
          Add Product
        </Button>
      </div>

      {/* Active filter bar + result count — shown when any filter/search is active */}
      {(activeFilterTypes.length > 0 || search) && (
        <div className="resultSummaryRow">
          <span className="resultSummary">
            <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'product' : 'products'}
            <span className="resultSummarySep">•</span>
          </span>

          {/* Active filter chips */}
          {activeFilterTypes.map(key => {
            const isOpen = openValueDropdown === key
            const selectedValues = categoryFilters
            const label = 'Category'
            const options: readonly { value: string; label: string }[] =
              tableCategories.map(c => ({ value: c, label: c }))

            const displayText =
              selectedValues.length === 0 ? 'Any'
                : selectedValues.length === 1
                  ? selectedValues[0]
                  : `${selectedValues.length} selected`

            return (
              <div key={key} className="filterChipWrap">
                <div className={`filterChipInner${isOpen ? ' filterChipInnerOpen' : ''}`}>
                  <button
                    className="filterChipMain"
                    onClick={() => setOpenValueDropdown(prev => prev === key ? null : key)}
                  >
                    <span className="filterChipLabel">{label}</span>
                    <span className={`filterChipValues${selectedValues.length > 0 ? ' filterChipValuesActive' : ''}`}>
                      {displayText}
                    </span>
                    <ChevronDown
                      size={11}
                      className={`filterChipChevron${isOpen ? ' filterChipChevronOpen' : ''}`}
                    />
                  </button>
                  <button
                    className="filterChipRemove"
                    onClick={() => removeFilterType(key)}
                    title={`Remove ${label} filter`}
                  >
                    <X size={11} />
                  </button>
                </div>

                {isOpen && (
                  <>
                    <div className="filterBackdrop" onClick={() => setOpenValueDropdown(null)} />
                    <div className="valueDropdown">
                      {options.map(opt => {
                        const checked = selectedValues.includes(opt.value)
                        return (
                          <button
                            key={opt.value}
                            className={`valueOption${checked ? ' valueOptionChecked' : ''}`}
                            onClick={() => {
                              setCategoryFilters(prev =>
                                prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                              )
                            }}
                          >
                            <span className="valueOptionCheck">
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
            <button className="filterChip" onClick={() => setSearch('')} title="Clear search">
              <span className="filterChipLabel">Search:</span>
              <span className="filterChipValue">{search}</span>
              <X size={12} />
            </button>
          )}

          {/* + Add Filter (only when unused filter types remain) */}
          {FILTER_DEFS.some(f => !activeFilterTypes.includes(f.key)) && activeFilterTypes.length > 0 && (
            <div className="addFilterWrap">
              <button
                className="addFilterBtn"
                onClick={() => { setAddFilterDropdownOpen(v => !v); setFilterTypeDropdownOpen(false) }}
              >
                <Plus size={12} />
                Add Filter
              </button>
              {addFilterDropdownOpen && (
                <>
                  <div className="filterBackdrop" onClick={() => setAddFilterDropdownOpen(false)} />
                  <div className="filterDropdown">
                    {FILTER_DEFS.filter(f => !activeFilterTypes.includes(f.key)).map(f => (
                      <button
                        key={f.key}
                        className="filterOption"
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

          <button className="filterClearAll" onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {itemsLoadError ? (
          <div className="empty-state">
            <p className="empty-state__title">Could not load products</p>
            <p className="empty-state__desc">{itemsLoadError}</p>
            <button className="btn btn--primary btn--sm" onClick={loadItems}>Retry</button>
          </div>
        ) : itemsLoading ? (
          <div className="empty-state">
            <p className="empty-state__desc">Loading products…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No products found</p>
            <p className="empty-state__desc">
              {search || categoryFilters.length > 0
                ? 'Try adjusting your filters'
                : 'Add your first product to get started'}
            </p>
            {!search && categoryFilters.length === 0 && (
              <Button size="sm" onClick={openAddDrawer}>
                Add Product
              </Button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className={styles.itemNameCol}>Product Name</th>
                <th className={styles.categoryCol}>Category</th>
                <th className={styles.stockCol}>Unit</th>
                <th className={styles.variantsCol}>Variants</th>
                <th className={styles.currentStockCol}>Current Stock</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                >
                  <td>{item.name}</td>
                  <td>
                    {item.category_name
                      ? <span className="badge badge--neutral">{item.category_name}</span>
                      : <span className="text-tertiary">—</span>}
                  </td>
                  <td>{item.unit_name}</td>
                  <td>{item.variant_count}</td>
                  <td>{item.current_stock} {item.unit_name}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className="btn btn--ghost btn--sm"
                        title="Edit product"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        title="Delete product"
                        onClick={() => handleDeleteItem(item)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add Item Drawer ── */}
      {showAddDrawer && (
        <div className="overlay" onClick={handleCloseDrawer}>
          <div
            className="drawer"
            style={{ width: '620px', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer__header">
              <h3 className="drawer__title">Add Product</h3>
              <button className="drawer__close" onClick={handleCloseDrawer}><X size={18} /></button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.drawerForm}>

                {/* ── 1. Item Name with autocomplete ── */}
                <div className="form-group">
                  <label className="form-label form-label--required">Product Name</label>
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
                            <span className="text-secondary text-sm">{item.category_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="form-hint">
                    Name must be unique. Select a suggestion to pre-fill from an existing product.
                  </span>
                </div>

                {/* ── 2. Unit ── */}
                <div className="form-group">
                  <label className="form-label form-label--required">Unit</label>
                  {!addingUnit ? (
                    <CustomSelect
                      value={form.unit}
                      disabled={unitsLoading}
                      placeholder={unitsLoading ? 'Loading units…' : 'Select unit'}
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
                        disabled={unitSaving}
                      />
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                        title="Confirm"
                        onClick={handleAddUnit}
                        disabled={unitSaving}
                      >
                        {unitSaving ? <span className="spinner--sm" /> : <Check size={15} />}
                      </button>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                        title="Cancel"
                        onClick={() => setAddingUnit(false)}
                        disabled={unitSaving}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                  {unitsLoadError && (
                    <div className={styles.errorMsg}>
                      {unitsLoadError}{' '}
                      <button type="button" className="btn btn--ghost btn--sm" onClick={loadUnits}>Retry</button>
                    </div>
                  )}
                </div>

                {/* ── 3/4. Category + Subcategory, side by side ── */}
                <div className={styles.fieldsRow}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    {!addingCategory ? (
                      <CustomSelect
                        value={form.category}
                        disabled={categoriesLoading}
                        placeholder={categoriesLoading ? 'Loading categories…' : 'Select category'}
                        options={[
                          ...allCategories.map(c => ({ value: c, label: c })),
                          { value: '__new__', label: '+ Create new category', isAction: true },
                        ]}
                        onChange={v => {
                          if (v === '__new__') {
                            setAddingCategory(true)
                          } else {
                            // Picking a different parent invalidates whatever
                            // subcategory was selected — it belonged to the old one.
                            setForm(prev => ({ ...prev, category: v, subcategory: '' }))
                          }
                        }}
                      />
                    ) : (
                      <div className={styles.inlineCreate}>
                        <input
                          ref={newCategoryInputRef}
                          className="form-input"
                          placeholder="e.g. Nuts, Spices"
                          value={newCategoryInput}
                          onChange={e => setNewCategoryInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddCategory()
                            if (e.key === 'Escape') setAddingCategory(false)
                          }}
                          disabled={categorySaving}
                        />
                        <button
                          type="button"
                          className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                          title="Confirm"
                          onClick={handleAddCategory}
                          disabled={categorySaving}
                        >
                          {categorySaving ? <span className="spinner--sm" /> : <Check size={15} />}
                        </button>
                        <button
                          type="button"
                          className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                          title="Cancel"
                          onClick={() => setAddingCategory(false)}
                          disabled={categorySaving}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                    {categoriesLoadError && (
                      <div className={styles.errorMsg}>
                        {categoriesLoadError}{' '}
                        <button type="button" className="btn btn--ghost btn--sm" onClick={loadCategories}>Retry</button>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Subcategory <span className="text-tertiary font-normal">(Optional)</span>
                    </label>
                    {!addingSubcategory ? (
                      <CustomSelect
                        value={form.subcategory}
                        placeholder={form.category ? 'None' : 'Select category first'}
                        disabled={!form.category}
                        options={
                          form.category
                            ? [
                                { value: '', label: 'None' },
                                ...getSubcategoriesFor(form.category).map(s => ({ value: s.name, label: s.name })),
                                { value: '__new__', label: '+ Create new subcategory', isAction: true },
                              ]
                            : []
                        }
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
                          placeholder="e.g. Premium, Organic"
                          value={newSubcategoryInput}
                          onChange={e => setNewSubcategoryInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddSubcategory()
                            if (e.key === 'Escape') setAddingSubcategory(false)
                          }}
                          disabled={subcategorySaving}
                        />
                        <button
                          type="button"
                          className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`}
                          title="Confirm"
                          onClick={handleAddSubcategory}
                          disabled={subcategorySaving}
                        >
                          {subcategorySaving ? <span className="spinner--sm" /> : <Check size={15} />}
                        </button>
                        <button
                          type="button"
                          className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                          title="Cancel"
                          onClick={() => setAddingSubcategory(false)}
                          disabled={subcategorySaving}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Divider between "categorization" and "product settings" ── */}
                <div className={styles.groupDivider} />

                {/* ── 5/6. Perishable + Has variants, side by side ── */}
                <div className={styles.toggleGrid}>
                  <div className={styles.toggleCard}>
                    <label className="form-label">Perishable</label>
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

                  <div className={styles.toggleCard}>
                    <label className="form-label">Has variants</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.has_variants}
                      className={`toggle ${form.has_variants ? '' : 'toggle--off'}`}
                      onClick={() =>
                        setForm(prev => ({ ...prev, has_variants: !prev.has_variants }))
                      }
                    >
                      <span className="toggle__dot" />
                    </button>
                  </div>
                </div>

                {form.has_expiry && (
                  <span className="form-hint">Perishable: any batch with stock will need its own expiry date.</span>
                )}

                {/* ── Code — always visible; label depends on Has variants ── */}
                <div className="form-group">
                  <label className="form-label">
                    {form.has_variants ? 'Variant Code' : 'Product Code'} <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Auto-generated if left empty"
                    value={form.code}
                    onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>

                {form.has_variants && (
                  <div className="form-group">
                    <label className="form-label form-label--required">Variant Name</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. 500g Pack"
                      autoFocus
                      value={form.variant_name}
                      onChange={e => setForm(prev => ({ ...prev, variant_name: e.target.value }))}
                    />
                    <span className="form-hint">First variant name — more can be added from the product page.</span>
                  </div>
                )}

                {/* ── Divider between "product info" and "stock & pricing" ── */}
                <div className={styles.groupDivider} />

                <div className="form-group">
                  <label className="form-label">
                    {form.has_expiry ? 'Batches' : 'Quantity'} <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  {form.has_expiry && (
                    <div className={styles.batchColumnLabels}>
                      <span>Qty</span>
                      <span>Expiry date</span>
                    </div>
                  )}
                  {form.stock_rows.map((row, i) => (
                    <div key={i} className={styles.stockRow}>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        placeholder="Quantity"
                        value={row.quantity}
                        onChange={e => {
                          const qty = e.target.value === '' ? '' : Number(e.target.value)
                          setForm(prev => ({
                            ...prev,
                            stock_rows: prev.stock_rows.map((r, j) => (j === i ? { ...r, quantity: qty } : r)),
                          }))
                        }}
                      />
                      {form.has_expiry && (
                        <input
                          className="form-input"
                          type="date"
                          value={row.expiry_date}
                          onChange={e => {
                            const val = e.target.value
                            setForm(prev => ({
                              ...prev,
                              stock_rows: prev.stock_rows.map((r, j) => (j === i ? { ...r, expiry_date: val } : r)),
                            }))
                          }}
                        />
                      )}
                      {form.stock_rows.length > 1 && (
                        <button
                          type="button"
                          className={styles.removeBtn}
                          title="Remove batch"
                          onClick={() =>
                            setForm(prev => ({ ...prev, stock_rows: prev.stock_rows.filter((_, j) => j !== i) }))
                          }
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.has_expiry && (
                    <button
                      type="button"
                      className={styles.addAttrBtn}
                      onClick={() =>
                        setForm(prev => ({ ...prev, stock_rows: [...prev.stock_rows, { quantity: '', expiry_date: '' }] }))
                      }
                    >
                      + Add another batch
                    </button>
                  )}
                  <span className="form-hint">Leave quantity at 0 if you haven&apos;t received stock yet.</span>
                </div>

                {/* ── 7/8. Pricing ── */}
                <PricingFields
                  value={form}
                  onChange={next => setForm(prev => ({ ...prev, ...next }))}
                  purchaseCostHint="Cost for this opening batch of stock."
                  targetProfitHint="Auto-calculates the selling price — editable."
                  sellingPriceHint="Auto-calculated from cost and target profit — edit to update the markup instead."
                />

                {/* ── 9/10. Attributes + Description — collapsed by default ── */}
                <button
                  type="button"
                  className={`${styles.moreDetailsToggle} ${showMoreDetails ? styles.moreDetailsToggleOpen : ''}`}
                  onClick={() => setShowMoreDetails(v => !v)}
                >
                  {showMoreDetails ? 'Hide attributes & description' : '+ Add attributes & description (optional)'}
                  <ChevronDown size={14} />
                </button>

                {showMoreDetails && (
                  <>
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
                          disabled={attributeSaving}
                        />
                        {/* Suggestions from the business-wide attribute list */}
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
                        disabled={attributeSaving}
                      >
                        {attributeSaving ? <span className="spinner--sm" /> : <Check size={15} />}
                      </button>
                      <button
                        type="button"
                        className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                        title="Cancel"
                        onClick={() => {
                          setAddingAttr(false)
                          setNewAttrInput('')
                        }}
                        disabled={attributeSaving}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.addAttrBtn}
                      onClick={() => setAddingAttr(true)}
                      disabled={attributesLoading}
                    >
                      + Add attribute
                    </button>
                  )}

                  {attributesLoadError && (
                    <div className={styles.errorMsg}>
                      {attributesLoadError}{' '}
                      <button type="button" className="btn btn--ghost btn--sm" onClick={loadAttributes}>Retry</button>
                    </div>
                  )}

                  <span className="form-hint">
                    Attributes define what varies between this product&apos;s variants (e.g. Size, Color) — added in a later step.
                  </span>
                </div>

                {/* ── 10. Description ── */}
                <div className="form-group">
                  <label className="form-label">
                    Description <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder="Additional notes or description about this product..."
                    value={form.description}
                    onChange={e =>
                      setForm(prev => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>
                  </>
                )}

                {createError && (
                  <div className={styles.errorMsg}>{createError}</div>
                )}

              </div>{/* drawerForm */}
            </div>{/* drawerScroll */}

            <div className={`drawer__footer ${styles.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={handleCloseDrawer}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSaveItem}
                disabled={!form.name.trim() || !form.unit || createSaving}
              >
                {createSaving ? <span className="spinner--sm" /> : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Item Drawer — UI only, not wired to a backend yet ── */}
      {showEditDrawer && (
        <div className="overlay" onClick={handleCloseEditDrawer}>
          <div
            className="drawer"
            style={{ width: '560px', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer__header">
              <h3 className="drawer__title">Edit Product</h3>
              <button className="drawer__close" onClick={handleCloseEditDrawer}><X size={18} /></button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.drawerForm}>

                {/* 1. Product Name */}
                <div className="form-group">
                  <label className="form-label form-label--required">Product Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {/* 2. Unit */}
                <div className="form-group">
                  <label className="form-label form-label--required">Unit</label>
                  {!editAddingUnit ? (
                    <CustomSelect
                      value={editForm.unit}
                      disabled={unitsLoading}
                      placeholder={unitsLoading ? 'Loading units…' : 'Select unit'}
                      options={[
                        ...allUnits.map(u => ({ value: u, label: u })),
                        { value: '__new__', label: '+ Create new unit', isAction: true },
                      ]}
                      onChange={v => {
                        if (v === '__new__') setEditAddingUnit(true)
                        else setEditForm(prev => ({ ...prev, unit: v }))
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
                          if (e.key === 'Escape') setEditAddingUnit(false)
                        }}
                        disabled={unitSaving}
                      />
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} title="Confirm" onClick={handleAddEditUnit} disabled={unitSaving}>
                        {unitSaving ? <span className="spinner--sm" /> : <Check size={15} />}
                      </button>
                      <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} title="Cancel" onClick={() => setEditAddingUnit(false)} disabled={unitSaving}>
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 3/4. Category + Subcategory, side by side */}
                <div className={styles.fieldsRow}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    {!editAddingCategory ? (
                      <CustomSelect
                        value={editForm.category}
                        disabled={categoriesLoading}
                        placeholder={categoriesLoading ? 'Loading categories…' : 'Select category'}
                        options={[
                          ...allCategories.map(c => ({ value: c, label: c })),
                          { value: '__new__', label: '+ Create new category', isAction: true },
                        ]}
                        onChange={v => {
                          if (v === '__new__') {
                            setEditAddingCategory(true)
                          } else {
                            setEditForm(prev => ({ ...prev, category: v, subcategory: '' }))
                          }
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
                            if (e.key === 'Escape') setEditAddingCategory(false)
                          }}
                          disabled={categorySaving}
                        />
                        <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} title="Confirm" onClick={handleAddEditCategory} disabled={categorySaving}>
                          {categorySaving ? <span className="spinner--sm" /> : <Check size={15} />}
                        </button>
                        <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} title="Cancel" onClick={() => setEditAddingCategory(false)} disabled={categorySaving}>
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Subcategory <span className="text-tertiary font-normal">(Optional)</span>
                    </label>
                    {!editAddingSubcategory ? (
                      <CustomSelect
                        value={editForm.subcategory}
                        placeholder={editForm.category ? 'None' : 'Select a category first'}
                        disabled={!editForm.category}
                        options={
                          editForm.category
                            ? [
                                { value: '', label: 'None' },
                                ...getSubcategoriesFor(editForm.category).map(s => ({ value: s.name, label: s.name })),
                                { value: '__new__', label: '+ Create new subcategory', isAction: true },
                              ]
                            : []
                        }
                        onChange={v => {
                          if (v === '__new__') setEditAddingSubcategory(true)
                          else setEditForm(prev => ({ ...prev, subcategory: v }))
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
                            if (e.key === 'Escape') setEditAddingSubcategory(false)
                          }}
                          disabled={subcategorySaving}
                        />
                        <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnConfirm}`} title="Confirm" onClick={handleAddEditSubcategory} disabled={subcategorySaving}>
                          {subcategorySaving ? <span className="spinner--sm" /> : <Check size={15} />}
                        </button>
                        <button type="button" className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`} title="Cancel" onClick={() => setEditAddingSubcategory(false)} disabled={subcategorySaving}>
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Divider between "categorization" and "product settings" ── */}
                <div className={styles.groupDivider} />

                {/* 5/6. Perishable + Has variants, side by side */}
                <div className={styles.toggleGrid}>
                  <div className={styles.toggleCard}>
                    <label className="form-label">Perishable</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.has_expiry}
                      className={`toggle ${editForm.has_expiry ? '' : 'toggle--off'}`}
                      onClick={() => setEditForm(prev => ({ ...prev, has_expiry: !prev.has_expiry }))}
                    >
                      <span className="toggle__dot" />
                    </button>
                  </div>

                  <div className={styles.toggleCard}>
                    <label className="form-label">Has variants</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.has_variants}
                      className={`toggle ${editForm.has_variants ? '' : 'toggle--off'}`}
                      disabled={editForm.has_variants && editingItemVariantCount > 1}
                      title={
                        editForm.has_variants && editingItemVariantCount > 1
                          ? `Has ${editingItemVariantCount} variants — remove the extra ones to turn this off`
                          : undefined
                      }
                      style={editForm.has_variants && editingItemVariantCount > 1 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      onClick={() => setEditForm(prev => ({ ...prev, has_variants: !prev.has_variants }))}
                    >
                      <span className="toggle__dot" />
                    </button>
                  </div>
                </div>

                {/* ── Divider between "product settings" and "pricing" ── */}
                <div className={styles.groupDivider} />

                {/* 6. Pricing — only for a product with no variants; a
                    variant product has no single price to edit here. */}
                {editForm.has_variants ? (
                  <div className="form-group">
                    <label className="form-label">Pricing</label>
                    <span className="form-hint">
                      {editingItemVariantCount > 1
                        ? `This product has ${editingItemVariantCount} variants — manage pricing per variant on the product page.`
                        : 'This product tracks variants — pricing is managed per variant on the product page.'}
                    </span>
                    <Link href={`/dashboard/inventory/${editingItemId}`} className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--space-2)', alignSelf: 'flex-start' }}>
                      Manage Variants
                    </Link>
                  </div>
                ) : editVariantLoading ? (
                  <div className="form-group">
                    <label className="form-label">Pricing</label>
                    <span className="form-hint">Loading…</span>
                  </div>
                ) : (
                  <PricingFields
                    value={editForm}
                    onChange={next => setEditForm(prev => ({ ...prev, ...next }))}
                    sellingPriceHint="Auto-calculated from cost and target profit — edit to update the markup instead."
                  />
                )}

                {/* 7/8. Attributes + Description — collapsed unless the
                    product already has values there. */}
                <button
                  type="button"
                  className={`${styles.moreDetailsToggle} ${showEditMoreDetails ? styles.moreDetailsToggleOpen : ''}`}
                  onClick={() => setShowEditMoreDetails(v => !v)}
                >
                  {showEditMoreDetails ? 'Hide attributes & description' : '+ Add attributes & description (optional)'}
                  <ChevronDown size={14} />
                </button>

                {showEditMoreDetails && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Attributes</label>

                      {editForm.selected_attributes.length > 0 && (
                        <div className={styles.attrChipsRow}>
                          {editForm.selected_attributes.map(attr => (
                            <span key={attr} className={styles.attrChip}>
                              {attr}
                              <button
                                type="button"
                                className={styles.attrChipRemove}
                                onClick={() => removeEditSelectedAttribute(attr)}
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
                                if (e.key === 'Enter') handleCreateEditAttribute(editNewAttrInput)
                                if (e.key === 'Escape') { setEditAddingAttr(false); setEditNewAttrInput('') }
                              }}
                              disabled={attributeSaving}
                            />
                            {editAttrSuggestions.length > 0 && (
                              <div className={styles.attrSuggestions}>
                                {editAttrSuggestions.map(attr => (
                                  <button
                                    key={attr}
                                    type="button"
                                    className={styles.attrSuggestionItem}
                                    onMouseDown={() => {
                                      addEditSelectedAttribute(attr)
                                      setEditNewAttrInput('')
                                      setEditAddingAttr(false)
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
                            onClick={() => handleCreateEditAttribute(editNewAttrInput)}
                            disabled={attributeSaving}
                          >
                            {attributeSaving ? <span className="spinner--sm" /> : <Check size={15} />}
                          </button>
                          <button
                            type="button"
                            className={`${styles.attrActionBtn} ${styles.attrActionBtnCancel}`}
                            title="Cancel"
                            onClick={() => { setEditAddingAttr(false); setEditNewAttrInput('') }}
                            disabled={attributeSaving}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.addAttrBtn}
                          onClick={() => setEditAddingAttr(true)}
                          disabled={attributesLoading}
                        >
                          + Add attribute
                        </button>
                      )}

                      <span className="form-hint">
                        Attributes define what varies between this product&apos;s variants (e.g. Size, Color).
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Description <span className="text-tertiary font-normal">(Optional)</span>
                      </label>
                      <textarea
                        className="form-textarea"
                        value={editForm.description}
                        onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                {editError && (
                  <div className={styles.errorMsg}>{editError}</div>
                )}

              </div>
            </div>

            <div className={`drawer__footer ${styles.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={handleCloseEditDrawer}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={() => handleSaveEdit(false)}
                disabled={!editForm.name.trim() || !editForm.unit || editSaving || editVariantLoading}
              >
                {editSaving ? <span className="spinner--sm" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm attribute removal — shown when the server reports the
          removed attribute(s) already have real variant data attached ── */}
      {confirmAttrRemoval && (
        <div className="modal-overlay" onClick={() => setConfirmAttrRemoval(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal__title">Remove attributes with variant data?</h3>
            <div className="alert alert--warning">
              <div className="alert__dot"></div>
              <div>
                <p className="alert__title">This can&apos;t be undone</p>
                <p className="alert__body">
                  {confirmAttrRemoval.join(', ')} {confirmAttrRemoval.length === 1 ? 'has' : 'have'} values
                  saved on existing variants. Removing {confirmAttrRemoval.length === 1 ? 'it' : 'them'} from
                  this product will permanently delete those saved values.
                </p>
              </div>
            </div>
            <div className="modal__actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setConfirmAttrRemoval(null)}>
                Cancel
              </button>
              <button
                className="btn btn--danger btn--sm"
                onClick={() => {
                  setConfirmAttrRemoval(null)
                  handleSaveEdit(true)
                }}
              >
                Remove Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm product deletion ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => { if (!deleteSaving) setDeleteTarget(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal__title">Delete &quot;{deleteTarget.name}&quot;?</h3>
            <p className="modal__body">
              This permanently removes the product and its variant(s). This can&apos;t be undone.
            </p>
            {deleteError && (
              <div className="alert alert--danger alert--mb-4">
                <div className="alert__dot"></div>
                <div>
                  <p className="alert__body">{deleteError}</p>
                </div>
              </div>
            )}
            <div className="modal__actions">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSaving}
              >
                Cancel
              </button>
              <button
                className="btn btn--danger btn--sm"
                onClick={confirmDeleteItem}
                disabled={deleteSaving}
              >
                {deleteSaving ? <span className="spinner--sm" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-wrap">
          <div className="toast">
            <div
              className={`toast__bar toast__bar--${
                toast.type === 'danger'
                  ? 'danger'
                  : toast.type === 'warning'
                    ? 'warning'
                    : toast.type === 'success'
                      ? 'success'
                      : 'info'
              }`}
            />
            <div>
              <div className="toast__text">{toast.message}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
