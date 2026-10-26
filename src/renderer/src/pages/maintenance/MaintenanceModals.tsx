import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Search, Wrench } from 'lucide-react'
import type {
  Asset,
  MaintenanceInput,
  MaintenancePriority,
  MaintenanceRecord,
  MaintenanceType
} from '@shared/types'
import {
  MAINTENANCE_PRIORITY_META,
  MAINTENANCE_TYPE_META
} from '@shared/constants'
import { formatCurrency, todayISO } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { toast } from '../../store/toast'
import { cn } from '../../lib/cn'

interface MaintenanceFormModalProps {
  open: boolean
  record: MaintenanceRecord | null
  presetAssetId: number | null
  assets: Asset[]
  onClose: () => void
  onSaved: () => void
}

export function MaintenanceFormModal({
  open,
  record,
  presetAssetId,
  assets,
  onClose,
  onSaved
}: MaintenanceFormModalProps) {
  const [assetSearch, setAssetSearch] = useState('')
  const [assetId, setAssetId] = useState('')
  const [type, setType] = useState<MaintenanceType>('preventive')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<MaintenancePriority>('normal')
  const [scheduledDate, setScheduledDate] = useState(todayISO())
  const [provider, setProvider] = useState('')
  const [assignee, setAssignee] = useState('')
  const [cost, setCost] = useState('')
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setAssetSearch('')
    if (record) {
      setAssetId(String(record.assetId))
      setType(record.type)
      setTitle(record.title)
      setPriority(record.priority)
      setScheduledDate(record.scheduledDate ?? todayISO())
      setProvider(record.provider ?? '')
      setAssignee(record.assignee ?? '')
      setCost(record.cost ? String(record.cost) : '')
      setDescription(record.description ?? '')
      setNote(record.note ?? '')
    } else {
      setAssetId(presetAssetId ? String(presetAssetId) : '')
      setType('preventive')
      setTitle('')
      setPriority('normal')
      setScheduledDate(todayISO())
      setProvider('')
      setAssignee('')
      setCost('')
      setDescription('')
      setNote('')
    }
  }, [open, record, presetAssetId])

  const filteredAssets = useMemo(() => {
    const term = assetSearch.trim().toLowerCase()
    return assets
      .filter(
        (asset) =>
          !term ||
          asset.name.toLowerCase().includes(term) ||
          asset.code.toLowerCase().includes(term) ||
          (asset.serialNumber ?? '').toLowerCase().includes(term)
      )
      .slice(0, 40)
  }, [assets, assetSearch])

  const selectedAsset = assets.find((asset) => String(asset.id) === assetId)

  const submit = async (): Promise<void> => {
    if (!assetId) {
      setError('Vui lòng chọn thiết bị cần bảo trì.')
      return
    }
    if (title.trim().length < 2) {
      setError('Vui lòng nhập nội dung bảo trì.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: MaintenanceInput = {
      assetId: Number(assetId),
      type,
      title: title.trim(),
      description: description.trim() || null,
      provider: provider.trim() || null,
      assignee: assignee.trim() || null,
      scheduledDate: scheduledDate || null,
      cost: Number(cost) || 0,
      priority,
      note: note.trim() || null
    }
    try {
      if (record) {
        await api.maintenance.update({ id: record.id, ...payload })
      } else {
        await api.maintenance.create(payload)
      }
      toast.success(record ? 'Đã cập nhật phiếu bảo trì' : 'Đã tạo phiếu bảo trì', title.trim())
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={record ? 'Chỉnh sửa phiếu bảo trì' : 'Tạo phiếu bảo trì'}
      description={
        record
          ? `${record.code} · ${record.assetName}`
          : 'Lập kế hoạch bảo dưỡng, sửa chữa hoặc kiểm tra thiết bị.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button loading={saving} leftIcon={<Wrench className="h-4 w-4" />} onClick={() => void submit()}>
            {record ? 'Lưu thay đổi' : 'Tạo phiếu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        {!record ? (
          <div>
            <label className="label">
              Thiết bị <span className="text-rose-500">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                placeholder="Tìm thiết bị theo mã, tên, serial…"
                className="pl-9"
              />
            </div>
            <div className="max-h-[160px] overflow-y-auto rounded-xl border border-slate-200 p-1.5 dark:border-slate-700">
              {filteredAssets.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] text-slate-400">Không tìm thấy thiết bị.</p>
              ) : (
                filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setAssetId(String(asset.id))}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                      assetId === String(asset.id)
                        ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                        {asset.name}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] text-slate-400">
                        {asset.code} · {asset.categoryName}
                      </span>
                    </span>
                    {assetId === String(asset.id) && <Badge tone="info">Đã chọn</Badge>}
                  </button>
                ))
              )}
            </div>
            {selectedAsset && (
              <p className="mt-1.5 text-[11.5px] text-slate-400">
                Đang chọn <strong className="text-slate-600 dark:text-slate-300">{selectedAsset.code}</strong> ·{' '}
                {selectedAsset.departmentName ?? 'Chưa phân bộ phận'} · {selectedAsset.locationName ?? 'Chưa có vị trí'}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] dark:bg-slate-800/50">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Thiết bị</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">{record.assetName}</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Mã thiết bị</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-100">{record.assetCode}</span>
            </div>
          </div>
        )}

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Loại bảo trì" htmlFor="maint-type">
            <Select id="maint-type" value={type} onChange={(event) => setType(event.target.value as MaintenanceType)}>
              {(Object.keys(MAINTENANCE_TYPE_META) as MaintenanceType[]).map((value) => (
                <option key={value} value={value}>
                  {MAINTENANCE_TYPE_META[value].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mức ưu tiên" htmlFor="maint-priority">
            <Select
              id="maint-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as MaintenancePriority)}
            >
              {(Object.keys(MAINTENANCE_PRIORITY_META) as MaintenancePriority[]).map((value) => (
                <option key={value} value={value}>
                  {MAINTENANCE_PRIORITY_META[value].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nội dung bảo trì" required className="sm:col-span-2" htmlFor="maint-title">
            <Input
              id="maint-title"
              value={title}
              placeholder="VD: Bảo dưỡng định kỳ 6 tháng, thay keo tản nhiệt…"
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Ngày thực hiện dự kiến" htmlFor="maint-date">
            <Input
              id="maint-date"
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
          </Field>
          <Field label="Chi phí dự kiến (VNĐ)" htmlFor="maint-cost">
            <Input
              id="maint-cost"
              type="number"
              min={0}
              step={50000}
              value={cost}
              placeholder="0"
              onChange={(event) => setCost(event.target.value)}
            />
          </Field>
          <Field label="Nhà cung cấp / đơn vị bảo trì" htmlFor="maint-provider">
            <Input
              id="maint-provider"
              value={provider}
              placeholder="Công ty sửa chữa, trung tâm bảo hành…"
              onChange={(event) => setProvider(event.target.value)}
            />
          </Field>
          <Field label="Người phụ trách" htmlFor="maint-assignee">
            <Input
              id="maint-assignee"
              value={assignee}
              placeholder="Kỹ thuật viên / nhân viên theo dõi"
              onChange={(event) => setAssignee(event.target.value)}
            />
          </Field>
          <Field label="Mô tả chi tiết" htmlFor="maint-description" className="sm:col-span-2">
            <Textarea
              id="maint-description"
              value={description}
              placeholder="Tình trạng lỗi, phạm vi công việc, linh kiện cần thay…"
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label="Ghi chú" htmlFor="maint-note" className="sm:col-span-2">
            <Input
              id="maint-note"
              value={note}
              placeholder="Ghi chú thêm (không bắt buộc)"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

interface CompleteMaintenanceModalProps {
  open: boolean
  record: MaintenanceRecord | null
  onClose: () => void
  onSaved: () => void
}

export function CompleteMaintenanceModal({
  open,
  record,
  onClose,
  onSaved
}: CompleteMaintenanceModalProps) {
  const [result, setResult] = useState('')
  const [cost, setCost] = useState('')
  const [completedDate, setCompletedDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !record) return
    setResult('')
    setCost(record.cost ? String(record.cost) : '')
    setCompletedDate(todayISO())
    setError(null)
  }, [open, record])

  const submit = async (): Promise<void> => {
    if (!record) return
    if (result.trim().length < 2) {
      setError('Vui lòng nhập kết quả bảo trì.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.maintenance.complete(record.id, {
        result: result.trim(),
        cost: Number(cost) || 0,
        completedDate
      })
      toast.success('Đã hoàn thành bảo trì', `${record.code} · ${record.assetName}`)
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!record) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Hoàn thành bảo trì"
      description={`${record.code} · ${record.assetName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button loading={saving} variant="success" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => void submit()}>
            Xác nhận hoàn thành
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] dark:bg-slate-800/50">
          <p className="font-medium text-slate-800 dark:text-slate-100">{record.title}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            {MAINTENANCE_TYPE_META[record.type].label} · Lên lịch {record.scheduledDate ? record.scheduledDate.slice(8, 10) + '/' + record.scheduledDate.slice(5, 7) + '/' + record.scheduledDate.slice(0, 4) : '—'}
          </p>
        </div>
        <Field label="Kết quả bảo trì" required htmlFor="complete-result">
          <Textarea
            id="complete-result"
            value={result}
            placeholder="Mô tả công việc đã thực hiện, linh kiện thay thế, tình trạng thiết bị sau bảo trì…"
            onChange={(event) => setResult(event.target.value)}
          />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Chi phí thực tế (VNĐ)" htmlFor="complete-cost">
            <Input
              id="complete-cost"
              type="number"
              min={0}
              step={50000}
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </Field>
          <Field label="Ngày hoàn thành" htmlFor="complete-date">
            <Input
              id="complete-date"
              type="date"
              value={completedDate}
              onChange={(event) => setCompletedDate(event.target.value)}
            />
          </Field>
        </div>
        {Number(cost) > 0 && (
          <p className="text-[11.5px] text-slate-400">
            Chi phí sẽ được ghi nhận vào báo cáo bảo trì: {formatCurrency(Number(cost))}.
          </p>
        )}
      </div>
    </Modal>
  )
}
