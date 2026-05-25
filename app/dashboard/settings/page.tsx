'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Archive, ArchiveRestore, Lock, FolderTree, Ruler, ArrowRightLeft, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { mockCategories as initialCategories, mockUnits as initialUnits, mockUnitConversions as initialConversions, mockInventoryItems, mockCatalogueItems } from '@/lib/mock-data'
import type { Category, Unit, UnitConversion } from '@/types/database'
import styles from './settings.module.css'

type SettingsTab = 'profile' | 'configuration' | 'billing'
type configSubTab = 'categories' | 'units'

// ─── Conversion graph helpers ────────────────────────────────

function findConversionFactor(
  sourceId: string,
  targetId: string,
  conversions: UnitConversion[]
): number | null {
  if (sourceId === targetId) return 1

  const graph = new Map<string, { unitId: string; factor: number }[]>()
  for (const conv of conversions) {
    if (!graph.has(conv.from_unit_id)) graph.set(conv.from_unit_id, [])
    if (!graph.has(conv.to_unit_id)) graph.set(conv.to_unit_id, [])
    graph.get(conv.from_unit_id)!.push({ unitId: conv.to_unit_id, factor: conv.factor })
    graph.get(conv.to_unit_id)!.push({ unitId: conv.from_unit_id, factor: 1 / conv.factor })
  }

  const visited = new Set<string>([sourceId])
  const queue: { unitId: string; acc: number }[] = [{ unitId: sourceId, acc: 1 }]

  while (queue.length > 0) {
    const { unitId, acc } = queue.shift()!
    for (const edge of graph.get(unitId) || []) {
      if (edge.unitId === targetId) return acc * edge.factor
      if (!visited.has(edge.unitId)) {
        visited.add(edge.unitId)
        queue.push({ unitId: edge.unitId, acc: acc * edge.factor })
      }
    }
  }
  return null
}

// ─── ID generator ────────────────────────────────────────────

let idCounter = 100
function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`
}

// ─── Component ───────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('configuration')
  const [activeConfigSubTab, setActiveConfigSubTab] = useState<configSubTab>('categories')

  // ─── Categories state ────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [categorySearch, setCategorySearch] = useState('')
  const [addingCategoryParentId, setAddingCategoryParentId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')

  // ─── Units state ─────────────────────────────────────────
  const [units, setUnits] = useState<Unit[]>(initialUnits)
  const [addingUnit, setAddingUnit] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitDecimal, setNewUnitDecimal] = useState(false)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [editingUnitName, setEditingUnitName] = useState('')
  const [unitError, setUnitError] = useState('')

  // ─── Conversions state ───────────────────────────────────
  const [conversions, setConversions] = useState<UnitConversion[]>(initialConversions)
  const [addingConversion, setAddingConversion] = useState(false)
  const [newConvFromUnit, setNewConvFromUnit] = useState('')
  const [newConvToUnit, setNewConvToUnit] = useState('')
  const [newConvFactor, setNewConvFactor] = useState('')
  const [conversionError, setConversionError] = useState('')

  // ─── Delete/archive modal ────────────────────────────────
  const [modal, setModal] = useState<{
    type: 'delete-category' | 'archive-category' | 'delete-unit'
    id: string
    name: string
    childCount?: number
    itemCount?: number
  } | null>(null)

  // ─── Refs for auto-focus ─────────────────────────────────
  const addCategoryRef = useRef<HTMLInputElement>(null)
  const editCategoryRef = useRef<HTMLInputElement>(null)
  const addUnitRef = useRef<HTMLInputElement>(null)
  const editUnitRef = useRef<HTMLInputElement>(null)
  const addConvFactorRef = useRef<HTMLInputElement>(null)

  useEffect(() => { addCategoryRef.current?.focus() }, [addingCategoryParentId])
  useEffect(() => { editCategoryRef.current?.focus() }, [editingCategoryId])
  useEffect(() => { addUnitRef.current?.focus() }, [addingUnit])
  useEffect(() => { editUnitRef.current?.focus() }, [editingUnitId])
  useEffect(() => { if (addingConversion) addConvFactorRef.current?.focus() }, [addingConversion])

  // ─── Cancel all inline operations ────────────────────────
  function cancelAll() {
    setAddingCategoryParentId(null)
    setNewCategoryName('')
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setCategoryError('')
    setAddingUnit(false)
    setNewUnitName('')
    setNewUnitDecimal(false)
    setEditingUnitId(null)
    setEditingUnitName('')
    setUnitError('')
    setAddingConversion(false)
    setNewConvFromUnit('')
    setNewConvToUnit('')
    setNewConvFactor('')
    setConversionError('')
  }

  // ─── Collapse helpers ────────────────────────────────────

  function toggleCategoryCollapse(categoryId: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  function expandCategory(categoryId: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      next.delete(categoryId)
      return next
    })
  }

  // ─── Search filter helpers ───────────────────────────────

  function getFilteredRootCategories() {
    const q = categorySearch.trim().toLowerCase()
    const roots = categories.filter(c => c.parent_id === null).sort((a, b) => a.sort_order - b.sort_order)
    if (!q) return roots
    return roots.filter(parent => {
      if (addingCategoryParentId === parent.id) return true
      if (parent.name.toLowerCase().includes(q)) return true
      return categories.filter(c => c.parent_id === parent.id).some(sub => sub.name.toLowerCase().includes(q))
    })
  }

  function getFilteredSubcategories(parentId: string) {
    const q = categorySearch.trim().toLowerCase()
    const subs = categories.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)
    if (!q || addingCategoryParentId === parentId) return subs
    const parentMatches = categories.find(c => c.id === parentId)?.name.toLowerCase().includes(q) ?? false
    if (parentMatches) return subs
    return subs.filter(sub => sub.name.toLowerCase().includes(q))
  }

  // ─── Category helpers ────────────────────────────────────

  function getRootCategories() {
    return categories.filter(c => c.parent_id === null).sort((a, b) => a.sort_order - b.sort_order)
  }

  function getSubcategories(parentId: string) {
    return categories.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)
  }

  function getCategoryItemCount(categoryId: string): number {
    const cat = categories.find(c => c.id === categoryId)
    if (!cat) return 0
    const invCount = mockInventoryItems.filter(i => i.category === cat.name).length
    const catCount = mockCatalogueItems.filter(i => i.category_name === cat.name).length
    return invCount + catCount
  }

  function isCategoryInUse(categoryId: string): boolean {
    if (getCategoryItemCount(categoryId) > 0) return true
    const children = getSubcategories(categoryId)
    return children.some(child => getCategoryItemCount(child.id) > 0)
  }

  function getTotalItemCount(categoryId: string): number {
    let count = getCategoryItemCount(categoryId)
    for (const child of getSubcategories(categoryId)) {
      count += getCategoryItemCount(child.id)
    }
    return count
  }

  function validateCategoryName(name: string, parentId: string | null, excludeId?: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return 'Name cannot be empty'
    if (trimmed.length > 50) return 'Name must be under 50 characters'
    const duplicate = categories.find(c =>
      c.parent_id === parentId &&
      c.name.toLowerCase() === trimmed.toLowerCase() &&
      c.id !== excludeId &&
      !c.is_archived
    )
    if (duplicate) {
      return parentId === null
        ? 'A category with this name already exists'
        : 'A subcategory with this name already exists under this parent'
    }
    return null
  }

  function handleSaveNewCategory() {
    const parentId = addingCategoryParentId === 'ROOT' ? null : addingCategoryParentId
    const error = validateCategoryName(newCategoryName, parentId)
    if (error) { setCategoryError(error); return }
    const siblings = parentId === null ? getRootCategories() : getSubcategories(parentId)
    const newCat: Category = {
      id: nextId('cat'),
      user_id: 'mock-user-1',
      name: newCategoryName.trim(),
      parent_id: parentId,
      is_archived: false,
      sort_order: siblings.length,
      created_at: new Date().toISOString(),
    }
    setCategories(prev => [...prev, newCat])
    setAddingCategoryParentId(null)
    setNewCategoryName('')
    setCategoryError('')
  }

  function handleStartEditCategory(cat: Category) {
    if (cat.is_archived) return
    cancelAll()
    setEditingCategoryId(cat.id)
    setEditingCategoryName(cat.name)
  }

  function handleSaveEditCategory() {
    const cat = categories.find(c => c.id === editingCategoryId)
    if (!cat) return
    const error = validateCategoryName(editingCategoryName, cat.parent_id, cat.id)
    if (error) { setCategoryError(error); return }
    setCategories(prev => prev.map(c =>
      c.id === editingCategoryId ? { ...c, name: editingCategoryName.trim() } : c
    ))
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setCategoryError('')
  }

  function handleDeleteCategory(cat: Category) {
    const childCount = getSubcategories(cat.id).length
    const totalItems = getTotalItemCount(cat.id)
    if (totalItems > 0) {
      setModal({ type: 'archive-category', id: cat.id, name: cat.name, childCount, itemCount: totalItems })
    } else {
      setModal({ type: 'delete-category', id: cat.id, name: cat.name, childCount })
    }
  }

  function confirmDeleteCategory() {
    if (!modal || modal.type !== 'delete-category') return
    setCategories(prev => prev.filter(c => c.id !== modal.id && c.parent_id !== modal.id))
    setModal(null)
  }

  function handleArchiveCategory(categoryId: string) {
    const childIds = getSubcategories(categoryId).map(c => c.id)
    setCategories(prev => prev.map(c =>
      c.id === categoryId || childIds.includes(c.id)
        ? { ...c, is_archived: true }
        : c
    ))
    setModal(null)
  }

  function handleRestoreCategory(categoryId: string) {
    setCategories(prev => {
      const parentIdsToRestore = new Set([categoryId])
      const children = getSubcategories(categoryId)
      children.forEach(child => parentIdsToRestore.add(child.id))
      const cat = prev.find(c => c.id === categoryId)
      if (cat?.parent_id) parentIdsToRestore.add(cat.parent_id)
      return prev.map(c =>
        parentIdsToRestore.has(c.id) ? { ...c, is_archived: false } : c
      )
    })
  }

  // ─── Unit helpers ────────────────────────────────────────

  function isUnitLocked(unit: Unit): boolean {
    return mockInventoryItems.some(i => i.unit === unit.name)
  }

  function validateUnitName(name: string, excludeId?: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return 'Name cannot be empty'
    if (trimmed.length > 30) return 'Name must be under 30 characters'
    const duplicate = units.find(u =>
      u.name.toLowerCase() === trimmed.toLowerCase() && u.id !== excludeId
    )
    if (duplicate) return 'A unit with this name already exists'
    return null
  }

  function handleSaveNewUnit() {
    const error = validateUnitName(newUnitName)
    if (error) { setUnitError(error); return }
    const newUnit: Unit = {
      id: nextId('unit'),
      user_id: 'mock-user-1',
      name: newUnitName.trim(),
      allow_decimal: newUnitDecimal,
      is_locked: false,
      created_at: new Date().toISOString(),
    }
    setUnits(prev => [...prev, newUnit])
    setAddingUnit(false)
    setNewUnitName('')
    setNewUnitDecimal(false)
    setUnitError('')
  }

  function handleStartEditUnit(unit: Unit) {
    if (isUnitLocked(unit)) return
    cancelAll()
    setEditingUnitId(unit.id)
    setEditingUnitName(unit.name)
  }

  function handleSaveEditUnit() {
    const error = validateUnitName(editingUnitName, editingUnitId!)
    if (error) { setUnitError(error); return }
    setUnits(prev => prev.map(u =>
      u.id === editingUnitId ? { ...u, name: editingUnitName.trim() } : u
    ))
    setEditingUnitId(null)
    setEditingUnitName('')
    setUnitError('')
  }

  function handleToggleDecimal(unitId: string) {
    const unit = units.find(u => u.id === unitId)
    if (!unit || isUnitLocked(unit)) return
    setUnits(prev => prev.map(u =>
      u.id === unitId ? { ...u, allow_decimal: !u.allow_decimal } : u
    ))
  }

  function handleDeleteUnit(unit: Unit) {
    if (isUnitLocked(unit)) return
    setModal({ type: 'delete-unit', id: unit.id, name: unit.name })
  }

  function confirmDeleteUnit() {
    if (!modal || modal.type !== 'delete-unit') return
    setConversions(prev => prev.filter(c =>
      c.from_unit_id !== modal.id && c.to_unit_id !== modal.id
    ))
    setUnits(prev => prev.filter(u => u.id !== modal.id))
    setModal(null)
  }

  // ─── Conversion helpers ──────────────────────────────────

  function validateConversion(fromId: string, toId: string, factor: string): string | null {
    if (!fromId || !toId) return 'Select both units'
    if (fromId === toId) return 'Cannot convert a unit to itself'
    const num = Number(factor)
    if (!factor || isNaN(num) || num <= 0) return 'Factor must be a positive number'
    const existsDirect = conversions.find(c =>
      (c.from_unit_id === fromId && c.to_unit_id === toId) ||
      (c.from_unit_id === toId && c.to_unit_id === fromId)
    )
    if (existsDirect) return 'A direct conversion between these units already exists'
    if (findConversionFactor(fromId, toId, conversions) !== null) {
      return 'A conversion path already exists between these units'
    }
    return null
  }

  function handleSaveNewConversion() {
    const error = validateConversion(newConvFromUnit, newConvToUnit, newConvFactor)
    if (error) { setConversionError(error); return }
    const newConv: UnitConversion = {
      id: nextId('conv'),
      user_id: 'mock-user-1',
      from_unit_id: newConvFromUnit,
      to_unit_id: newConvToUnit,
      factor: Number(newConvFactor),
      created_at: new Date().toISOString(),
    }
    setConversions(prev => [...prev, newConv])
    setAddingConversion(false)
    setNewConvFromUnit('')
    setNewConvToUnit('')
    setNewConvFactor('')
    setConversionError('')
  }

  function handleDeleteConversion(convId: string) {
    setConversions(prev => prev.filter(c => c.id !== convId))
  }

  function getUnitName(unitId: string): string {
    return units.find(u => u.id === unitId)?.name || '?'
  }

  // ─── Keyboard handler ───────────────────────────────────

  function handleKey(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, saveHandler: () => void) {
    if (e.key === 'Enter') { e.preventDefault(); saveHandler() }
    if (e.key === 'Escape') { e.preventDefault(); cancelAll() }
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>

      {/* Tab Bar */}
      <div className={styles.tabBar}>
        {(['profile', 'configuration', 'billing'] as SettingsTab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tabItem} ${activeTab === tab ? styles.tabItemActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className={styles.stubContent}>Business profile settings coming soon.</div>
      )}
      {activeTab === 'billing' && (
        <div className={styles.stubContent}>Subscription & billing settings coming soon.</div>
      )}

      {/* ─── Configuration Tab ─────────────────────────────────── */}
      {activeTab === 'configuration' && (
        <div className={styles.configContainer}>
          {/* Segmented sub-tabs */}
          <div className={styles.subTabBar}>
            {(['categories', 'units'] as configSubTab[]).map(sub => (
              <button
                key={sub}
                className={`${styles.subTabItem} ${activeConfigSubTab === sub ? styles.subTabItemActive : ''}`}
                onClick={() => setActiveConfigSubTab(sub)}
              >
                {sub.charAt(0).toUpperCase() + sub.slice(1)}
              </button>
            ))}
          </div>

          {/* ─── Categories Sub-tab ───────────────────────────── */}
          {activeConfigSubTab === 'categories' && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderInfo}>
                  <div className={styles.sectionIcon}>
                    <FolderTree size={18} />
                  </div>
                  <div>
                    <div className={styles.sectionTitle}>Categories</div>
                    <div className={styles.sectionDesc}>Organize inventory and catalogue items into groups.</div>
                  </div>
                </div>
                <div className={styles.sectionHeaderRight}>
                  <div className={styles.categorySearchWrapper}>
                    <span className={styles.categorySearchIcon}><Search size={15} /></span>
                    <input
                      className={styles.categorySearchInput}
                      placeholder="Search categories..."
                      value={categorySearch}
                      onChange={e => setCategorySearch(e.target.value)}
                    />
                    {categorySearch && (
                      <button className={styles.categorySearchClear} onClick={() => setCategorySearch('')} title="Clear">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {!addingCategoryParentId && (
                    <button
                      className="btn btn--primary"
                      onClick={() => { cancelAll(); setAddingCategoryParentId('ROOT') }}
                    >
                      <Plus size={15} /> Add Category
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.categoryList}>
                {/* Inline add root category */}
                {addingCategoryParentId === 'ROOT' && (
                  <div className={styles.rootAddWrapper}>
                    <div className={styles.inlineInputRow}>
                      <input
                        ref={addCategoryRef}
                        className={`form-input ${styles.inlineInput}`}
                        placeholder="Enter category name..."
                        value={newCategoryName}
                        onChange={e => { setNewCategoryName(e.target.value); setCategoryError('') }}
                        onKeyDown={e => handleKey(e, handleSaveNewCategory)}
                        maxLength={50}
                      />
                      <button className="btn btn--primary btn--sm" onClick={handleSaveNewCategory}>Save</button>
                      <button className="btn btn--ghost btn--sm" onClick={cancelAll}>Cancel</button>
                    </div>
                    {categoryError && <div className={styles.errorMsg}>{categoryError}</div>}
                  </div>
                )}

                {getFilteredRootCategories().map(parent => {
                  const subs = getSubcategories(parent.id)
                  const hasSubs = subs.length > 0
                  const isCollapsed = collapsedCategories.has(parent.id) && !categorySearch.trim()
                  const isAddingUnder = addingCategoryParentId === parent.id
                  const displaySubs = getFilteredSubcategories(parent.id)
                  const showRail = !isCollapsed && (hasSubs || isAddingUnder)

                  return (
                    <div key={parent.id} className={styles.categoryGroup}>
                      {/* Parent row */}
                      <div className={`${styles.categoryParentRow} ${parent.is_archived ? styles.categoryRowArchived : ''}`}>
                        {/* Collapse chevron — visible space reserved always to keep alignment */}
                        <button
                          className={styles.collapseBtn}
                          onClick={() => toggleCategoryCollapse(parent.id)}
                          tabIndex={hasSubs ? 0 : -1}
                          style={{ visibility: hasSubs ? 'visible' : 'hidden' }}
                          title={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {editingCategoryId === parent.id ? (
                          <input
                            ref={editCategoryRef}
                            className={`form-input ${styles.inlineInput}`}
                            value={editingCategoryName}
                            onChange={e => { setEditingCategoryName(e.target.value); setCategoryError('') }}
                            onKeyDown={e => handleKey(e, handleSaveEditCategory)}
                            onBlur={handleSaveEditCategory}
                            maxLength={50}
                          />
                        ) : (
                          <span
                            className={`${styles.categoryName} ${parent.is_archived ? styles.categoryNameArchived : ''}`}
                            onClick={() => handleStartEditCategory(parent)}
                            title={parent.name}
                          >
                            {parent.name}
                          </span>
                        )}

                        {/* Sub-count pill when collapsed */}
                        {isCollapsed && hasSubs && (
                          <span className={styles.subCountBadge}>
                            {subs.length} sub{subs.length !== 1 ? 's' : ''}
                          </span>
                        )}

                        <span className={styles.itemCount}>
                          {getCategoryItemCount(parent.id)} item{getCategoryItemCount(parent.id) !== 1 ? 's' : ''}
                        </span>

                        <div className={styles.categoryActions}>
                          {!parent.is_archived && (
                            <>
                              <button
                                className="btn btn--ghost btn--sm"
                                title="Add Subcategory"
                                onClick={() => {
                                  cancelAll()
                                  expandCategory(parent.id)
                                  setAddingCategoryParentId(parent.id)
                                }}
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                className="btn btn--ghost btn--sm"
                                title="Archive"
                                onClick={() => {
                                  const childCount = getSubcategories(parent.id).length
                                  setModal({ type: 'archive-category', id: parent.id, name: parent.name, childCount })
                                }}
                              >
                                <Archive size={14} />
                              </button>
                            </>
                          )}
                          {parent.is_archived && (
                            <button
                              className="btn btn--ghost btn--sm"
                              title="Restore"
                              onClick={() => handleRestoreCategory(parent.id)}
                            >
                              <ArchiveRestore size={14} />
                            </button>
                          )}
                          <button
                            className="btn btn--ghost btn--sm"
                            title={isCategoryInUse(parent.id) ? 'In use — archive instead' : 'Delete'}
                            onClick={() => handleDeleteCategory(parent)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Subcategory rail */}
                      {showRail && (
                        <div className={styles.subcategoryRail}>
                          {/* Inline add subcategory form */}
                          {isAddingUnder && (
                            <>
                              <div className={styles.subAddRow}>
                                <input
                                  ref={addCategoryRef}
                                  className={`form-input ${styles.inlineInput}`}
                                  placeholder="Subcategory name"
                                  value={newCategoryName}
                                  onChange={e => { setNewCategoryName(e.target.value); setCategoryError('') }}
                                  onKeyDown={e => handleKey(e, handleSaveNewCategory)}
                                  maxLength={50}
                                />
                                <button className="btn btn--primary btn--sm" onClick={handleSaveNewCategory}>Save</button>
                                <button className="btn btn--ghost btn--sm" onClick={cancelAll}>Cancel</button>
                              </div>
                              {categoryError && <div className={styles.errorMsgRail}>{categoryError}</div>}
                            </>
                          )}

                          {/* Subcategory rows */}
                          {displaySubs.map(sub => (
                            <div
                              key={sub.id}
                              className={`${styles.categorySubRow} ${sub.is_archived ? styles.categoryRowArchived : ''}`}
                            >
                              {editingCategoryId === sub.id ? (
                                <input
                                  ref={editCategoryRef}
                                  className={`form-input ${styles.inlineInput}`}
                                  value={editingCategoryName}
                                  onChange={e => { setEditingCategoryName(e.target.value); setCategoryError('') }}
                                  onKeyDown={e => handleKey(e, handleSaveEditCategory)}
                                  onBlur={handleSaveEditCategory}
                                  maxLength={50}
                                />
                              ) : (
                                <span
                                  className={`${styles.categoryName} ${sub.is_archived ? styles.categoryNameArchived : ''}`}
                                  onClick={() => handleStartEditCategory(sub)}
                                  title={sub.name}
                                >
                                  {sub.name}
                                </span>
                              )}

                              <span className={styles.itemCount}>
                                {getCategoryItemCount(sub.id)} item{getCategoryItemCount(sub.id) !== 1 ? 's' : ''}
                              </span>

                              <div className={styles.categoryActions}>
                                {!sub.is_archived && (
                                  <button
                                    className="btn btn--ghost btn--sm"
                                    title="Archive"
                                    onClick={() => setModal({ type: 'archive-category', id: sub.id, name: sub.name, childCount: 0 })}
                                  >
                                    <Archive size={14} />
                                  </button>
                                )}
                                {sub.is_archived && (
                                  <button
                                    className="btn btn--ghost btn--sm"
                                    title="Restore"
                                    onClick={() => handleRestoreCategory(sub.id)}
                                  >
                                    <ArchiveRestore size={14} />
                                  </button>
                                )}
                                <button
                                  className="btn btn--ghost btn--sm"
                                  title={isCategoryInUse(sub.id) ? 'In use — archive instead' : 'Delete'}
                                  onClick={() => handleDeleteCategory(sub)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Edit error inside rail */}
                          {editingCategoryId && categoryError &&
                            subs.some(s => s.id === editingCategoryId) && (
                            <div className={styles.errorMsgRail}>{categoryError}</div>
                          )}
                        </div>
                      )}

                      {/* Edit error for parent */}
                      {editingCategoryId === parent.id && categoryError && (
                        <div className={styles.errorMsg}>{categoryError}</div>
                      )}
                    </div>
                  )
                })}

                {getFilteredRootCategories().length === 0 && !addingCategoryParentId && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>
                      {categorySearch ? <Search size={36} /> : <FolderTree size={40} />}
                    </div>
                    {categorySearch
                      ? <p>No categories match &quot;{categorySearch}&quot;</p>
                      : <p>No categories yet.</p>
                    }
                    {!categorySearch && (
                      <button
                        className="btn btn--primary btn--sm"
                        onClick={() => { cancelAll(); setAddingCategoryParentId('ROOT') }}
                        style={{ marginTop: 'var(--space-3)' }}
                      >
                        <Plus size={14} /> Add your first category
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Units Sub-tab ────────────────────────────────── */}
          {activeConfigSubTab === 'units' && (
            <>
              {/* Units Card */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionHeaderInfo}>
                    <div className={styles.sectionIcon}>
                      <Ruler size={18} />
                    </div>
                    <div>
                      <div className={styles.sectionTitle}>Measurement Units</div>
                      <div className={styles.sectionDesc}>Define units used to track inventory quantities.</div>
                    </div>
                  </div>
                  <button
                    className="btn btn--primary"
                    onClick={() => { cancelAll(); setAddingUnit(true) }}
                  >
                    <Plus size={15} /> Add Unit
                  </button>
                </div>

                {units.length === 0 && !addingUnit && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}><Ruler size={36} /></div>
                    No units defined. Click &quot;Add Unit&quot; to create one.
                  </div>
                )}

                <div className={styles.unitList}>
                  {units.map(unit => {
                    const locked = isUnitLocked(unit)
                    return (
                      <div key={unit.id} className={styles.unitRow}>
                        {editingUnitId === unit.id ? (
                          <input
                            ref={editUnitRef}
                            className={`form-input ${styles.inlineInput}`}
                            value={editingUnitName}
                            onChange={e => { setEditingUnitName(e.target.value); setUnitError('') }}
                            onKeyDown={e => handleKey(e, handleSaveEditUnit)}
                            onBlur={handleSaveEditUnit}
                            maxLength={30}
                          />
                        ) : (
                          <span
                            className={`${styles.unitName} ${locked ? styles.unitNameLocked : ''}`}
                            onClick={() => handleStartEditUnit(unit)}
                            title={locked ? 'In use — cannot edit' : 'Click to edit'}
                          >
                            {unit.name}
                          </span>
                        )}

                        <div className={styles.unitToggleCol}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={unit.allow_decimal}
                            className={`toggle ${unit.allow_decimal ? '' : 'toggle--off'}`}
                            onClick={() => handleToggleDecimal(unit.id)}
                            disabled={locked}
                            title={locked ? 'In use — cannot change' : 'Allow decimals'}
                          >
                            <span className="toggle__dot" />
                          </button>
                          <span>Decimals</span>
                        </div>

                        <div className={styles.unitStatusCol}>
                          {locked && (
                            <span className="badge badge--neutral" title="Used by inventory items">
                              <Lock size={10} /> In Use
                            </span>
                          )}
                        </div>

                        <div className={styles.unitActions}>
                          <button
                            className="btn btn--ghost btn--sm"
                            title={locked ? 'In use — cannot delete' : 'Delete'}
                            onClick={() => handleDeleteUnit(unit)}
                            disabled={locked}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Inline add unit */}
                  {addingUnit && (
                    <>
                      <div className={styles.unitRow}>
                        <input
                          ref={addUnitRef}
                          className={`form-input ${styles.inlineInput}`}
                          placeholder="Unit name"
                          value={newUnitName}
                          onChange={e => { setNewUnitName(e.target.value); setUnitError('') }}
                          onKeyDown={e => handleKey(e, handleSaveNewUnit)}
                          maxLength={30}
                        />
                        <div className={styles.unitToggleCol}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={newUnitDecimal}
                            className={`toggle ${newUnitDecimal ? '' : 'toggle--off'}`}
                            onClick={() => setNewUnitDecimal(!newUnitDecimal)}
                          >
                            <span className="toggle__dot" />
                          </button>
                          <span>Decimals</span>
                        </div>
                        <button className="btn btn--primary btn--sm" onClick={handleSaveNewUnit}>Save</button>
                        <button className="btn btn--ghost btn--sm" onClick={cancelAll}>Cancel</button>
                      </div>
                      {unitError && <div className={styles.errorMsg}>{unitError}</div>}
                    </>
                  )}

                  {editingUnitId && unitError && (
                    <div className={styles.errorMsg}>{unitError}</div>
                  )}
                </div>
              </div>

              {/* Conversions Card */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionHeaderInfo}>
                    <div className={styles.sectionIcon}>
                      <ArrowRightLeft size={18} />
                    </div>
                    <div>
                      <div className={styles.sectionTitle}>Unit Conversions</div>
                      <div className={styles.sectionDesc}>Define how units relate to each other for automatic conversion.</div>
                    </div>
                  </div>
                  <button
                    className="btn btn--primary"
                    onClick={() => { cancelAll(); setAddingConversion(true) }}
                    disabled={units.length < 2}
                    title={units.length < 2 ? 'Need at least 2 units to define a conversion' : 'Add conversion'}
                  >
                    <Plus size={15} /> Add Conversion
                  </button>
                </div>

                {conversions.length === 0 && !addingConversion && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}><ArrowRightLeft size={36} /></div>
                    No conversions defined. Add relationships between your units.
                  </div>
                )}

                <div className={styles.conversionList}>
                  {conversions.map(conv => (
                    <div key={conv.id} className={styles.conversionRow}>
                      <span className={styles.conversionText}>
                        1 <strong>{getUnitName(conv.from_unit_id)}</strong>
                        {' = '}
                        <strong>{conv.factor}</strong> {getUnitName(conv.to_unit_id)}
                      </span>
                      <div className={styles.conversionActions}>
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Delete conversion"
                          onClick={() => handleDeleteConversion(conv.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Inline add conversion */}
                  {addingConversion && (
                    <>
                      <div className={styles.conversionForm}>
                        <span className={styles.conversionEquals}>1</span>
                        <select
                          className={styles.conversionSelect}
                          value={newConvFromUnit}
                          onChange={e => { setNewConvFromUnit(e.target.value); setConversionError('') }}
                        >
                          <option value="">From unit</option>
                          {units.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <span className={styles.conversionEquals}>=</span>
                        <input
                          ref={addConvFactorRef}
                          className={styles.conversionFactorInput}
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Factor"
                          value={newConvFactor}
                          onChange={e => { setNewConvFactor(e.target.value); setConversionError('') }}
                          onKeyDown={e => handleKey(e, handleSaveNewConversion)}
                        />
                        <select
                          className={styles.conversionSelect}
                          value={newConvToUnit}
                          onChange={e => { setNewConvToUnit(e.target.value); setConversionError('') }}
                        >
                          <option value="">To unit</option>
                          {units.filter(u => u.id !== newConvFromUnit).map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <button className="btn btn--primary btn--sm" onClick={handleSaveNewConversion}>Save</button>
                        <button className="btn btn--ghost btn--sm" onClick={cancelAll}>Cancel</button>
                      </div>
                      {conversionError && <div className={styles.errorMsg}>{conversionError}</div>}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Modal ───────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {/* Colored band header */}
            <div className={`${styles.modalBand} ${
              modal.type === 'archive-category' ? styles.modalBandWarning : styles.modalBandDanger
            }`}>
              <div className={`${styles.modalBandIcon} ${
                modal.type === 'archive-category' ? styles.modalBandIconWarning : styles.modalBandIconDanger
              }`}>
                {modal.type === 'archive-category' ? <Archive size={18} /> : <Trash2 size={18} />}
              </div>
              <div className={styles.modalBandText}>
                <div className={styles.modalBandTitle}>
                  {modal.type === 'delete-category' && 'Delete Category'}
                  {modal.type === 'archive-category' && 'Archive Category'}
                  {modal.type === 'delete-unit' && 'Delete Unit'}
                </div>
                <div className={styles.modalBandSub}>&quot;{modal.name}&quot;</div>
              </div>
            </div>

            <div className={styles.modalText}>
              {modal.type === 'delete-category' && (
                <p>
                  This will permanently delete &quot;{modal.name}&quot;
                  {(modal.childCount ?? 0) > 0 && (
                    <> and its {modal.childCount} subcategor{modal.childCount === 1 ? 'y' : 'ies'}</>
                  )}. This action cannot be undone.
                </p>
              )}
              {modal.type === 'archive-category' && (
                <>
                  {modal.itemCount && modal.itemCount > 0 ? (
                    <p>
                      &quot;{modal.name}&quot; is assigned to {modal.itemCount} item{modal.itemCount !== 1 ? 's' : ''} and cannot be deleted.
                    </p>
                  ) : null}
                  <p>
                    Archived categories are hidden from item forms but kept in your records.
                    {(modal.childCount ?? 0) > 0 && (
                      <> This will also archive {modal.childCount} subcategor{modal.childCount === 1 ? 'y' : 'ies'}.</>
                    )}
                  </p>
                </>
              )}
              {modal.type === 'delete-unit' && (
                <p>
                  Deleting &quot;{modal.name}&quot; will also remove any conversions that use this unit. This cannot be undone.
                </p>
              )}
            </div>

            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              {modal.type === 'delete-category' && (
                <button className="btn btn--danger" onClick={confirmDeleteCategory}>Delete</button>
              )}
              {modal.type === 'archive-category' && (
                <button className="btn btn--primary" onClick={() => handleArchiveCategory(modal.id)}>Archive</button>
              )}
              {modal.type === 'delete-unit' && (
                <button className="btn btn--danger" onClick={confirmDeleteUnit}>Delete</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
