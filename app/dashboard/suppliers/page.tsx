'use client'

import { useState } from 'react'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'
import { mockSuppliers, mockPurchaseOrders } from '@/lib/mock-data'
import type { MockSupplier } from '@/lib/mock-data'
import styles from './suppliers.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyDraft(): Omit<MockSupplier, 'id'> {
  return { name: '', phone: '', email: '', notes: '' }
}

function orderCount(supplierId: string) {
  return mockPurchaseOrders.filter(po => po.supplier_id === supplierId).length
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<MockSupplier[]>(mockSuppliers)
  const [search, setSearch] = useState('')

  const [showDrawer, setShowDrawer] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Omit<MockSupplier, 'id'>>(emptyDraft())

  const filteredSuppliers = suppliers.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.email.toLowerCase().includes(q)
  })

  function openAddDrawer() {
    setEditingId(null)
    setDraft(emptyDraft())
    setShowDrawer(true)
  }

  function openEditDrawer(supplier: MockSupplier) {
    setEditingId(supplier.id)
    setDraft({ name: supplier.name, phone: supplier.phone, email: supplier.email, notes: supplier.notes })
    setShowDrawer(true)
  }

  function closeDrawer() {
    setShowDrawer(false)
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const canSave = draft.name.trim().length > 0

  function handleSave() {
    if (!canSave) return
    if (editingId) {
      setSuppliers(prev => prev.map(s => (s.id === editingId ? { ...s, ...draft, name: draft.name.trim() } : s)))
    } else {
      const created: MockSupplier = { id: `s-${Date.now()}`, ...draft, name: draft.name.trim() }
      setSuppliers(prev => [...prev, created])
    }
    closeDrawer()
  }

  function handleDelete(id: string) {
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.headerRow}>
        <h1>Suppliers</h1>
        <button className={`btn btn--primary btn--sm ${styles.newSupplierBtn}`} onClick={openAddDrawer}>
          <Plus size={18} /> New Supplier
        </button>
      </div>

      {/* Summary */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className="text-secondary text-sm">Total suppliers</span>
          <span className={styles.summaryValue}>{suppliers.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.searchWrap}>
          <input
            className="form-input"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No suppliers found</p>
            <p className="empty-state__desc">
              {search ? 'Try adjusting your search' : 'Add your first supplier to start creating purchase orders'}
            </p>
            {!search && (
              <button className="btn btn--primary btn--sm" onClick={openAddDrawer}>
                New Supplier
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className={styles.nameCol}>Name</th>
                <th className={styles.phoneCol}>Phone</th>
                <th className={styles.emailCol}>Email</th>
                <th className={styles.notesCol}>Notes</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="text-sm">{s.phone || <span className="text-tertiary">—</span>}</td>
                  <td className="text-sm">{s.email || <span className="text-tertiary">—</span>}</td>
                  <td className={`text-sm ${styles.notesCell}`}>{s.notes || <span className="text-tertiary">—</span>}</td>
                  <td>
                    <div className={styles.actions}>
                      <button className="btn btn--ghost btn--sm" title="Edit supplier" onClick={() => openEditDrawer(s)}>
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        title={orderCount(s.id) > 0 ? 'Cannot delete — has purchase orders' : 'Delete supplier'}
                        disabled={orderCount(s.id) > 0}
                        onClick={() => handleDelete(s.id)}
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

      {/* ── Add / Edit Supplier Drawer ── */}
      {showDrawer && (
        <div className="overlay" onClick={closeDrawer}>
          <div className="drawer" style={{ width: '480px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="drawer__header">
              <h3 className="drawer__title">{editingId ? 'Edit Supplier' : 'New Supplier'}</h3>
              <button className="drawer__close" onClick={closeDrawer}><X size={18} /></button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.drawerForm}>
                <div className="form-group">
                  <label className="form-label form-label--required">Name</label>
                  <input
                    className="form-input"
                    autoFocus
                    placeholder="e.g. Anand Traders"
                    value={draft.name}
                    onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone <span className="text-tertiary font-normal">(Optional)</span></label>
                  <input
                    className="form-input"
                    placeholder="e.g. 9840011223"
                    value={draft.phone}
                    onChange={e => setDraft(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email <span className="text-tertiary font-normal">(Optional)</span></label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="e.g. contact@supplier.com"
                    value={draft.email}
                    onChange={e => setDraft(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes <span className="text-tertiary font-normal">(Optional)</span></label>
                  <textarea
                    className="form-textarea"
                    placeholder="Credit terms, delivery notes, etc."
                    value={draft.notes}
                    onChange={e => setDraft(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className={`drawer__footer ${styles.stickyFooter}`}>
              <button className="btn btn--ghost" onClick={closeDrawer}>Cancel</button>
              <button className="btn btn--primary" disabled={!canSave} onClick={handleSave}>
                {editingId ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
