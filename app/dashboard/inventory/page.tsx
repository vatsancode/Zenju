'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, X, Check, Filter, ChevronDown } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { InventoryItemWithDetails } from '@/lib/services/inventory'
import type { CategoryWithCount } from '@/lib/services/categories'
import type { UnitWithUsage } from '@/lib/services/units'
import type { AttributeWithUsage } from '@/lib/services/attributes'
import styles from './inventory.module.css'

// ─── Form-local types ─────────────────────────────────────────────────────────

type ToastState = {
  message: string
  type: 'success' | 'warning' | 'danger' | 'info'
}

type NewItemForm = {
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
  expires_within_days: number | ''
  // Notes
  description: string
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

function emptyForm(): NewItemForm {
  return {
    name: '',
    selected_attributes: [],
    unit: '',
    category: '',
    subcategory: '',
    has_expiry: false,
    expires_within_days: '',
    description: '',
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
  const [editForm, setEditForm] = useState<NewItemForm>(emptyForm())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
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
      expires_within_days: item.expires_within_days ?? '',
      description: item.notes ?? '',
      selected_attributes: [...item.attribute_names],
    }))
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
  function handleOpenEdit(item: InventoryItemWithDetails) {
    const own = item.category_id ? categories.find(c => c.id === item.category_id) : null
    const isRoot = own ? own.parent_id === null : true
    const parent = own && !isRoot ? categories.find(c => c.id === own.parent_id) : null

    setEditingItemId(item.id)
    setEditForm({
      name: item.name,
      selected_attributes: [...item.attribute_names],
      unit: item.unit_name,
      category: isRoot ? (own?.name ?? '') : (parent?.name ?? ''),
      subcategory: isRoot ? '' : (own?.name ?? ''),
      has_expiry: item.has_expiry,
      expires_within_days: item.expires_within_days ?? '',
      description: item.notes ?? '',
    })
    setEditAddingAttr(false)
    setEditAddingUnit(false)
    setEditAddingCategory(false)
    setEditAddingSubcategory(false)
    setEditError('')
    setConfirmAttrRemoval(null)
    setShowEditDrawer(true)
  }

  function handleCloseEditDrawer() {
    setShowEditDrawer(false)
    setEditingItemId(null)
    setEditForm(emptyForm())
    setEditAddingAttr(false)
    setEditAddingUnit(false)
    setEditAddingCategory(false)
    setEditAddingSubcategory(false)
    setEditError('')
    setConfirmAttrRemoval(null)
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
          expires_within_days: editForm.has_expiry && editForm.expires_within_days !== ''
            ? Number(editForm.expires_within_days)
            : null,
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

      setItems(prev => prev.map(item => item.id === editingItemId ? body.data : item))
      showToast(`"${body.data.name}" updated`)
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
    setShowAddDrawer(false)
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
          expires_within_days: form.has_expiry && form.expires_within_days !== ''
            ? Number(form.expires_within_days)
            : null,
          notes: form.description.trim() || null,
          attribute_ids: attributeIds,
        }),
      })
      const body = await res.json()
      if (!res.ok) { setCreateError(body.error || 'Could not create the product.'); return }

      setItems(prev => [body.data, ...prev])
      showToast(`"${body.data.name}" product created`)
      handleCloseDrawer()
    } catch {
      setCreateError('Could not create the product. Please check your connection.')
    } finally {
      setCreateSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page Header */}
      <div className={styles.headerRow}>
        <h1>Products</h1>
        <div className={styles.headerActions}>
          <Button size="sm" icon={<Plus size={18} />} onClick={() => setShowAddDrawer(true)}>
            Add Product
          </Button>
        </div>
      </div>

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
              <Button size="sm" onClick={() => setShowAddDrawer(true)}>
                Add Product
              </Button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className={styles.itemNameCol}>Product Name</th>
                <th className={styles.itemIdCol}>Product ID</th>
                <th className={styles.categoryCol}>Category</th>
                <th className={styles.stockCol}>Unit</th>
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
                    <div className={styles.itemIdCell}>
                      <span className={styles.itemIdCode}>{item.id}</span>
                      {item.attribute_names.length > 0 && (
                        <span className={styles.variantIdMore}>
                          {item.attribute_names.length} attribute{item.attribute_names.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {item.category_name
                      ? <span className="badge badge--neutral">{item.category_name}</span>
                      : <span className="text-tertiary">—</span>}
                  </td>
                  <td>{item.unit_name}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className="btn btn--ghost btn--sm"
                        title="Edit product"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil size={14} />
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
            style={{ width: '560px', overflow: 'hidden' }}
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

                {/* ── 3. Unit ── */}
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

                {/* ── Categorization ── */}
                <div className={styles.sectionLabel}>Categorization</div>

                {/* ── 4. Category ── */}
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
                        placeholder="e.g. Nuts, Spices, Beverages"
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

                {/* ── 5. Subcategory ── */}
                <div className="form-group">
                  <label className="form-label">
                    Subcategory <span className="text-tertiary font-normal">(Optional)</span>
                  </label>
                  {!addingSubcategory ? (
                    <CustomSelect
                      value={form.subcategory}
                      placeholder={form.category ? 'None' : 'Select a category first'}
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
                        placeholder="e.g. Premium, Organic, Salted"
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

                {/* ── 6. Expiry toggle ── */}
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

                {/* ── 7. Description ── */}
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

                {/* 2. Attributes */}
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

                {/* 3. Unit */}
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

                {/* Categorization */}
                <div className={styles.sectionLabel}>Categorization</div>

                {/* 4. Category */}
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

                {/* 5. Subcategory */}
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

                {/* 6. Expiry toggle */}
                <div className="form-group">
                  <div className={styles.fieldHeaderRow}>
                    <label className="form-label">Perishable — has expiry date</label>
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
                  {editForm.has_expiry && (
                    <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                      <label className="form-label">Expires within (days)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        placeholder="e.g. 30"
                        value={editForm.expires_within_days}
                        onChange={e =>
                          setEditForm(prev => ({
                            ...prev,
                            expires_within_days: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  )}
                </div>

                {/* 7. Description */}
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
                disabled={!editForm.name.trim() || !editForm.unit || editSaving}
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
