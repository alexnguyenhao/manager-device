import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  Clock,
  FilterX,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
  Wrench
} from 'lucide-react'
import type {
  Asset,
  MaintenanceRecord,
  MaintenanceStatus,
  MaintenanceType,
  PageResult
} from '@shared/types'
import {
  DEFAULT_PAGE_SIZE,
  MAINTENANCE_PRIORITY_META,
  MAINTENANCE_STATUS_META,
  MAINTENANCE_TYPE_META,
  hasPermission
} from '@shared/constants'
import { formatCurrency, formatDate, formatNumber, todayISO } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/common/SearchInput'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { EmptyState, Pagination, Spinner } from '../../components/ui/Feedback'
import { Dropdown, DropdownMenu, type MenuItem } from '../../components/ui/Dropdown'
import { useConfirm } from '../../components/ui/Confirm'
import { CompleteMaintenanceModal, MaintenanceFormModal } from './MaintenanceModals'

type MaintenanceStatusFilter = 'all' | MaintenanceStatus | 'overdue'

export function MaintenancePage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MaintenanceStatusFilter>('all')
  const [type, setType] = useState<'all' | MaintenanceType>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [data, setData] = useState<PageResult<MaintenanceRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null)
  const [presetAssetId, setPresetAssetId] = useState<number | null>(null)
  const [completing, setCompleting] = useState<MaintenanceRecord | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)

  const canWrite = hasPermission(user.role, 'maintenance:write')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.maintenance.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        status,
        type,
        fromDate: fromDate || null,
        toDate: toDate || null
      })
      setData(result)
    } catch (error) {
      toast.error('Không thể tải danh sách bảo trì', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, status, type, fromDate, toDate])

  const loadAssets = useCallback(async () => {
    try {
      const result = await api.assets.list({ pageSize: 500, sortBy: 'code', sortDir: 'asc' })
      setAssets(result.items.filter((asset) => asset.status !== 'disposed' && asset.status !== 'lost'))
    } catch {
      // bỏ qua, người dùng vẫn có thể xem danh sách
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const queryAsset = searchParams.get('assetId')
    const openNew = searchParams.get('new')
    if (queryAsset) setPresetAssetId(Number(queryAsset))
    if (openNew === '1') {
      setEditing(null)
      setFormOpen(true)
    }
    if (queryAsset || openNew) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const resetFilters = (): void => {
    setSearchInput('')
    setStatus('all')
    setType('all')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const activeFilterCount = [search.trim(), status !== 'all', type !== 'all', fromDate, toDate].filter(
    Boolean
  ).length

  const start = async (record: MaintenanceRecord): Promise<void> => {
    try {
      await api.maintenance.update({ id: record.id, status: 'in_progress' })
      toast.success('Đã bắt đầu bảo trì', `${record.code} · ${record.assetName}`)
      void load()
      void loadAssets()
    } catch (error) {
      toast.error('Không thể cập nhật phiếu', errorMessage(error))
    }
  }

  const cancel = async (record: MaintenanceRecord): Promise<void> => {
    const ok = await confirm({
      title: 'Hủy phiếu bảo trì?',
      description: `Phiếu ${record.code} - ${record.assetName} sẽ được đánh dấu đã hủy và không tính vào báo cáo chi phí.`,
      confirmText: 'Hủy phiếu'
    })
    if (!ok) return
    try {
      await api.maintenance.cancel(record.id)
      toast.success('Đã hủy phiếu bảo trì', record.code)
      void load()
      void loadAssets()
    } catch (error) {
      toast.error('Không thể hủy phiếu', errorMessage(error))
    }
  }

  const remove = async (record: MaintenanceRecord): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa phiếu bảo trì?',
      description: `Phiếu ${record.code} sẽ bị xóa vĩnh viễn khỏi lịch sử bảo trì.`,
      confirmText: 'Xóa phiếu'
    })
    if (!ok) return
    try {
      await api.maintenance.remove(record.id)
      toast.success('Đã xóa phiếu bảo trì', record.code)
      void load()
    } catch (error) {
      toast.error('Không thể xóa phiếu', errorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Bảo trì & sửa chữa"
        description="Lập lịch, theo dõi tiến độ và chi phí bảo dưỡng thiết bị."
        icon={<Wrench className="h-5 w-5" />}
        meta={data ? <Badge tone="info">{formatNumber(data.total)} phiếu</Badge> : undefined}
        actions={
          canWrite ? (
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditing(null)
                setPresetAssetId(null)
                setFormOpen(true)
              }}
            >
              Tạo phiếu bảo trì
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm mã phiếu, thiết bị, nội dung, nhà cung cấp…"
            className="xl:w-[320px]"
          />
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as MaintenanceStatusFilter)
                setPage(1)
              }}
              aria-label="Lọc trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="scheduled">Đã lên lịch</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="overdue">Quá hạn</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </Select>
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value as 'all' | MaintenanceType)
                setPage(1)
              }}
              aria-label="Lọc loại bảo trì"
            >
              <option value="all">Tất cả loại</option>
              {(Object.keys(MAINTENANCE_TYPE_META) as MaintenanceType[]).map((value) => (
                <option key={value} value={value}>
                  {MAINTENANCE_TYPE_META[value].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-950/60">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  setPage(1)
                }}
                className="h-9 w-[122px] border-0 bg-transparent text-[11.5px] text-slate-600 outline-none dark:text-slate-300"
                aria-label="Từ ngày"
              />
              <span className="text-slate-300">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value)
                  setPage(1)
                }}
                className="h-9 w-[122px] border-0 bg-transparent text-[11.5px] text-slate-600 outline-none dark:text-slate-300"
                aria-label="Đến ngày"
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" leftIcon={<FilterX className="h-3.5 w-3.5" />} onClick={resetFilters}>
                Xóa lọc
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <Spinner className="py-24" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-6 w-6" />}
            title={activeFilterCount ? 'Không tìm thấy phiếu bảo trì' : 'Chưa có phiếu bảo trì'}
            description={
              activeFilterCount
                ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                : 'Tạo phiếu bảo trì để theo dõi chi phí và lịch sử sửa chữa.'
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              ) : canWrite ? (
                <Button
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  Tạo phiếu bảo trì
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã phiếu / Nội dung</th>
                  <th>Thiết bị</th>
                  <th>Loại</th>
                  <th>Đơn vị / Phụ trách</th>
                  <th>Thời gian</th>
                  <th>Chi phí</th>
                  <th>Trạng thái</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((record) => {
                  const statusMeta = MAINTENANCE_STATUS_META[record.status]
                  const priorityMeta = MAINTENANCE_PRIORITY_META[record.priority]
                  const isOpen = record.status === 'scheduled' || record.status === 'in_progress'
                  const actions: MenuItem[] = [
                    {
                      label: 'Xem thiết bị',
                      icon: <Wrench className="h-4 w-4" />,
                      onClick: () => navigate(`/assets/${record.assetId}`)
                    },
                    ...(isOpen
                      ? [
                          {
                            label: 'Chỉnh sửa phiếu',
                            icon: <Pencil className="h-4 w-4" />,
                            onClick: () => {
                              setEditing(record)
                              setFormOpen(true)
                            },
                            disabled: !canWrite
                          }
                        ]
                      : []),
                    ...(record.status === 'scheduled' && canWrite
                      ? [
                          {
                            label: 'Bắt đầu thực hiện',
                            icon: <Play className="h-4 w-4" />,
                            onClick: () => void start(record)
                          }
                        ]
                      : []),
                    ...(isOpen && canWrite
                      ? [
                          {
                            label: 'Hoàn thành bảo trì',
                            icon: <CheckCircle2 className="h-4 w-4" />,
                            onClick: () => {
                              setCompleting(record)
                              setCompleteOpen(true)
                            }
                          },
                          {
                            label: 'Hủy phiếu',
                            icon: <CircleSlash className="h-4 w-4" />,
                            onClick: () => void cancel(record)
                          }
                        ]
                      : []),
                    ...(canWrite
                      ? [
                          {
                            label: 'Xóa phiếu',
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                            dividerBefore: true,
                            onClick: () => void remove(record)
                          }
                        ]
                      : [])
                  ]

                  return (
                    <tr key={record.id}>
                      <td>
                        <p className="max-w-[240px] truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                          {record.title}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10.5px] text-slate-400">{record.code}</span>
                          <Badge tone={priorityMeta.tone}>{priorityMeta.label}</Badge>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/assets/${record.assetId}`}
                          className="block max-w-[200px] truncate text-[12px] font-medium text-slate-700 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
                        >
                          {record.assetName}
                        </Link>
                        <p className="font-mono text-[10.5px] text-slate-400">
                          {record.assetCode} · {record.categoryName}
                        </p>
                      </td>
                      <td>
                        <Badge tone={MAINTENANCE_TYPE_META[record.type].tone}>
                          {MAINTENANCE_TYPE_META[record.type].label}
                        </Badge>
                      </td>
                      <td>
                        <p className="max-w-[160px] truncate text-[12px] text-slate-600 dark:text-slate-300">
                          {record.provider ?? '—'}
                        </p>
                        <p className="max-w-[160px] truncate text-[10.5px] text-slate-400">
                          {record.assignee ?? 'Chưa phân công'}
                        </p>
                      </td>
                      <td>
                        <p className="flex items-center gap-1 text-[12px] text-slate-600 dark:text-slate-300">
                          <CalendarDays className="h-3 w-3 text-slate-400" />
                          {formatDate(record.scheduledDate)}
                        </p>
                        {record.completedDate ? (
                          <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400">
                            Xong {formatDate(record.completedDate)}
                          </p>
                        ) : record.isOverdue ? (
                          <p className="text-[10.5px] font-medium text-rose-600 dark:text-rose-400">Quá hạn</p>
                        ) : (
                          <p className="text-[10.5px] text-slate-400">Chưa hoàn thành</p>
                        )}
                      </td>
                      <td>
                        <span className="text-[12px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
                          {record.cost > 0 ? formatCurrency(record.cost) : '—'}
                        </span>
                      </td>
                      <td>
                        <Badge tone={statusMeta.tone} dot={record.status === 'in_progress'}>
                          {statusMeta.label}
                        </Badge>
                      </td>
                      <td>
                        <Dropdown
                          width={210}
                          trigger={
                            <span className="icon-btn">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          }
                          ariaLabel={`Thao tác ${record.code}`}
                        >
                          {(close) => <DropdownMenu items={actions} close={close} />}
                        </Dropdown>
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
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <Clock className="h-3 w-3" />
        Phiếu đang thực hiện sẽ chuyển thiết bị sang trạng thái "Bảo trì". Hoàn thành sẽ trả thiết bị về trạng thái phù hợp.
        <span className="ml-auto">Hôm nay: {formatDate(todayISO())}</span>
      </div>

      <MaintenanceFormModal
        open={formOpen}
        record={editing}
        presetAssetId={presetAssetId}
        assets={assets}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          void load()
          void loadAssets()
        }}
      />

      <CompleteMaintenanceModal
        open={completeOpen}
        record={completing}
        onClose={() => setCompleteOpen(false)}
        onSaved={() => {
          void load()
          void loadAssets()
        }}
      />
    </div>
  )
}
