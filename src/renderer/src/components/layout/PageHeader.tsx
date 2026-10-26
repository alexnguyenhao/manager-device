import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  meta?: ReactNode
}

export function PageHeader({ title, description, actions, icon, className, meta }: PageHeaderProps) {
  return (
    <div className={cn('mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-600/10 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/15">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {description && <p className="mt-1 text-[13px] leading-relaxed muted">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
