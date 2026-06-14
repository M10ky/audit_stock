// 'use client'
import { IconLoader2 } from '@tabler/icons-react'
import { cx } from '@/lib/helpers'

const VARIANTS = {
  primary: 'btn-primary',
  indigo:  'btn-indigo',
  danger:  'btn-danger',
  outline: 'btn-outline',
  ghost:   'btn-ghost',
}

export default function Button({
  children, variant = 'primary', size, icon: Icon, loading = false,
  className, disabled, ...props
}) {
  return (
    <button
      className={cx(
        'btn',
        VARIANTS[variant] || VARIANTS.primary,
        size === 'sm' && 'btn-sm',
        size === 'icon' && 'btn-icon',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <IconLoader2 size={14} className="btn-spinner" /> : Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  )
}