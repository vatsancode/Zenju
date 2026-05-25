'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { mockCatalogueItems, formatINR } from '@/lib/mock-data'
import { Plus, X, Search, ChevronDown, Pencil, ArrowLeft, Hash, Gift } from 'lucide-react'
import styles from './offers.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

type BenefitType = 'fixed_price' | 'percentage_discount' | 'flat_discount' | 'free_item'

type Offer = {
  id: string
  name: string
  applicable_item_ids: string[]
  min_quantity: number
  benefit_type: BenefitType
  benefit_value: number
  active: boolean
  created_at: string
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const seedOffers: Offer[] = [
  {
    id: '1',
    name: '3 T-shirt Combo',
    applicable_item_ids: ['1', '2'],
    min_quantity: 3,
    benefit_type: 'fixed_price',
    benefit_value: 5000,
    active: true,
    created_at: '2024-06-01T10:00:00Z',
  },
  {
    id: '2',
    name: 'Gift Pack Discount',
    applicable_item_ids: ['3', '4'],
    min_quantity: 2,
    benefit_type: 'percentage_discount',
    benefit_value: 10,
    active: true,
    created_at: '2024-06-05T10:00:00Z',
  },
  {
    id: '3',
    name: 'Buy 3 Get 1 Free',
    applicable_item_ids: ['1', '2', '6'],
    min_quantity: 3,
    benefit_type: 'free_item',
    benefit_value: 0,
    active: false,
    created_at: '2024-06-10T10:00:00Z',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function catalogueItemName(id: string): string {
  return mockCatalogueItems.find(i => i.id === id)?.name ?? 'Unknown'
}

function benefitLabel(offer: Offer): string {
  switch (offer.benefit_type) {
    case 'fixed_price':          return `Fixed Price ${formatINR(offer.benefit_value)}`
    case 'percentage_discount':  return `${offer.benefit_value}% Off`
    case 'flat_discount':        return `${formatINR(offer.benefit_value)} Off`
    case 'free_item':            return 'Free Item (cheapest)'
    default:                     return ''
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffersPage() {
  // ── List state ───────────────────────────────────────────────────────────
  const [offers, setOffers] = useState<Offer[]>(seedOffers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)

  // ── Form fields ──────────────────────────────────────────────────────────
  const [formName, setFormName] = useState('')
  const [formItemIds, setFormItemIds] = useState<string[]>([])
  const [formMinQty, setFormMinQty] = useState<number | ''>(2)
  const [formBenefitType, setFormBenefitType] = useState<BenefitType | ''>('')
  const [formBenefitValue, setFormBenefitValue] = useState<number | ''>(0)
  const [submitted, setSubmitted] = useState(false)

  // ── Item picker ──────────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  // ── Derived ──────────────────────────────────────────────────────────────
  const filteredOffers = offers.filter(o => {
    const matchesSearch = !search || o.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? o.active : !o.active)
    return matchesSearch && matchesStatus
  })

  const catalogueByCategory = mockCatalogueItems.reduce<Record<string, { id: string; name: string }[]>>(
    (acc, item) => {
      const cat = item.category_name as string
      if (!acc[cat]) acc[cat] = []
      acc[cat].push({ id: item.id, name: item.name })
      return acc
    },
    {}
  )

  const filteredCatalogue = Object.entries(catalogueByCategory)
    .map(([category, items]) => ({
      category,
      items: items.filter(i => !pickerSearch || i.name.toLowerCase().includes(pickerSearch.toLowerCase())),
    }))
    .filter(g => g.items.length > 0)

  const errors = {
    name:         !formName.trim() ? 'Offer name is required' : '',
    items:        formItemIds.length === 0 ? 'Select at least one item' : '',
    minQty:       formMinQty === '' || Number(formMinQty) < 2 ? 'Minimum quantity must be greater than 1' : '',
    benefitType:  !formBenefitType ? 'Choose a benefit type' : '',
    benefitValue:
      formBenefitType && formBenefitType !== 'free_item' &&
      (formBenefitValue === '' || Number(formBenefitValue) <= 0)
        ? 'Enter a valid benefit value'
        : '',
  }
  const hasErrors = Object.values(errors).some(e => e)

  // ── Handlers ─────────────────────────────────────────────────────────────
  function resetForm() {
    setFormName('')
    setFormItemIds([])
    setFormMinQty(2)
    setFormBenefitType('')
    setFormBenefitValue(0)
    setSubmitted(false)
    setEditingId(null)
    setPickerOpen(false)
    setPickerSearch('')
  }

  function closeDrawer() {
    setShowDrawer(false)
    resetForm()
  }

  function openCreate() {
    resetForm()
    setDrawerMode('create')
    setShowDrawer(true)
  }

  function openEdit(offer: Offer) {
    resetForm()
    setEditingId(offer.id)
    setFormName(offer.name)
    setFormItemIds([...offer.applicable_item_ids])
    setFormMinQty(offer.min_quantity)
    setFormBenefitType(offer.benefit_type)
    setFormBenefitValue(offer.benefit_value)
    setDrawerMode('edit')
    setShowDrawer(true)
  }

  function toggleActive(id: string) {
    setOffers(prev => prev.map(o => (o.id === id ? { ...o, active: !o.active } : o)))
  }

  function toggleItem(itemId: string) {
    setFormItemIds(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId])
  }

  function handleSave() {
    setSubmitted(true)
    if (hasErrors) return

    if (drawerMode === 'edit' && editingId) {
      setOffers(prev =>
        prev.map(o =>
          o.id === editingId
            ? {
                ...o,
                name: formName.trim(),
                applicable_item_ids: formItemIds,
                min_quantity: Number(formMinQty),
                benefit_type: formBenefitType as BenefitType,
                benefit_value: formBenefitType === 'free_item' ? 0 : Number(formBenefitValue),
              }
            : o
        )
      )
    } else {
      setOffers(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          name: formName.trim(),
          applicable_item_ids: formItemIds,
          min_quantity: Number(formMinQty),
          benefit_type: formBenefitType as BenefitType,
          benefit_value: formBenefitType === 'free_item' ? 0 : Number(formBenefitValue),
          active: true,
          created_at: new Date().toISOString(),
        },
      ])
    }

    closeDrawer()
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <Link href="/dashboard/catalogue" className={styles.backLink}>
        <ArrowLeft size={14} />
        Back to Catalogue
      </Link>

      {/* Header */}
      <div className={styles.headerRow}>
        <h1>Offers & Discounts</h1>
        <div className={styles.headerActions}>
          <button className="btn btn--primary btn--sm" onClick={openCreate} style={{ height: '32px' }}>
            <Plus size={18} /> Create Offer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <input
          className="form-input"
          placeholder="Search offers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Offer list / empty state */}
      {filteredOffers.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">
            {search || statusFilter ? 'No offers match your filters' : 'No offers created yet'}
          </p>
          <p className="empty-state__desc">
            {search || statusFilter
              ? 'Try adjusting your search or filters'
              : 'Create pricing rules that will be suggested during checkout in POS'}
          </p>
          {!search && !statusFilter && (
            <button className="btn btn--primary btn--sm" onClick={openCreate}>
              <Plus size={16} /> Create your first offer
            </button>
          )}
        </div>
      ) : (
        <div className={styles.offersList}>
          {filteredOffers.map(offer => (
            <div
              key={offer.id}
              className={`${styles.offerCard} ${!offer.active ? styles.offerCardInactive : ''}`}
            >
              <div className={styles.offerCardTop}>
                <div>
                  <div className={styles.offerName}>{offer.name}</div>
                  <div className={styles.offerMeta}>
                    <div className={styles.offerMetaItem}>
                      <Hash size={12} className={styles.offerMetaIcon} />
                      Min {offer.min_quantity} items
                    </div>
                    <div className={styles.offerMetaDot} />
                    <div className={styles.offerMetaItem}>
                      <Gift size={12} className={styles.offerMetaIcon} />
                      {benefitLabel(offer)}
                    </div>
                    <div className={styles.offerMetaDot} />
                    <span className={`badge ${offer.active ? 'badge--success' : 'badge--neutral'}`}>
                      {offer.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className={styles.offerItems}>
                    {offer.applicable_item_ids.map(id => (
                      <span key={id} className={styles.offerItemChip}>
                        {catalogueItemName(id)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.offerCardActions}>
                  <button
                    className="btn btn--ghost btn--sm"
                    title="Edit"
                    onClick={() => openEdit(offer)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    title={offer.active ? 'Disable' : 'Enable'}
                    className={`toggle ${offer.active ? '' : 'toggle--off'}`}
                    onClick={() => toggleActive(offer.id)}
                    style={{ width: '34px', height: '20px' }}
                  >
                    <span className="toggle__dot" style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Drawer ── */}
      {showDrawer && (
        <div className="overlay" onClick={closeDrawer}>
          <div
            className="drawer"
            style={{ width: '520px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="drawer__header">
              <h3 className="drawer__title">
                {drawerMode === 'edit' ? 'Edit Offer' : 'Create Offer'}
              </h3>
              <button className="drawer__close" onClick={closeDrawer}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className={styles.drawerBody}>

              {/* Section 1: Offer Details */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionLabel}>Offer Details</div>
                <div className="form-group">
                  <label className="form-label form-label--required">Offer Name</label>
                  <input
                    className={`form-input ${submitted && errors.name ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder='e.g. "Buy 3 T-shirts Combo"'
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                  {submitted && errors.name && (
                    <span className="form-error">{errors.name}</span>
                  )}
                </div>
              </div>

              {/* Section 2: Applicable Items */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionLabel}>Applicable Items</div>
                <div className="form-group">
                  <label className="form-label form-label--required">Select items from catalogue</label>
                  <div className={styles.itemPickerWrap} ref={pickerRef}>
                    <button
                      type="button"
                      className={`${styles.itemPickerTrigger} ${pickerOpen ? styles.itemPickerTriggerOpen : ''}`}
                      onClick={() => { setPickerOpen(!pickerOpen); if (!pickerOpen) setPickerSearch('') }}
                    >
                      <span className={formItemIds.length === 0 ? 'text-tertiary' : ''}>
                        {formItemIds.length === 0
                          ? 'Select items...'
                          : `${formItemIds.length} item${formItemIds.length > 1 ? 's' : ''} selected`}
                      </span>
                      <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                    </button>

                    {pickerOpen && (
                      <div className={styles.itemPickerDropdown}>
                        <div className={styles.itemPickerSearch}>
                          <Search size={14} />
                          <input
                            autoFocus
                            placeholder="Search items..."
                            value={pickerSearch}
                            onChange={e => setPickerSearch(e.target.value)}
                          />
                        </div>
                        <div className={styles.itemPickerOptions}>
                          {filteredCatalogue.length === 0 ? (
                            <div className={styles.itemPickerNoResult}>No items found</div>
                          ) : (
                            filteredCatalogue.map(group => (
                              <div key={group.category}>
                                <div className={styles.itemPickerCategoryLabel}>{group.category}</div>
                                {group.items.map(item => {
                                  const selected = formItemIds.includes(item.id)
                                  return (
                                    <div
                                      key={item.id}
                                      className={`${styles.itemPickerOption} ${selected ? styles.itemPickerOptionSelected : ''}`}
                                      onClick={() => toggleItem(item.id)}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => {}}
                                        style={{ accentColor: 'var(--color-brand-blue)' }}
                                      />
                                      {item.name}
                                    </div>
                                  )
                                })}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {formItemIds.length > 0 && (
                    <div className={styles.selectedItems}>
                      {formItemIds.map(id => (
                        <span key={id} className={styles.selectedItemChip}>
                          {catalogueItemName(id)}
                          <button type="button" className={styles.selectedItemChipRemove} onClick={() => toggleItem(id)}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {submitted && errors.items && (
                    <span className="form-error">{errors.items}</span>
                  )}
                </div>
              </div>

              {/* Section 3: Condition */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionLabel}>Condition</div>
                <div className="form-group">
                  <label className="form-label form-label--required">Minimum quantity from selected items</label>
                  <input
                    className={`form-input ${submitted && errors.minQty ? 'form-input--error' : ''}`}
                    type="number"
                    min="2"
                    placeholder="e.g. 3"
                    value={formMinQty}
                    onChange={e => setFormMinQty(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ maxWidth: '140px' }}
                  />
                  {submitted && errors.minQty && (
                    <span className="form-error">{errors.minQty}</span>
                  )}
                  {formMinQty !== '' && Number(formMinQty) >= 2 && formItemIds.length > 0 && (
                    <span className="form-hint">
                      Offer becomes eligible when {formMinQty}+ items from the selected list are in cart
                    </span>
                  )}
                </div>
              </div>

              {/* Section 4: Benefit */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionLabel}>Benefit</div>
                <div className="form-group">
                  <label className="form-label form-label--required">What does the customer get?</label>
                  <div className={styles.benefitOptions}>
                    {(
                      [
                        { type: 'fixed_price',         label: 'Fixed Price',      desc: 'Flat price for the combo' },
                        { type: 'percentage_discount',  label: 'Percentage Off',   desc: 'Discount by a percentage' },
                        { type: 'flat_discount',        label: 'Flat Discount',    desc: 'Fixed amount off the total' },
                        { type: 'free_item',            label: 'Free Item',        desc: 'Cheapest item becomes free' },
                      ] as { type: BenefitType; label: string; desc: string }[]
                    ).map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        className={`${styles.benefitOption} ${formBenefitType === opt.type ? styles.benefitOptionActive : ''}`}
                        onClick={() => { setFormBenefitType(opt.type); setFormBenefitValue(0) }}
                      >
                        <span className={styles.benefitOptionLabel}>{opt.label}</span>
                        <span className={styles.benefitOptionDesc}>{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {submitted && errors.benefitType && (
                    <span className="form-error">{errors.benefitType}</span>
                  )}

                  {/* Benefit value inputs */}
                  {(formBenefitType === 'fixed_price' || formBenefitType === 'flat_discount') && (
                    <div className={styles.benefitValueRow}>
                      <label className="form-label form-label--required">
                        {formBenefitType === 'fixed_price' ? 'Combo price' : 'Discount amount'}
                      </label>
                      <div className="input-prefix" style={{ maxWidth: '180px' }}>
                        <span className="input-prefix__label">&#8377;</span>
                        <input
                          className="input-prefix__input"
                          type="number"
                          min="0"
                          placeholder={formBenefitType === 'fixed_price' ? 'e.g. 5000' : 'e.g. 500'}
                          value={formBenefitValue || ''}
                          onChange={e => setFormBenefitValue(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      {submitted && errors.benefitValue && (
                        <span className="form-error">{errors.benefitValue}</span>
                      )}
                    </div>
                  )}

                  {formBenefitType === 'percentage_discount' && (
                    <div className={styles.benefitValueRow}>
                      <label className="form-label form-label--required">Discount percentage</label>
                      <div className="input-prefix" style={{ maxWidth: '140px' }}>
                        <span className="input-prefix__label">%</span>
                        <input
                          className="input-prefix__input"
                          type="number"
                          min="1"
                          max="100"
                          placeholder="e.g. 10"
                          value={formBenefitValue || ''}
                          onChange={e => setFormBenefitValue(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      {submitted && errors.benefitValue && (
                        <span className="form-error">{errors.benefitValue}</span>
                      )}
                    </div>
                  )}

                  {formBenefitType === 'free_item' && (
                    <div className={styles.benefitValueRow}>
                      <div className="alert alert--info">
                        <div className="alert__dot" />
                        <div>
                          <div className="alert__title">How free item works</div>
                          <div className="alert__body">
                            The system suggests the cheapest eligible item as free. The cashier
                            selects the final free item during checkout.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="drawer__footer" style={{ justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button className="btn btn--ghost" onClick={closeDrawer}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSave}>
                {drawerMode === 'edit' ? 'Save Changes' : 'Save Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
