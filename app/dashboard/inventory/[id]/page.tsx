'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Pencil, X, Trash2, Download, Eye, Check, Plus, Image as ImageIcon, Layers, FileText, Upload } from 'lucide-react'
import type { InventoryItemWithDetails } from '@/lib/services/inventory'
import type { CategoryWithCount } from '@/lib/services/categories'
import type { UnitWithUsage } from '@/lib/services/units'
import type { AttributeWithUsage } from '@/lib/services/attributes'
import type { VariantWithDetails } from '@/lib/services/variants'
import CustomSelect from '@/components/ui/CustomSelect'
import styles from './detail.module.css'
import inv from '../inventory.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'variants' | 'description' | 'images'

type ToastState = { message: string; type: 'success' | 'warning' | 'danger' | 'info' }

type EditForm = {
  name: string
  selected_attributes: string[]
  unit: string
  category: string
  subcategory: string
  has_expiry: boolean
  expires_within_days: number | ''
  description: string
}

type ImageFile = {
  id: string
  name: string
  url: string
  size: number
}

type VariantRowDraft = { variant_code: string; selling_price: number; attribute_values: string[] }

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string

  // ── Main item state ────────────────────────────────────────────────────────
  const [item, setItem] = useState<InventoryItemWithDetails | null>(null)
  const [itemLoading, setItemLoading] = useState(true)
  const [itemLoadError, setItemLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('variants')

  // ── Variants tab state ─────────────────────────────────────────────────────
  const [variants, setVariants] = useState<VariantWithDetails[]>([])
  const [variantsLoading, setVariantsLoading] = useState(true)
  const [variantsLoadError, setVariantsLoadError] = useState('')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<VariantRowDraft | null>(null)
  const [rowSaving, setRowSaving] = useState(false)
  const [rowSaveError, setRowSaveError] = useState('')
  const sellingPriceInputRef = useRef<HTMLInputElement>(null)

  // ── Opening stock modal state ──────────────────────────────────────────────
  const [openingStockVariantId, setOpeningStockVariantId] = useState<string | null>(null)
  const [openingStockQty, setOpeningStockQty] = useState('')
  const [openingStockSaving, setOpeningStockSaving] = useState(false)
  const [openingStockError, setOpeningStockError] = useState('')

  // ── Categories / units / attributes — loaded from Settings-managed data ──────
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesLoadError, setCategoriesLoadError] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [subcategorySaving, setSubcategorySaving] = useState(false)
  const rootCategories = categories.filter(c => c.parent_id === null)
  const allCategories = rootCategories.map(c => c.name)

  function getSubcategoriesFor(categoryName: string): CategoryWithCount[] {
    const parent = rootCategories.find(c => c.name === categoryName)
    return parent ? categories.filter(c => c.parent_id === parent.id) : []
  }

  const [units, setUnits] = useState<UnitWithUsage[]>([])
  const [unitsLoading, setUnitsLoading] = useState(true)
  const [unitsLoadError, setUnitsLoadError] = useState('')
  const [unitSaving, setUnitSaving] = useState(false)
  const allUnits = units.map(u => u.name)

  const [attributes, setAttributes] = useState<AttributeWithUsage[]>([])
  const [attributesLoading, setAttributesLoading] = useState(true)
  const [attributesLoadError, setAttributesLoadError] = useState('')
  const [attributeSaving, setAttributeSaving] = useState(false)

  // ── Description tab state ──────────────────────────────────────────────────
  const [description, setDescription] = useState('')
  const [descSaved, setDescSaved] = useState(false)
  const [descError, setDescError] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Images tab state ───────────────────────────────────────────────────────
  const [images, setImages] = useState<ImageFile[]>([])
  const [viewingImage, setViewingImage] = useState<ImageFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Edit drawer state ──────────────────────────────────────────────────────
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', selected_attributes: [], unit: '', category: '', subcategory: '',
    has_expiry: false, expires_within_days: '', description: '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [confirmAttrRemoval, setConfirmAttrRemoval] = useState<string[] | null>(null)

  const [editAddingAttr, setEditAddingAttr] = useState(false)
  const [editNewAttrInput, setEditNewAttrInput] = useState('')
  const [editAddingUnit, setEditAddingUnit] = useState(false)
  const [newEditUnitInput, setNewEditUnitInput] = useState('')
  const [editAddingCategory, setEditAddingCategory] = useState(false)
  const [newEditCategoryInput, setNewEditCategoryInput] = useState('')
  const [editAddingSubcategory, setEditAddingSubcategory] = useState(false)
  const [newEditSubcategoryInput, setNewEditSubcategoryInput] = useState('')

  const newEditUnitInputRef = useRef<HTMLInputElement>(null)
  const newEditCategoryInputRef = useRef<HTMLInputElement>(null)
  const newEditSubcategoryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingRowId) { sellingPriceInputRef.current?.focus(); sellingPriceInputRef.current?.select() }
  }, [editingRowId])

  useEffect(() => { if (editAddingUnit) newEditUnitInputRef.current?.focus() }, [editAddingUnit])
  useEffect(() => { if (editAddingCategory) newEditCategoryInputRef.current?.focus() }, [editAddingCategory])
  useEffect(() => { if (editAddingSubcategory) newEditSubcategoryInputRef.current?.focus() }, [editAddingSubcategory])

  const editAvailableAttributes = attributes
    .map(a => a.name)
    .filter(a => !editForm.selected_attributes.includes(a))
  const editAttrSuggestions = editAddingAttr
    ? editAvailableAttributes.filter(
      a => !editNewAttrInput.trim() || a.toLowerCase().includes(editNewAttrInput.toLowerCase())
    )
    : []

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showToast(message: string, type: ToastState['type'] = 'success') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Load item, categories, units, attributes from the server ─────────────────

  async function loadItem() {
    setItemLoading(true)
    setItemLoadError('')
    try {
      const res = await fetch(`/api/inventory/${id}`)
      const body = await res.json()
      if (!res.ok) { setItemLoadError(body.error || 'Item not found'); setItem(null); return }
      setItem(body.data)
      setDescription(body.data.notes ?? '')
    } catch {
      setItemLoadError('Could not load the product. Please check your connection.')
    } finally {
      setItemLoading(false)
    }
  }

  async function loadVariants() {
    setVariantsLoading(true)
    setVariantsLoadError('')
    try {
      const res = await fetch(`/api/inventory/${id}/variants`)
      const body = await res.json()
      if (!res.ok) { setVariantsLoadError(body.error || 'Could not load variants.'); return }
      setVariants(body.data)
    } catch {
      setVariantsLoadError('Could not load variants. Please check your connection.')
    } finally {
      setVariantsLoading(false)
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

  useEffect(() => { loadItem() }, [id])
  useEffect(() => { loadVariants() }, [id])
  useEffect(() => { loadCategories() }, [])
  useEffect(() => { loadUnits() }, [])
  useEffect(() => { loadAttributes() }, [])

  // Just-created products land here with the fresh default variant already
  // open for editing, cursor in the selling price field — the query flag is
  // stripped right after so a refresh or back-nav doesn't re-trigger it.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    if (variantsLoading || variants.length !== 1) return
    const variant = variants[0]
    setEditingRowId(variant.id)
    setRowDraft({
      variant_code: variant.variant_code ?? '',
      selling_price: variant.selling_price ?? 0,
      attribute_values: [...variant.attribute_values],
    })
    setActiveTab('variants')
    router.replace(`/dashboard/inventory/${id}`, { scroll: false })
  }, [searchParams, variantsLoading, variants, id, router])

  // ── Handlers: variant row edit ─────────────────────────────────────────────

  function startEditRow(row: VariantWithDetails) {
    setEditingRowId(row.id)
    setRowDraft({
      variant_code: row.variant_code ?? '',
      selling_price: row.selling_price ?? 0,
      attribute_values: [...row.attribute_values],
    })
    setRowSaveError('')
  }

  function cancelEditRow() {
    setEditingRowId(null)
    setRowDraft(null)
    setRowSaveError('')
  }

  // Single click navigates to the variant detail page; double click edits
  // inline. The single-click action is delayed so a second click can cancel
  // it in time.
  const rowClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current) }
  }, [])

  function handleRowClick(row: VariantWithDetails) {
    if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current)
    rowClickTimerRef.current = setTimeout(() => {
      router.push(`/dashboard/inventory/${id}/variant/${row.id}`)
    }, 220)
  }

  function handleRowDoubleClick(row: VariantWithDetails) {
    if (rowClickTimerRef.current) {
      clearTimeout(rowClickTimerRef.current)
      rowClickTimerRef.current = null
    }
    if (editingRowId !== row.id) startEditRow(row)
  }

  async function saveEditRow(variantId: string) {
    if (!rowDraft || rowSaving) return
    setRowSaving(true)
    setRowSaveError('')
    try {
      const res = await fetch(`/api/inventory/${id}/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_code: rowDraft.variant_code.trim() || null,
          selling_price: rowDraft.selling_price,
          attribute_values: rowDraft.attribute_values,
        }),
      })
      const body = await res.json()
      if (!res.ok) { setRowSaveError(body.error || 'Could not save the variant.'); return }
      setVariants(prev => prev.map(v => (v.id === variantId ? body.data : v)))
      setEditingRowId(null)
      setRowDraft(null)
    } catch {
      setRowSaveError('Could not save the variant. Please check your connection.')
    } finally {
      setRowSaving(false)
    }
  }

  // ── Handlers: opening stock ────────────────────────────────────────────────

  function openOpeningStockModal(variantId: string) {
    setOpeningStockVariantId(variantId)
    setOpeningStockQty('')
    setOpeningStockError('')
  }

  function closeOpeningStockModal() {
    setOpeningStockVariantId(null)
    setOpeningStockQty('')
    setOpeningStockError('')
  }

  async function saveOpeningStock() {
    if (!openingStockVariantId || openingStockSaving) return
    const qty = Number(openingStockQty)
    if (!openingStockQty.trim() || !Number.isFinite(qty) || qty <= 0) {
      setOpeningStockError('Enter a quantity greater than 0.')
      return
    }

    setOpeningStockSaving(true)
    setOpeningStockError('')
    try {
      const res = await fetch(`/api/inventory/${id}/variants/${openingStockVariantId}/opening-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      })
      const body = await res.json()
      if (!res.ok) { setOpeningStockError(body.error || 'Could not save the opening stock.'); return }
      setVariants(prev => prev.map(v => (v.id === openingStockVariantId ? body.data : v)))
      showToast('Opening stock added')
      closeOpeningStockModal()
    } catch {
      setOpeningStockError('Could not save the opening stock. Please check your connection.')
    } finally {
      setOpeningStockSaving(false)
    }
  }

  // ── Handlers: description (auto-saves to the real product) ───────────────────

  function handleDescriptionChange(value: string) {
    setDescription(value)
    setDescSaved(false)
    setDescError('')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveDescription(value), 800)
  }

  async function saveDescription(value: string) {
    if (!item) return
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          category_id: item.category_id,
          unit_id: item.unit_id,
          has_expiry: item.has_expiry,
          expires_within_days: item.expires_within_days,
          notes: value.trim() || null,
          attribute_ids: item.attribute_ids,
        }),
      })
      const body = await res.json()
      if (!res.ok) { setDescError(body.error || 'Could not save the description.'); return }
      setItem(body.data)
      setDescSaved(true)
      setTimeout(() => setDescSaved(false), 2000)
    } catch {
      setDescError('Could not save the description. Please check your connection.')
    }
  }

  // ── Handlers: images (local preview only — not yet persisted) ────────────────

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

  // ── Handlers: attributes (edit drawer) ────────────────────────────────────────

  function addEditSelectedAttribute(attrName: string) {
    if (editForm.selected_attributes.includes(attrName)) return
    setEditForm(prev => ({ ...prev, selected_attributes: [...prev.selected_attributes, attrName] }))
  }

  function removeEditSelectedAttribute(attrName: string) {
    setEditForm(prev => ({ ...prev, selected_attributes: prev.selected_attributes.filter(a => a !== attrName) }))
  }

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

  async function handleCreateEditAttribute(name: string) {
    const attr = await resolveOrCreateAttribute(name)
    if (!attr) return
    addEditSelectedAttribute(attr.name)
    setEditNewAttrInput('')
    setEditAddingAttr(false)
  }

  // ── Handlers: units / categories (edit drawer, create inline) ────────────────

  async function createUnitRemote(name: string): Promise<UnitWithUsage | null> {
    if (unitSaving) return null
    setUnitSaving(true)
    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // ── Handlers: open/close/save edit drawer ─────────────────────────────────────

  function openEditDrawer() {
    if (!item) return
    const own = item.category_id ? categories.find(c => c.id === item.category_id) : null
    const isRoot = own ? own.parent_id === null : true
    const parent = own && !isRoot ? categories.find(c => c.id === own.parent_id) : null

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

  function closeEditDrawer() {
    setShowEditDrawer(false)
    setEditError('')
    setConfirmAttrRemoval(null)
  }

  async function handleSaveEdit(confirmAttributeRemoval = false) {
    if (!item || !editForm.name.trim() || !editForm.unit || editSaving) return

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
      .filter((attrId): attrId is string => !!attrId)

    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
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

      setItem(body.data)
      setDescription(body.data.notes ?? '')
      // Attributes may have been added/removed — drop any in-progress row
      // edit and reload variants so attribute_values line up with the
      // item's current attribute columns.
      cancelEditRow()
      loadVariants()
      showToast(`"${body.data.name}" updated`)
      closeEditDrawer()
    } catch {
      setEditError('Could not save the product. Please check your connection.')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Early returns: loading / not found ────────────────────────────────────────

  if (itemLoading) {
    return (
      <div>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/inventory')}>
          <ArrowLeft size={16} />
          Back to Inventory
        </button>
        <div className="empty-state">
          <p className="empty-state__desc">Loading product…</p>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/inventory')}>
          <ArrowLeft size={16} />
          Back to Inventory
        </button>
        <div className="empty-state">
          <p className="empty-state__title">Item not found</p>
          <p className="empty-state__desc">
            {itemLoadError === 'Product not found'
              ? 'The inventory item you are looking for does not exist.'
              : itemLoadError || 'The inventory item you are looking for does not exist.'}
          </p>
        </div>
      </div>
    )
  }

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
              <span className={styles.metaText}>{item.category_name ?? 'Uncategorized'}</span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{item.unit_name}</span>
              {item.attribute_names.length > 0 && (
                <>
                  <span className={styles.metaDot} />
                  <span className={styles.metaText}>{item.attribute_names.join(', ')}</span>
                </>
              )}
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
          {variants.length > 0 && <span className={styles.tabCount}>{variants.length}</span>}
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
          {variantsLoading ? (
            <div className="empty-state">
              <p className="empty-state__desc">Loading variants…</p>
            </div>
          ) : variantsLoadError ? (
            <div className="empty-state">
              <p className="empty-state__title">Could not load variants</p>
              <p className="empty-state__desc">{variantsLoadError}</p>
            </div>
          ) : variants.length > 0 ? (
            <>
              <div className={styles.variantScrollWrap}>
                <table className={styles.variantTableFull}>
                  <thead>
                    <tr>
                      <th>Variant Code</th>
                      {item.attribute_names.map(attr => <th key={attr}>{attr}</th>)}
                      <th className={styles.colQty}>Qty</th>
                      <th className={styles.colSelling}>Selling / Unit</th>
                      <th className={styles.colActions} />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map(row => {
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
                                value={rowDraft?.variant_code ?? ''}
                                placeholder="Optional"
                                onChange={e => setRowDraft(d => d && { ...d, variant_code: e.target.value })}
                              />
                            ) : (
                              <span className={styles.variantDisplayText}>
                                {row.variant_code || <span className="text-tertiary">Unnamed</span>}
                              </span>
                            )}
                          </td>
                          {item.attribute_names.map((attr, ai) => (
                            <td key={attr}>
                              {isEditing ? (
                                <input
                                  className={`form-input ${styles.variantInput}`}
                                  placeholder={attr}
                                  value={rowDraft?.attribute_values[ai] ?? ''}
                                  onChange={e => {
                                    const val = e.target.value
                                    setRowDraft(d => d && { ...d, attribute_values: d.attribute_values.map((v, j) => (j === ai ? val : v)) })
                                  }}
                                />
                              ) : (
                                <span className={styles.variantDisplayText}>
                                  {row.attribute_values[ai] || <span className="text-tertiary">—</span>}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className={styles.colQty}>
                            {row.current_stock > 0 ? (
                              <span className={styles.qtyDisplayText} title="Quantity updates automatically from Purchases and Consumption">
                                {row.current_stock} {item.unit_name}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={`btn btn--ghost btn--sm ${styles.addStockBtn}`}
                                onClick={e => { e.stopPropagation(); openOpeningStockModal(row.id) }}
                                title="Add opening stock"
                              >
                                <Plus size={12} /> Add Stock
                              </button>
                            )}
                          </td>
                          <td className={styles.colSelling}>
                            {isEditing ? (
                              <div className={styles.compactCurrency}>
                                <span className={styles.compactCurrencySymbol}>₹</span>
                                <input
                                  ref={sellingPriceInputRef}
                                  className={styles.compactCurrencyInput}
                                  type="number" min="0"
                                  value={rowDraft?.selling_price ?? 0}
                                  onChange={e => setRowDraft(d => d && { ...d, selling_price: Number(e.target.value) })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEditRow(row.id)
                                    if (e.key === 'Escape') cancelEditRow()
                                  }}
                                  disabled={rowSaving}
                                />
                              </div>
                            ) : (
                              <span className={styles.variantDisplayText}>
                                {row.selling_price != null ? `₹${row.selling_price}` : <span className="text-tertiary">Not set</span>}
                              </span>
                            )}
                          </td>
                          <td className={styles.colActions} onClick={e => e.stopPropagation()}>
                            <div className={styles.actionsRow}>
                              {isEditing ? (
                                <>
                                  <button className={`${styles.removeBtn} ${styles.saveBtn}`}
                                    onClick={() => saveEditRow(row.id)} disabled={rowSaving} title="Save changes">
                                    {rowSaving ? <span className="spinner--sm" /> : <Check size={14} />}
                                  </button>
                                  <button className={styles.removeBtn} onClick={cancelEditRow} disabled={rowSaving} title="Cancel">
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <button className={styles.removeBtn} onClick={() => startEditRow(row)} title="Edit variant">
                                  <Pencil size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {rowSaveError && <div className={inv.errorMsg} style={{ marginTop: 'var(--space-2)' }}>{rowSaveError}</div>}
            </>
          ) : (
            <div className={styles.noVariants}>
              <div className={styles.noVariantsIcon}><Layers size={24} /></div>
              <p className={styles.noVariantsTitle}>No variants yet</p>
              <p className="text-sm text-secondary">
                Variant creation is coming in a later stage.
              </p>
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
            <span className={styles.descHint}>{descError || 'Changes are saved automatically'}</span>
            {descSaved && !descError && (
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
      {showEditDrawer && (
        <div className="overlay" onClick={closeEditDrawer}>
          <div className="drawer" style={{ width: '560px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="drawer__header">
              <h3 className="drawer__title">Edit Product</h3>
              <button className="drawer__close" onClick={closeEditDrawer}><X size={18} /></button>
            </div>

            <div className={inv.drawerScroll}>
              <div className={inv.drawerForm}>

                {/* Item Name */}
                <div className="form-group">
                  <label className="form-label form-label--required">Product Name</label>
                  <input className="form-input" type="text" value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>

                {/* Attributes */}
                <div className="form-group">
                  <label className="form-label">Attributes</label>

                  {editForm.selected_attributes.length > 0 && (
                    <div className={inv.attrChipsRow}>
                      {editForm.selected_attributes.map(attr => (
                        <span key={attr} className={inv.attrChip}>
                          {attr}
                          <button type="button" className={inv.attrChipRemove}
                            onClick={() => removeEditSelectedAttribute(attr)} title={`Remove ${attr}`}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {editAddingAttr ? (
                    <div className={inv.attrAddRow}>
                      <div className={inv.attrInputWrap}>
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
                          <div className={inv.attrSuggestions}>
                            {editAttrSuggestions.map(attr => (
                              <button
                                key={attr}
                                type="button"
                                className={inv.attrSuggestionItem}
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
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnConfirm}`}
                        title="Add attribute" onClick={() => handleCreateEditAttribute(editNewAttrInput)} disabled={attributeSaving}>
                        {attributeSaving ? <span className="spinner--sm" /> : <Check size={15} />}
                      </button>
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnCancel}`}
                        title="Cancel" onClick={() => { setEditAddingAttr(false); setEditNewAttrInput('') }} disabled={attributeSaving}>
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className={inv.addAttrBtn}
                      onClick={() => setEditAddingAttr(true)} disabled={attributesLoading}>
                      + Add attribute
                    </button>
                  )}

                  <span className="form-hint">
                    Attributes define what varies between this product&apos;s variants (e.g. Size, Color).
                  </span>
                </div>

                {/* Unit */}
                <div className="form-group">
                  <label className="form-label form-label--required">Unit</label>
                  {!editAddingUnit ? (
                    <CustomSelect value={editForm.unit}
                      placeholder={unitsLoading ? 'Loading units…' : 'Select unit'}
                      options={[...allUnits.map(u => ({ value: u, label: u })), { value: '__new__', label: '+ Create new unit', isAction: true }]}
                      onChange={v => { if (v === '__new__') setEditAddingUnit(true); else setEditForm(prev => ({ ...prev, unit: v })) }} />
                  ) : (
                    <div className={inv.inlineCreate}>
                      <input ref={newEditUnitInputRef} className="form-input" placeholder="e.g. Boxes, Cartons"
                        value={newEditUnitInput} onChange={e => setNewEditUnitInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddEditUnit(); if (e.key === 'Escape') setEditAddingUnit(false) }}
                        disabled={unitSaving} />
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnConfirm}`} onClick={handleAddEditUnit} disabled={unitSaving}>
                        {unitSaving ? <span className="spinner--sm" /> : <Check size={15} />}
                      </button>
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnCancel}`} onClick={() => setEditAddingUnit(false)} disabled={unitSaving}><X size={15} /></button>
                    </div>
                  )}
                </div>

                {/* Categorization */}
                <div className={inv.sectionLabel}>Categorization</div>

                {/* Category */}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  {!editAddingCategory ? (
                    <CustomSelect value={editForm.category} placeholder={categoriesLoading ? 'Loading categories…' : 'Select category'}
                      options={[...allCategories.map(c => ({ value: c, label: c })), { value: '__new__', label: '+ Create new category', isAction: true }]}
                      onChange={v => { if (v === '__new__') setEditAddingCategory(true); else setEditForm(prev => ({ ...prev, category: v, subcategory: '' })) }} />
                  ) : (
                    <div className={inv.inlineCreate}>
                      <input ref={newEditCategoryInputRef} className="form-input" placeholder="e.g. Nuts, Spices"
                        value={newEditCategoryInput} onChange={e => setNewEditCategoryInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddEditCategory(); if (e.key === 'Escape') setEditAddingCategory(false) }}
                        disabled={categorySaving} />
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnConfirm}`} onClick={handleAddEditCategory} disabled={categorySaving}>
                        {categorySaving ? <span className="spinner--sm" /> : <Check size={15} />}
                      </button>
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnCancel}`} onClick={() => setEditAddingCategory(false)} disabled={categorySaving}><X size={15} /></button>
                    </div>
                  )}
                </div>

                {/* Subcategory */}
                <div className="form-group">
                  <label className="form-label">Subcategory <span className="text-tertiary font-normal">(Optional)</span></label>
                  {!editAddingSubcategory ? (
                    <CustomSelect value={editForm.subcategory}
                      placeholder={editForm.category ? 'None' : 'Select a category first'}
                      options={
                        editForm.category
                          ? [{ value: '', label: 'None' }, ...getSubcategoriesFor(editForm.category).map(s => ({ value: s.name, label: s.name })), { value: '__new__', label: '+ Create new subcategory', isAction: true }]
                          : []
                      }
                      onChange={v => { if (v === '__new__') setEditAddingSubcategory(true); else setEditForm(prev => ({ ...prev, subcategory: v })) }} />
                  ) : (
                    <div className={inv.inlineCreate}>
                      <input ref={newEditSubcategoryInputRef} className="form-input" placeholder="e.g. Premium, Organic"
                        value={newEditSubcategoryInput} onChange={e => setNewEditSubcategoryInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddEditSubcategory(); if (e.key === 'Escape') setEditAddingSubcategory(false) }}
                        disabled={subcategorySaving} />
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnConfirm}`} onClick={handleAddEditSubcategory} disabled={subcategorySaving}>
                        {subcategorySaving ? <span className="spinner--sm" /> : <Check size={15} />}
                      </button>
                      <button type="button" className={`${inv.attrActionBtn} ${inv.attrActionBtnCancel}`} onClick={() => setEditAddingSubcategory(false)} disabled={subcategorySaving}><X size={15} /></button>
                    </div>
                  )}
                </div>

                {/* Expiry toggle */}
                <div className="form-group">
                  <div className={inv.fieldHeaderRow}>
                    <label className="form-label">Perishable — has expiry date</label>
                    <button type="button" role="switch" aria-checked={editForm.has_expiry}
                      className={`toggle ${editForm.has_expiry ? '' : 'toggle--off'}`}
                      onClick={() => setEditForm(prev => ({ ...prev, has_expiry: !prev.has_expiry }))}>
                      <span className="toggle__dot" />
                    </button>
                  </div>
                  {editForm.has_expiry && (
                    <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                      <label className="form-label">Expires within (days)</label>
                      <input className="form-input" type="number" min="1" placeholder="e.g. 30"
                        value={editForm.expires_within_days}
                        onChange={e => setEditForm(prev => ({ ...prev, expires_within_days: e.target.value === '' ? '' : Number(e.target.value) }))} />
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Notes <span className="text-tertiary font-normal">(Optional)</span></label>
                  <textarea className="form-textarea" value={editForm.description}
                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} />
                </div>

                {editError && (
                  <div className={inv.errorMsg}>{editError}</div>
                )}

              </div>
            </div>

            <div className={`drawer__footer ${inv.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={closeEditDrawer}>Cancel</button>
              <button className="btn btn--primary"
                onClick={() => handleSaveEdit(false)}
                disabled={!editForm.name.trim() || !editForm.unit || editSaving}>
                {editSaving ? <span className="spinner--sm" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm attribute removal ── */}
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
              <button className="btn btn--ghost btn--sm" onClick={() => setConfirmAttrRemoval(null)}>Cancel</button>
              <button className="btn btn--danger btn--sm"
                onClick={() => { setConfirmAttrRemoval(null); handleSaveEdit(true) }}>
                Remove Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add opening stock ── */}
      {openingStockVariantId && (
        <div className="modal-overlay" onClick={closeOpeningStockModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal__title">Add Opening Stock</h3>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                className="form-input"
                type="number"
                min="0"
                autoFocus
                value={openingStockQty}
                onChange={e => setOpeningStockQty(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveOpeningStock() }}
                disabled={openingStockSaving}
              />
              <span className="form-hint">
                This sets the starting quantity for this variant. To edit it later, open the variant and add stock entries or mark consumption to keep the count accurate.
              </span>
            </div>
            {openingStockError && <div className={inv.errorMsg}>{openingStockError}</div>}
            <div className="modal__actions">
              <button className="btn btn--ghost btn--sm" onClick={closeOpeningStockModal} disabled={openingStockSaving}>
                Cancel
              </button>
              <button className="btn btn--primary btn--sm" onClick={saveOpeningStock} disabled={openingStockSaving}>
                {openingStockSaving ? <span className="spinner--sm" /> : 'Save'}
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
                toast.type === 'danger' ? 'danger' : toast.type === 'warning' ? 'warning' : toast.type === 'success' ? 'success' : 'info'
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
