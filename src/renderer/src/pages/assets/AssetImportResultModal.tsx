import { AlertTriangle, CheckCircle2, FileSpreadsheet, XCircle } from 'lucide-react'
import type { ImportResult } from '@shared/types'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

interface AssetImportResultModalProps {
  open: boolean
  result: ImportResult | null
  onClose: () => void
  onImported: () => void
}

export function AssetImportResultModal({ open, result, onClose, onImported }: AssetImportResultModalProps) {
  if (!result) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Kết quả nhập Excel"
      description={result.filePath ? `Tệp: ${result.filePath}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {result.imported > 0 && (
            <Button
              onClick={() => {
                onImported()
                onClose()
              }}
            >
              Xem danh sách thiết bị
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[11.5px] font-semibold uppercase tracking-wide">Thành công</span>
          </div>
          <p className="mt-1 text-[24px] font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
            {result.imported}
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <XCircle className="h-4 w-4" />
            <span className="text-[11.5px] font-semibold uppercase tracking-wide">Lỗi</span>
          </div>
          <p className="mt-1 text-[24px] font-semibold tabular-nums text-rose-800 dark:text-rose-300">
            {result.failed}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="text-[11.5px] font-semibold uppercase tracking-wide">Tổng dòng</span>
          </div>
          <p className="mt-1 text-[24px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {result.imported + result.failed}
          </p>
        </div>
      </div>

      {result.errors.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              Chi tiết lỗi
            </h3>
            <Badge tone="warning">{result.errors.length}</Badge>
          </div>
          <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Dòng</th>
                  <th className="px-3 py-2 font-semibold">Nội dung lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {result.errors.map((error, index) => (
                  <tr key={`${error.row}-${index}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-500">{error.row}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          Tất cả thiết bị đã được nhập thành công vào hệ thống.
        </div>
      )}
    </Modal>
  )
}
