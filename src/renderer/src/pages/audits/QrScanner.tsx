import { useEffect, useId, useRef, useState } from 'react'
import { Camera, CameraOff, ScanLine } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'

interface QrScannerProps {
  onScan: (text: string) => void
  disabled?: boolean
  className?: string
}

export function QrScanner({ onScan, disabled, className }: QrScannerProps) {
  const elementId = useId().replace(/[:]/g, '')
  const scannerRef = useRef<{
    stop: () => Promise<void>
    clear: () => void
  } | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [starting, setStarting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stop = async (): Promise<void> => {
    const scanner = scannerRef.current
    scannerRef.current = null
    setScanning(false)
    if (!scanner) return
    try {
      await scanner.stop()
      scanner.clear()
    } catch {
      // camera đã dừng
    }
  }

  useEffect(() => {
    return () => {
      void stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async (): Promise<void> => {
    setError(null)
    setStarting(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          onScanRef.current(decodedText)
          void stop()
        },
        () => undefined
      )
      setScanning(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Không thể mở camera: ${err.message}`
          : 'Không thể mở camera. Vui lòng kiểm tra quyền truy cập.'
      )
      scannerRef.current = null
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 p-3 dark:border-slate-700', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
            <ScanLine className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">Quét QR bằng camera</p>
            <p className="text-[10.5px] text-slate-400">Đưa mã QR trên nhãn thiết bị vào khung hình</p>
          </div>
        </div>
        {scanning ? (
          <Button size="sm" variant="outline" leftIcon={<CameraOff className="h-3.5 w-3.5" />} onClick={() => void stop()}>
            Dừng
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            loading={starting}
            disabled={disabled}
            leftIcon={<Camera className="h-3.5 w-3.5" />}
            onClick={() => void start()}
          >
            Mở camera
          </Button>
        )}
      </div>

      <div
        id={elementId}
        className={cn(
          'mt-3 overflow-hidden rounded-lg bg-slate-950',
          scanning ? 'block min-h-[220px] [&_video]:w-full [&_video]:rounded-lg' : 'hidden'
        )}
      />

      {error && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {error}
        </p>
      )}
      {!scanning && !error && (
        <p className="mt-2 text-[10.5px] text-slate-400">
          Nếu camera không khả dụng, bạn có thể nhập mã thiết bị bằng bàn phím hoặc đầu đọc mã vạch.
        </p>
      )}
    </div>
  )
}
