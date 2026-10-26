import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setOptions(next)
    })
  }, [])

  const finish = (value: boolean): void => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const danger = options?.variant !== 'primary'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(options)}
        onClose={() => finish(false)}
        size="sm"
        hideClose
        footer={
          <>
            <Button variant="outline" onClick={() => finish(false)}>
              {options?.cancelText ?? 'Hủy bỏ'}
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={() => finish(true)}>
              {options?.confirmText ?? 'Xác nhận'}
            </Button>
          </>
        }
      >
        <div className="flex gap-4 py-1">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              danger
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
            }`}
          >
            {danger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </div>
          <div className="pt-0.5">
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
              {options?.title ?? 'Xác nhận'}
            </h3>
            {options?.description && (
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                {options.description}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used inside ConfirmProvider')
  return context
}
