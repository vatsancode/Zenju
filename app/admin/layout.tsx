import Link from 'next/link'
import styles from './admin.module.css'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>SI</div>
            <div className={styles.brandText}>
              <p className={styles.brandTitle}>SmartInventory AI</p>
              <p className={styles.brandSub}>Admin Portal</p>
            </div>
          </div>
          <div className={styles.navRight}>
            <span className={styles.adminBadge}>Super Admin</span>
            <Link href="/auth/login" className={styles.navSignOut}>Sign out</Link>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
