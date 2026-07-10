'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import styles from './signup.module.css'

type Step = 'email' | 'otp' | 'profile'

const OTP_LENGTH = 6

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep]               = useState<Step>('email')
  const [email, setEmail]             = useState('')
  const [emailSnapshot, setEmailSnapshot] = useState('')
  const [otpDigits, setOtpDigits]     = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [isChangingEmail, setIsChangingEmail] = useState(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null))

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 'email') {
      if (!email) return
      setStep('otp')
    } else if (isChangingEmail) {
      if (!email) return
      setIsChangingEmail(false)
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setStep('otp')
    } else if (step === 'profile') {
      if (password !== confirmPassword) return
      // TODO: wire up Supabase auth — create account
    }
  }

  function submitOtp(digits: string[]) {
    // TODO: wire up Supabase auth
  }

  function handleOtpDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }

    if (next.every(Boolean) && next.join('').length === OTP_LENGTH) {
      submitOtp(next)
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits]
        next[index] = ''
        setOtpDigits(next)
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault()
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = [...otpDigits]
    pasted.split('').forEach((char, i) => { next[i] = char })
    setOtpDigits(next)
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    otpRefs.current[focusIndex]?.focus()
    if (pasted.length === OTP_LENGTH) submitOtp(next)
  }

  function handleChangeEmail() {
    setEmailSnapshot(email)
    setIsChangingEmail(true)
  }

  function handleCancelChangeEmail() {
    setEmail(emailSnapshot)
    setIsChangingEmail(false)
  }

  const emailEditable    = step === 'email' || isChangingEmail
  const showOtp          = step === 'otp' && !isChangingEmail
  const showProfile      = step === 'profile' && !isChangingEmail
  const showChangeLink   = (step === 'otp' || step === 'profile') && !isChangingEmail

  return (
    <>
      <h2 className={styles.heading}>Create your account</h2>

      <form className={styles.formFields} onSubmit={handleFormSubmit}>

        {/* Email row — always visible */}
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email address</label>
          <div className={styles.emailRow}>
            <input
              className={`form-input ${!emailEditable ? styles.emailLocked : ''}`}
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={!emailEditable}
            />
            {emailEditable && (
              <button type="submit" className={`btn btn--primary btn--sm ${styles.verifyBtn}`} disabled>
                Verify
              </button>
            )}
            {isChangingEmail && (
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancelChangeEmail}
                aria-label="Cancel email change"
              >
                <X size={14} />
              </button>
            )}
            {showChangeLink && (
              <button
                type="button"
                className={styles.changeEmailBtn}
                onClick={handleChangeEmail}
              >
                Change email
              </button>
            )}
          </div>
          <span className="badge badge--neutral badge--centered">Coming soon</span>
        </div>

        {/* OTP — 6 individual digit boxes */}
        {showOtp && (
          <div className="form-group">
            <label className="form-label">Enter the 6-digit code sent to your email</label>
            <div className={styles.otpBoxes} role="group" aria-label="One-time password">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  className={styles.otpBox}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                  onFocus={(e) => e.target.select()}
                  disabled
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  autoFocus={i === 0}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
            {isLoading && (
              <p className={styles.verifyingHint}>
                <span className="spinner--sm"></span>
                Verifying…
              </p>
            )}
            <span className="badge badge--neutral badge--centered">Coming soon</span>
          </div>
        )}

        {/* Profile fields — no full name */}
        {showProfile && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                className="form-input"
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
              <input
                className={`form-input${passwordMismatch ? ' form-input--error' : ''}`}
                id="confirm-password"
                type="password"
                placeholder="Repeat password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordMismatch && (
                <p className="form-error">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--full btn--lg"
              disabled
            >
              Create Account
            </button>
            <span className="badge badge--neutral badge--centered">Coming soon</span>
          </>
        )}
      </form>

      <div className={styles.divider}><span>or</span></div>

      <button
        type="button"
        className="btn btn--ghost btn--full"
        disabled
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>
      <span className="badge badge--neutral badge--centered">Coming soon</span>

      <p className={styles.bottomLink}>
        Already have an account?{' '}
        <Link href="/auth/login">Log in</Link>
      </p>
    </>
  )
}
