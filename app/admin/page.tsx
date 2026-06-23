'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, KeyRound, Power, X, Eye, EyeOff, Check } from 'lucide-react'
import styles from './admin.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

type BusinessStatus = 'active' | 'suspended'
type BusinessType = 'retail' | 'grocery' | 'cafe' | 'health' | 'repair' | 'artisan'
type BusinessPlan = 'trial' | 'starter' | 'pro'

interface Business {
  id: string
  business_name: string
  owner_name: string
  email: string
  phone: string
  business_type: BusinessType
  plan: BusinessPlan
  status: BusinessStatus
  created_at: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'b1',
    business_name: 'RK Dry Fruits & Snacks',
    owner_name: 'Ramesh Kumar',
    email: 'ramesh@rkdryfruits.com',
    phone: '+91 98765 43210',
    business_type: 'grocery',
    plan: 'trial',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'b2',
    business_name: 'Green Leaf Pharmacy',
    owner_name: 'Priya Nair',
    email: 'priya@greenleaf.in',
    phone: '+91 87654 32109',
    business_type: 'health',
    plan: 'trial',
    status: 'active',
    created_at: '2024-02-03T09:00:00Z',
  },
  {
    id: 'b3',
    business_name: 'Urban Café',
    owner_name: 'Arun Mehta',
    email: 'arun@urbancafe.in',
    phone: '+91 76543 21098',
    business_type: 'cafe',
    plan: 'trial',
    status: 'suspended',
    created_at: '2024-02-18T11:30:00Z',
  },
  {
    id: 'b4',
    business_name: 'Sri Ram Textiles',
    owner_name: 'Suresh Balaji',
    email: 'suresh@sriramtex.com',
    phone: '+91 65432 10987',
    business_type: 'retail',
    plan: 'trial',
    status: 'active',
    created_at: '2024-03-05T08:00:00Z',
  },
  {
    id: 'b5',
    business_name: 'Fix It Workshop',
    owner_name: 'Dinesh Rajan',
    email: 'dinesh@fixitshop.in',
    phone: '+91 54321 09876',
    business_type: 'repair',
    plan: 'trial',
    status: 'active',
    created_at: '2024-03-20T14:00:00Z',
  },
  {
    id: 'b6',
    business_name: 'Artisan Pottery Studio',
    owner_name: 'Meera Iyer',
    email: 'meera@artisanpottery.in',
    phone: '+91 43210 98765',
    business_type: 'artisan',
    plan: 'trial',
    status: 'suspended',
    created_at: '2024-04-10T10:00:00Z',
  },
  {
    id: 'b7',
    business_name: 'Vijay Supermart',
    owner_name: 'Vijay Krishnan',
    email: 'vijay@vijaymart.com',
    phone: '+91 32109 87654',
    business_type: 'grocery',
    plan: 'trial',
    status: 'active',
    created_at: '2024-05-01T09:30:00Z',
  },
  {
    id: 'b8',
    business_name: 'Bella Beauty & Care',
    owner_name: 'Anitha Raj',
    email: 'anitha@bellabeauty.in',
    phone: '+91 21098 76543',
    business_type: 'health',
    plan: 'trial',
    status: 'active',
    created_at: '2024-05-22T12:00:00Z',
  },
]

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'cafe', label: 'Café' },
  { value: 'health', label: 'Health & Beauty' },
  { value: 'repair', label: 'Repair Shop' },
  { value: 'artisan', label: 'Artisan' },
]

// ─── Blank form states ────────────────────────────────────────────────────────

const BLANK_CREATE = {
  business_name: '',
  owner_name: '',
  email: '',
  phone: '',
  business_type: '' as BusinessType | '',
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

function getTypeLabel(type: BusinessType): string {
  return BUSINESS_TYPES.find(t => t.value === type)?.label ?? type
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BusinessStatus>('all')

  // Modal state
  const [activeModal, setActiveModal] = useState<'create' | 'reset' | 'status' | null>(null)
  const [targetBusiness, setTargetBusiness] = useState<Business | null>(null)

  // Create form
  const [createForm, setCreateForm] = useState({ ...BLANK_CREATE })
  const [createShowPwd, setCreateShowPwd] = useState(false)
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof typeof BLANK_CREATE, string>>>({})

  // Reset password form
  const [resetForm, setResetForm] = useState({ ...BLANK_RESET })
  const [resetShowPwd, setResetShowPwd] = useState(false)
  const [resetErrors, setResetErrors] = useState<Partial<Record<keyof typeof BLANK_RESET, string>>>({})

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

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  function closeModal() {
    setActiveModal(null)
    setTargetBusiness(null)
    setCreateForm({ ...BLANK_CREATE })
    setCreateErrors({})
    setCreateShowPwd(false)
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

  function handleCreateSubmit() {
    const errors: Partial<Record<keyof typeof BLANK_CREATE, string>> = {}
    if (!createForm.business_name.trim()) errors.business_name = 'Required'
    if (!createForm.owner_name.trim()) errors.owner_name = 'Required'
    if (!createForm.email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errors.email = 'Invalid email'
    if (!createForm.business_type) errors.business_type = 'Required'
    if (!createForm.password) errors.password = 'Required'
    else if (createForm.password.length < 8) errors.password = 'Minimum 8 characters'
    if (createForm.confirmPassword !== createForm.password) errors.confirmPassword = 'Passwords do not match'

    if (Object.keys(errors).length > 0) { setCreateErrors(errors); return }

    const newBusiness: Business = {
      id: `b${Date.now()}`,
      business_name: createForm.business_name.trim(),
      owner_name: createForm.owner_name.trim(),
      email: createForm.email.trim(),
      phone: createForm.phone.trim(),
      business_type: createForm.business_type as BusinessType,
      plan: 'trial',
      status: 'active',
      created_at: new Date().toISOString(),
    }
    setBusinesses(prev => [newBusiness, ...prev])
    closeModal()
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
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
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
                        <span className="badge badge--neutral">{getTypeLabel(b.business_type)}</span>
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
                <select
                  className={`form-select${createErrors.business_type ? ' form-select--error' : ''}`}
                  value={createForm.business_type}
                  onChange={e => setCreateForm(f => ({ ...f, business_type: e.target.value as BusinessType }))}
                >
                  <option value="">Select type…</option>
                  {BUSINESS_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {createErrors.business_type && (
                  <span className="form-error">{createErrors.business_type}</span>
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
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                />
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

            <div className={styles.modalFooter}>
              <button className="btn btn--ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn--primary" onClick={handleCreateSubmit}>
                <Check size={15} />
                Create Business
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
