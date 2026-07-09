import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/lib/supabase/admin'
import styles from './admin.module.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isCurrentUserAdmin())) {
    redirect('/auth/login')
  }

  return (
    <div className={styles.root}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>ZJ</div>
            <div className={styles.brandText}>
              <p className={styles.brandTitle}>ZenJu</p>
              <p className={styles.brandSub}>Admin Portal</p>
            </div>
          </div>
          <div className={styles.navRight}>
            <span className={styles.adminBadge}>Super Admin</span>
            <Link href="/api/auth/force-logout" className={styles.navSignOut}>Sign out</Link>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
