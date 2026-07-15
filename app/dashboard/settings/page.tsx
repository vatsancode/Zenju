'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Archive, ArchiveRestore, Lock, FolderTree, Ruler, ArrowRightLeft, Tag, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import type { UnitConversion } from '@/types/database'
import type { CategoryWithCount } from '@/lib/services/categories'
import type { UnitWithUsage } from '@/lib/services/units'
import type { AttributeWithUsage } from '@/lib/services/attributes'
import styles from './settings.module.css'

type SettingsTab = 'profile' | 'configuration' | 'billing'
type configSubTab = 'categories' | 'units' | 'attributes'

type ToastState = {
  message: string
  type: 'success' | 'warning' | 'danger' | 'info'
}

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

// ─── Component ───────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('configuration')
  const [activeConfigSubTab, setActiveConfigSubTab] = useState<configSubTab>('categories')

  // ─── Categories state ────────────────────────────────────
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesLoadError, setCategoriesLoadError] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [categorySearch, setCategorySearch] = useState('')
  const [addingCategoryParentId, setAddingCategoryParentId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [modalActionLoading, setModalActionLoading] = useState(false)
  const [restoringCategoryId, setRestoringCategoryId] = useState<string | null>(null)

  // ─── Units state ─────────────────────────────────────────
  const [units, setUnits] = useState<UnitWithUsage[]>([])
  const [unitsLoading, setUnitsLoading] = useState(true)
  const [unitsLoadError, setUnitsLoadError] = useState('')
  const [addingUnit, setAddingUnit] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitDecimal, setNewUnitDecimal] = useState(false)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [editingUnitName, setEditingUnitName] = useState('')
  const [unitError, setUnitError] = useState('')
  const [unitSaving, setUnitSaving] = useState(false)
  const [togglingUnitId, setTogglingUnitId] = useState<string | null>(null)
  const [unitModalActionLoading, setUnitModalActionLoading] = useState(false)

  // ─── Attributes state ────────────────────────────────────
  const [attributes, setAttributes] = useState<AttributeWithUsage[]>([])
  const [attributesLoading, setAttributesLoading] = useState(true)
  const [attributesLoadError, setAttributesLoadError] = useState('')
  const [addingAttribute, setAddingAttribute] = useState(false)
  const [newAttributeName, setNewAttributeName] = useState('')
  const [editingAttributeId, setEditingAttributeId] = useState<string | null>(null)
  const [editingAttributeName, setEditingAttributeName] = useState('')
  const [attributeError, setAttributeError] = useState('')
  const [attributeSaving, setAttributeSaving] = useState(false)
  const [attributeModalActionLoading, setAttributeModalActionLoading] = useState(false)

  // ─── Conversions state ───────────────────────────────────
  const [conversions, setConversions] = useState<UnitConversion[]>([])
  const [conversionsLoading, setConversionsLoading] = useState(true)
  const [conversionsLoadError, setConversionsLoadError] = useState('')
  const [addingConversion, setAddingConversion] = useState(false)
  const [newConvFromUnit, setNewConvFromUnit] = useState('')
  const [newConvToUnit, setNewConvToUnit] = useState('')
  const [newConvFactor, setNewConvFactor] = useState('')
  const [conversionError, setConversionError] = useState('')
  const [conversionSaving, setConversionSaving] = useState(false)
  const [deletingConversionId, setDeletingConversionId] = useState<string | null>(null)

  // ─── Toast ────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ─── Delete/archive modal ────────────────────────────────
  const [modal, setModal] = useState<{
    type: 'delete-category' | 'archive-category' | 'delete-unit' | 'delete-attribute'
    id: string
    name: string
    childCount?: number
    itemCount?: number
    conversionCount?: number
  } | null>(null)

  // ─── Refs for auto-focus ─────────────────────────────────
  const addCategoryRef = useRef<HTMLInputElement>(null)
  const editCategoryRef = useRef<HTMLInputElement>(null)
  const addUnitRef = useRef<HTMLInputElement>(null)
  const editUnitRef = useRef<HTMLInputElement>(null)
  const addAttributeRef = useRef<HTMLInputElement>(null)
  const editAttributeRef = useRef<HTMLInputElement>(null)
  const addConvFactorRef = useRef<HTMLInputElement>(null)

  // ─── Load categories from the server ─────────────────────
  async function loadCategories() {
    setCategoriesLoading(true)
    setCategoriesLoadError('')
    try {
      const res = await fetch('/api/categories')
      const body = await res.json()
      if (!res.ok) {
        setCategoriesLoadError(body.error || 'Could not load categories.')
        return
      }
      setCategories(body.data)
    } catch {
      setCategoriesLoadError('Could not load categories. Please check your connection.')
    } finally {
      setCategoriesLoading(false)
    }
  }

  useEffect(() => { loadCategories() }, [])

  // ─── Load units from the server ──────────────────────────
  async function loadUnits() {
    setUnitsLoading(true)
    setUnitsLoadError('')
    try {
      const res = await fetch('/api/units')
      const body = await res.json()
      if (!res.ok) {
        setUnitsLoadError(body.error || 'Could not load units.')
        return
      }
      setUnits(body.data)
    } catch {
      setUnitsLoadError('Could not load units. Please check your connection.')
    } finally {
      setUnitsLoading(false)
    }
  }

  useEffect(() => { loadUnits() }, [])

  // ─── Load attributes from the server ─────────────────────
  async function loadAttributes() {
    setAttributesLoading(true)
    setAttributesLoadError('')
    try {
      const res = await fetch('/api/attributes')
      const body = await res.json()
      if (!res.ok) {
        setAttributesLoadError(body.error || 'Could not load attributes.')
        return
      }
      setAttributes(body.data)
    } catch {
      setAttributesLoadError('Could not load attributes. Please check your connection.')
    } finally {
      setAttributesLoading(false)
    }
  }

  useEffect(() => { loadAttributes() }, [])

  // ─── Load unit conversions from the server ───────────────
  async function loadConversions() {
    setConversionsLoading(true)
    setConversionsLoadError('')
    try {
      const res = await fetch('/api/unit-conversions')
      const body = await res.json()
      if (!res.ok) {
        setConversionsLoadError(body.error || 'Could not load unit conversions.')
        return
      }
      setConversions(body.data)
    } catch {
      setConversionsLoadError('Could not load unit conversions. Please check your connection.')
    } finally {
      setConversionsLoading(false)
    }
  }

  useEffect(() => { loadConversions() }, [])

  useEffect(() => { addCategoryRef.current?.focus() }, [addingCategoryParentId])
  useEffect(() => { editCategoryRef.current?.focus() }, [editingCategoryId])
  useEffect(() => { addUnitRef.current?.focus() }, [addingUnit])
  useEffect(() => { editUnitRef.current?.focus() }, [editingUnitId])
  useEffect(() => { addAttributeRef.current?.focus() }, [addingAttribute])
  useEffect(() => { editAttributeRef.current?.focus() }, [editingAttributeId])
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
    setAddingAttribute(false)
    setNewAttributeName('')
    setEditingAttributeId(null)
    setEditingAttributeName('')
    setAttributeError('')
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
    const roots = categories.filter(c => c.parent_id === null).sort((a, b) => a.display_order - b.display_order)
    if (!q) return roots
    return roots.filter(parent => {
      if (addingCategoryParentId === parent.id) return true
      if (parent.name.toLowerCase().includes(q)) return true
      return categories.filter(c => c.parent_id === parent.id).some(sub => sub.name.toLowerCase().includes(q))
    })
  }

  function getFilteredSubcategories(parentId: string) {
    const q = categorySearch.trim().toLowerCase()
    const subs = categories.filter(c => c.parent_id === parentId).sort((a, b) => a.display_order - b.display_order)
    if (!q || addingCategoryParentId === parentId) return subs
    const parentMatches = categories.find(c => c.id === parentId)?.name.toLowerCase().includes(q) ?? false
    if (parentMatches) return subs
    return subs.filter(sub => sub.name.toLowerCase().includes(q))
  }

  // ─── Category helpers ────────────────────────────────────

  function getRootCategories() {
    return categories.filter(c => c.parent_id === null).sort((a, b) => a.display_order - b.display_order)
  }

  function getSubcategories(parentId: string) {
    return categories.filter(c => c.parent_id === parentId).sort((a, b) => a.display_order - b.display_order)
  }

  function getCategoryItemCount(categoryId: string): number {
    return categories.find(c => c.id === categoryId)?.item_count ?? 0
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

  async function handleSaveNewCategory() {
    if (categorySaving) return // a request is already in flight — ignore repeat Enter/clicks
    const parentId = addingCategoryParentId === 'ROOT' ? null : addingCategoryParentId
    const error = validateCategoryName(newCategoryName, parentId)
    if (error) { setCategoryError(error); return }
    setCategorySaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), parent_id: parentId }),
      })
      const body = await res.json()
      if (!res.ok) { setCategoryError(body.error || 'Could not create category.'); return }
      setCategories(prev => [...prev, { ...body.data, item_count: 0 }])
      setAddingCategoryParentId(null)
      setNewCategoryName('')
      setCategoryError('')
      showToast(`"${body.data.name}" created`)
    } catch {
      setCategoryError('Could not create category. Please check your connection.')
    } finally {
      setCategorySaving(false)
    }
  }

  function handleStartEditCategory(cat: CategoryWithCount) {
    if (cat.is_archived) return
    cancelAll()
    setEditingCategoryId(cat.id)
    setEditingCategoryName(cat.name)
  }

  async function handleSaveEditCategory() {
    if (categorySaving) return // Enter fires this, then blur fires it again — ignore the repeat
    const cat = categories.find(c => c.id === editingCategoryId)
    if (!cat) return
    const error = validateCategoryName(editingCategoryName, cat.parent_id, cat.id)
    if (error) { setCategoryError(error); return }
    setCategorySaving(true)
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCategoryName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) { setCategoryError(body.error || 'Could not rename category.'); return }
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: body.data.name } : c))
      setEditingCategoryId(null)
      setEditingCategoryName('')
      setCategoryError('')
      showToast(`Renamed to "${body.data.name}"`)
    } catch {
      setCategoryError('Could not rename category. Please check your connection.')
    } finally {
      setCategorySaving(false)
    }
  }

  function handleDeleteCategory(cat: CategoryWithCount) {
    const childCount = getSubcategories(cat.id).length
    const totalItems = getTotalItemCount(cat.id)
    if (totalItems > 0) {
      setModal({ type: 'archive-category', id: cat.id, name: cat.name, childCount, itemCount: totalItems })
    } else {
      setModal({ type: 'delete-category', id: cat.id, name: cat.name, childCount })
    }
  }

  async function confirmDeleteCategory() {
    if (!modal || modal.type !== 'delete-category' || modalActionLoading) return
    const { id } = modal
    setModalActionLoading(true)
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        setCategoriesLoadError(body.error || 'Could not delete category.')
        return
      }
      setCategories(prev => prev.filter(c => c.id !== id && c.parent_id !== id))
      setModal(null)
      showToast(`"${modal.name}" deleted`)
    } catch {
      setCategoriesLoadError('Could not delete category. Please check your connection.')
    } finally {
      setModalActionLoading(false)
    }
  }

  async function handleArchiveCategory(categoryId: string) {
    if (modalActionLoading) return
    const categoryName = categories.find(c => c.id === categoryId)?.name ?? 'Category'
    setModalActionLoading(true)
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true }),
      })
      if (!res.ok) {
        const body = await res.json()
        setCategoriesLoadError(body.error || 'Could not archive category.')
        return
      }
      await loadCategories()
      setModal(null)
      showToast(`"${categoryName}" archived`)
    } catch {
      setCategoriesLoadError('Could not archive category. Please check your connection.')
    } finally {
      setModalActionLoading(false)
    }
  }

  async function handleRestoreCategory(categoryId: string) {
    if (restoringCategoryId) return
    const categoryName = categories.find(c => c.id === categoryId)?.name ?? 'Category'
    setRestoringCategoryId(categoryId)
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false }),
      })
      if (!res.ok) {
        const body = await res.json()
        setCategoriesLoadError(body.error || 'Could not restore category.')
        return
      }
      await loadCategories()
      showToast(`"${categoryName}" restored`)
    } catch {
      setCategoriesLoadError('Could not restore category. Please check your connection.')
    } finally {
      setRestoringCategoryId(null)
    }
  }

  // ─── Unit helpers ────────────────────────────────────────

  function isUnitLocked(unit: UnitWithUsage): boolean {
    return unit.in_use
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

  async function handleSaveNewUnit() {
    if (unitSaving) return // a request is already in flight — ignore repeat Enter/clicks
    const error = validateUnitName(newUnitName)
    if (error) { setUnitError(error); return }
    setUnitSaving(true)
    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUnitName.trim(), allows_decimal: newUnitDecimal }),
      })
      const body = await res.json()
      if (!res.ok) { setUnitError(body.error || 'Could not create unit.'); return }
      setUnits(prev => [...prev, { ...body.data, in_use: false }])
      setAddingUnit(false)
      setNewUnitName('')
      setNewUnitDecimal(false)
      setUnitError('')
      showToast(`"${body.data.name}" created`)
    } catch {
      setUnitError('Could not create unit. Please check your connection.')
    } finally {
      setUnitSaving(false)
    }
  }

  function handleStartEditUnit(unit: UnitWithUsage) {
    if (isUnitLocked(unit)) return
    cancelAll()
    setEditingUnitId(unit.id)
    setEditingUnitName(unit.name)
  }

  async function handleSaveEditUnit() {
    if (unitSaving) return // Enter fires this, then blur fires it again — ignore the repeat
    if (!editingUnitId) return
    const error = validateUnitName(editingUnitName, editingUnitId)
    if (error) { setUnitError(error); return }
    setUnitSaving(true)
    try {
      const res = await fetch(`/api/units/${editingUnitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingUnitName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) { setUnitError(body.error || 'Could not rename unit.'); return }
      setUnits(prev => prev.map(u => u.id === editingUnitId ? { ...u, name: body.data.name } : u))
      setEditingUnitId(null)
      setEditingUnitName('')
      setUnitError('')
      showToast(`Renamed to "${body.data.name}"`)
    } catch {
      setUnitError('Could not rename unit. Please check your connection.')
    } finally {
      setUnitSaving(false)
    }
  }

  async function handleToggleDecimal(unitId: string) {
    if (togglingUnitId) return
    const unit = units.find(u => u.id === unitId)
    if (!unit || isUnitLocked(unit)) return
    setTogglingUnitId(unitId)
    try {
      const res = await fetch(`/api/units/${unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allows_decimal: !unit.allows_decimal }),
      })
      const body = await res.json()
      if (!res.ok) { setUnitsLoadError(body.error || 'Could not update unit.'); return }
      setUnits(prev => prev.map(u => u.id === unitId ? { ...u, allows_decimal: body.data.allows_decimal } : u))
    } catch {
      setUnitsLoadError('Could not update unit. Please check your connection.')
    } finally {
      setTogglingUnitId(null)
    }
  }

  function handleDeleteUnit(unit: UnitWithUsage) {
    if (isUnitLocked(unit)) return
    const conversionCount = conversions.filter(c => c.from_unit_id === unit.id || c.to_unit_id === unit.id).length
    setModal({ type: 'delete-unit', id: unit.id, name: unit.name, conversionCount })
  }

  async function confirmDeleteUnit() {
    if (!modal || modal.type !== 'delete-unit' || unitModalActionLoading) return
    const { id } = modal
    setUnitModalActionLoading(true)
    try {
      const res = await fetch(`/api/units/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        setUnitsLoadError(body.error || 'Could not delete unit.')
        return
      }
      setConversions(prev => prev.filter(c => c.from_unit_id !== id && c.to_unit_id !== id))
      setUnits(prev => prev.filter(u => u.id !== id))
      setModal(null)
      showToast(`"${modal.name}" deleted`)
    } catch {
      setUnitsLoadError('Could not delete unit. Please check your connection.')
    } finally {
      setUnitModalActionLoading(false)
    }
  }

  // ─── Attribute helpers ────────────────────────────────────

  function isAttributeLocked(attribute: AttributeWithUsage): boolean {
    return attribute.in_use
  }

  function validateAttributeName(name: string, excludeId?: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return 'Name cannot be empty'
    if (trimmed.length > 50) return 'Name must be under 50 characters'
    const duplicate = attributes.find(a =>
      a.name.toLowerCase() === trimmed.toLowerCase() && a.id !== excludeId
    )
    if (duplicate) return 'An attribute with this name already exists'
    return null
  }

  async function handleSaveNewAttribute() {
    if (attributeSaving) return // a request is already in flight — ignore repeat Enter/clicks
    const error = validateAttributeName(newAttributeName)
    if (error) { setAttributeError(error); return }
    setAttributeSaving(true)
    try {
      const res = await fetch('/api/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAttributeName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) { setAttributeError(body.error || 'Could not create attribute.'); return }
      setAttributes(prev => [...prev, { ...body.data, in_use: false }])
      setAddingAttribute(false)
      setNewAttributeName('')
      setAttributeError('')
      showToast(`"${body.data.name}" created`)
    } catch {
      setAttributeError('Could not create attribute. Please check your connection.')
    } finally {
      setAttributeSaving(false)
    }
  }

  function handleStartEditAttribute(attribute: AttributeWithUsage) {
    if (isAttributeLocked(attribute)) return
    cancelAll()
    setEditingAttributeId(attribute.id)
    setEditingAttributeName(attribute.name)
  }

  async function handleSaveEditAttribute() {
    if (attributeSaving) return // Enter fires this, then blur fires it again — ignore the repeat
    if (!editingAttributeId) return
    const error = validateAttributeName(editingAttributeName, editingAttributeId)
    if (error) { setAttributeError(error); return }
    setAttributeSaving(true)
    try {
      const res = await fetch(`/api/attributes/${editingAttributeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingAttributeName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) { setAttributeError(body.error || 'Could not rename attribute.'); return }
      setAttributes(prev => prev.map(a => a.id === editingAttributeId ? { ...a, name: body.data.name } : a))
      setEditingAttributeId(null)
      setEditingAttributeName('')
      setAttributeError('')
      showToast(`Renamed to "${body.data.name}"`)
    } catch {
      setAttributeError('Could not rename attribute. Please check your connection.')
    } finally {
      setAttributeSaving(false)
    }
  }

  function handleDeleteAttribute(attribute: AttributeWithUsage) {
    if (isAttributeLocked(attribute)) return
    setModal({ type: 'delete-attribute', id: attribute.id, name: attribute.name })
  }

  async function confirmDeleteAttribute() {
    if (!modal || modal.type !== 'delete-attribute' || attributeModalActionLoading) return
    const { id } = modal
    setAttributeModalActionLoading(true)
    try {
      const res = await fetch(`/api/attributes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        setAttributesLoadError(body.error || 'Could not delete attribute.')
        return
      }
      setAttributes(prev => prev.filter(a => a.id !== id))
      setModal(null)
      showToast(`"${modal.name}" deleted`)
    } catch {
      setAttributesLoadError('Could not delete attribute. Please check your connection.')
    } finally {
      setAttributeModalActionLoading(false)
    }
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

  async function handleSaveNewConversion() {
    if (conversionSaving) return // a request is already in flight — ignore repeat Enter/clicks
    const error = validateConversion(newConvFromUnit, newConvToUnit, newConvFactor)
    if (error) { setConversionError(error); return }
    setConversionSaving(true)
    try {
      const res = await fetch('/api/unit-conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_unit_id: newConvFromUnit,
          to_unit_id: newConvToUnit,
          factor: Number(newConvFactor),
        }),
      })
      const body = await res.json()
      if (!res.ok) { setConversionError(body.error || 'Could not create conversion.'); return }
      setConversions(prev => [...prev, body.data])
      setAddingConversion(false)
      setNewConvFromUnit('')
      setNewConvToUnit('')
      setNewConvFactor('')
      setConversionError('')
      showToast('Conversion created')
    } catch {
      setConversionError('Could not create conversion. Please check your connection.')
    } finally {
      setConversionSaving(false)
    }
  }

  async function handleDeleteConversion(convId: string) {
    if (deletingConversionId) return
    setDeletingConversionId(convId)
    try {
      const res = await fetch(`/api/unit-conversions/${convId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        setConversionsLoadError(body.error || 'Could not delete conversion.')
        return
      }
      setConversions(prev => prev.filter(c => c.id !== convId))
      showToast('Conversion deleted')
    } catch {
      setConversionsLoadError('Could not delete conversion. Please check your connection.')
    } finally {
      setDeletingConversionId(null)
    }
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
            {(['categories', 'units', 'attributes'] as configSubTab[]).map(sub => (
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

              {categoriesLoadError && (
                <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-3)' }}>
                  {categoriesLoadError}
                  <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'var(--space-2)' }} onClick={loadCategories}>
                    Retry
                  </button>
                </div>
              )}

              {categoriesLoading ? (
                <div className={styles.emptyState}>Loading categories…</div>
              ) : (
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
                        disabled={categorySaving}
                      />
                      <button className="btn btn--primary btn--sm" onClick={handleSaveNewCategory} disabled={categorySaving}>
                        {categorySaving ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={cancelAll} disabled={categorySaving}>Cancel</button>
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
                            disabled={categorySaving}
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
                              disabled={restoringCategoryId === parent.id}
                            >
                              {restoringCategoryId === parent.id ? <span className="spinner--sm" /> : <ArchiveRestore size={14} />}
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
                                  disabled={categorySaving}
                                />
                                <button className="btn btn--primary btn--sm" onClick={handleSaveNewCategory} disabled={categorySaving}>
                                  {categorySaving ? 'Saving…' : 'Save'}
                                </button>
                                <button className="btn btn--ghost btn--sm" onClick={cancelAll} disabled={categorySaving}>Cancel</button>
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
                                  disabled={categorySaving}
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
                                    disabled={restoringCategoryId === sub.id}
                                  >
                                    {restoringCategoryId === sub.id ? <span className="spinner--sm" /> : <ArchiveRestore size={14} />}
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
              )}
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

                {unitsLoadError && (
                  <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-3)' }}>
                    {unitsLoadError}
                    <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'var(--space-2)' }} onClick={loadUnits}>
                      Retry
                    </button>
                  </div>
                )}

                {unitsLoading ? (
                  <div className={styles.emptyState}>Loading units…</div>
                ) : (
                <>
                {units.length === 0 && !addingUnit && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}><Ruler size={36} /></div>
                    No units defined. Click &quot;Add Unit&quot; to create one.
                  </div>
                )}

                <div className={styles.unitList}>
                  {units.map(unit => {
                    const locked = isUnitLocked(unit)
                    const toggling = togglingUnitId === unit.id
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
                            disabled={unitSaving}
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
                            aria-checked={unit.allows_decimal}
                            className={`toggle ${unit.allows_decimal ? '' : 'toggle--off'}`}
                            onClick={() => handleToggleDecimal(unit.id)}
                            disabled={locked || toggling}
                            title={locked ? 'In use — cannot change' : 'Allow decimals'}
                          >
                            {toggling ? <span className="spinner--sm" /> : <span className="toggle__dot" />}
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
                          disabled={unitSaving}
                        />
                        <div className={styles.unitToggleCol}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={newUnitDecimal}
                            className={`toggle ${newUnitDecimal ? '' : 'toggle--off'}`}
                            onClick={() => setNewUnitDecimal(!newUnitDecimal)}
                            disabled={unitSaving}
                          >
                            <span className="toggle__dot" />
                          </button>
                          <span>Decimals</span>
                        </div>
                        <button className="btn btn--primary btn--sm" onClick={handleSaveNewUnit} disabled={unitSaving}>
                          {unitSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={cancelAll} disabled={unitSaving}>Cancel</button>
                      </div>
                      {unitError && <div className={styles.errorMsg}>{unitError}</div>}
                    </>
                  )}

                  {editingUnitId && unitError && (
                    <div className={styles.errorMsg}>{unitError}</div>
                  )}
                </div>
                </>
                )}
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

                {conversionsLoadError && (
                  <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-3)' }}>
                    {conversionsLoadError}
                    <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'var(--space-2)' }} onClick={loadConversions}>
                      Retry
                    </button>
                  </div>
                )}

                {conversionsLoading ? (
                  <div className={styles.emptyState}>Loading conversions…</div>
                ) : (
                <>
                {conversions.length === 0 && !addingConversion && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}><ArrowRightLeft size={36} /></div>
                    No conversions defined. Add relationships between your units.
                  </div>
                )}

                <div className={styles.conversionList}>
                  {conversions.map(conv => {
                    const deleting = deletingConversionId === conv.id
                    return (
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
                            disabled={deleting}
                          >
                            {deleting ? <span className="spinner--sm" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Inline add conversion */}
                  {addingConversion && (
                    <>
                      <div className={styles.conversionForm}>
                        <span className={styles.conversionEquals}>1</span>
                        <select
                          className={styles.conversionSelect}
                          value={newConvFromUnit}
                          onChange={e => { setNewConvFromUnit(e.target.value); setConversionError('') }}
                          disabled={conversionSaving}
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
                          disabled={conversionSaving}
                        />
                        <select
                          className={styles.conversionSelect}
                          value={newConvToUnit}
                          onChange={e => { setNewConvToUnit(e.target.value); setConversionError('') }}
                          disabled={conversionSaving}
                        >
                          <option value="">To unit</option>
                          {units.filter(u => u.id !== newConvFromUnit).map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <button className="btn btn--primary btn--sm" onClick={handleSaveNewConversion} disabled={conversionSaving}>
                          {conversionSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={cancelAll} disabled={conversionSaving}>Cancel</button>
                      </div>
                      {conversionError && <div className={styles.errorMsg}>{conversionError}</div>}
                    </>
                  )}
                </div>
                </>
                )}
              </div>
            </>
          )}

          {/* ─── Attributes Sub-tab ───────────────────────────── */}
          {activeConfigSubTab === 'attributes' && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderInfo}>
                  <div className={styles.sectionIcon}>
                    <Tag size={18} />
                  </div>
                  <div>
                    <div className={styles.sectionTitle}>Attributes</div>
                    <div className={styles.sectionDesc}>Define reusable attributes (e.g. Grade, Roast) for item variants.</div>
                  </div>
                </div>
                <button
                  className="btn btn--primary"
                  onClick={() => { cancelAll(); setAddingAttribute(true) }}
                >
                  <Plus size={15} /> Add Attribute
                </button>
              </div>

              {attributesLoadError && (
                <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-3)' }}>
                  {attributesLoadError}
                  <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'var(--space-2)' }} onClick={loadAttributes}>
                    Retry
                  </button>
                </div>
              )}

              {attributesLoading ? (
                <div className={styles.emptyState}>Loading attributes…</div>
              ) : (
              <>
              {attributes.length === 0 && !addingAttribute && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}><Tag size={36} /></div>
                  No attributes defined. Click &quot;Add Attribute&quot; to create one.
                </div>
              )}

              <div className={styles.unitList}>
                {attributes.map(attribute => {
                  const locked = isAttributeLocked(attribute)
                  return (
                    <div key={attribute.id} className={styles.unitRow}>
                      {editingAttributeId === attribute.id ? (
                        <input
                          ref={editAttributeRef}
                          className={`form-input ${styles.inlineInput}`}
                          value={editingAttributeName}
                          onChange={e => { setEditingAttributeName(e.target.value); setAttributeError('') }}
                          onKeyDown={e => handleKey(e, handleSaveEditAttribute)}
                          onBlur={handleSaveEditAttribute}
                          maxLength={50}
                          disabled={attributeSaving}
                        />
                      ) : (
                        <span
                          className={`${styles.unitName} ${locked ? styles.unitNameLocked : ''}`}
                          onClick={() => handleStartEditAttribute(attribute)}
                          title={locked ? 'In use — cannot edit' : 'Click to edit'}
                        >
                          {attribute.name}
                        </span>
                      )}

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
                          onClick={() => handleDeleteAttribute(attribute)}
                          disabled={locked}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Inline add attribute */}
                {addingAttribute && (
                  <>
                    <div className={styles.unitRow}>
                      <input
                        ref={addAttributeRef}
                        className={`form-input ${styles.inlineInput}`}
                        placeholder="Attribute name"
                        value={newAttributeName}
                        onChange={e => { setNewAttributeName(e.target.value); setAttributeError('') }}
                        onKeyDown={e => handleKey(e, handleSaveNewAttribute)}
                        maxLength={50}
                        disabled={attributeSaving}
                      />
                      <button className="btn btn--primary btn--sm" onClick={handleSaveNewAttribute} disabled={attributeSaving}>
                        {attributeSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={cancelAll} disabled={attributeSaving}>Cancel</button>
                    </div>
                    {attributeError && <div className={styles.errorMsg}>{attributeError}</div>}
                  </>
                )}

                {editingAttributeId && attributeError && (
                  <div className={styles.errorMsg}>{attributeError}</div>
                )}
              </div>
              </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Modal ───────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => { if (!modalActionLoading && !unitModalActionLoading && !attributeModalActionLoading) setModal(null) }}>
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
                  {modal.type === 'delete-attribute' && 'Delete Attribute'}
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
                  Deleting &quot;{modal.name}&quot;
                  {(modal.conversionCount ?? 0) > 0 && (
                    <> will also remove {modal.conversionCount} conversion{modal.conversionCount === 1 ? '' : 's'} that use{modal.conversionCount === 1 ? 's' : ''} it</>
                  )}. This cannot be undone.
                </p>
              )}
              {modal.type === 'delete-attribute' && (
                <p>
                  Deleting &quot;{modal.name}&quot; cannot be undone.
                </p>
              )}
            </div>

            <div className="modal__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setModal(null)}
                disabled={
                  modal.type === 'delete-unit' ? unitModalActionLoading :
                  modal.type === 'delete-attribute' ? attributeModalActionLoading :
                  modalActionLoading
                }
              >
                Cancel
              </button>
              {modal.type === 'delete-category' && (
                <button className="btn btn--danger" onClick={confirmDeleteCategory} disabled={modalActionLoading}>
                  {modalActionLoading ? <><span className="spinner" /> Deleting…</> : 'Delete'}
                </button>
              )}
              {modal.type === 'archive-category' && (
                <button className="btn btn--primary" onClick={() => handleArchiveCategory(modal.id)} disabled={modalActionLoading}>
                  {modalActionLoading ? <><span className="spinner" /> Archiving…</> : 'Archive'}
                </button>
              )}
              {modal.type === 'delete-unit' && (
                <button className="btn btn--danger" onClick={confirmDeleteUnit} disabled={unitModalActionLoading}>
                  {unitModalActionLoading ? <><span className="spinner" /> Deleting…</> : 'Delete'}
                </button>
              )}
              {modal.type === 'delete-attribute' && (
                <button className="btn btn--danger" onClick={confirmDeleteAttribute} disabled={attributeModalActionLoading}>
                  {attributeModalActionLoading ? <><span className="spinner" /> Deleting…</> : 'Delete'}
                </button>
              )}
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
