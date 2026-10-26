import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  History,
  MonitorSmartphone,
  Paperclip,
  Pencil,
  Printer,
  QrCode,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Wrench,
  X
} from 'lucide-react'
import type { AssetDetail, Category, Department, Employee, Location, Supplier } from '@shared/types'
import {
  ASSET_CONDITION_META,
  ASSET_STATUS_META,
  MAINTENANCE_STATUS_META,
  MAINTENANCE_TYPE_META,
  hasPermission
} from '@shared/constants'
import {
  formatSpecValue,
  getComputerPreset,
  getEffectiveSpecFields
} from '@shared/spec-presets'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  relativeTime
} from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { Spinner, EmptyState } from '../../components/ui/Feedback'
import { ProgressBar } from '../../components/ui/Avatar'
import { useConfirm } from '../../components/ui/Confirm'
import { AssetFormDrawer } from './AssetFormDrawer'
import { AssetLabelModal } from './AssetLabelModal'

type TabValue = 'overview' | 'assignments' | 'maintenance' | 'files' | 'logs'

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800/70">
      <span className="text-[12px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="max-w-[60%] text-right text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
        {value || '—'}
      </span>
    </div>
  )
}

export function AssetDetailPage() {
  const { id } = useParams()
  const assetId = Number(id)
  const navigate = useNavigate()
  const user = useCurrentUser()
  const confirm = useConfirm()
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabValue>('overview')
  const [formOpen, setFormOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const canWrite = hasPermission(user.role, 'asset:write')
  const canDelete = hasPermission(user.role, 'asset:delete')

  const load = useCallback(async () => {
    if (!Number.isFinite(assetId) || assetId <= 0) {
      navigate('/assets', { replace: true })
      return
    }
    setLoading(true)
    try {
      const result = await api.assets.get(assetId)
      setDetail(result)
    } catch (error) {
      toast.error('Không thể tải thiết bị', errorMessage(error))
      navigate('/assets', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [assetId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void Promise.all([
      api.categories.list(),
      api.departments.list(),
      api.locations.list(),
      api.employees.list(),
      api.suppliers.list()
    ])
      .then(([c, d, l, e, s]) => {
        setCategories(c)
        setDepartments(d)
        setLocations(l)
        setEmployees(e)
        setSuppliers(s)
      })
      .catch(() => undefined)
  }, [])

  const remove = async (): Promise<void> => {
    if (!detail) return
    const ok = await confirm({
      title: 'Xóa thiết bị?',
      description: `Thiết bị "${detail.asset.code} · ${detail.asset.name}" sẽ bị xóa vĩnh viễn. Dữ liệu cấp phát và bảo trì liên quan cũng sẽ bị ảnh hưởng.`,
      confirmText: 'Xóa thiết bị'
    })
    if (!ok) return
    try {
      await api.assets.remove(detail.asset.id)
      toast.success('Đã xóa thiết bị', detail.asset.name)
      navigate('/assets', { replace: true })
    } catch (error) {
      toast.error('Không thể xóa thiết bị', errorMessage(error))
    }
  }

  const upload = async (): Promise<void> => {
    if (!detail) return
    setUploading(true)
    try {
      const result = await api.files.upload(detail.asset.id)
      if (result) {
        toast.success('Đã đính kèm tệp', result.filename)
        void load()
      }
    } catch (error) {
      toast.error('Không thể đính kèm tệp', errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = async (attachmentId: number, filename: string): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa tệp đính kèm?',
      description: `Tệp "${filename}" sẽ bị xóa khỏi thiết bị.`,
      confirmText: 'Xóa tệp'
    })
    if (!ok) return
    try {
      await api.files.remove(attachmentId)
      toast.success('Đã xóa tệp đính kèm')
      void load()
    } catch (error) {
      toast.error('Không thể xóa tệp', errorMessage(error))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!detail) return null
  const { asset } = detail
  const statusMeta = ASSET_STATUS_META[asset.status]
  const conditionMeta = ASSET_CONDITION_META[asset.condition]
  const assetCategory = categories.find((category) => category.id === asset.categoryId)
  const computerPreset = getComputerPreset(assetCategory)
  const specFields = getEffectiveSpecFields(assetCategory)
  const specEntries: Array<{ key: string; label: string; value: string }> = [
    ...specFields
      .filter((field) => asset.specs[field.key] !== undefined)
      .map((field) => ({
        key: field.key,
        label: field.label,
        value: formatSpecValue(asset.specs[field.key], field)
      })),
    ...Object.entries(asset.specs)
      .filter(([key]) => !specFields.some((field) => field.key === key))
      .map(([key, value]) => ({ key, label: key, value: String(value) }))
  ]
  const warrantyTone =
    asset.warrantyDaysLeft === null
      ? 'neutral'
      : asset.warrantyDaysLeft < 0
        ? 'neutral'
        : asset.warrantyDaysLeft <= 45
          ? 'warning'
          : 'success'

  const valuePercent =
    asset.purchasePrice > 0 ? (asset.currentValue / asset.purchasePrice) * 100 : 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
        <Link to="/assets" className="inline-flex items-center gap-1 hover:text-brand-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Danh sách thiết bị
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-500 dark:text-slate-400">{asset.code}</span>
      </div>

      <PageHeader
        title={asset.name}
        description={`${asset.categoryName}${asset.model ? ` · ${asset.model}` : ''}${asset.manufacturer ? ` · ${asset.manufacturer}` : ''}`}
        icon={<MonitorSmartphone className="h-5 w-5" />}
        meta={
          <>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {asset.code}
            </span>
            <Badge tone={statusMeta.tone} dot>
              {statusMeta.label}
            </Badge>
            <Badge tone={conditionMeta.tone}>{conditionMeta.label}</Badge>
            {asset.serialNumber && (
              <span className="text-[11px] text-slate-400">Serial: {asset.serialNumber}</span>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="md" leftIcon={<QrCode className="h-4 w-4" />} onClick={() => setLabelOpen(true)}>
              In nhãn
            </Button>
            {canWrite && (
              <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
                Chỉnh sửa
              </Button>
            )}
            {hasPermission(user.role, 'assignment:write') && (
              <Button
                variant="outline"
                leftIcon={<ArrowLeftRight className="h-4 w-4" />}
                onClick={() => navigate(`/assignments?new=1&assetId=${asset.id}`)}
                disabled={asset.status === 'disposed' || asset.status === 'lost'}
              >
                Cấp phát
              </Button>
            )}
            {hasPermission(user.role, 'maintenance:write') && (
              <Button
                leftIcon={<Wrench className="h-4 w-4" />}
                onClick={() => navigate(`/maintenance?new=1&assetId=${asset.id}`)}
              >
                Bảo trì
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">Giá trị còn lại</p>
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 tabular-nums dark:text-white">
                {formatCurrency(asset.currentValue)}
              </p>
              <div className="mt-2">
                <ProgressBar value={valuePercent} tone="primary" showLabel />
              </div>
              <p className="mt-1.5 text-[10.5px] text-slate-400">
                Nguyên giá {formatCurrency(asset.purchasePrice)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">Đã khấu hao</p>
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 tabular-nums dark:text-white">
                {formatCurrency(asset.accumulatedDepreciation)}
              </p>
              <p className="mt-2 text-[10.5px] text-slate-400">
                {formatCurrency(asset.monthlyDepreciation)}/tháng · {asset.ageMonths} tháng sử dụng
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">Bảo hành</p>
                <Badge tone={warrantyTone}>
                  {asset.warrantyDaysLeft === null
                    ? 'Không có'
                    : asset.warrantyDaysLeft < 0
                      ? 'Đã hết hạn'
                      : `Còn ${asset.warrantyDaysLeft} ngày`}
                </Badge>
              </div>
              <p className="mt-1 text-[17px] font-semibold text-slate-900 dark:text-white">
                {asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : '—'}
              </p>
              <p className="mt-2 text-[10.5px] text-slate-400">
                {asset.warrantyMonths} tháng · bắt đầu {formatDate(asset.warrantyStart)}
              </p>
            </div>
          </div>

          <div className="card mt-3">
            <div className="px-4 pt-3">
              <Tabs<TabValue>
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'overview', label: 'Tổng quan' },
                  { value: 'assignments', label: 'Cấp phát', count: detail.assignments.length },
                  { value: 'maintenance', label: 'Bảo trì', count: detail.maintenance.length },
                  { value: 'files', label: 'Tệp đính kèm', count: detail.attachments.length },
                  { value: 'logs', label: 'Lịch sử', count: detail.logs.length }
                ]}
              />
            </div>

            <div className="p-4">
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      <ClipboardList className="h-4 w-4 text-slate-400" /> Thông tin chung
                    </h3>
                    <div className="grid gap-x-8 sm:grid-cols-2">
                      <InfoRow label="Danh mục" value={asset.categoryName} />
                      <InfoRow label="Số serial" value={<span className="font-mono">{asset.serialNumber}</span>} />
                      <InfoRow label="Model" value={asset.model} />
                      <InfoRow label="Hãng sản xuất" value={asset.manufacturer} />
                      <InfoRow label="Nhà cung cấp" value={asset.supplierName} />
                      <InfoRow label="Số hóa đơn" value={asset.invoiceNumber} />
                      <InfoRow label="Ngày mua" value={formatDate(asset.purchaseDate)} />
                      <InfoRow
                        label="Phòng ban"
                        value={asset.departmentName}
                      />
                      <InfoRow label="Vị trí" value={asset.locationName} />
                      <InfoRow
                        label="Người sử dụng"
                        value={
                          asset.assignedEmployeeName ? (
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3 w-3 text-slate-400" />
                              {asset.assignedEmployeeName}
                            </span>
                          ) : (
                            'Chưa cấp phát'
                          )
                        }
                      />
                      <InfoRow label="Ngày tạo" value={formatDateTime(asset.createdAt)} />
                      <InfoRow label="Cập nhật cuối" value={formatDateTime(asset.updatedAt)} />
                      <InfoRow label="Người tạo" value={asset.createdByName} />
                      <InfoRow label="Giá trị thanh lý" value={formatCurrency(asset.salvageValue)} />
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      {computerPreset ? (
                        <Cpu className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Receipt className="h-4 w-4 text-slate-400" />
                      )}
                      {computerPreset ? 'Cấu hình thiết bị' : 'Thông số kỹ thuật'}
                    </h3>
                    {specEntries.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center dark:border-slate-700">
                        <p className="text-[12px] text-slate-400">
                          {computerPreset
                            ? 'Chưa nhập cấu hình CPU, RAM, GPU, dung lượng ổ cứng hoặc hệ điều hành.'
                            : 'Chưa khai báo thông số kỹ thuật.'}
                        </p>
                        {computerPreset && canWrite && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            leftIcon={<Pencil className="h-3.5 w-3.5" />}
                            onClick={() => setFormOpen(true)}
                          >
                            Bổ sung cấu hình
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {specEntries.map((entry) => (
                          <div
                            key={entry.key}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-[12px] dark:bg-slate-800/50"
                          >
                            <span className="shrink-0 text-slate-500 dark:text-slate-400">
                              {entry.label}
                            </span>
                            <span className="max-w-[62%] break-words text-right font-medium text-slate-800 dark:text-slate-100">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {asset.note && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        <FileText className="h-4 w-4 text-slate-400" /> Ghi chú
                      </h3>
                      <p className="whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                        {asset.note}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'assignments' && (
                <div>
                  {detail.assignments.length === 0 ? (
                    <EmptyState
                      icon={<ArrowLeftRight className="h-5 w-5" />}
                      title="Chưa có lịch sử cấp phát"
                      description="Thiết bị chưa được bàn giao cho nhân viên nào."
                      className="py-8"
                    />
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {detail.assignments.map((assignment) => (
                        <div key={assignment.id} className="flex flex-wrap items-center gap-3 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                              {assignment.employeeName}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {assignment.code} · {formatDate(assignment.assignedDate)}
                              {assignment.expectedReturnDate
                                ? ` → ${formatDate(assignment.expectedReturnDate)}`
                                : ''}
                            </p>
                          </div>
                          {assignment.status === 'active' ? (
                            <Badge tone={assignment.isOverdue ? 'danger' : 'info'}>
                              {assignment.isOverdue ? 'Quá hạn' : 'Đang sử dụng'}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">Đã thu hồi {formatDate(assignment.returnedDate)}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<ArrowLeftRight className="h-3.5 w-3.5" />}
                      onClick={() => navigate(`/assignments?search=${encodeURIComponent(asset.code)}`)}
                    >
                      Xem trong trang cấp phát
                    </Button>
                  </div>
                </div>
              )}

              {tab === 'maintenance' && (
                <div>
                  {detail.maintenance.length === 0 ? (
                    <EmptyState
                      icon={<Wrench className="h-5 w-5" />}
                      title="Chưa có phiếu bảo trì"
                      description="Thiết bị chưa được bảo trì hoặc sửa chữa lần nào."
                      className="py-8"
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {detail.maintenance.map((record) => (
                        <div
                          key={record.id}
                          className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3 dark:border-slate-800"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                            <Wrench className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                              {record.title}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {record.code} · {MAINTENANCE_TYPE_META[record.type].label} ·{' '}
                              {formatDate(record.scheduledDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge tone={MAINTENANCE_STATUS_META[record.status].tone}>
                              {MAINTENANCE_STATUS_META[record.status].label}
                            </Badge>
                            {record.cost > 0 && (
                              <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
                                {formatCurrency(record.cost)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'files' && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">
                      Hóa đơn, biên bản bàn giao, hình ảnh thiết bị…
                    </p>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={uploading}
                        leftIcon={<Upload className="h-3.5 w-3.5" />}
                        onClick={() => void upload()}
                      >
                        Đính kèm tệp
                      </Button>
                    )}
                  </div>
                  {detail.attachments.length === 0 ? (
                    <EmptyState
                      icon={<Paperclip className="h-5 w-5" />}
                      title="Chưa có tệp đính kèm"
                      description="Tải lên hóa đơn hoặc tài liệu liên quan đến thiết bị."
                      className="py-8"
                    />
                  ) : (
                    <div className="space-y-2">
                      {detail.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-2.5 dark:border-slate-800"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                              {attachment.filename}
                            </p>
                            <p className="text-[10.5px] text-slate-400">
                              {formatBytes(attachment.size)} · {attachment.createdByName ?? 'Hệ thống'} ·{' '}
                              {formatDate(attachment.createdAt)}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => void api.files.open(attachment.id)}>
                            Mở
                          </Button>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => void removeAttachment(attachment.id, attachment.filename)}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                              aria-label="Xóa tệp"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'logs' && (
                <div>
                  {detail.logs.length === 0 ? (
                    <EmptyState icon={<History className="h-5 w-5" />} title="Chưa có lịch sử" className="py-8" />
                  ) : (
                    <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
                      {detail.logs.map((log) => (
                        <li key={log.id} className="relative">
                          <span className="absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-brand-500 dark:border-slate-900" />
                          <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                            {log.action}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {log.username ?? 'Hệ thống'} · {relativeTime(log.createdAt)}
                            {log.details ? ` · ${log.details}` : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              <CalendarDays className="h-4 w-4 text-slate-400" /> Vòng đời tài sản
            </h3>
            <div className="space-y-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Ngày mua</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {formatDate(asset.purchaseDate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Đã sử dụng</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{asset.ageMonths} tháng</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Thời gian khấu hao</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {asset.depreciationMonths || '—'} tháng
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Hết bảo hành</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {formatDate(asset.warrantyExpiry)}
                </span>
              </div>
            </div>
            {asset.warrantyDaysLeft !== null && asset.warrantyDaysLeft >= 0 && asset.warrantyDaysLeft <= 45 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Bảo hành sắp hết hạn, nên liên hệ nhà cung cấp để gia hạn.
              </div>
            )}
            {asset.status === 'available' && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Thiết bị sẵn sàng để cấp phát.
              </div>
            )}
            {asset.status === 'lost' && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Thiết bị được ghi nhận thất lạc.
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-slate-400" /> Thông tin hệ thống
            </h3>
            <div className="space-y-2 text-[11.5px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Người tạo</span>
                <span className="text-right font-medium text-slate-700 dark:text-slate-200">
                  {asset.createdByName ?? '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Cập nhật</span>
                <span className="text-right font-medium text-slate-700 dark:text-slate-200">
                  {formatDateTime(asset.updatedAt)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Mã thiết bị</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{asset.code}</span>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-2.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              Thao tác nhanh
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLabelOpen(true)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-3 text-[11.5px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5"
              >
                <Printer className="h-4 w-4" /> In nhãn QR
              </button>
              <button
                type="button"
                onClick={() => navigate(`/assignments?new=1&assetId=${asset.id}`)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-3 text-[11.5px] font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/5"
              >
                <ArrowLeftRight className="h-4 w-4" /> Cấp phát
              </button>
              <button
                type="button"
                onClick={() => navigate(`/maintenance?new=1&assetId=${asset.id}`)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-3 text-[11.5px] font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/5"
              >
                <Wrench className="h-4 w-4" /> Bảo trì
              </button>
              <button
                type="button"
                onClick={() => setTab('files')}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-3 text-[11.5px] font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/5"
              >
                <Paperclip className="h-4 w-4" /> Tệp đính kèm
              </button>
            </div>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => void remove()}
              >
                Xóa thiết bị
              </Button>
            )}
          </div>
        </div>
      </div>

      <AssetFormDrawer
        open={formOpen}
        assetId={asset.id}
        categories={categories}
        departments={departments}
        locations={locations}
        employees={employees}
        suppliers={suppliers}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />

      <AssetLabelModal open={labelOpen} assets={[asset]} onClose={() => setLabelOpen(false)} />
    </div>
  )
}
