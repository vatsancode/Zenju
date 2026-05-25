'use client'
import { useState } from 'react'
import styles from './CustomSelect.module.css'

export type SelectOption = { value: string; label: string; isAction?: boolean }

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value && !o.isAction)

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`form-select ${styles.trigger}`}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <span className={selected ? '' : 'text-tertiary'}>
          {selected?.label ?? placeholder}
        </span>
      </button>
      {open && (
        <div className={styles.dropdown}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={[
                styles.option,
                opt.isAction ? styles.optionAction : '',
                !opt.isAction && opt.value === value ? styles.optionSelected : '',
              ].filter(Boolean).join(' ')}
              onMouseDown={e => {
                e.preventDefault()
                onChange(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
