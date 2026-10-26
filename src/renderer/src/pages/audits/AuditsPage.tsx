import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ClipboardCheck,
  Download,
  Eye,
  FilterX,
  MoreHorizontal,
  Plus,
  Trash2
} from 'lucide-react'
import type {
  AuditSession,
  AuditStatus,
  Department,
  Location,
  PageResult
} from '@shared/types'
import {
  AUDIT_STATUS_META,
  DEFAULT_PAGE_SIZE,
  hasPermission
} from '@shared/constants'
import { formatDate, formatNumber } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/common/SearchInput'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { EmptyState, Pagination, Spinner } from '../../components/ui/Feedback'
import { Dropdown, DropdownMenu } from '../../components/ui/Dropdown'
import { useConfirm } from '../../components/ui/Confirm'
import { AuditCreateModal } from './AuditModals'

export function AuditsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | AuditStatus>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [data, setData] = useState<PageResult<AuditSession> | null>(null)
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite = hasPermission(user.role, 'audit:write')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.audits.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        status
      })
      setData(result)
    } catch (error) {
      toast.error('Không thể tải danh sách kiểm kê', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void Promise.all([api.departments.list(), api.locations.list()])
      .then(([departmentList, locationList]) => {
        setDepartments(departmentList)
        setLocations(locationList)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (searchParams.get('new') === '1') setCreateOpen(true)
    if (searchParams.get('new')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const remove = async (session: AuditSession): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa phiên kiểm kê?',
      description: `Phiên "${session.code} · ${session.name}" cùng toàn bộ kết quả kiểm kê sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xóa phiên'
    })
    if (!ok) return
    try {
      await api.audits.remove(session.id)
      toast.success('Đã xóa phiên kiểm kê', session.code)
      void load()
    } catch (error) {
      toast.error('Không thể xóa phiên kiểm kê', errorMessage(error))
    }
  }

  const exportExcel = async (session: AuditSession): Promise<void> => {
    try {
      const result = await api.audits.exportExcel(session.id)
      if (!result.canceled && result.filePath) {
        toast.success('Đã xuất kết quả kiểm kê', result.filePath)
      }
    } catch (error) {
      toast.error('Không thể xuất Excel', errorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Kiểm kê tài sản"
        description="Tạo phiên kiểm kê, quét QR và đối chiếu thực tế với hồ sơ."
        icon={<ClipboardCheck className="h-5 w-5" />}
        meta={data ? <Badge tone="info">{formatNumber(data.total)} phiên</Badge> : undefined}
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Tạo phiên kiểm kê
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm mã hoặc tên phiên kiểm kê…"
            className="sm:w-[340px]"
          />
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'all' | AuditStatus)
              setPage(1)
            }}
            className="sm:w-[200px]"
            aria-label="Lọc trạng thái kiểm kê"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="in_progress">Đang kiểm kê</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </Select>
          {(search || status !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<FilterX className="h-3.5 w-3.5" />}
              onClick={() => {
                setSearchInput('')
                setStatus('all')
                setPage(1)
              }}
            >
              Xóa lọc
            </Button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <Spinner className="py-24" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title={search || status !== 'all' ? 'Không tìm thấy phiên kiểm kê' : 'Chưa có phiên kiểm kê'}
            description={
              search || status !== 'all'
                ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                : 'Tạo phiên kiểm kê đầu tiên để đối chiếu tài sản thực tế.'
            }
            action={
              canWrite ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                  Tạo phiên kiểm kê
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Phiên kiểm kê</th>
                  <th>Phạm vi</th>
                  <th>Tiến độ</th>
                  <th>Kết quả</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((session) => {
                  const statusMeta = AUDIT_STATUS_META[session.status]
                  const percent = session.totalItems
                    ? Math.round((session.scannedItems / session.totalItems) * 100)
                    : 0
                  return (
                    <tr key={session.id}>
                      <td>
                        <Link
                          to={`/audits/${session.id}`}
                          className="block max-w-[240px] truncate text-[12.5px] font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400"
                        >
                          {session.name}
                        </Link>
                        <p className="font-mono text-[10.5px] text-slate-400">{session.code}</p>
                      </td>
                      <td>
                        <p className="text-[12px] text-slate-600 dark:text-slate-300">
                          {session.departmentName ?? 'Tất cả phòng ban'}
                        </p>
                        <p className="text-[10.5px] text-slate-400">
                          {session.locationName ?? 'Tất cả vị trí'}
                        </p>
                      </td>
                      <td className="min-w-[140px]">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {session.scannedItems}/{session.totalItems}
                          </span>
                          <span className="text-slate-400">{percent}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={
                              session.status === 'completed' ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-brand-500'
                            }
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone="success">{session.matchedItems} đúng</Badge>
                          {(session.wrongItems > 0 || session.damagedItems > 0) && (
                            <Badge tone="warning">{session.wrongItems + session.damagedItems} sai/hỏng</Badge>
                          )}
                          {session.missingItems > 0 && (
                            <Badge tone="danger">{session.missingItems} thiếu</Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <p className="text-[11.5px] text-slate-600 dark:text-slate-300">
                          {formatDate(session.startDate)}
                        </p>
                        <p className="text-[10.5px] text-slate-400">
                          {session.completedAt
                            ? `Xong ${formatDate(session.completedAt)}`
                            : session.endDate
                              ? `Dự kiến ${formatDate(session.endDate)}`
                              : 'Chưa đặt hạn'}
                        </p>
                      </td>
                      <td>
                        <Badge tone={statusMeta.tone} dot={session.status === 'in_progress'}>
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
                          ariaLabel={`Thao tác ${session.code}`}
                        >
                          {(close) => (
                            <DropdownMenu
                              close={close}
                              items={[
                                {
                                  label: 'Mở phiên kiểm kê',
                                  icon: <Eye className="h-4 w-4" />,
                                  onClick: () => navigate(`/audits/${session.id}`)
                                },
                                {
                                  label: 'Xuất kết quả Excel',
                                  icon: <Download className="h-4 w-4" />,
                                  onClick: () => void exportExcel(session)
                                },
                                ...(canWrite
                                  ? [
                                      {
                                        label: 'Xóa phiên',
                                        icon: <Trash2 className="h-4 w-4" />,
                                        danger: true,
                                        dividerBefore: true,
                                        onClick: () => void remove(session)
                                      }
                                    ]
                                  : [])
                              ]}
                            />
                          )}
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

      <AuditCreateModal
        open={createOpen}
        departments={departments}
        locations={locations}
        onClose={() => setCreateOpen(false)}
        onCreated={(session) => navigate(`/audits/${session.id}`)}
      />
    </div>
  )
}
