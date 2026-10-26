import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  CircleAlert,
  MapPin,
  UserRound
} from 'lucide-react'
import type {
  AuditDetail,
  AuditItem,
  AuditResult,
  AuditSession,
  Department,
  Employee,
  Location
} from '@shared/types'
import {
  AUDIT_RESULT_META,
  AUDIT_RESULT_OPTIONS
} from '@shared/constants'
import { formatDate, todayISO } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { toast } from '../../store/toast'

interface AuditCreateModalProps {
  open: boolean
  departments: Department[]
  locations: Location[]
  onClose: () => void
  onCreated: (session: AuditSession) => void
}

export function AuditCreateModal({
  open,
  departments,
  locations,
  onClose,
  onCreated
}: AuditCreateModalProps) {
  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const now = new Date()
    setName(`Kiểm kê thiết bị tháng ${now.getMonth() + 1}/${now.getFullYear()}`)
    setDepartmentId('')
    setLocationId('')
    setStartDate(todayISO())
    setEndDate(todayISO())
    setNote('')
    setError(null)
  }, [open])

  const submit = async (): Promise<void> => {
    if (name.trim().length < 2) {
      setError('Vui lòng nhập tên phiên kiểm kê.')
      return
    }
    if (!startDate) {
      setError('Vui lòng chọn ngày bắt đầu.')
      return
    }
    if (endDate && endDate < startDate) {
      setError('Ngày kết thúc phải sau ngày bắt đầu.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const session = await api.audits.create({
        name: name.trim(),
        departmentId: departmentId ? Number(departmentId) : null,
        locationId: locationId ? Number(locationId) : null,
        startDate,
        endDate: endDate || null,
        note: note.trim() || null
      })
      toast.success('Đã tạo phiên kiểm kê', `${session.code} · ${session.totalItems} thiết bị`)
      onCreated(session)
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
      title="Tạo phiên kiểm kê"
      description="Hệ thống sẽ chụp lại vị trí và người sử dụng hiện tại của thiết bị để đối chiếu."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button loading={saving} leftIcon={<ClipboardCheck className="h-4 w-4" />} onClick={() => void submit()}>
            Tạo phiên kiểm kê
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
        <Field label="Tên phiên kiểm kê" required htmlFor="audit-name">
          <Input
            id="audit-name"
            value={name}
            placeholder="Kiểm kê thiết bị quý IV/2026"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="Bộ phận"
            hint="Bỏ trống để kiểm kê tất cả bộ phận."
            htmlFor="audit-department"
          >
            <Select id="audit-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">Tất cả bộ phận</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vị trí" hint="Bỏ trống để kiểm kê tất cả vị trí." htmlFor="audit-location">
            <Select id="audit-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              <option value="">Tất cả vị trí</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày bắt đầu" required htmlFor="audit-start">
            <Input
              id="audit-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
          <Field label="Ngày kết thúc dự kiến" htmlFor="audit-end">
            <Input
              id="audit-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
          <Field label="Ghi chú" htmlFor="audit-note" className="sm:col-span-2">
            <Textarea
              id="audit-note"
              value={note}
              placeholder="Phạm vi, người phối hợp, lưu ý khi kiểm kê…"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        <div className="rounded-xl bg-blue-50/70 px-3.5 py-3 text-[11.5px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          Danh sách thiết bị được chụp tại thời điểm tạo phiên. Thiết bị đã thanh lý sẽ không được đưa vào kiểm kê.
        </div>
      </div>
    </Modal>
  )
}

interface AuditItemModalProps {
  open: boolean
  item: AuditItem | null
  locations: Location[]
  employees: Employee[]
  onClose: () => void
  onSaved: (detail: AuditDetail) => void
}

export function AuditItemModal({
  open,
  item,
  locations,
  employees,
  onClose,
  onSaved
}: AuditItemModalProps) {
  const [result, setResult] = useState<AuditResult>('matched')
  const [actualLocationId, setActualLocationId] = useState('')
  const [actualEmployeeId, setActualEmployeeId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !item) return
    setResult(item.result === 'pending' ? 'matched' : item.result)
    setActualLocationId(item.actualLocationId ? String(item.actualLocationId) : '')
    setActualEmployeeId(item.actualEmployeeId ? String(item.actualEmployeeId) : '')
    setNote(item.note ?? '')
    setError(null)
  }, [open, item])

  const submit = async (): Promise<void> => {
    if (!item) return
    setSaving(true)
    setError(null)
    try {
      const detail = await api.audits.updateItem({
        itemId: item.id,
        result,
        actualLocationId: actualLocationId ? Number(actualLocationId) : null,
        actualEmployeeId: actualEmployeeId ? Number(actualEmployeeId) : null,
        note: note.trim() || null
      })
      toast.success('Đã cập nhật kết quả kiểm kê', item.assetCode)
      onSaved(detail)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Cập nhật kết quả kiểm kê"
      description={`${item.assetCode} · ${item.assetName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            Lưu kết quả
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
        <div className="grid gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] dark:bg-slate-800/50">
          <div className="flex items-start justify-between gap-3">
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" /> Vị trí dự kiến
            </span>
            <span className="text-right font-medium text-slate-800 dark:text-slate-100">
              {item.expectedLocationName ?? 'Chưa xác định'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <UserRound className="h-3.5 w-3.5" /> Người sử dụng dự kiến
            </span>
            <span className="text-right font-medium text-slate-800 dark:text-slate-100">
              {item.expectedEmployeeName ?? 'Chưa cấp phát'}
            </span>
          </div>
          {item.scannedByName && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Đã quét bởi</span>
              <span className="text-right text-slate-600 dark:text-slate-300">
                {item.scannedByName} · {item.scannedAt ? formatDate(item.scannedAt) : ''}
              </span>
            </div>
          )}
        </div>
        <Field label="Kết quả kiểm kê" required htmlFor="audit-result">
          <Select id="audit-result" value={result} onChange={(event) => setResult(event.target.value as AuditResult)}>
            {AUDIT_RESULT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {AUDIT_RESULT_META[value].label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Vị trí thực tế" htmlFor="audit-actual-location">
            <Select
              id="audit-actual-location"
              value={actualLocationId}
              onChange={(event) => setActualLocationId(event.target.value)}
            >
              <option value="">Giữ nguyên / chưa xác định</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Người sử dụng thực tế" htmlFor="audit-actual-employee">
            <Select
              id="audit-actual-employee"
              value={actualEmployeeId}
              onChange={(event) => setActualEmployeeId(event.target.value)}
            >
              <option value="">Giữ nguyên / chưa xác định</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú" htmlFor="audit-item-note" className="sm:col-span-2">
            <Textarea
              id="audit-item-note"
              value={note}
              placeholder="Tình trạng thực tế, vị trí mới, người bàn giao…"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

interface AuditCompleteModalProps {
  open: boolean
  session: AuditSession | null
  onClose: () => void
  onCompleted: () => void
}

export function AuditCompleteModal({
  open,
  session,
  onClose,
  onCompleted
}: AuditCompleteModalProps) {
  const [applyActualLocation, setApplyActualLocation] = useState(false)
  const [markMissingAsLost, setMarkMissingAsLost] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setApplyActualLocation(false)
    setMarkMissingAsLost(false)
    setError(null)
  }, [open])

  const submit = async (): Promise<void> => {
    if (!session) return
    setSaving(true)
    setError(null)
    try {
      await api.audits.complete({
        sessionId: session.id,
        applyActualLocation,
        markMissingAsLost
      })
      toast.success('Đã hoàn thành kiểm kê', `${session.code} · ${session.name}`)
      onCompleted()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!session) return null
  const pending = session.totalItems - session.scannedItems

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Hoàn thành phiên kiểm kê"
      description={`${session.code} · ${session.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button loading={saving} variant="success" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => void submit()}>
            Chốt kết quả
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Tổng', value: session.totalItems, tone: 'text-slate-800 dark:text-slate-100' },
            { label: 'Đã kiểm', value: session.scannedItems, tone: 'text-blue-600 dark:text-blue-400' },
            { label: 'Đúng', value: session.matchedItems, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Thiếu', value: session.missingItems, tone: 'text-rose-600 dark:text-rose-400' }
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
              <p className="text-[10.5px] uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className={`text-[19px] font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {pending > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Còn <strong>{pending}</strong> thiết bị chưa được kiểm. Các thiết bị này sẽ giữ trạng thái "Chưa kiểm".
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
          <Checkbox
            checked={applyActualLocation}
            onChange={(event) => setApplyActualLocation(event.target.checked)}
            label="Cập nhật vị trí thực tế vào hồ sơ thiết bị"
          />
          <p className="-mt-1 ml-6 text-[11px] text-slate-400">
            Áp dụng cho các thiết bị có ghi nhận vị trí thực tế khác với hồ sơ.
          </p>
          <Checkbox
            checked={markMissingAsLost}
            onChange={(event) => setMarkMissingAsLost(event.target.checked)}
            label="Đánh dấu thiết bị không tìm thấy là thất lạc"
          />
          <p className="-mt-1 ml-6 text-[11px] text-slate-400">
            Thiết bị sẽ chuyển sang trạng thái "Thất lạc" và thu hồi cấp phát đang hoạt động.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <Badge tone="neutral">Lưu ý</Badge>
          Sau khi chốt, phiên kiểm kê không thể chỉnh sửa kết quả.
        </div>

        <p className="text-[11px] text-slate-400">Ngày hoàn thành: {formatDate(todayISO())}</p>
      </div>
    </Modal>
  )
}
