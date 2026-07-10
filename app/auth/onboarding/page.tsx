'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
// TODO: import Supabase client when wiring up real auth
import styles from './onboarding.module.css'

const CATEGORY_OPTIONS = [
  { value: 'retail',   label: 'Retail & Boutique — clothing, stationery, gifts' },
  { value: 'grocery',  label: 'Grocery & Mini-Mart — essentials, packaged food' },
  { value: 'cafe',     label: 'Cafe & Food Stalls — quick service, snacks, beverages' },
  { value: 'health',   label: 'Health & Beauty — salon, pharmacy, products + services' },
  { value: 'repair',   label: 'Repair & Technical — parts inventory, maintenance' },
  { value: 'artisan',  label: 'Artisan & Maker — handcrafted, self-manufactured products' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading]     = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory]       = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName || !category || isLoading) return
    // TODO: wire up Supabase — create business, branch, channel, business_user
  }

  function selectOption(value: string) {
    setCategory(value)
    setDropdownOpen(false)
  }

  const selectedLabel = CATEGORY_OPTIONS.find(o => o.value === category)?.label

  return (
    <>
      <h2 className={styles.heading}>Set up your business</h2>

      <form className={styles.form} onSubmit={handleContinue}>
        <div className="form-group">
          <label className="form-label" htmlFor="business-name">
            Business Name
          </label>
          <input
            className="form-input"
            type="text"
            id="business-name"
            placeholder="e.g. RK Dry Fruits & Snacks"
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="category-trigger">
            Business Category
          </label>
          <div className={styles.selectWrap} ref={dropdownRef}>
            <button
              type="button"
              id="category-trigger"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              className={`form-select ${styles.selectTrigger} ${dropdownOpen ? styles.selectTriggerOpen : ''} ${!category ? styles.selectTriggerPlaceholder : ''}`}
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <span>{selectedLabel ?? 'Select your business type...'}</span>
              <svg
                className={`${styles.selectChevron} ${dropdownOpen ? styles.selectChevronOpen : ''}`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <ul className={styles.selectList} role="listbox" aria-label="Business Category">
                {CATEGORY_OPTIONS.map((opt) => (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={category === opt.value}
                    className={`${styles.selectOption} ${category === opt.value ? styles.selectOptionActive : ''}`}
                    onClick={() => selectOption(opt.value)}
                  >
                    {opt.label}
                    {category === opt.value && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full btn--lg"
          disabled
        >
          Continue to Dashboard
        </button>
        <span className="badge badge--neutral badge--centered">Coming soon</span>
      </form>

    </>
  )
}
