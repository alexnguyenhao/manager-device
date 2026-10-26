import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore, type ToastKind } from '../../store/toast'
import { cn } from '../../lib/cn'

const META: Record<
  ToastKind,
  { icon: typeof Info; wrap: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    wrap: 'border-emerald-200 bg-white dark:border-emerald-500/25 dark:bg-slate-900',
    iconClass: 'text-emerald-600 dark:text-emerald-400'
  },
  error: {
    icon: XCircle,
    wrap: 'border-rose-200 bg-white dark:border-rose-500/25 dark:bg-slate-900',
    iconClass: 'text-rose-600 dark:text-rose-400'
  },
  warning: {
    icon: AlertTriangle,
    wrap: 'border-amber-200 bg-white dark:border-amber-500/25 dark:bg-slate-900',
    iconClass: 'text-amber-600 dark:text-amber-400'
  },
  info: {
    icon: Info,
    wrap: 'border-blue-200 bg-white dark:border-blue-500/25 dark:bg-slate-900',
    iconClass: 'text-blue-600 dark:text-blue-400'
  }
}

export function Toaster() {
  const items = useToastStore((state) => state.items)
  const dismiss = useToastStore((state) => state.dismiss)

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2.5">
      {items.map((item) => {
        const meta = META[item.kind]
        const Icon = meta.icon
        return (
          <div
            key={item.id}
            className={cn(
              'animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-slate-950/10',
              meta.wrap
            )}
            role="status"
          >
            <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', meta.iconClass)} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">
                {item.title}
              </p>
              {item.description && (
                <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Đóng thông báo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body
  )
}
