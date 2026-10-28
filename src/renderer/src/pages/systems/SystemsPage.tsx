import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FilterX,
  HelpCircle,
  Pencil,
  Plus,
  Search,
  ServerCog,
  ShieldAlert,
  Trash2,
  Upload
} from 'lucide-react'
import type {
  Asset,
  Department,
  ImportResult,
  InformationSystem,
  InformationSystemListParams,
  PageResult,
  SystemDashboard,
  SystemLevel,
  SystemStatus
} from '@shared/types'
import {
  DEFAULT_PAGE_SIZE,
  SYSTEM_LEVEL_META,
  SYSTEM_LEVEL_OPTIONS,
  SYSTEM_STATUS_META,
  SYSTEM_STATUS_OPTIONS,
  hasPermission,
  systemLevelLabel
} from '@shared/constants'
import { formatDate, formatNumber } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { StatCard } from '../../components/common/StatCard'
import { SearchInput } from '../../components/common/SearchInput'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Input'
import { EmptyState, Pagination, Spinner } from '../../components/ui/Feedback'
import { useConfirm } from '../../components/ui/Confirm'
import { SystemFormDrawer } from './SystemFormDrawer'

type LevelFilter = '' | 'unset' | `${SystemLevel}`
type StatusFilter = 'all' | SystemStatus

function levelBarClass(level: SystemLevel | 0): string {
  if (!level) return 'bg-slate-400'
  switch (SYSTEM_LEVEL_META[level].tone) {
    case 'success':
      return 'bg-emerald-500'
    case 'teal':
      return 'bg-teal-500'
    case 'warning':
      return 'bg-amber-500'
    case 'danger':
      return 'bg-rose-500'
    case 'purple':
      return 'bg-violet-500'
    default:
      return 'bg-blue-500'
  }
}

export function SystemsPage() {
  const user = useCurrentUser()
  const confirm = useConfirm()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<LevelFilter>('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [data, setData] = useState<PageResult<InformationSystem> | null>(null)
  const [dashboard, setDashboard] = useState<SystemDashboard | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'template' | 'import' | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<InformationSystem | null>(null)

  const canWrite = hasPermission(user.role, 'system:write')
  const canDelete = hasPermission(user.role, 'system:delete')

  const filters = useMemo<InformationSystemListParams>(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
      level: level === '' ? 'all' : level === 'unset' ? 'unset' : (Number(level) as SystemLevel),
      status: status === 'all' ? 'all' : status,
      departmentId: departmentId ? Number(departmentId) : null,
      fromDate: fromDate || null,
      toDate: toDate || null
    }),
    [page, pageSize, search, level, status, departmentId, fromDate, toDate]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.systems.list(filters))
    } catch (error) {
      toast.error('Không thể tải danh sách HTTT', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [filters])

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await api.systems.dashboard())
    } catch {
      // bỏ qua
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    api.departments
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]))
    api.assets
      .list({ pageSize: 500, sortBy: 'code', sortDir: 'asc' })
      .then((result) => setAssets(result.items))
      .catch(() => setAssets([]))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const resetFilters = (): void => {
    setSearchInput('')
    setLevel('')
    setStatus('all')
    setDepartmentId('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const activeFilterCount = [
    search.trim(),
    level !== '',
    status !== 'all',
    departmentId,
    fromDate,
    toDate
  ].filter(Boolean).length

  const openCreate = (): void => {
    setEditing(null)
    setDrawerOpen(true)
  }

  const openEdit = (system: InformationSystem): void => {
    setEditing(system)
    setDrawerOpen(true)
  }

  const refreshAll = (): void => {
    void load()
    void loadDashboard()
  }

  const remove = async (system: InformationSystem): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa hệ thống thông tin?',
      description: `${system.code} - ${system.name} sẽ được xóa mềm và ẩn khỏi danh sách, dữ liệu vẫn được giữ trong nhật ký.`,
      confirmText: 'Xóa HTTT'
    })
    if (!ok) return
    try {
      await api.systems.remove(system.id)
      toast.success('Đã xóa HTTT', `${system.code} · ${system.name}`)
      refreshAll()
    } catch (error) {
      toast.error('Không thể xóa HTTT', errorMessage(error))
    }
  }

  const exportExcel = async (): Promise<void> => {
    setExporting('excel')
    try {
      const result = await api.systems.exportExcel(filters)
      if (!result.canceled) toast.success('Đã xuất báo cáo Excel', result.filePath)
    } catch (error) {
      toast.error('Không thể xuất Excel', errorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  const exportPdf = async (): Promise<void> => {
    setExporting('pdf')
    try {
      const result = await api.systems.exportPdf(filters)
      if (!result.canceled) toast.success('Đã xuất báo cáo PDF', result.filePath)
    } catch (error) {
      toast.error('Không thể xuất PDF', errorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  const downloadTemplate = async (): Promise<void> => {
    setExporting('template')
    try {
      const result = await api.systems.downloadTemplate()
      if (!result.canceled) toast.success('Đã tải mẫu nhập dữ liệu', result.filePath)
    } catch (error) {
      toast.error('Không thể tải mẫu', errorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  const importExcel = async (): Promise<void> => {
    setExporting('import')
    try {
      const result = await api.systems.importExcel()
      if (result.canceled) return
      setImportResult(result)
      refreshAll()
      if (result.failed === 0) {
        toast.success('Nhập dữ liệu thành công', `${formatNumber(result.imported)} HTTT`)
      } else {
        toast.warning(
          'Nhập dữ liệu hoàn tất',
          `${formatNumber(result.imported)} thành công, ${formatNumber(result.failed)} dòng lỗi`
        )
      }
    } catch (error) {
      toast.error('Không thể nhập dữ liệu', errorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  const kpis = dashboard?.kpis

  return (
    <div>
      <PageHeader
        title="Hệ thống thông tin"
        description="Quản lý tập trung danh mục HTTT, cấp độ an toàn và quyết định phê duyệt."
        icon={<ServerCog className="h-5 w-5" />}
        meta={data ? <Badge tone="info">{formatNumber(data.total)} HTTT</Badge> : undefined}
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={<FileText className="h-4 w-4" />}
              onClick={() => void downloadTemplate()}
              loading={exporting === 'template'}
            >
              Mẫu nhập
            </Button>
            {canWrite && (
              <Button
                variant="outline"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => void importExcel()}
                loading={exporting === 'import'}
              >
                Nhập Excel
              </Button>
            )}
            <Button
              variant="outline"
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              onClick={() => void exportExcel()}
              loading={exporting === 'excel'}
            >
              Xuất Excel
            </Button>
            <Button
              variant="outline"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => void exportPdf()}
              loading={exporting === 'pdf'}
            >
              Xuất PDF
            </Button>
            {canWrite && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Thêm HTTT
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng số HTTT"
          value={formatNumber(kpis?.total ?? 0)}
          hint="Hệ thống đang quản lý"
          icon={<ServerCog className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Đã phê duyệt cấp độ"
          value={`${kpis?.approvalRate ?? 0}%`}
          hint={`${formatNumber(kpis?.approved ?? 0)} HTTT có cấp độ và số quyết định`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Chưa xác định cấp độ"
          value={formatNumber(kpis?.unsetLevel ?? 0)}
          hint={`${formatNumber(kpis?.level3Plus ?? 0)} HTTT từ cấp độ 3 trở lên`}
          icon={<HelpCircle className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Thiết bị hạ tầng"
          value={formatNumber(kpis?.infrastructureTotal ?? 0)}
          hint={`${formatNumber(dashboard?.infrastructure.physicalServers ?? 0)} máy chủ vật lý · ${
            dashboard?.infrastructure.virtualServers ?? 0
          } máy ảo`}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="purple"
        />
      </div>

      {dashboard && (
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <div className="card p-4 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="section-title">Phân bố theo cấp độ an toàn</h2>
                <p className="mt-0.5 text-[11.5px] muted">
                  Toàn bộ HTTT đang quản lý, không phụ thuộc bộ lọc bên dưới.
                </p>
              </div>
              <Badge tone="neutral">{formatNumber(dashboard.kpis.total)} HTTT</Badge>
            </div>
            <div className="space-y-2.5">
              {dashboard.byLevel.map((item) => {
                const percent = dashboard.kpis.total
                  ? Math.round((item.count / dashboard.kpis.total) * 100)
                  : 0
                return (
                  <div key={item.level === 0 ? 'unset' : item.level}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {item.label}
                      </span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {formatNumber(item.count)} · {percent}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-2 rounded-full ${levelBarClass(item.level)}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="section-title">Theo trạng thái vận hành</h2>
            <div className="mt-3 space-y-2">
              {dashboard.byStatus.length === 0 ? (
                <p className="text-[12px] text-slate-400">Chưa có dữ liệu.</p>
              ) : (
                dashboard.byStatus.map((item) => (
                  <div
                    key={item.status}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
                  >
                    <Badge tone={SYSTEM_STATUS_META[item.status].tone}>
                      {SYSTEM_STATUS_META[item.status].label}
                    </Badge>
                    <span className="text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {formatNumber(item.count)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Đơn vị quản lý nhiều HTTT
              </p>
              {dashboard.byUnit.slice(0, 3).map((item) => (
                <div key={item.unit} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="truncate text-[12px] text-slate-600 dark:text-slate-300">
                    {item.unit}
                  </span>
                  <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
                    {formatNumber(item.count)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {dashboard && dashboard.warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {formatNumber(kpis?.warningCount ?? dashboard.warnings.length)} HTTT cần bổ sung hồ sơ, cấp độ hoặc quyết định
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {dashboard.warnings.slice(0, 4).map((warning) => (
              <li key={warning.id} className="text-[12px] text-amber-700 dark:text-amber-400">
                <button
                  type="button"
                  className="font-mono text-[11px] font-semibold underline-offset-2 hover:underline"
                  onClick={() => {
                    const target = data?.items.find((item) => item.id === warning.id)
                    if (target) openEdit(target)
                  }}
                >
                  {warning.code}
                </button>
                <span className="ml-1.5 font-medium">{warning.name}</span>
                <span className="ml-1.5">— {warning.issues.join('; ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm mã, tên, đơn vị, số QĐ…"
            className="lg:col-span-2"
          />
          <Select
            value={level}
            onChange={(event) => {
              setLevel(event.target.value as LevelFilter)
              setPage(1)
            }}
            aria-label="Lọc theo cấp độ"
          >
            <option value="">Tất cả cấp độ</option>
            <option value="unset">Chưa xác định cấp độ</option>
            {SYSTEM_LEVEL_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {SYSTEM_LEVEL_META[item].label}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              setPage(1)
            }}
            aria-label="Lọc theo trạng thái"
          >
            <option value="all">Tất cả trạng thái</option>
            {SYSTEM_STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {SYSTEM_STATUS_META[item].label}
              </option>
            ))}
          </Select>
          <Select
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value)
              setPage(1)
            }}
            aria-label="Lọc theo phòng ban"
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={resetFilters}
            className="flex h-9.5 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            disabled={activeFilterCount === 0}
          >
            <FilterX className="h-3.5 w-3.5" />
            Xóa lọc {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="shrink-0">Cập nhật từ</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value)
                setPage(1)
              }}
              className="input h-8"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="shrink-0">đến</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value)
                setPage(1)
              }}
              className="input h-8"
            />
          </label>
          <p className="flex items-center gap-1.5 text-[12px] text-slate-400 sm:col-span-2">
            <Search className="h-3.5 w-3.5" />
            Lọc theo ngày cập nhật, áp dụng cho cả danh sách và báo cáo.
          </p>
        </div>
      </div>

      <div className="table-wrap">
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<ServerCog className="h-6 w-6" />}
            title="Chưa có hệ thống thông tin nào"
            description={
              activeFilterCount
                ? 'Không tìm thấy HTTT phù hợp với bộ lọc hiện tại.'
                : 'Thêm mới hoặc nhập từ Excel để bắt đầu quản lý danh mục HTTT.'
            }
            action={
              canWrite ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Thêm HTTT
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hệ thống thông tin</th>
                  <th>Đơn vị quản lý</th>
                  <th className="w-32">Cấp độ</th>
                  <th>Số quyết định</th>
                  <th className="w-36">Trạng thái</th>
                  <th className="w-32">Cập nhật</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((system) => {
                  const levelMeta = system.level ? SYSTEM_LEVEL_META[system.level] : null
                  const statusMeta = SYSTEM_STATUS_META[system.status]
                  const needsAttention = system.level === null || !system.decisionNumber
                  return (
                    <tr key={system.id}>
                      <td>
                        <div className="flex items-start gap-2">
                          {needsAttention && (
                            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEdit(system)}
                              className="block max-w-[330px] truncate text-left text-[12.5px] font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400"
                            >
                              {system.name}
                            </button>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[10.5px] text-slate-400">{system.code}</span>
                              {system.hostingDetail && (
                                <span className="max-w-[220px] truncate text-[10.5px] text-slate-400">
                                  · {system.hostingDetail}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="max-w-[200px] truncate text-[12px] text-slate-600 dark:text-slate-300">
                          {system.managingUnit}
                        </p>
                        <p className="max-w-[200px] truncate text-[10.5px] text-slate-400">
                          {system.departmentName ?? 'Chưa gắn phòng ban'}
                        </p>
                      </td>
                      <td>
                        <Badge tone={levelMeta?.tone ?? 'neutral'}>{systemLevelLabel(system.level)}</Badge>
                      </td>
                      <td>
                        <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                          {system.decisionNumber ?? '—'}
                        </p>
                        <p className="text-[10.5px] text-slate-400">
                          {formatDate(system.decisionDate) || 'Chưa có ngày ký'}
                        </p>
                      </td>
                      <td>
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </td>
                      <td>
                        <p className="text-[12px] text-slate-600 dark:text-slate-300">
                          {formatDate(system.updatedAt)}
                        </p>
                        <p className="text-[10.5px] text-slate-400">{system.fileCount} tệp hồ sơ</p>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openEdit(system)}
                            aria-label={`Sửa ${system.code}`}
                            title="Xem / sửa"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              className="icon-btn text-rose-500 hover:text-rose-600"
                              onClick={() => void remove(system)}
                              aria-label={`Xóa ${system.code}`}
                              title="Xóa HTTT"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </div>

      <SystemFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        system={editing}
        departments={departments}
        assets={assets}
        onSaved={refreshAll}
      />

      <Modal
        open={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        title="Kết quả nhập dữ liệu HTTT"
        description={
          importResult
            ? `${formatNumber(importResult.imported)} dòng thành công, ${formatNumber(importResult.failed)} dòng lỗi.`
            : undefined
        }
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setImportResult(null)}>
            Đóng
          </Button>
        }
      >
        {importResult && importResult.errors.length > 0 ? (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {importResult.errors.map((error, index) => (
              <div
                key={`${error.row}-${index}`}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <span className="font-semibold">Dòng {error.row}:</span> {error.message}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            Toàn bộ dữ liệu trong tệp đã được nhập thành công.
          </p>
        )}
      </Modal>
    </div>
  )
}
