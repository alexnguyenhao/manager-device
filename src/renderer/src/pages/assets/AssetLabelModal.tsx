import { useEffect, useMemo, useState } from 'react'
import { Printer, QrCode, Tag } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Asset } from '@shared/types'
import { api } from '../../lib/api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Select } from '../../components/ui/Input'
import { formatDate } from '@shared/utils'

interface AssetLabelModalProps {
  open: boolean
  assets: Asset[]
  onClose: () => void
}

export function AssetLabelModal({ open, assets, onClose }: AssetLabelModalProps) {
  const [copies, setCopies] = useState('1')
  const [companyName, setCompanyName] = useState('Manager Device')

  useEffect(() => {
    if (!open) return
    setCopies('1')
    api.settings
      .get()
      .then((settings) => setCompanyName(settings.companyName || 'Manager Device'))
      .catch(() => setCompanyName('Manager Device'))
  }, [open])

  const labels = useMemo(() => {
    const count = Math.max(1, Math.min(6, Number(copies) || 1))
    const list: Array<{ key: string; asset: Asset }> = []
    for (const asset of assets) {
      for (let index = 0; index < count; index++) {
        list.push({ key: `${asset.id}-${index}`, asset })
      }
    }
    return list
  }, [assets, copies])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="3xl"
      title="In nhãn QR thiết bị"
      description={`${assets.length} thiết bị · ${labels.length} nhãn sẽ được in trên khổ A4.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            In nhãn
          </Button>
        </>
      }
    >
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/50">
        <Field label="Số nhãn mỗi thiết bị" className="w-40">
          <Select value={copies} onChange={(event) => setCopies(event.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {value} nhãn
              </option>
            ))}
          </Select>
        </Field>
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
          <QrCode className="h-3.5 w-3.5" />
          Mã QR chứa mã thiết bị, dùng để quét khi kiểm kê.
        </p>
      </div>

      <div className="print-area rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="labels-sheet">
          {labels.map(({ key, asset }) => (
            <div
              key={key}
              className="asset-label flex flex-col justify-between overflow-hidden rounded-md border border-dashed border-slate-300 bg-white p-1.5 text-slate-900"
            >
              <div className="flex items-start gap-1.5">
                <QRCodeSVG value={asset.code} size={42} level="M" marginSize={0} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[6.5px] font-semibold uppercase tracking-wide text-slate-500">
                    {companyName}
                  </p>
                  <p className="truncate font-mono text-[9.5px] font-bold leading-tight">{asset.code}</p>
                  <p className="line-clamp-2 text-[6.5px] leading-tight text-slate-600">{asset.name}</p>
                </div>
              </div>
              <div className="mt-0.5 flex items-end justify-between gap-1 border-t border-slate-200 pt-0.5">
                <span className="truncate text-[5.5px] text-slate-500">{asset.categoryName}</span>
                <span className="shrink-0 text-[5.5px] text-slate-400">
                  {formatDate(asset.purchaseDate)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="no-print mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Tag className="h-3 w-3" />
        Mẹo: chọn "Save as PDF" trong hộp thoại in nếu bạn muốn lưu nhãn thành tệp.
      </div>
    </Modal>
  )
}
