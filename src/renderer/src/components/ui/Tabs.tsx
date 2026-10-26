import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string = string> {
  value: T
  label: string
  count?: number
  icon?: ReactNode
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  variant?: 'underline' | 'pill'
  className?: string
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  className
}: TabsProps<T>) {
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={cn(
          'inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80',
          className
        )}
      >
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === value}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              item.value === value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                  item.value === value
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      className={cn('flex gap-6 overflow-x-auto border-b border-slate-200 dark:border-slate-800', className)}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            'relative flex shrink-0 items-center gap-2 pb-3 text-[13px] font-medium transition',
            item.value === value
              ? 'text-brand-700 dark:text-brand-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          )}
        >
          {item.icon}
          {item.label}
          {typeof item.count === 'number' && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {item.count}
            </span>
          )}
          {item.value === value && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
          )}
        </button>
      ))}
    </div>
  )
}
