'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { mockUser } from '@/lib/mock-data'
import styles from './Sidebar.module.css'

const initials = mockUser.name.split(' ').map(n => n[0]).join('').toUpperCase()

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="sidebar">
      {/* A. Logo */}
      <div className="sidebar__logo">
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>ZJ</div>
          <span>Zen<span className={styles.logoAccent}>Ju</span></span>
        </div>
      </div>

      {/* B1. Main nav — no label */}
      <Link href="/dashboard" className={`nav-item ${isActive('/dashboard', true) ? 'active' : ''}`}>
        <div className="nav-item__bar"></div>
        <span>Dashboard</span>
      </Link>
      <Link href="/dashboard/inventory" className={`nav-item ${isActive('/dashboard/inventory') ? 'active' : ''}`}>
        <div className="nav-item__bar"></div>
        <span>Stocks</span>
      </Link>
      <Link href="/dashboard/catalogue" className={`nav-item ${isActive('/dashboard/catalogue') ? 'active' : ''}`}>
        <div className="nav-item__bar"></div>
        <span>Catalogue</span>
      </Link>
      <Link href="/dashboard/pos" className={`nav-item ${isActive('/dashboard/pos') ? 'active' : ''}`}>
        <div className="nav-item__bar"></div>
        <span>POS</span>
      </Link>

      {/* B2. Reports section */}
      <p className="sidebar__section">Reports</p>
      <Link href="/dashboard/sales" className={`nav-item ${isActive('/dashboard/sales') ? 'active' : ''}`}>
        <div className="nav-item__bar"></div>
        <span>Sales History</span>
        <span className="nav-item__pro-badge">Pro</span>
      </Link>

      {/* B3 + C. Account actions + user — pinned to bottom */}
      <div className={styles.bottomGroup}>
        <Link href="/dashboard/settings" className={`nav-item ${isActive('/dashboard/settings') ? 'active' : ''}`}>
          <div className="nav-item__bar"></div>
          <span>Settings</span>
        </Link>
        <button
          className={`nav-item ${styles.logoutBtn}`}
          onClick={() => router.push('/api/auth/force-logout')}
        >
          <div className="nav-item__bar"></div>
          <span>Logout</span>
        </button>

        <div className="sidebar__user">
          <div className="sidebar__avatar">{initials}</div>
          <div>
            <p className="sidebar__name">{mockUser.business_name}</p>
            <p className="sidebar__plan">
              {mockUser.subscription_plan === 'pro' ? 'Pro plan' : 'Free plan'}
            </p>
          </div>
        </div>
      </div>
    </nav>
  )
}
