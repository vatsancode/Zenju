'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import styles from './reset-password.module.css'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkExpired, setLinkExpired] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords don\'t match.')
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setIsLoading(false)
      setLinkExpired(true)
      return
    }

    router.push('/dashboard')
  }

  if (linkExpired) {
    return (
      <>
        <h2 className={styles.heading}>Link expired</h2>
        <p className={`text-secondary ${styles.subtext}`}>
          This reset link has expired or already been used.
        </p>
        <Link href="/auth/forgot-password" className="btn btn--primary btn--full btn--lg" style={{ textAlign: 'center' }}>
          Request a new link
        </Link>
      </>
    )
  }

  return (
    <>
      <h2 className={styles.heading}>Set new password</h2>
      <p className={`text-secondary ${styles.subtext}`}>
        Choose a strong password for your account.
      </p>

      {error && (
        <div className="alert alert--danger" style={{ marginBottom: 16 }}>
          <div className="alert__dot" />
          <p className="alert__body">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formFields}>
        <div className="form-group">
          <label className="form-label" htmlFor="new-password">
            New password
          </label>
          <input
            className="form-input"
            id="new-password"
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            className="form-input"
            id="confirm-password"
            type="password"
            placeholder="Repeat new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full btn--lg"
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner" /> : 'Update Password'}
        </button>
      </form>
    </>
  )
}
