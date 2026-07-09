'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import styles from './SearchableSelect.module.css'

export type SearchableOption = { value: string; label: string }

export default function SearchableSelect({
  value,
  options,
  onChange,
  onCreate,
  placeholder = 'Select…',
  disabled = false,
}: {
  value: string
  options: SearchableOption[]
  onChange: (value: string) => void
  onCreate: (name: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on a click truly outside the component. Deliberately not using
  // onBlur on the trigger — the search input's autoFocus steals focus from
  // the trigger the instant the dropdown opens, which fires a blur event
  // even though focus is still inside this same component, closing it
  // immediately. Checking against the DOM subtree avoids that false positive.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected = options.find(o => o.value === value)
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const showCreateSuggestion =
    search.trim() &&
    !filtered.find(o => o.label.toLowerCase() === search.trim().toLowerCase())

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`form-select ${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        disabled={disabled}
        onClick={() => {
          setOpen(!open)
          if (!open) setSearch('')
        }}
      >
        <span className={selected ? '' : 'text-tertiary'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.search}>
            <Search size={14} />
            <input
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && showCreateSuggestion) {
                  onCreate(search.trim())
                  setOpen(false)
                }
              }}
            />
          </div>
          <div className={styles.options}>
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.option} ${opt.value === value ? styles.optionSelected : ''}`}
                  onMouseDown={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              ))
            ) : !showCreateSuggestion ? (
              <div className={styles.noResult}>No results found</div>
            ) : null}

            {showCreateSuggestion && (
              <button
                type="button"
                className={`${styles.option} ${styles.optionCreate}`}
                onMouseDown={() => {
                  onCreate(search.trim())
                  setOpen(false)
                }}
              >
                + Add "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
