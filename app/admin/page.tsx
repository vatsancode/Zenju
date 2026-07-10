'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, KeyRound, Power, X, Eye, EyeOff, Check } from 'lucide-react'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { BusinessType } from '@/types/database'
import styles from './admin.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

type BusinessStatus = 'active' | 'suspended'
// Mirrors the DB's subscription_plan CHECK constraint ('free' | 'pro') — no separate trial/starter tier exists yet.
type BusinessPlan = 'free' | 'pro'
type BusinessTypeSummary = Pick<BusinessType, 'id' | 'name'>

interface BusinessTypesGetResponse {
  business_types: BusinessTypeSummary[]
}

interface BusinessTypesPostResponse {
  business_type?: BusinessTypeSummary
  error?: string
}

interface BusinessRecord {
  id: string
  business_name: string
  owner_name: string
  email: string
  phone: string
  business_type_id: string | null
  plan: BusinessPlan
  created_at: string
}

interface BusinessesGetResponse {
  businesses?: BusinessRecord[]
  error?: string
}

interface BusinessesPostResponse {
  business?: BusinessRecord
  error?: string
}

interface Business {
  id: string
  business_name: string
  owner_name: string
  email: string
  phone: string
  business_type_id: string | null
  plan: BusinessPlan
  status: BusinessStatus
  created_at: string
}

// ─── Blank form states ────────────────────────────────────────────────────────

const BLANK_CREATE = {
  business_name: '',
  owner_name: '',
  email: '',
  phone: '',
  business_type_id: '',
  password: '',
  confirmPassword: '',
}

const BLANK_RESET = { password: '', confirmPassword: '' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = MONTHS[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

// ─── Component ────────────────────────────────────────────────────────────────

// The DB has no status column yet (suspend/activate isn't persisted) — every
// business fetched from the API is shown as active until that's built.
function toBusiness(record: BusinessRecord): Business {
  return { ...record, status: 'active' }
}

export default function AdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loadingBusinesses, setLoadingBusinesses] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BusinessStatus>('all')

  // Modal state
  const [activeModal, setActiveModal] = useState<'create' | 'reset' | 'status' | null>(null)
  const [targetBusiness, setTargetBusiness] = useState<Business | null>(null)

  // Create form
  const [createForm, setCreateForm] = useState({ ...BLANK_CREATE })
  const [createShowPwd, setCreateShowPwd] = useState(false)
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof typeof BLANK_CREATE, string>>>({})
  const [creatingBusinessType, setCreatingBusinessType] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null)

  // Reset password form
  const [resetForm, setResetForm] = useState({ ...BLANK_RESET })
  const [resetShowPwd, setResetShowPwd] = useState(false)
  const [resetErrors, setResetErrors] = useState<Partial<Record<keyof typeof BLANK_RESET, string>>>({})

  // Business types — fetched from the real database, not hardcoded
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeSummary[]>([])

  useEffect(() => {
    fetch('/api/business-types')
      .then(res => res.json() as Promise<BusinessTypesGetResponse>)
      .then(data => setBusinessTypes(data.business_types ?? []))
      .catch(() => setCreateErrors(e => ({ ...e, business_type_id: 'Could not load business types. Refresh to try again.' })))
  }, [])

  useEffect(() => {
    fetch('/api/businesses')
      .then(res => res.json() as Promise<BusinessesGetResponse>)
      .then(data => {
        if (!data.businesses) {
          setListError(data.error ?? 'Could not load businesses.')
          return
        }
        setBusinesses(data.businesses.map(toBusiness))
      })
      .catch(() => setListError('Could not load businesses. Refresh to try again.'))
      .finally(() => setLoadingBusinesses(false))
  }, [])

  async function handleCreateBusinessType(name: string) {
    setCreatingBusinessType(true)
    setCreateErrors(e => ({ ...e, business_type_id: undefined }))

    try {
      const res = await fetch('/api/business-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json() as BusinessTypesPostResponse
      const businessType = data.business_type

      if (res.ok && businessType) {
        setBusinessTypes(prev =>
          prev.some(t => t.id === businessType.id)
            ? prev
            : [...prev, businessType].sort((a, b) => a.name.localeCompare(b.name))
        )
        setCreateForm(f => ({ ...f, business_type_id: businessType.id }))
      } else {
        setCreateErrors(e => ({ ...e, business_type_id: 'Could not add business type. Try again.' }))
      }
    } catch {
      setCreateErrors(e => ({ ...e, business_type_id: 'Could not add business type. Try again.' }))
    } finally {
      setCreatingBusinessType(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return businesses.filter(b => {
      const matchSearch =
        q === '' ||
        b.business_name.toLowerCase().includes(q) ||
        b.owner_name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [businesses, search, statusFilter])

  const stats = useMemo(() => ({
    total: businesses.length,
    active: businesses.filter(b => b.status === 'active').length,
    suspended: businesses.filter(b => b.status === 'suspended').length,
  }), [businesses])

  const businessTypeNameById = useMemo(
    () => new Map(businessTypes.map(t => [t.id, t.name])),
    [businessTypes]
  )

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  function closeModal() {
    setActiveModal(null)
    setTargetBusiness(null)
    setCreateForm({ ...BLANK_CREATE })
    setCreateErrors({})
    setCreateShowPwd(false)
    setCreatingBusinessType(false)
    setCreateSubmitting(false)
    setCreateSubmitError(null)
    setResetForm({ ...BLANK_RESET })
    setResetErrors({})
    setResetShowPwd(false)
  }

  function openResetModal(b: Business) {
    setTargetBusiness(b)
    setActiveModal('reset')
  }

  function openStatusModal(b: Business) {
    setTargetBusiness(b)
    setActiveModal('status')
  }

  // ── Submit handlers ───────────────────────────────────────────────────────────

  async function handleCreateSubmit() {
    const errors: Partial<Record<keyof typeof BLANK_CREATE, string>> = {}
    if (!createForm.business_name.trim()) errors.business_name = 'Required'
    if (!createForm.owner_name.trim()) errors.owner_name = 'Required'
    if (!createForm.email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errors.email = 'Invalid email'
    if (!createForm.business_type_id) errors.business_type_id = 'Required'
    if (!createForm.phone.trim()) errors.phone = 'Required for the business owner'
    if (!createForm.password) errors.password = 'Required'
    else if (createForm.password.length < 8) errors.password = 'Minimum 8 characters'
    if (createForm.confirmPassword !== createForm.password) errors.confirmPassword = 'Passwords do not match'

    if (Object.keys(errors).length > 0) { setCreateErrors(errors); return }

    setCreateSubmitting(true)
    setCreateSubmitError(null)

    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: createForm.business_name.trim(),
          owner_name: createForm.owner_name.trim(),
          business_type_id: createForm.business_type_id,
          email: createForm.email.trim(),
          phone: createForm.phone.trim(),
          password: createForm.password,
        }),
      })
      const data = await res.json() as BusinessesPostResponse

      if (!res.ok || !data.business) {
        setCreateSubmitError(data.error ?? 'Could not create business. Please try again.')
        return
      }

      setBusinesses(prev => [toBusiness(data.business!), ...prev])
      closeModal()
    } catch {
      setCreateSubmitError('Could not create business. Please try again.')
    } finally {
      setCreateSubmitting(false)
    }
  }

  function handleResetSubmit() {
    const errors: Partial<Record<keyof typeof BLANK_RESET, string>> = {}
    if (!resetForm.password) errors.password = 'Required'
    else if (resetForm.password.length < 8) errors.password = 'Minimum 8 characters'
    if (resetForm.confirmPassword !== resetForm.password) errors.confirmPassword = 'Passwords do not match'

    if (Object.keys(errors).length > 0) { setResetErrors(errors); return }
    closeModal()
  }

  function handleStatusToggle() {
    if (!targetBusiness) return
    setBusinesses(prev =>
      prev.map(b =>
        b.id === targetBusiness.id
          ? { ...b, status: b.status === 'active' ? 'suspended' : 'active' }
          : b
      )
    )
    closeModal()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className={styles.headerRow}>
        <div>
          <h1>Businesses</h1>
          <p className="text-secondary" style={{ marginTop: 4 }}>
            Manage all business accounts on this platform.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setActiveModal('create')}>
          <Plus size={16} />
          Add Business
        </button>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────── */}
      <div className={styles.statsRow}>
        <button
          className={`${styles.statCard} ${statusFilter === 'all' ? styles.statCardActive : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <p className={styles.statLabel}>Total</p>
          <p className={styles.statValue}>{stats.total}</p>
        </button>
        <button
          className={`${styles.statCard} ${statusFilter === 'active' ? styles.statCardActive : ''}`}
          onClick={() => setStatusFilter('active')}
        >
          <p className={styles.statLabel}>Active</p>
          <p className={`${styles.statValue} ${styles.statValueGreen}`}>{stats.active}</p>
        </button>
        <button
          className={`${styles.statCard} ${statusFilter === 'suspended' ? styles.statCardActive : ''}`}
          onClick={() => setStatusFilter('suspended')}
        >
          <p className={styles.statLabel}>Suspended</p>
          <p className={`${styles.statValue} ${styles.statValueAmber}`}>{stats.suspended}</p>
        </button>
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <div className={styles.filtersRow}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={`form-input ${styles.searchInput}`}
            placeholder="Search by business, owner or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="btn btn--ghost btn--sm" onClick={() => setSearch('')}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      {listError && (
        <div className="alert alert--danger" style={{ marginBottom: 16 }}>
          <div className="alert__dot" />
          <p className="alert__body">{listError}</p>
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loadingBusinesses ? (
          <div className="empty-state">
            <p className="empty-state__title">Loading businesses…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No businesses found</p>
            <p className="empty-state__desc">
              {search ? 'Try a different search term.' : 'No accounts have been created yet.'}
            </p>
            {!search && (
              <button className="btn btn--primary" onClick={() => setActiveModal('create')}>
                <Plus size={15} /> Add First Business
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td>
                      <div className={styles.businessCell}>
                        <span className={styles.businessName}>{b.business_name}</span>
                        <span className="badge badge--neutral">
                          {(b.business_type_id && businessTypeNameById.get(b.business_type_id)) ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td>{b.owner_name}</td>
                    <td className="text-secondary">{b.email}</td>
                    <td>
                      <span className="badge badge--info">
                        {b.plan.charAt(0).toUpperCase() + b.plan.slice(1)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${b.status === 'active' ? 'badge--success' : 'badge--warning'}`}>
                        {b.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="text-secondary text-sm">{formatDate(b.created_at)}</td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => openResetModal(b)}
                        >
                          <KeyRound size={13} />
                          Reset Password
                        </button>
                        <button
                          className={`btn btn--sm ${b.status === 'active' ? 'btn--danger' : 'btn--success'}`}
                          onClick={() => openStatusModal(b)}
                        >
                          <Power size={13} />
                          {b.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-secondary text-sm" style={{ marginTop: 12 }}>
          Showing {filtered.length} of {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'}
        </p>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — Create Business
      ════════════════════════════════════════════════════════════ */}

      {activeModal === 'create' && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={`card card--lg ${styles.modal}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="card__header">
              <h2 className="card__title">Add Business</h2>
              <button className="btn btn--ghost btn--sm" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.formGrid}>
              {/* Business Name — full width */}
              <div className={`form-group ${styles.spanFull}`}>
                <label className="form-label form-label--required">Business Name</label>
                <input
                  className={`form-input${createErrors.business_name ? ' form-input--error' : ''}`}
                  placeholder="e.g. RK Dry Fruits & Snacks"
                  value={createForm.business_name}
                  onChange={e => setCreateForm(f => ({ ...f, business_name: e.target.value }))}
                />
                {createErrors.business_name && (
                  <span className="form-error">{createErrors.business_name}</span>
                )}
              </div>

              {/* Owner Name */}
              <div className="form-group">
                <label className="form-label form-label--required">Owner Name</label>
                <input
                  className={`form-input${createErrors.owner_name ? ' form-input--error' : ''}`}
                  placeholder="e.g. Ramesh Kumar"
                  value={createForm.owner_name}
                  onChange={e => setCreateForm(f => ({ ...f, owner_name: e.target.value }))}
                />
                {createErrors.owner_name && (
                  <span className="form-error">{createErrors.owner_name}</span>
                )}
              </div>

              {/* Business Type */}
              <div className="form-group">
                <label className="form-label form-label--required">Business Type</label>
                <SearchableSelect
                  value={createForm.business_type_id}
                  options={businessTypes.map(t => ({ value: t.id, label: t.name }))}
                  onChange={v => setCreateForm(f => ({ ...f, business_type_id: v }))}
                  onCreate={handleCreateBusinessType}
                  placeholder={creatingBusinessType ? 'Adding…' : 'Select type…'}
                  disabled={creatingBusinessType}
                />
                {createErrors.business_type_id && (
                  <span className="form-error">{createErrors.business_type_id}</span>
                )}
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label form-label--required">Email</label>
                <input
                  type="email"
                  className={`form-input${createErrors.email ? ' form-input--error' : ''}`}
                  placeholder="owner@business.com"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                />
                {createErrors.email && (
                  <span className="form-error">{createErrors.email}</span>
                )}
              </div>

              {/* Phone */}
              <div className="form-group">
                <label className="form-label form-label--required">Phone (WhatsApp preferred)</label>
                <input
                  className={`form-input${createErrors.phone ? ' form-input--error' : ''}`}
                  placeholder="+91 98765 43210"
                  value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                />
                {createErrors.phone && (
                  <span className="form-error">{createErrors.phone}</span>
                )}
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label form-label--required">Temporary Password</label>
                <div className={styles.pwdWrap}>
                  <input
                    type={createShowPwd ? 'text' : 'password'}
                    className={`form-input${createErrors.password ? ' form-input--error' : ''}`}
                    placeholder="Min 8 characters"
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    className={styles.pwdToggle}
                    onClick={() => setCreateShowPwd(v => !v)}
                  >
                    {createShowPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {createErrors.password && (
                  <span className="form-error">{createErrors.password}</span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label className="form-label form-label--required">Confirm Password</label>
                <input
                  type={createShowPwd ? 'text' : 'password'}
                  className={`form-input${createErrors.confirmPassword ? ' form-input--error' : ''}`}
                  placeholder="Repeat password"
                  value={createForm.confirmPassword}
                  onChange={e => setCreateForm(f => ({ ...f, confirmPassword: e.target.value }))}
                />
                {createErrors.confirmPassword && (
                  <span className="form-error">{createErrors.confirmPassword}</span>
                )}
              </div>
            </div>

            {createSubmitError && (
              <div className="alert alert--danger" style={{ marginTop: 12 }}>
                <div className="alert__dot" />
                <p className="alert__body">{createSubmitError}</p>
              </div>
            )}

            <div className={styles.modalFooter}>
              <button className="btn btn--ghost" onClick={closeModal} disabled={createSubmitting}>Cancel</button>
              <button className="btn btn--primary" onClick={handleCreateSubmit} disabled={createSubmitting}>
                <Check size={15} />
                {createSubmitting ? 'Creating…' : 'Create Business'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — Reset Password
      ════════════════════════════════════════════════════════════ */}

      {activeModal === 'reset' && targetBusiness && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={`card card--lg ${styles.modal} ${styles.modalSm}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="card__header">
              <h2 className="card__title">Reset Password</h2>
              <button className="btn btn--ghost btn--sm" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.resetTarget}>
              <p className="text-secondary text-sm">Setting new password for</p>
              <p className="font-semibold" style={{ marginTop: 2 }}>{targetBusiness.business_name}</p>
              <p className="text-secondary text-sm">{targetBusiness.email}</p>
            </div>

            <div className={styles.formStack}>
              <div className="form-group">
                <label className="form-label form-label--required">New Password</label>
                <div className={styles.pwdWrap}>
                  <input
                    type={resetShowPwd ? 'text' : 'password'}
                    className={`form-input${resetErrors.password ? ' form-input--error' : ''}`}
                    placeholder="Min 8 characters"
                    value={resetForm.password}
                    onChange={e => setResetForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    className={styles.pwdToggle}
                    onClick={() => setResetShowPwd(v => !v)}
                  >
                    {resetShowPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {resetErrors.password && (
                  <span className="form-error">{resetErrors.password}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label form-label--required">Confirm Password</label>
                <input
                  type={resetShowPwd ? 'text' : 'password'}
                  className={`form-input${resetErrors.confirmPassword ? ' form-input--error' : ''}`}
                  placeholder="Repeat password"
                  value={resetForm.confirmPassword}
                  onChange={e => setResetForm(f => ({ ...f, confirmPassword: e.target.value }))}
                />
                {resetErrors.confirmPassword && (
                  <span className="form-error">{resetErrors.confirmPassword}</span>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className="btn btn--ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn--primary" onClick={handleResetSubmit}>
                <Check size={15} />
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — Confirm Suspend / Activate
      ════════════════════════════════════════════════════════════ */}

      {activeModal === 'status' && targetBusiness && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={`card card--lg ${styles.modal} ${styles.modalSm}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="card__header">
              <h2 className="card__title">
                {targetBusiness.status === 'active' ? 'Suspend Business' : 'Activate Business'}
              </h2>
              <button className="btn btn--ghost btn--sm" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '4px 0 8px' }}>
              {targetBusiness.status === 'active' ? (
                <div className="alert alert--warning">
                  <div className="alert__dot" />
                  <div>
                    <p className="alert__title">Suspend {targetBusiness.business_name}?</p>
                    <p className="alert__body">
                      {targetBusiness.owner_name} will not be able to log in until the account is reactivated.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="alert alert--success">
                  <div className="alert__dot" />
                  <div>
                    <p className="alert__title">Activate {targetBusiness.business_name}?</p>
                    <p className="alert__body">
                      {targetBusiness.owner_name} will regain full access to their account immediately.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className="btn btn--ghost" onClick={closeModal}>Cancel</button>
              {targetBusiness.status === 'active' ? (
                <button className="btn btn--danger" onClick={handleStatusToggle}>
                  <Power size={15} />
                  Suspend Account
                </button>
              ) : (
                <button className="btn btn--success" onClick={handleStatusToggle}>
                  <Check size={15} />
                  Activate Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
