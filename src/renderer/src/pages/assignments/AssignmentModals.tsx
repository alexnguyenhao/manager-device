import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, CircleAlert, MonitorSmartphone, Search, UserRound } from 'lucide-react'
import type {
  Asset,
  AssetCondition,
  Assignment,
  Department,
  Employee,
  Location
} from '@shared/types'
import { ASSET_CONDITION_META } from '@shared/constants'
import { formatDate, todayISO } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { toast } from '../../store/toast'
import { cn } from '../../lib/cn'

interface AssignmentFormModalProps {
  open: boolean
  presetAssetId: number | null
  assets: Asset[]
  employees: Employee[]
  departments: Department[]
  onClose: () => void
  onSaved: (assignment: Assignment) => void
}

export function AssignmentFormModal({
  open,
  presetAssetId,
  assets,
  employees,
  departments,
  onClose,
  onSaved
}: AssignmentFormModalProps) {
  const [assetSearch, setAssetSearch] = useState('')
  const [assetId, setAssetId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [assignedDate, setAssignedDate] = useState(todayISO())
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [conditionBefore, setConditionBefore] = useState<AssetCondition>('good')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAssetId(presetAssetId ? String(presetAssetId) : '')
    setEmployeeId('')
    setDepartmentId('')
    setAssignedDate(todayISO())
    setExpectedReturnDate('')
    setNote('')
    setError(null)
    setAssetSearch('')
    const preset = assets.find((asset) => asset.id === presetAssetId)
    setConditionBefore(preset?.condition ?? 'good')
    // Chỉ đồng bộ lại khi mở modal hoặc đổi thiết bị được chọn trước
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetAssetId])

  const filteredAssets = useMemo(() => {
    const term = assetSearch.trim().toLowerCase()
    const list = term
      ? assets.filter(
          (asset) =>
            asset.name.toLowerCase().includes(term) ||
            asset.code.toLowerCase().includes(term) ||
            (asset.serialNumber ?? '').toLowerCase().includes(term)
        )
      : assets
    return list.slice(0, 40)
  }, [assets, assetSearch])

  const selectedAsset = assets.find((asset) => String(asset.id) === assetId)
  const selectedEmployee = employees.find((employee) => String(employee.id) === employeeId)

  const selectAsset = (asset: Asset): void => {
    setAssetId(String(asset.id))
    setConditionBefore(asset.condition)
  }

  const onEmployeeChange = (value: string): void => {
    setEmployeeId(value)
    const employee = employees.find((item) => String(item.id) === value)
    setDepartmentId(employee?.departmentId ? String(employee.departmentId) : '')
  }

  const submit = async (): Promise<void> => {
    if (!assetId) {
      setError('Vui lòng chọn thiết bị cần cấp phát.')
      return
    }
    if (!employeeId) {
      setError('Vui lòng chọn nhân viên nhận thiết bị.')
      return
    }
    if (!assignedDate) {
      setError('Vui lòng chọn ngày cấp phát.')
      return
    }
    if (expectedReturnDate && expectedReturnDate < assignedDate) {
      setError('Ngày dự kiến thu hồi phải sau ngày cấp phát.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const assignment = await api.assignments.create({
        assetId: Number(assetId),
        employeeId: Number(employeeId),
        departmentId: departmentId ? Number(departmentId) : null,
        assignedDate,
        expectedReturnDate: expectedReturnDate || null,
        conditionBefore,
        note: note.trim() || null
      })
      toast.success('Đã cấp phát thiết bị', `${assignment.assetCode} → ${assignment.employeeName}`)
      onSaved(assignment)
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
      title="Cấp phát thiết bị"
      description="Bàn giao thiết bị cho nhân viên và ghi nhận tình trạng trước khi sử dụng."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button loading={saving} leftIcon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => void submit()}>
            Xác nhận cấp phát
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

        <div>
          <label className="label">Thiết bị cần cấp phát <span className="text-rose-500">*</span></label>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Tìm theo mã, tên hoặc serial…"
              className="pl-9"
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto rounded-xl border border-slate-200 p-1.5 dark:border-slate-700">
            {filteredAssets.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-slate-400">
                Không có thiết bị sẵn sàng để cấp phát.
              </p>
            ) : (
              filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => selectAsset(asset)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                    assetId === String(asset.id)
                      ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <MonitorSmartphone className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                      {asset.name}
                    </span>
                    <span className="block truncate font-mono text-[10.5px] text-slate-400">
                      {asset.code}
                      {asset.serialNumber ? ` · ${asset.serialNumber}` : ''}
                    </span>
                  </span>
                  {assetId === String(asset.id) && <Badge tone="info">Đã chọn</Badge>}
                </button>
              ))
            )}
          </div>
          {selectedAsset && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <MonitorSmartphone className="h-3.5 w-3.5" />
              Đã chọn <strong className="text-slate-700 dark:text-slate-200">{selectedAsset.code}</strong> ·{' '}
              {selectedAsset.categoryName} · Vị trí: {selectedAsset.locationName ?? '—'}
            </div>
          )}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Nhân viên nhận" required htmlFor="assign-employee">
            <Select id="assign-employee" value={employeeId} onChange={(event) => onEmployeeChange(event.target.value)}>
              <option value="">Chọn nhân viên…</option>
              {employees
                .filter((employee) => employee.isActive)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                    {employee.code ? ` (${employee.code})` : ''}
                  </option>
                ))}
            </Select>
          </Field>
          <Field
            label="Bộ phận"
            hint={selectedEmployee?.position ?? 'Tự động theo bộ phận của nhân viên.'}
            htmlFor="assign-department"
          >
            <Select id="assign-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">Chưa phân bộ phận</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày cấp phát" required htmlFor="assign-date">
            <Input
              id="assign-date"
              type="date"
              value={assignedDate}
              max={todayISO()}
              onChange={(event) => setAssignedDate(event.target.value)}
            />
          </Field>
          <Field label="Dự kiến thu hồi" htmlFor="assign-return-date">
            <Input
              id="assign-return-date"
              type="date"
              value={expectedReturnDate}
              min={assignedDate}
              onChange={(event) => setExpectedReturnDate(event.target.value)}
            />
          </Field>
          <Field label="Tình trạng khi bàn giao" htmlFor="assign-condition">
            <Select
              id="assign-condition"
              value={conditionBefore}
              onChange={(event) => setConditionBefore(event.target.value as AssetCondition)}
            >
              {(Object.keys(ASSET_CONDITION_META) as AssetCondition[]).map((value) => (
                <option key={value} value={value}>
                  {ASSET_CONDITION_META[value].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Thông tin bàn giao" htmlFor="assign-note" className="sm:col-span-2">
            <Textarea
              id="assign-note"
              value={note}
              placeholder="Phụ kiện đi kèm, tình trạng máy, ghi chú bàn giao…"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>

        {selectedAsset && selectedEmployee && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-3 text-[12px] text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
            <div className="flex items-center gap-2 font-medium">
              <UserRound className="h-3.5 w-3.5" />
              Xác nhận bàn giao
            </div>
            <p className="mt-1 leading-relaxed">
              Cấp phát <strong>{selectedAsset.name}</strong> ({selectedAsset.code}) cho{' '}
              <strong>{selectedEmployee.fullName}</strong> từ ngày {formatDate(assignedDate)}.
              Thiết bị sẽ chuyển sang trạng thái "Đang sử dụng".
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

interface ReturnAssignmentModalProps {
  open: boolean
  assignment: Assignment | null
  locations: Location[]
  onClose: () => void
  onSaved: () => void
}

export function ReturnAssignmentModal({
  open,
  assignment,
  locations,
  onClose,
  onSaved
}: ReturnAssignmentModalProps) {
  const [returnedDate, setReturnedDate] = useState(todayISO())
  const [conditionAfter, setConditionAfter] = useState<AssetCondition>('good')
  const [locationId, setLocationId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !assignment) return
    setReturnedDate(todayISO())
    setConditionAfter(assignment.conditionBefore ?? 'good')
    setLocationId('')
    setNote('')
    setError(null)
  }, [open, assignment])

  const submit = async (): Promise<void> => {
    if (!assignment) return
    if (!returnedDate) {
      setError('Vui lòng chọn ngày thu hồi.')
      return
    }
    if (returnedDate < assignment.assignedDate) {
      setError('Ngày thu hồi không thể trước ngày cấp phát.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.assignments.returnAsset({
        assignmentId: assignment.id,
        returnedDate,
        conditionAfter,
        locationId: locationId ? Number(locationId) : null,
        note: note.trim() || null
      })
      toast.success('Đã thu hồi thiết bị', `${assignment.assetCode} từ ${assignment.employeeName}`)
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!assignment) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Thu hồi thiết bị"
      description={`${assignment.code} · ${assignment.assetName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            Xác nhận thu hồi
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
          <div className="flex justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">Người sử dụng</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{assignment.employeeName}</span>
          </div>
          <div className="mt-1.5 flex justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">Ngày cấp phát</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {formatDate(assignment.assignedDate)}
            </span>
          </div>
          {assignment.expectedReturnDate && (
            <div className="mt-1.5 flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Dự kiến thu hồi</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formatDate(assignment.expectedReturnDate)}
              </span>
            </div>
          )}
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Ngày thu hồi" required htmlFor="return-date">
            <Input
              id="return-date"
              type="date"
              value={returnedDate}
              min={assignment.assignedDate}
              onChange={(event) => setReturnedDate(event.target.value)}
            />
          </Field>
          <Field label="Tình trạng khi thu hồi" htmlFor="return-condition">
            <Select
              id="return-condition"
              value={conditionAfter}
              onChange={(event) => setConditionAfter(event.target.value as AssetCondition)}
            >
              {(Object.keys(ASSET_CONDITION_META) as AssetCondition[]).map((value) => (
                <option key={value} value={value}>
                  {ASSET_CONDITION_META[value].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vị trí lưu kho sau thu hồi" htmlFor="return-location" className="sm:col-span-2">
            <Select id="return-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              <option value="">Giữ nguyên vị trí hiện tại</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú thu hồi" htmlFor="return-note" className="sm:col-span-2">
            <Textarea
              id="return-note"
              value={note}
              placeholder="Tình trạng thực tế, phụ kiện còn thiếu, hư hỏng…"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        <p className="text-[11.5px] text-slate-400">
          Sau khi thu hồi, thiết bị sẽ chuyển về trạng thái "Sẵn sàng" (trừ khi đang bảo trì, đã thanh lý hoặc thất lạc).
        </p>
      </div>
    </Modal>
  )
}
