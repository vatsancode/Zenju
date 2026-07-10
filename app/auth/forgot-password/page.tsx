'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './forgot-password.module.css'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [state, setState] = useState<'form' | 'sent'>('form')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: wire up Supabase auth — send password reset email
  }

  if (state === 'sent') {
    return (
      <div className={styles.successScreen}>
        <div className={styles.successIcon}>
          <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            aria-hidden="true"
            className={styles.successIconSvg}
          >
            <path
              d="M5 13.5l5.5 5.5L21 8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className={styles.successText}>
          <h2>Check your inbox</h2>
          <p className="text-secondary">
            We sent a password reset link to your email.
            Click the link in the email to set a new password.
          </p>
          <p className="text-tertiary">
            Didn&apos;t receive it? Check your spam folder.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--full"
          onClick={() => router.push('/auth/login')}
        >
          Back to Login
        </button>
      </div>
    )
  }

  return (
    <>
      <h2 className={styles.heading}>Reset your password</h2>
      <p className={`text-secondary ${styles.subtext}`}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className={styles.formFields}>
        <div className="form-group">
          <label className="form-label" htmlFor="reset-email">
            Email address
          </label>
          <input
            className="form-input"
            id="reset-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full btn--lg"
          disabled
        >
          Send Reset Link
        </button>
        <span className="badge badge--neutral badge--centered">Coming soon</span>
      </form>

      <Link href="/auth/login" className={`text-secondary ${styles.backLink}`}>
        ← Back to login
      </Link>
    </>
  )
}
