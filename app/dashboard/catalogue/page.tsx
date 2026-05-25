'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  mockCatalogueItems,
  mockInventoryItems,
  mockCategories,
  mockTags,
  mockUnits,
  mockUnitConversions,
  formatINR,
} from '@/lib/mock-data'
import { Tag, Plus, X, Check, Search, ChevronDown, Pencil, Archive, RotateCcw } from 'lucide-react'
import type { Category } from '@/types/database'
import styles from './catalogue.module.css'

// ─── Local types ──────────────────────────────────────────────────────────────

type BundleComponent = {
  inventory_item_id: string
  name: string
  quantity: number
  unit: string
}

type CatalogueItem = {
  id: string
  name: string
  category_id: string
  category_name: string
  subcategory_id?: string
  type: 'linked' | 'bundle' | 'independent'
  inventory_item_id: string | null
  inventory_item_name: string | null
  selling_price: number
  is_bundle: boolean
  inventory_tracking: boolean
  availability_status: 'active' | 'inactive' | 'archived'
  tags: string[]
  notes: string
  created_at: string
  bundle_components?: BundleComponent[]
  taxes?: TaxLine[]
  tax_inclusive?: boolean
  mapped_inventory?: MappedInventoryItem[]
}

type IngredientRow = {
  id: string
  inventory_item_id: string
  quantity: number | ''
  unit: string
}

type TaxLine = {
  id: string
  name: string
  percentage: number
}

type MappedInventoryItem = {
  id: string
  inventory_item_id: string
  quantity: number | ''
  unit: string
  selected_variants?: string[] // variant IDs
}

// ─── Searchable select component ──────────────────────────────────────────────

type SearchableOption = { value: string; label: string }

function SearchableSelect({
  value,
  options,
  onChange,
  onCreate,
  placeholder = 'Select…',
  disabled = false,
}: {
  value: string
  options: SearchableOption[]
  onChange: (value: string) => void
  onCreate: (name: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const showCreateSuggestion =
    search.trim() &&
    !filtered.find(o => o.label.toLowerCase() === search.trim().toLowerCase())

  return (
    <div className={styles.searchableSelectWrap}>
      <button
        type="button"
        className={`form-select ${styles.searchableSelectTrigger} ${open ? styles.searchableSelectTriggerOpen : ''
          }`}
        disabled={disabled}
        onClick={() => {
          setOpen(!open)
          if (!open) setSearch('')
        }}
      >
        <span className={selected ? '' : 'text-tertiary'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={styles.searchableSelectChevron} />
      </button>

      {open && (
        <div className={styles.searchableSelectDropdown} ref={dropdownRef}>
          <div className={styles.searchableSelectSearch}>
            <Search size={14} />
            <input
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && showCreateSuggestion) {
                  onCreate(search.trim())
                  setOpen(false)
                }
              }}
            />
          </div>
          <div className={styles.searchableSelectOptions}>
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.searchableSelectOption} ${opt.value === value ? styles.searchableSelectOptionSelected : ''
                    }`}
                  onMouseDown={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              ))
            ) : !showCreateSuggestion ? (
              <div className={styles.searchableSelectNoResult}>No results found</div>
            ) : null}

            {showCreateSuggestion && (
              <button
                type="button"
                className={`${styles.searchableSelectOption} ${styles.searchableSelectOptionCreate}`}
                onMouseDown={() => {
                  onCreate(search.trim())
                  setOpen(false)
                }}
              >
                + Create "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyIngredient(): IngredientRow {
  return {
    id: `${Date.now()}-${Math.random()}`,
    inventory_item_id: '',
    quantity: '',
    unit: '',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CataloguePage() {
  // ── Table state ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState<CatalogueItem[]>(
    mockCatalogueItems as CatalogueItem[]
  )
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // ── Modal / drawer visibility ────────────────────────────────────────────────
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [showViewDrawer, setShowViewDrawer] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [wasViewingBeforeEdit, setWasViewingBeforeEdit] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [createType, setCreateType] = useState<'bundle' | 'independent' | null>(null)
  const [createStep, setCreateStep] = useState(1)

  // ── Import modal state ───────────────────────────────────────────────────────
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([])
  const [importPrices, setImportPrices] = useState<Record<string, string>>({})
  const [importSearch, setImportSearch] = useState('')
  const [importFilter, setImportFilter] = useState<'all' | 'not_imported' | 'imported'>('all')
  const selectAllRef = useRef<HTMLInputElement>(null)

  // ── Create drawer form state ─────────────────────────────────────────────────
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategoryId, setNewItemCategoryId] = useState('')
  const [newItemSubCategoryId, setNewItemSubCategoryId] = useState('')
  const [newItemSellingPrice, setNewItemSellingPrice] = useState<number | ''>('')
  const [newItemTags, setNewItemTags] = useState<string[]>([])
  const [newItemTagInput, setNewItemTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [newItemNotes, setNewItemNotes] = useState('')
  const [newItemStatus, setNewItemStatus] = useState<'active' | 'inactive'>('active')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    emptyIngredient(),
    emptyIngredient(),
  ])
  const [inventoryTracking, setInventoryTracking] = useState(true)

  // ── New Create Drawer Form State (Overhauled) ───────────────────────────────
  const [taxInclusive, setTaxInclusive] = useState(true)
  const [taxes, setTaxes] = useState<TaxLine[]>([])
  const [lastAddedTaxId, setLastAddedTaxId] = useState('')
  const [mappedInventory, setMappedInventory] = useState<MappedInventoryItem[]>([])
  const [lastAddedMapId, setLastAddedMapId] = useState('')

  // For inventory search in rows
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)
  const [inventorySearch, setInventorySearch] = useState('')

  // ── Local Categories (for quick add) ─────────────────────────────────────────
  const [localCategories, setLocalCategories] = useState<Category[]>(mockCategories)

  // ── Derived: filtered table rows ─────────────────────────────────────────────
  const filteredItems = items.filter(item => {
    const matchesSearch =
      !search || item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryFilter || item.category_id === categoryFilter
    const matchesType = !typeFilter || item.type === typeFilter
    const matchesStatus = !statusFilter || item.availability_status === statusFilter
    return matchesSearch && matchesCategory && matchesType && matchesStatus
  })

  // ── Derived: import ──────────────────────────────────────────────────────────
  const importedInventoryIds = new Set(items.map(i => i.inventory_item_id).filter(Boolean))

  const filteredImportItems = mockInventoryItems.filter(inv => {
    const matchesSearch = !importSearch || inv.name.toLowerCase().includes(importSearch.toLowerCase())
    const isImported = importedInventoryIds.has(inv.id)
    const matchesFilter =
      importFilter === 'all' ? true :
        importFilter === 'not_imported' ? !isImported :
          isImported
    return matchesSearch && matchesFilter
  })

  const allSelectChecked =
    filteredImportItems.length > 0 &&
    filteredImportItems.every(i => selectedImportIds.includes(i.id))
  const someSelectChecked =
    filteredImportItems.some(i => selectedImportIds.includes(i.id)) && !allSelectChecked

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelectChecked
    }
  }, [someSelectChecked])

  const selectedInvItems = mockInventoryItems.filter(i =>
    selectedImportIds.includes(i.id)
  )

  // ── Derived: bundle cost calc ────────────────────────────────────────────────
  const validIngredients = ingredients.filter(
    r => r.inventory_item_id && r.quantity !== '' && Number(r.quantity) > 0
  )

  const estimatedCost = validIngredients.reduce((sum, row) => {
    const invItem = mockInventoryItems.find(i => i.id === row.inventory_item_id)
    if (!invItem) return sum
    return sum + invItem.cost_price * Number(row.quantity)
  }, 0)

  const sellingPrice = Number(newItemSellingPrice) || 0
  const margin = sellingPrice - estimatedCost
  const marginPercent =
    sellingPrice > 0 ? Math.round((margin / sellingPrice) * 100) : 0

  // ── Derived: can create? ─────────────────────────────────────────────────────
  const canCreate = (() => {
    if (!newItemName.trim() || !newItemCategoryId || newItemSellingPrice === '') return false
    if (createType === 'bundle' && validIngredients.length < 2) return false
    return true
  })()

  // ── Tag suggestions ──────────────────────────────────────────────────────────
  const tagSuggestions =
    newItemTagInput.trim().length > 0
      ? mockTags.filter(
        t =>
          t.name.toLowerCase().includes(newItemTagInput.toLowerCase()) &&
          !newItemTags.includes(t.name)
      )
      : mockTags.filter(t => !newItemTags.includes(t.name)).slice(0, 5)

  // ── Handlers: tags ───────────────────────────────────────────────────────────
  function addTag(tagName: string) {
    const cleaned = tagName.replace(/,/g, '').trim()
    if (cleaned && !newItemTags.includes(cleaned)) {
      setNewItemTags(prev => [...prev, cleaned])
    }
    setNewItemTagInput('')
    setShowTagSuggestions(false)
  }

  function removeTag(tagName: string) {
    setNewItemTags(prev => prev.filter(t => t !== tagName))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && newItemTagInput.trim()) {
      e.preventDefault()
      addTag(newItemTagInput)
    }
  }

  // ── Handlers: ingredient rows ────────────────────────────────────────────────
  function updateIngredient(
    id: string,
    field: 'inventory_item_id' | 'quantity',
    value: string
  ) {
    setIngredients(prev =>
      prev.map(row => {
        if (row.id !== id) return row
        if (field === 'inventory_item_id') {
          const invItem = mockInventoryItems.find(i => i.id === value)
          return { ...row, inventory_item_id: value, unit: invItem?.unit ?? '' }
        }
        return { ...row, quantity: value === '' ? '' : Number(value) }
      })
    )
  }

  // ── Handlers: reset state ────────────────────────────────────────────────────
  function resetCreateForm() {
    setNewItemName('')
    setNewItemCategoryId('')
    setNewItemSubCategoryId('')
    setNewItemSellingPrice('')
    setNewItemTags([])
    setNewItemTagInput('')
    setNewItemNotes('')
    setNewItemStatus('active')
    setIngredients([emptyIngredient(), emptyIngredient()])
    setCreateStep(1)
    setCreateType(null)
    setTaxes([])
    setTaxInclusive(true)
    setMappedInventory([])
    setEditingItemId(null)
    setShowViewDrawer(false)
    setWasViewingBeforeEdit(false)
  }

  function resetImportState() {
    setSelectedImportIds([])
    setImportPrices({})
    setImportSearch('')
    setImportFilter('all')
  }

  // ── Handlers: create item ────────────────────────────────────────────────────
  function handleCreateItem() {
    const category = mockCategories.find(c => c.id === newItemCategoryId)
    const subcategory = localCategories.find(c => c.id === newItemSubCategoryId)

    // Determine type: if multiple mapped items, it's effectively a bundle
    const finalType = mappedInventory.length > 1 ? 'bundle' : (mappedInventory.length === 1 ? 'linked' : 'independent')

    const newItem: CatalogueItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      category_id: newItemCategoryId,
      category_name: category?.name ?? '',
      subcategory_id: newItemSubCategoryId,
      type: finalType,
      inventory_item_id: mappedInventory.length === 1 ? mappedInventory[0].inventory_item_id : null,
      inventory_item_name: mappedInventory.length === 1 ? mockInventoryItems.find(i => i.id === mappedInventory[0].inventory_item_id)?.name || null : null,
      selling_price: Number(newItemSellingPrice) || 0,
      is_bundle: finalType === 'bundle',
      inventory_tracking: finalType !== 'independent',
      availability_status: newItemStatus,
      tags: newItemTags,
      notes: newItemNotes,
      created_at: new Date().toISOString(),
      taxes: taxes.filter(t => t.name.trim()),
      tax_inclusive: taxInclusive,
      mapped_inventory: mappedInventory.filter(m => m.inventory_item_id),
    }

    setItems(prev => [...prev, newItem])
    setShowCreateDrawer(false)
    setShowViewDrawer(true)
    // We don't reset yet because we want to see it in view mode
  }

  // ── Handlers: edit item ──────────────────────────────────────────────────────
  function openEditDrawer(item: CatalogueItem, fromView = false) {
    setEditingItemId(item.id)
    setNewItemName(item.name)
    setNewItemSellingPrice(item.selling_price)
    setNewItemCategoryId(item.category_id)
    setNewItemSubCategoryId(item.subcategory_id || '')
    setNewItemTags(item.tags)
    setNewItemNotes(item.notes)
    setNewItemStatus(item.availability_status as 'active' | 'inactive')
    setTaxes(item.taxes || [])
    setTaxInclusive(item.tax_inclusive !== undefined ? item.tax_inclusive : true)
    setMappedInventory((item.mapped_inventory || []).map(m => ({ ...m, selected_variants: m.selected_variants || [] })))
    setWasViewingBeforeEdit(fromView)
    setShowViewDrawer(false)
    setShowEditDrawer(true)
  }

  function openViewDrawer(item: CatalogueItem) {
    setEditingItemId(item.id)
    setNewItemName(item.name)
    setNewItemSellingPrice(item.selling_price)
    setNewItemCategoryId(item.category_id)
    setNewItemSubCategoryId(item.subcategory_id || '')
    setNewItemTags(item.tags)
    setNewItemNotes(item.notes)
    setNewItemStatus(item.availability_status as 'active' | 'inactive')
    setTaxes(item.taxes || [])
    setTaxInclusive(item.tax_inclusive !== undefined ? item.tax_inclusive : true)
    setMappedInventory((item.mapped_inventory || []).map(m => ({ ...m, selected_variants: m.selected_variants || [] })))
    setShowViewDrawer(true)
  }

  function handleUpdateItem() {
    if (!editingItemId) return

    const category = mockCategories.find(c => c.id === newItemCategoryId)
    const finalType = mappedInventory.length > 1 ? 'bundle' : (mappedInventory.length === 1 ? 'linked' : 'independent')

    setItems(prev =>
      prev.map(item => {
        if (item.id !== editingItemId) return item
        return {
          ...item,
          name: newItemName.trim(),
          category_id: newItemCategoryId,
          category_name: category?.name ?? '',
          subcategory_id: newItemSubCategoryId,
          type: finalType,
          inventory_item_id: mappedInventory.length === 1 ? mappedInventory[0].inventory_item_id : null,
          inventory_item_name: mappedInventory.length === 1 ? mockInventoryItems.find(i => i.id === mappedInventory[0].inventory_item_id)?.name || null : null,
          selling_price: Number(newItemSellingPrice) || 0,
          is_bundle: finalType === 'bundle',
          inventory_tracking: finalType !== 'independent',
          availability_status: newItemStatus,
          tags: newItemTags,
          notes: newItemNotes,
          taxes: taxes.filter(t => t.name.trim()),
          tax_inclusive: taxInclusive,
          mapped_inventory: mappedInventory.filter(m => m.inventory_item_id),
        }
      })
    )
    if (wasViewingBeforeEdit) {
      setShowEditDrawer(false)
      setShowViewDrawer(true)
    } else {
      setShowEditDrawer(false)
      resetCreateForm()
    }
  }

  // ── Handlers: import ─────────────────────────────────────────────────────────
  function handleImport() {
    const newItems: CatalogueItem[] = selectedInvItems.map((inv, idx) => ({
      id: `${Date.now()}${idx}${inv.id}`,
      name: inv.name,
      category_id: '',
      category_name: inv.category,
      type: 'linked' as const,
      inventory_item_id: inv.id,
      inventory_item_name: inv.name,
      selling_price: Number(importPrices[inv.id] || 0),
      is_bundle: false,
      inventory_tracking: true,
      availability_status: 'active' as const,
      tags: [],
      notes: '',
      created_at: new Date().toISOString(),
      mapped_inventory: [
        {
          id: `map-${Date.now()}-${inv.id}`,
          inventory_item_id: inv.id,
          quantity: 1,
          unit: inv.unit,
          selected_variants: inv.variants ? inv.variants.map(v => v.id) : []
        }
      ]
    }))
    setItems(prev => [...prev, ...newItems])
    setShowImportModal(false)
    resetImportState()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className={styles.headerRow}>
        <h1>Catalogue</h1>
        <div className={styles.headerActions}>
          <Link
            href="/dashboard/catalogue/offers"
            className="btn btn--ghost btn--sm"
            title="Offers"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <Tag size={16} />
          </Link>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowImportModal(true)}
            style={{ height: '32px' }}
          >
            Import from Stocks
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => {
              setShowCreateDrawer(true)
              setCreateStep(1)
            }}
            style={{ height: '32px' }}
          >
            <Plus size={18} /> Create Item
          </button>
        </div>
      </div>


      {/* Freemium Banner */}
      {items.length >= 25 && (
        <div className="upgrade-banner" style={{ marginBottom: 'var(--space-4)' }}>
          <p className="upgrade-banner__text">
            {items.length} of 30 catalogue items used on free plan.
          </p>
          <Link href="/dashboard/settings/billing" className="btn btn--primary btn--sm">
            Upgrade to Pro
          </Link>
        </div>
      )}

      {/* Filters Row */}
      <div className={styles.filtersRow}>
        <input
          className="form-input"
          placeholder="Search catalogue..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="linked">Linked</option>
          <option value="bundle">Bundle</option>
          <option value="independent">Service</option>
        </select>
        <select
          className="form-select"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {mockCategories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          className="form-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No items found</p>
            <p className="empty-state__desc">
              {search || categoryFilter || typeFilter || statusFilter
                ? 'Try adjusting your filters'
                : 'Add inventory items with a selling price, or create a bundle here'}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Selling Price</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr
                  key={item.id}
                  className={`${item.availability_status === 'archived' ? styles.archivedRow : ''} ${styles.clickableRow}`}
                  onClick={() => openViewDrawer(item)}
                >
                  {/* Item Name */}
                  <td>
                    <div className={styles.itemNameCell}>
                      <span>{item.name}</span>
                      {item.type === 'bundle' && item.bundle_components && (
                        <span className="text-tertiary text-xs">
                          {item.bundle_components.length} ingredients
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Category */}
                  <td>
                    <span className="badge badge--neutral">{item.category_name}</span>
                  </td>

                  {/* Selling Price */}
                  <td>{formatINR(item.selling_price)}</td>

                  {/* Tags */}
                  <td>
                    <div className={styles.tagCell}>
                      {item.tags.length === 0 ? (
                        <span className="text-tertiary text-xs">—</span>
                      ) : (
                        <>
                          {item.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="badge badge--neutral">
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 2 && (
                            <span className="text-tertiary text-xs">
                              +{item.tags.length - 2} more
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    {item.availability_status === 'active' && (
                      <span className="badge badge--success">Active</span>
                    )}
                    {item.availability_status === 'inactive' && (
                      <span className="badge badge--neutral">Inactive</span>
                    )}
                    {item.availability_status === 'archived' && (
                      <span className="badge badge--danger">Archived</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td>
                    <div className={styles.actions}>
                      <button
                        className="btn btn--ghost btn--sm"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDrawer(item)
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      {item.availability_status === 'archived' ? (
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Restore"
                          onClick={(e) => {
                            e.stopPropagation()
                            setItems(prev =>
                              prev.map(i =>
                                i.id === item.id
                                  ? { ...i, availability_status: 'active' }
                                  : i
                              )
                            )
                          }
                          }
                        >
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Archive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setItems(prev =>
                              prev.map(i =>
                                i.id === item.id
                                  ? { ...i, availability_status: 'archived' }
                                  : i
                              )
                            )
                          }
                          }
                        >
                          <Archive size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Import from Inventory Modal ── */}
      {showImportModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowImportModal(false)
            resetImportState()
          }}
        >
          <div
            className="modal"
            style={{ maxWidth: '600px', width: '100%', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="modal__title">Import from Stocks</h3>

            {/* Search + Filter row */}
            <div className={styles.importSearchRow}>
              <input
                className="form-input"
                placeholder="Search items..."
                value={importSearch}
                onChange={e => setImportSearch(e.target.value)}
                style={{ flex: 2 }}
              />
              <select
                className="form-select"
                value={importFilter}
                onChange={e => setImportFilter(e.target.value as typeof importFilter)}
                style={{ flex: 1 }}
              >
                <option value="all">All Items</option>
                <option value="not_imported">Not Imported</option>
                <option value="imported">Already Imported</option>
              </select>
            </div>

            {/* Select All */}
            <div className={styles.importRowSelectAll}>
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelectChecked}
                onChange={() => {
                  if (allSelectChecked) {
                    setSelectedImportIds(prev =>
                      prev.filter(id => !filteredImportItems.some(i => i.id === id))
                    )
                  } else {
                    const newIds = filteredImportItems.map(i => i.id)
                    setSelectedImportIds(prev => Array.from(new Set([...prev, ...newIds])))
                  }
                }}
              />
              <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                Select All
                {filteredImportItems.length !== mockInventoryItems.length && (
                  <span className="text-tertiary" style={{ fontWeight: 400 }}>
                    {' '}({filteredImportItems.length} shown)
                  </span>
                )}
              </span>
            </div>

            {/* Item list */}
            <div className={styles.importList}>
              {filteredImportItems.length === 0 ? (
                <p className="text-secondary text-sm" style={{ padding: 'var(--space-4) 0' }}>
                  No items match your search.
                </p>
              ) : (
                filteredImportItems.map(inv => {
                  const isChecked = selectedImportIds.includes(inv.id)
                  const alreadyImported = importedInventoryIds.has(inv.id)
                  return (
                    <div
                      key={inv.id}
                      className={`${styles.importRow} ${isChecked ? styles.selected : ''}`}
                      onClick={() =>
                        !alreadyImported && setSelectedImportIds(prev =>
                          prev.includes(inv.id)
                            ? prev.filter(id => id !== inv.id)
                            : [...prev, inv.id]
                        )
                      }
                      style={alreadyImported ? { cursor: 'default', opacity: 0.6 } : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={alreadyImported}
                        onChange={() => { }}
                      />
                      <div className={styles.importRowInfo}>
                        <span style={{ fontWeight: 500 }}>{inv.name}</span>
                        <span className="text-secondary text-xs">
                          #{inv.id} · {inv.category} · {inv.current_stock} {inv.unit}
                        </span>
                      </div>
                      {alreadyImported ? (
                        <span className="badge badge--neutral" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          Imported
                        </span>
                      ) : (
                        <div
                          className={styles.importPriceWrap}
                          onClick={e => {
                            e.stopPropagation()
                            if (!isChecked && !alreadyImported) {
                              setSelectedImportIds(prev => [...prev, inv.id])
                            }
                          }}
                        >
                          <div className={`input-prefix ${!isChecked ? styles.importPriceDisabled : ''}`}>
                            <span className="input-prefix__label">₹</span>
                            <input
                              className="input-prefix__input"
                              type="number"
                              min="0"
                              placeholder="Price"
                              disabled={!isChecked}
                              value={importPrices[inv.id] || ''}
                              onChange={e =>
                                setImportPrices(prev => ({ ...prev, [inv.id]: e.target.value }))
                              }
                            />
                          </div>
                          {isChecked && (
                            <span className={styles.importUnitLabel}>per {inv.unit}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="modal__actions">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setShowImportModal(false)
                  resetImportState()
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary btn--sm"
                disabled={selectedImportIds.length === 0}
                onClick={handleImport}
              >
                Import {selectedImportIds.length > 0 ? `${selectedImportIds.length} ` : ''}items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit / View Item Drawer ── */}
      {(showCreateDrawer || showEditDrawer || showViewDrawer) && (
        <div
          className="overlay"
          onClick={() => {
            setShowCreateDrawer(false)
            setShowEditDrawer(false)
            setShowViewDrawer(false)
            resetCreateForm()
          }}
        >
          <div
            className="drawer"
            style={{ width: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer__header">
              <h3 className="drawer__title">
                {showViewDrawer ? 'Catalogue Item Details' : showEditDrawer ? 'Edit Catalogue Item' : 'Create Catalogue Item'}
              </h3>
              <button
                className="drawer__close"
                onClick={() => {
                  setShowCreateDrawer(false)
                  setShowEditDrawer(false)
                  setShowViewDrawer(false)
                  resetCreateForm()
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={`${styles.drawerForm} ${showViewDrawer ? styles.viewOnly : ''}`}>
                {/* 1. Item/Service Name */}
                <div className="form-group">
                  <label className="form-label form-label--required">Item/Service Name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Mixed Dry Fruits 500g"
                    value={newItemName}
                    disabled={showViewDrawer}
                    onChange={e => setNewItemName(e.target.value)}
                  />
                </div>

                {/* 2. Selling Price / Service Charge */}
                <div className="form-group">
                  <label className="form-label form-label--required">Selling Price / Service Charge</label>
                  <div className="input-prefix">
                    <span className="input-prefix__label">₹</span>
                    <input
                      className="input-prefix__input"
                      type="number"
                      placeholder="0.00"
                      min="0"
                      value={newItemSellingPrice}
                      disabled={showViewDrawer}
                      onChange={e =>
                        setNewItemSellingPrice(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                {/* 3. Taxes (Inventory Style) */}
                <div className="form-group">
                  <div className={styles.fieldHeaderRow}>
                    <label className="form-label">Taxes <span className="text-tertiary font-normal">(Optional)</span></label>
                    {!showViewDrawer && (
                      <label className={styles.toggleLabel}>
                        <span className="text-sm text-secondary">
                          {taxInclusive ? 'Inclusive' : 'Exclusive'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          className={`toggle ${taxInclusive ? '' : 'toggle--off'}`}
                          onClick={() => setTaxInclusive(!taxInclusive)}
                        >
                          <span className="toggle__dot" />
                        </button>
                      </label>
                    )}
                  </div>

                  {taxes.length > 0 && (
                    <div className={styles.taxSection}>
                      {taxes.map((tax, i) => (
                        <div key={tax.id} className={styles.taxRow}>
                          <input
                            className="form-input"
                            placeholder="Tax name (e.g. GST)"
                            autoFocus={tax.id === lastAddedTaxId}
                            value={tax.name}
                            disabled={showViewDrawer}
                            onChange={e => {
                              const newTaxes = [...taxes]
                              newTaxes[i].name = e.target.value
                              setTaxes(newTaxes)
                            }}
                            style={{ flex: 1 }}
                          />
                          <div className={styles.taxPercentInput}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={tax.percentage || ''}
                              disabled={showViewDrawer}
                              onChange={e => {
                                const newTaxes = [...taxes]
                                newTaxes[i].percentage = Number(e.target.value)
                                setTaxes(newTaxes)
                              }}
                            />
                            <span className={styles.taxPercentSuffix}>%</span>
                          </div>
                          {!showViewDrawer && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => setTaxes(taxes.filter((_, j) => j !== i))}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!showViewDrawer && (
                    <button
                      type="button"
                      className={styles.addAttrBtn}
                      style={{ marginTop: taxes.length > 0 ? 'var(--space-2)' : undefined }}
                      onClick={() => {
                        const newId = `${Date.now()}-${Math.random()}`
                        setLastAddedTaxId(newId)
                        setTaxes([...taxes, { id: newId, name: '', percentage: 0 }])
                      }}
                    >
                      <Plus size={14} /> Add tax
                    </button>
                  )}
                  {showViewDrawer && taxes.length === 0 && (
                    <p className="text-tertiary text-sm italic">No taxes applied</p>
                  )}
                </div>

                {/* 4. Map with Inventory */}
                <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                  <div className={styles.sectionLabel} style={{ marginBottom: 'var(--space-3)' }}>Map with Stocks</div>

                  {mappedInventory.length > 0 && (
                    <div className={styles.mapList} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                      {mappedInventory.map((map, i) => {
                        const invItem = mockInventoryItems.find(it => it.id === map.inventory_item_id)
                        return (
                          <div key={map.id} className={styles.mapItemWrapper}>
                            <div className={styles.mapRow}>
                              <div className={styles.mapItemSearch}>
                                <div className={styles.searchContainer}>
                                  <button
                                    type="button"
                                    className={`form-select ${styles.searchableSelectTrigger}`}
                                    disabled={showViewDrawer}
                                    onClick={() => {
                                      if (activeSearchId === map.id) {
                                        setActiveSearchId(null)
                                      } else {
                                        setActiveSearchId(map.id)
                                        setInventorySearch('')
                                      }
                                    }}
                                  >
                                    <span className={invItem ? '' : 'text-tertiary'}>
                                      {invItem?.name || 'Select inventory...'}
                                    </span>
                                    <ChevronDown size={14} className={styles.searchableSelectChevron} />
                                  </button>

                                  {activeSearchId === map.id && !showViewDrawer && (
                                    <div className={styles.searchDropdown}>
                                      <div className={styles.searchableSelectSearch}>
                                        <Search size={14} />
                                        <input
                                          autoFocus
                                          placeholder="Search..."
                                          value={inventorySearch}
                                          onChange={e => setInventorySearch(e.target.value)}
                                        />
                                      </div>
                                      <div className={styles.searchableSelectOptions}>
                                        {mockInventoryItems
                                          .filter(it =>
                                            it.name.toLowerCase().includes(inventorySearch.toLowerCase()) &&
                                            !mappedInventory.some(m => m.inventory_item_id === it.id && m.id !== map.id)
                                          )
                                          .map(it => (
                                            <div
                                              key={it.id}
                                              className={styles.searchItem}
                                              onClick={() => {
                                                const newMap = [...mappedInventory]
                                                newMap[i].inventory_item_id = it.id
                                                newMap[i].unit = it.unit
                                                newMap[i].selected_variants = it.variants ? it.variants.map(v => v.id) : []
                                                setMappedInventory(newMap)
                                                setActiveSearchId(null)
                                              }}
                                            >
                                              <div style={{ fontWeight: 500 }}>{it.name}</div>
                                              <div className="text-secondary text-xs">Stock: {it.current_stock} {it.unit}</div>
                                            </div>
                                          ))}
                                        {mockInventoryItems.filter(it =>
                                          it.name.toLowerCase().includes(inventorySearch.toLowerCase()) &&
                                          !mappedInventory.some(m => m.inventory_item_id === it.id && m.id !== map.id)
                                        ).length === 0 && (
                                            <div className={styles.searchableSelectNoResult}>No items found</div>
                                          )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input
                                  className="form-input"
                                  type="number"
                                  min="0"
                                  placeholder="Qty"
                                  value={map.quantity}
                                  disabled={showViewDrawer}
                                  onChange={e => {
                                    const newMap = [...mappedInventory]
                                    newMap[i].quantity = e.target.value === '' ? '' : Number(e.target.value)
                                    setMappedInventory(newMap)
                                  }}
                                  style={{ width: '80px' }}
                                />
                              </div>
                              <select
                                className="form-select"
                                value={map.unit}
                                disabled={showViewDrawer || !map.inventory_item_id}
                                onChange={e => {
                                  const newMap = [...mappedInventory]
                                  newMap[i].unit = e.target.value
                                  setMappedInventory(newMap)
                                }}
                                style={{ width: '120px' }}
                              >
                                {!map.inventory_item_id ? (
                                  <option value="">Unit</option>
                                ) : (
                                  <>
                                    <option value={invItem?.unit}>{invItem?.unit}</option>
                                    {/* In view mode, we don't need to show all conversion options if not selected */}
                                    {(() => {
                                      if (!invItem || showViewDrawer) return null
                                      const baseUnit = mockUnits.find(u => u.name === invItem.unit)
                                      if (!baseUnit) return null
                                      const conversions = mockUnitConversions.filter(c =>
                                        c.from_unit_id === baseUnit.id || c.to_unit_id === baseUnit.id
                                      )
                                      return conversions.map(c => {
                                        const otherUnitId = c.from_unit_id === baseUnit.id ? c.to_unit_id : c.from_unit_id
                                        const otherUnit = mockUnits.find(u => u.id === otherUnitId)
                                        if (!otherUnit) return null
                                        return (
                                          <option key={otherUnit.id} value={otherUnit.name}>
                                            {otherUnit.name}
                                          </option>
                                        )
                                      })
                                    })()}
                                  </>
                                )}
                              </select>
                              {!showViewDrawer && (
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={() => setMappedInventory(mappedInventory.filter((_, j) => j !== i))}
                                  style={{ border: 'none', color: 'var(--color-text-tertiary)' }}
                                >
                                  <X size={18} />
                                </button>
                              )}
                            </div>

                            {/* Variants sub-section */}
                            {invItem && invItem.variants && invItem.variants.length > 0 && (
                              <div className={styles.variantSection}>
                                <div className={styles.variantLabel}>Available Variants</div>
                                <div className={styles.variantChipsRow}>
                                  {invItem.variants.map(v => {
                                    const isSelected = map.selected_variants?.includes(v.id)
                                    const variantName = v.attributes.join('-')
                                    return (
                                      <div
                                        key={v.id}
                                        className={`${styles.variantChip} ${isSelected ? styles.variantChipSelected : ''} ${showViewDrawer ? styles.variantChipDisabled : ''}`}
                                        onClick={() => {
                                          if (showViewDrawer) return
                                          const newMap = [...mappedInventory]
                                          const currentSelected = newMap[i].selected_variants || []
                                          if (currentSelected.includes(v.id)) {
                                            newMap[i].selected_variants = currentSelected.filter(id => id !== v.id)
                                          } else {
                                            newMap[i].selected_variants = [...currentSelected, v.id]
                                          }
                                          setMappedInventory(newMap)
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={showViewDrawer}
                                          onChange={() => { }} // Handled by div onClick
                                        />
                                        <span className={styles.variantChipText}>{variantName}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!showViewDrawer && (
                    <button
                      type="button"
                      className={styles.addMapBtn}
                      onClick={() => {
                        const newId = `${Date.now()}-${Math.random()}`
                        setLastAddedMapId(newId)
                        setMappedInventory([...mappedInventory, { id: newId, inventory_item_id: '', quantity: '', unit: '' }])
                      }}
                    >
                      <Plus size={14} /> Add item from inventory
                    </button>
                  )}
                  {showViewDrawer && mappedInventory.length === 0 && (
                    <p className="text-tertiary text-sm italic">Not mapped to inventory</p>
                  )}
                </div>

                {/* Categorization (Category / Subcategory) */}
                <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                  <div className={styles.sectionLabel} style={{ marginBottom: 'var(--space-3)' }}>Categorization</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div className="form-group">
                      <label className="form-label form-label--required">Category</label>
                      <SearchableSelect
                        value={newItemCategoryId}
                        disabled={showViewDrawer}
                        placeholder="Select Category"
                        options={localCategories
                          .filter(c => !c.parent_id)
                          .map(c => ({ value: c.id, label: c.name }))}
                        onChange={val => {
                          setNewItemCategoryId(val)
                          setNewItemSubCategoryId('')
                        }}
                        onCreate={name => {
                          const newId = `new-cat-${Date.now()}`
                          const newCategory: Category = {
                            id: newId,
                            user_id: 'mock-user-1',
                            name,
                            parent_id: null,
                            is_archived: false,
                            sort_order: localCategories.length,
                            created_at: new Date().toISOString()
                          }
                          setLocalCategories(prev => [...prev, newCategory])
                          setNewItemCategoryId(newId)
                          setNewItemSubCategoryId('')
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Subcategory</label>
                      <SearchableSelect
                        value={newItemSubCategoryId}
                        disabled={showViewDrawer || !newItemCategoryId}
                        placeholder="Select Subcategory"
                        options={localCategories
                          .filter(c => c.parent_id === newItemCategoryId)
                          .map(c => ({ value: c.id, label: c.name }))}
                        onChange={val => setNewItemSubCategoryId(val)}
                        onCreate={name => {
                          const newId = `new-sub-${Date.now()}`
                          const newSub: Category = {
                            id: newId,
                            user_id: 'mock-user-1',
                            name,
                            parent_id: newItemCategoryId,
                            is_archived: false,
                            sort_order: localCategories.length,
                            created_at: new Date().toISOString()
                          }
                          setLocalCategories(prev => [...prev, newSub])
                          setNewItemSubCategoryId(newId)
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  {newItemTags.length > 0 && (
                    <div className={styles.tagChips} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      {newItemTags.map(tag => (
                        <span key={tag} className={styles.tagChip}>
                          {tag}
                          {!showViewDrawer && (
                            <button
                              type="button"
                              className={styles.tagChipRemove}
                              onClick={() => removeTag(tag)}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {!showViewDrawer && (
                    <div className={styles.tagInputWrap} style={{ position: 'relative' }}>
                      <Search
                        size={14}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}
                      />
                      <input
                        className="form-input"
                        style={{ paddingLeft: '34px' }}
                        type="text"
                        placeholder="Add or create tags..."
                        value={newItemTagInput}
                        onChange={e => {
                          setNewItemTagInput(e.target.value)
                          setShowTagSuggestions(true)
                        }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                        onKeyDown={handleTagKeyDown}
                      />
                      {showTagSuggestions && (
                        <div className={styles.tagSuggestions} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-dropdown)', marginTop: '4px', overflow: 'hidden' }}>
                          {tagSuggestions.length > 0 ? (
                            tagSuggestions.map(t => (
                              <div
                                key={t.id}
                                className={styles.tagSuggestionItem}
                                style={{ padding: '8px 12px', cursor: 'pointer' }}
                                onMouseDown={() => addTag(t.name)}
                              >
                                {t.name}
                              </div>
                            ))
                          ) : newItemTagInput.trim() ? (
                            <div
                              className={styles.tagSuggestionItem}
                              style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--color-brand-blue)', fontWeight: 500 }}
                              onMouseDown={() => addTag(newItemTagInput)}
                            >
                              + Create "{newItemTagInput}"
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                  {showViewDrawer && newItemTags.length === 0 && (
                    <p className="text-tertiary text-sm italic">No tags</p>
                  )}
                </div>
              </div>
            </div>

            <div className={`drawer__footer ${styles.drawerFooter}`}>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  setShowCreateDrawer(false)
                  setShowEditDrawer(false)
                  setShowViewDrawer(false)
                  resetCreateForm()
                }}
              >
                {showViewDrawer ? 'Close' : 'Cancel'}
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  if (showViewDrawer) {
                    const item = items.find(i => i.id === editingItemId)
                    if (item) {
                      openEditDrawer(item, true)
                    }
                  } else if (showEditDrawer) {
                    handleUpdateItem()
                  } else {
                    handleCreateItem()
                  }
                }}
                disabled={!showViewDrawer && (!newItemName.trim() || newItemSellingPrice === '')}
              >
                {showViewDrawer ? 'Edit Item' : showEditDrawer ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
