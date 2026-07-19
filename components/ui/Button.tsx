'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'navy' | 'outline' | 'ghost' | 'success' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface SharedProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Filled: primary, navy, success, danger. Outlined: outline. Neutral: ghost. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** Icon shown before the label (or the only content when iconOnly is set). */
  icon?: ReactNode
  /** Icon shown after the label. Ignored when iconOnly is set. */
  iconRight?: ReactNode
  fullWidth?: boolean
}

interface LabelledButtonProps extends SharedProps {
  iconOnly?: false
  children: ReactNode
}

interface IconOnlyButtonProps extends SharedProps {
  iconOnly: true
  icon: ReactNode
  children?: never
  /** Required — icon-only buttons need an accessible name. */
  'aria-label': string
}

export type ButtonProps = LabelledButtonProps | IconOnlyButtonProps

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn--primary',
  navy: 'btn--navy',
  outline: 'btn--outline',
  ghost: 'btn--ghost',
  success: 'btn--success',
  danger: 'btn--danger',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
}

const ICON_ONLY_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: styles.iconOnlySm,
  md: styles.iconOnlyMd,
  lg: styles.iconOnlyLg,
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, fullWidth, iconOnly, className, children, type, ...rest },
  ref
) {
  const classes = [
    'btn',
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    fullWidth && 'btn--full',
    iconOnly && styles.iconOnly,
    iconOnly && ICON_ONLY_SIZE_CLASS[size],
    className,
  ].filter(Boolean).join(' ')

  return (
    <button ref={ref} type={type ?? 'button'} className={classes} {...rest}>
      {icon}
      {!iconOnly && children}
      {!iconOnly && iconRight}
    </button>
  )
})

export default Button
