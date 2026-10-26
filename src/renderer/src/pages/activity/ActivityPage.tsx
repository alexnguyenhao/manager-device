import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FilterX,
  History,
  MapPin,
  MonitorSmartphone,
  Settings,
  ShieldCheck,
  Tags,
  Truck,
  UserRound,
  Users,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import type { ActivityLog, LogListParams, PageResult } from '@shared/types'
import { DEFAULT_PAGE_SIZE, ENTITY_LABELS, hasPermission, type Tone } from '@shared/constants'
import { formatDate, formatDateTime, formatNumber, relativeTime, todayISO } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/common/SearchInput'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { EmptyState, Pagination, Spinner } from '../../components/ui/Feedback'

const ENTITY_ICONS: Record<string, LucideIcon> = {
  asset: MonitorSmartphone,
  assignment: ArrowLeftRight,
  maintenance: Wrench,
  audit: ClipboardCheck,
  category: Tags,
  department: Building2,
  location: MapPin,
  supplier: Truck,
  employee: Users,
  user: ShieldCheck,
  settings: Settings,
  report: History,
  system: History
}

const ENTITY_ORDER = [
  'asset',
  'assignment',
  'maintenance',
  'audit',
  'category',
  'department',
  'location',
  'supplier',
  'employee',
  'user',
  'report',
  'settings',
  'system'
]

function actionTone(action: string): Tone {
  if (/xóa|hủy/i.test(action)) return 'danger'
  if (/tạo|thêm|sao lưu|tải mẫu/i.test(action)) return 'success'
  if (/phục hồi|khôi phục|đặt lại/i.test(action)) return 'warning'
  if (/đăng nhập|đăng xuất/i.test(action)) return 'neutral'
  if (/cập nhật|sửa|đổi|chuyển|hoàn thành|thu hồi|bắt đầu/i.test(action)) return 'info'
  return 'purple'
}

function shiftDaysISO(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function ActivityPage() {
  const user = useCurrentUser()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [data, setData] = useState<PageResult<ActivityLog> | null>(null)
  const [loading, setLoading] = useState(true)

  const canRead = hasPermission(user.role, 'log:read')

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: LogListParams = {
        page,
        pageSize,
        search: search.trim() || undefined,
        entityType: entityType || undefined,
        fromDate: fromDate || null,
        toDate: toDate || null
      }
      setData(await api.logs.list(params))
    } catch (error) {
      toast.error('Không thể tải nhật ký hoạt động', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [canRead, page, pageSize, search, entityType, fromDate, toDate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const resetFilters = (): void => {
    setSearchInput('')
    setEntityType('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const applyPreset = (days: number): void => {
    setFromDate(days === 0 ? todayISO() : shiftDaysISO(days))
    setToDate(todayISO())
    setPage(1)
  }

  const activeFilterCount = [search.trim(), entityType, fromDate, toDate].filter(Boolean).length

  if (!canRead) {
    return (
      <div className="table-wrap">
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="Không có quyền truy cập"
          description="Vai trò của bạn không được phép xem nhật ký hoạt động hệ thống."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Nhật ký hoạt động"
        description="Theo dõi toàn bộ thao tác của người dùng trên thiết bị, cấp phát, bảo trì, kiểm kê và hệ thống."
        icon={<History className="h-5 w-5" />}
        meta={
          data ? (
            <>
              <Badge tone="info">{formatNumber(data.total)} bản ghi</Badge>
              <span className="text-[11.5px] text-slate-400">
                Trang {data.page} / {data.totalPages}
              </span>
            </>
          ) : undefined
        }
        actions={
          <Button
            variant="outline"
            leftIcon={<CalendarDays className="h-4 w-4" />}
            onClick={() => applyPreset(6)}
          >
            7 ngày gần nhất
          </Button>
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm hành động, người dùng, đối tượng…"
            className="xl:w-[320px]"
          />
          <Select
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value)
              setPage(1)
            }}
            aria-label="Lọc theo loại đối tượng"
            className="xl:w-[200px]"
          >
            <option value="">Tất cả đối tượng</option>
            {ENTITY_ORDER.map((entity) => (
              <option key={entity} value={entity}>
                {ENTITY_LABELS[entity] ?? entity}
              </option>
            ))}
          </Select>
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
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => applyPreset(0)}>
                Hôm nay
              </Button>
              <Button size="sm" variant="ghost" onClick={() => applyPreset(29)}>
                30 ngày
              </Button>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FilterX className="h-3.5 w-3.5" />}
                onClick={resetFilters}
              >
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
            icon={<History className="h-6 w-6" />}
            title={activeFilterCount ? 'Không tìm thấy hoạt động' : 'Chưa có hoạt động'}
            description={
              activeFilterCount
                ? 'Thử thay đổi bộ lọc hoặc khoảng thời gian.'
                : 'Các thao tác của người dùng sẽ được ghi lại tại đây.'
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người dùng</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => {
                  const Icon = ENTITY_ICONS[log.entityType] ?? History
                  return (
                    <tr key={log.id}>
                      <td>
                        <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                          {formatDateTime(log.createdAt)}
                        </p>
                        <p className="text-[10.5px] text-slate-400">{relativeTime(log.createdAt)}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {log.username ? (
                            <Avatar name={log.username} size="xs" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                              <Settings className="h-3 w-3" />
                            </span>
                          )}
                          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                            {log.username ?? 'Hệ thống'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[230px] truncate text-[12px] text-slate-600 dark:text-slate-300">
                              {log.entityLabel ?? ENTITY_LABELS[log.entityType] ?? '—'}
                            </p>
                            <p className="text-[10.5px] text-slate-400">
                              {ENTITY_LABELS[log.entityType] ?? log.entityType}
                              {log.entityId ? ` #${log.entityId}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p
                          className="max-w-[360px] truncate text-[11.5px] text-slate-500 dark:text-slate-400"
                          title={log.details ?? undefined}
                        >
                          {log.details ?? '—'}
                        </p>
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

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 text-[11.5px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        <UserRound className="h-3.5 w-3.5 text-brand-500" />
        Nhật ký được ghi tự động, không thể chỉnh sửa và chỉ hiển thị cho người dùng có quyền xem.
        <span className="ml-auto">Hôm nay: {formatDate(todayISO())}</span>
      </div>
    </div>
  )
}
