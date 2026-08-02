'use client'

import { useEffect, useState } from 'react'
import { isChrome, isWebStorageAccessible } from '@/lib/utils/storage-access'
import styles from './StorageAccessGuard.module.css'

export default function StorageAccessGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (isChrome() && !isWebStorageAccessible()) {
      setBlocked(true)
    }
  }, [])

  if (!blocked) {
    return <>{children}</>
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.title}>Site data is blocked in Chrome</h2>
        <p className={styles.body}>
          ZenJu needs to store data in your browser to keep you signed in.
          Chrome is currently blocking this — usually because of Incognito
          settings or a site permission.
        </p>
        <ol className={styles.steps}>
          <li>
            Click the <strong>lock icon</strong> in the address bar, open{' '}
            <strong>Site settings</strong>, and set{' '}
            <strong>Cookies and site data</strong> to Allowed.
          </li>
          <li>
            If you&apos;re in an <strong>Incognito window</strong>, make sure
            &quot;Block third-party cookies&quot; is off, or open ZenJu in a
            regular window instead.
          </li>
          <li>Reload this page once you&apos;ve made the change.</li>
        </ol>
        <button
          type="button"
          className="btn"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    </div>
  )
}
