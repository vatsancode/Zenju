'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './reset-password.module.css'

export default function ResetPasswordPage() {
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: wire up Supabase auth — update password
  }

  return (
    <>
      <h2 className={styles.heading}>Set new password</h2>
      <p className={`text-secondary ${styles.subtext}`}>
        Choose a strong password for your account.
      </p>

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
          />
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full btn--lg"
          disabled
        >
          Update Password
        </button>
        <span className="badge badge--neutral badge--centered">Coming soon</span>
      </form>
    </>
  )
}
