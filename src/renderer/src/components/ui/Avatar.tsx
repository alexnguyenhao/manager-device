import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { gradientFor } from '../../lib/colors'
import { initials } from '@shared/utils'

export function Avatar({
  name,
  size = 'md',
  className
}: {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[9px]',
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-9 w-9 text-[11px]',
    lg: 'h-11 w-11 text-[13px]',
    xl: 'h-16 w-16 text-lg'
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm',
        gradientFor(name),
        sizes[size],
        className
      )}
      title={name}
    >
      {initials(name)}
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'primary',
  className,
  showLabel = false
}: {
  value: number
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
  showLabel?: boolean
}) {
  const colors = {
    primary: 'bg-brand-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500'
  }
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 text-right text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  )
}
