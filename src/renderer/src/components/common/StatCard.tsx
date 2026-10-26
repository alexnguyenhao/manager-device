import type { ReactNode } from 'react'
import { TONE_SOFT } from '../../lib/colors'
import type { Tone } from '@shared/constants'
import { cn } from '../../lib/cn'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: ReactNode
  tone?: Tone
  className?: string
  footer?: ReactNode
}

export function StatCard({ label, value, hint, icon, tone = 'info', className, footer }: StatCardProps) {
  return (
    <div
      className={cn(
        'card relative overflow-hidden p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 tabular-nums dark:text-white">
            {value}
          </div>
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            TONE_SOFT[tone]
          )}
        >
          {icon}
        </div>
      </div>
      {hint && <div className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">{hint}</div>}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  )
}
