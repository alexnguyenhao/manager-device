import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ExternalLink,
  FilePlus2,
  Paperclip,
  RefreshCw,
  Save,
  Trash2,
  Upload
} from 'lucide-react'
import type {
  Asset,
  Department,
  InformationSystem,
  InformationSystemDetail,
  InformationSystemFile,
  SystemDocumentType,
  SystemHostingType,
  SystemLevel,
  SystemStatus
} from '@shared/types'
import {
  SYSTEM_DOCUMENT_TYPE_META,
  SYSTEM_HOSTING_META,
  SYSTEM_LEVEL_META,
  SYSTEM_LEVEL_OPTIONS,
  SYSTEM_STATUS_META,
  SYSTEM_STATUS_OPTIONS,
  systemLevelLabel
} from '@shared/constants'
import { formatDate, formatDateTime, formatNumber } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { Drawer } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { useConfirm } from '../../components/ui/Confirm'

interface Props {
  open: boolean
  onClose: () => void
  system: InformationSystem | null
  departments: Department[]
  assets: Asset[]
  onSaved: () => void
}

interface FormState {
  code: string
  name: string
  description: string
  managingUnit: string
  departmentId: string
  level: string
  decisionNumber: string
  decisionDate: string
  decisionAgency: string
  status: SystemStatus
  hostingType: SystemHostingType
  hostingDetail: string
  assetId: string
}

const EMPTY: FormState = {
  code: '',
  name: '',
  description: '',
  managingUnit: '',
  departmentId: '',
  level: '',
  decisionNumber: '',
  decisionDate: '',
  decisionAgency: '',
  status: 'operating',
  hostingType: 'none',
  hostingDetail: '',
  assetId: ''
}

function stateFrom(system: InformationSystem | null): FormState {
  if (!system) return { ...EMPTY }
  return {
    code: system.code,
    name: system.name,
    description: system.description ?? '',
    managingUnit: system.managingUnit,
    departmentId: system.departmentId ? String(system.departmentId) : '',
    level: system.level ? String(system.level) : '',
    decisionNumber: system.decisionNumber ?? '',
    decisionDate: system.decisionDate ?? '',
    decisionAgency: system.decisionAgency ?? '',
    status: system.status,
    hostingType: system.hostingType,
    hostingDetail: system.hostingDetail ?? '',
    assetId: system.assetId ? String(system.assetId) : ''
  }
}

function fileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function SystemFormDrawer({
  open,
  onClose,
  system,
  departments,
  assets,
  onSaved
}: Props) {
  const user = useCurrentUser()
  const confirm = useConfirm()
  const [form, setForm] = useState<FormState>(stateFrom(system))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<InformationSystemDetail | null>(null)
  const [uploading, setUploading] = useState<SystemDocumentType | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(stateFrom(system))
    setErrors({})
    setDetail(null)
    if (system) {
      api.systems
        .get(system.id)
        .then(setDetail)
        .catch(() => setDetail(null))
    }
  }, [open, system])

  const loadDetail = useCallback(async (id: number) => {
    try {
      setDetail(await api.systems.get(id))
    } catch {
      // bỏ qua
    }
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }

  const suggestCode = async (): Promise<void> => {
    try {
      set('code', await api.systems.nextCode())
    } catch (error) {
      toast.error('Không thể sinh mã', errorMessage(error))
    }
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Vui lòng nhập tên hệ thống thông tin.'
    if (form.managingUnit.trim().length < 2) {
      next.managingUnit = 'Vui lòng nhập đơn vị quản lý, vận hành.'
    }
    if (form.level && !form.decisionNumber.trim()) {
      next.decisionNumber = 'HTTT đã có cấp độ bắt buộc phải nhập số quyết định phê duyệt.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async (): Promise<void> => {
    if (!validate()) return
    setSaving(true)
    try {
      const result = await api.systems.save({
        id: system?.id,
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        description: form.description.trim() || null,
        managingUnit: form.managingUnit.trim(),
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        level: form.level ? (Number(form.level) as SystemLevel) : null,
        decisionNumber: form.decisionNumber.trim() || null,
        decisionDate: form.decisionDate || null,
        decisionAgency: form.decisionAgency.trim() || null,
        status: form.status,
        hostingType: form.hostingType,
        hostingDetail: form.hostingDetail.trim() || null,
        assetId: form.assetId ? Number(form.assetId) : null
      })
      if (result.warnings.length > 0) {
        toast.warning(
          system ? 'Đã cập nhật HTTT' : 'Đã thêm HTTT',
          `${result.system.code}: ${result.warnings.join('; ')}`
        )
      } else {
        toast.success(system ? 'Đã cập nhật HTTT' : 'Đã thêm HTTT', `${result.system.code} · ${result.system.name}`)
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error('Không thể lưu HTTT', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const upload = async (documentType: SystemDocumentType): Promise<void> => {
    if (!system) return
    setUploading(documentType)
    try {
      const file = await api.systems.uploadFile(system.id, documentType)
      if (file) {
        toast.success('Đã đính kèm tệp', file.filename)
        await loadDetail(system.id)
        onSaved()
      }
    } catch (error) {
      toast.error('Không thể đính kèm tệp', errorMessage(error))
    } finally {
      setUploading(null)
    }
  }

  const openFile = async (file: InformationSystemFile): Promise<void> => {
    try {
      await api.systems.openFile(file.id)
    } catch (error) {
      toast.error('Không thể mở tệp', errorMessage(error))
    }
  }

  const removeFile = async (file: InformationSystemFile): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa tệp đính kèm?',
      description: `Tệp "${file.filename}" sẽ bị xóa vĩnh viễn khỏi hồ sơ HTTT.`,
      confirmText: 'Xóa tệp'
    })
    if (!ok) return
    try {
      await api.systems.removeFile(file.id)
      toast.success('Đã xóa tệp', file.filename)
      if (system) await loadDetail(system.id)
      onSaved()
    } catch (error) {
      toast.error('Không thể xóa tệp', errorMessage(error))
    }
  }

  const levelMeta = form.level ? SYSTEM_LEVEL_META[Number(form.level) as SystemLevel] : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={system ? `Cập nhật HTTT · ${system.code}` : 'Thêm hệ thống thông tin'}
      description="Khai báo thông tin hệ thống, cấp độ an toàn và quyết định phê duyệt."
      widthClassName="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            leftIcon={<Save className="h-4 w-4" />}
            onClick={() => void save()}
            loading={saving}
          >
            {system ? 'Lưu thay đổi' : 'Thêm hệ thống'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Mã HTTT"
            hint={system ? 'Có thể sửa mã nếu chưa dùng ở hệ thống khác.' : 'Bỏ trống để tự sinh mã HTTT-0001.'}
          >
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={(event) => set('code', event.target.value.toUpperCase())}
                placeholder="HTTT-0001"
              />
              {!system && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void suggestCode()}
                  aria-label="Tự sinh mã"
                  title="Tự sinh mã"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Field>
          <Field label="Trạng thái" required>
            <Select
              value={form.status}
              onChange={(event) => set('status', event.target.value as SystemStatus)}
            >
              {SYSTEM_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {SYSTEM_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tên hệ thống thông tin" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="VD: Hệ thống Quản lý văn bản và Điều hành"
            invalid={Boolean(errors.name)}
          />
        </Field>

        <Field label="Mô tả / chức năng chính">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Tóm tắt chức năng, phạm vi phục vụ của hệ thống…"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Đơn vị quản lý, vận hành" required error={errors.managingUnit}>
            <Input
              value={form.managingUnit}
              onChange={(event) => set('managingUnit', event.target.value)}
              placeholder="VD: Văn phòng HĐND và UBND"
              invalid={Boolean(errors.managingUnit)}
            />
          </Field>
          <Field label="Phòng ban" hint="Liên kết với cơ cấu tổ chức để thống kê.">
            <Select
              value={form.departmentId}
              onChange={(event) => set('departmentId', event.target.value)}
            >
              <option value="">— Không liên kết —</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              Cấp độ an toàn thông tin
            </p>
            <Badge tone={levelMeta?.tone ?? 'neutral'}>{systemLevelLabel(form.level ? (Number(form.level) as SystemLevel) : null)}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Cấp độ HTTT"
              hint="Theo Nghị định 85/2016/NĐ-CP, cấp độ từ 1 đến 5."
            >
              <Select value={form.level} onChange={(event) => set('level', event.target.value)}>
                <option value="">Chưa xác định cấp độ</option>
                {SYSTEM_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {SYSTEM_LEVEL_META[level].label} — {SYSTEM_LEVEL_META[level].description}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Số quyết định phê duyệt"
              required={Boolean(form.level)}
              error={errors.decisionNumber}
            >
              <Input
                value={form.decisionNumber}
                onChange={(event) => set('decisionNumber', event.target.value)}
                placeholder="VD: 85/QĐ-UBND"
                invalid={Boolean(errors.decisionNumber)}
              />
            </Field>
            <Field label="Ngày ký quyết định">
              <Input
                type="date"
                value={form.decisionDate}
                onChange={(event) => set('decisionDate', event.target.value)}
              />
            </Field>
            <Field label="Cơ quan ban hành">
              <Input
                value={form.decisionAgency}
                onChange={(event) => set('decisionAgency', event.target.value)}
                placeholder="VD: UBND xã An Bình"
              />
            </Field>
          </div>
          {form.level && Number(form.level) >= 3 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              HTTT cấp độ 3 trở lên cần đầy đủ ngày ký, cơ quan ban hành và hồ sơ, quyết định đính kèm.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hình thức triển khai">
            <Select
              value={form.hostingType}
              onChange={(event) => set('hostingType', event.target.value as SystemHostingType)}
            >
              {(Object.keys(SYSTEM_HOSTING_META) as SystemHostingType[]).map((type) => (
                <option key={type} value={type}>
                  {SYSTEM_HOSTING_META[type].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Máy chủ / hạ tầng chạy HTTT">
            <Input
              value={form.hostingDetail}
              onChange={(event) => set('hostingDetail', event.target.value)}
              placeholder="VD: Máy chủ ảo ESXi-01 (10.10.1.21)"
            />
          </Field>
        </div>

        <Field label="Thiết bị liên kết" hint="Chọn thiết bị/máy chủ đang chạy hệ thống nếu có trong danh mục thiết bị.">
          <Select value={form.assetId} onChange={(event) => set('assetId', event.target.value)}>
            <option value="">— Không liên kết —</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.code} · {asset.name}
              </option>
            ))}
          </Select>
        </Field>

        {system && (
          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  Tệp đính kèm (QĐ, hồ sơ đề xuất cấp độ)
                </p>
                <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                  Hỗ trợ PDF, Word, Excel. Tệp được lưu cùng hồ sơ HTTT.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['decision', 'profile', 'other'] as SystemDocumentType[]).map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    leftIcon={type === 'other' ? <Paperclip className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                    loading={uploading === type}
                    onClick={() => void upload(type)}
                  >
                    {SYSTEM_DOCUMENT_TYPE_META[type].label}
                  </Button>
                ))}
              </div>
            </div>
            {detail && detail.files.length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {detail.files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FilePlus2 className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
                          {file.filename}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {SYSTEM_DOCUMENT_TYPE_META[file.documentType].label} · {fileSize(file.size)} ·{' '}
                          {formatDateTime(file.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void openFile(file)}
                        aria-label="Mở tệp"
                        title="Mở tệp"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-rose-500 hover:text-rose-600"
                        onClick={() => void removeFile(file)}
                        aria-label="Xóa tệp"
                        title="Xóa tệp"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                Chưa có tệp đính kèm nào.
              </p>
            )}
          </div>
        )}

        {system && (
          <div className="grid gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] text-slate-500 sm:grid-cols-2 dark:bg-slate-800/60 dark:text-slate-400">
            <p>
              Ngày tạo: <span className="font-medium text-slate-700 dark:text-slate-200">{formatDate(system.createdAt)}</span>
            </p>
            <p>
              Cập nhật:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatDateTime(system.updatedAt)}
              </span>
            </p>
            <p>
              Người tạo:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {system.createdByName ?? '—'}
              </span>
            </p>
            <p>
              Hồ sơ: <span className="font-medium text-slate-700 dark:text-slate-200">{formatNumber(system.fileCount)} tệp</span>
            </p>
          </div>
        )}
      </div>
    </Drawer>
  )
}
