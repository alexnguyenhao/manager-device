import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

interface DropdownProps {
  trigger: ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: number
  contentClassName?: string
  triggerClassName?: string
  ariaLabel?: string
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
  width = 220,
  contentClassName,
  triggerClassName,
  ariaLabel
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 400 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  const openMenu = (): void => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const left =
      align === 'right'
        ? Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
        : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const top = rect.bottom + 6
    setPosition({
      top,
      left,
      maxHeight: Math.max(160, window.innerHeight - top - 12)
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (): void => setOpen(false)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={open ? () => setOpen(false) : openMenu}
        className={cn('outline-none', triggerClassName)}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <div
              role="menu"
              style={{ top: position.top, left: position.left, width, maxHeight: position.maxHeight }}
              className={cn(
                'animate-modal-in fixed z-[71] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900',
                contentClassName
              )}
            >
              {children(() => setOpen(false))}
            </div>
          </>,
          document.body
        )}
    </>
  )
}

export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  dividerBefore?: boolean
}

export function DropdownMenu({ items, close }: { items: MenuItem[]; close: () => void }) {
  return (
    <>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {item.dividerBefore && <div className="my-1 border-t border-slate-100 dark:border-slate-800" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onClick()
              close()
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
              item.danger
                ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            )}
          >
            {item.icon && <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span>}
            {item.label}
          </button>
        </div>
      ))}
    </>
  )
}
