import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FilterX,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  UserRound
} from 'lucide-react'
import type {
  Asset,
  Assignment,
  AssignmentStatus,
  Department,
  Employee,
  Location,
  PageResult
} from '@shared/types'
import {
  ASSET_CONDITION_META,
  DEFAULT_PAGE_SIZE,
  hasPermission
} from '@shared/constants'
import { formatDate, formatNumber, todayISO } from '@shared/utils'
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
import { cn } from '../../lib/cn'
import { AssignmentFormModal, ReturnAssignmentModal } from './AssignmentModals'

type StatusFilter = 'all' | AssignmentStatus | 'overdue'

export function AssignmentsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [employeeId, setEmployeeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [data, setData] = useState<PageResult<Assignment> | null>(null)
  const [loading, setLoading] = useState(true)

  const [assets, setAssets] = useState<Asset[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [presetAssetId, setPresetAssetId] = useState<number | null>(null)
  const [returning, setReturning] = useState<Assignment | null>(null)
  const [returnOpen, setReturnOpen] = useState(false)

  const canWrite = hasPermission(user.role, 'assignment:write')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.assignments.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        status,
        employeeId: employeeId ? Number(employeeId) : null,
        departmentId: departmentId ? Number(departmentId) : null,
        fromDate: fromDate || null,
        toDate: toDate || null
      })
      setData(result)
    } catch (error) {
      toast.error('Không thể tải danh sách cấp phát', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, status, employeeId, departmentId, fromDate, toDate])

  const loadCatalogs = useCallback(async () => {
    try {
      const [assetResult, employeeList, departmentList, locationList] = await Promise.all([
        api.assets.list({ pageSize: 500, sortBy: 'code', sortDir: 'asc' }),
        api.employees.list(),
        api.departments.list(),
        api.locations.list()
      ])
      setAssets(
        assetResult.items.filter(
          (asset) => asset.status === 'available' || asset.status === 'reserved'
        )
      )
      setEmployees(employeeList)
      setDepartments(departmentList)
      setLocations(locationList)
    } catch (error) {
      toast.error('Không thể tải dữ liệu danh mục', errorMessage(error))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const querySearch = searchParams.get('search')
    const queryAsset = searchParams.get('assetId')
    const openNew = searchParams.get('new')
    if (querySearch) setSearchInput(querySearch)
    if (queryAsset) setPresetAssetId(Number(queryAsset))
    if (openNew === '1') setFormOpen(true)
    if (querySearch || queryAsset || openNew) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const resetFilters = (): void => {
    setSearchInput('')
    setStatus('all')
    setEmployeeId('')
    setDepartmentId('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const activeFilterCount = [
    search.trim(),
    status !== 'all',
    employeeId,
    departmentId,
    fromDate,
    toDate
  ].filter(Boolean).length

  const remove = async (assignment: Assignment): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa phiếu cấp phát?',
      description: `Phiếu ${assignment.code} của ${assignment.employeeName} sẽ bị xóa khỏi lịch sử. Chỉ phiếu đã thu hồi mới có thể xóa.`,
      confirmText: 'Xóa phiếu'
    })
    if (!ok) return
    try {
      await api.assignments.remove(assignment.id)
      toast.success('Đã xóa phiếu cấp phát', assignment.code)
      void load()
    } catch (error) {
      toast.error('Không thể xóa phiếu', errorMessage(error))
    }
  }

  const openCreate = (): void => {
    setPresetAssetId(null)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Cấp phát thiết bị"
        description="Theo dõi lịch sử bàn giao và thu hồi thiết bị cho nhân viên."
        icon={<ArrowLeftRight className="h-5 w-5" />}
        meta={
          data ? (
            <Badge tone="info">
              {formatNumber(data.total)} phiếu {activeFilterCount ? '(đang lọc)' : ''}
            </Badge>
          ) : undefined
        }
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Cấp phát thiết bị
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm mã phiếu, thiết bị, nhân viên…"
            className="xl:w-[300px]"
          />
          <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-3">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter)
                setPage(1)
              }}
              aria-label="Lọc trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang cấp phát</option>
              <option value="overdue">Quá hạn thu hồi</option>
              <option value="returned">Đã thu hồi</option>
            </Select>
            <Select
              value={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value)
                setPage(1)
              }}
              aria-label="Lọc nhân viên"
            >
              <option value="">Tất cả nhân viên</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </Select>
            <Select
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value)
                setPage(1)
              }}
              aria-label="Lọc bộ phận"
            >
              <option value="">Tất cả bộ phận</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
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
            icon={<ArrowLeftRight className="h-6 w-6" />}
            title={activeFilterCount ? 'Không tìm thấy phiếu cấp phát' : 'Chưa có phiếu cấp phát'}
            description={
              activeFilterCount
                ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                : 'Cấp phát thiết bị cho nhân viên để bắt đầu theo dõi.'
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              ) : canWrite ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Cấp phát thiết bị
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Thiết bị</th>
                  <th>Nhân viên</th>
                  <th>Ngày cấp phát</th>
                  <th>Dự kiến thu hồi</th>
                  <th>Trạng thái</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((assignment) => {
                  const isOverdue = assignment.isOverdue
                  const actions = [
                    {
                      label: 'Xem thiết bị',
                      icon: <ArrowLeftRight className="h-4 w-4" />,
                      onClick: () => navigate(`/assets/${assignment.assetId}`)
                    },
                    ...(assignment.status === 'active' && canWrite
                      ? [
                          {
                            label: 'Thu hồi thiết bị',
                            icon: <RotateCcw className="h-4 w-4" />,
                            onClick: () => {
                              setReturning(assignment)
                              setReturnOpen(true)
                            }
                          }
                        ]
                      : []),
                    ...(assignment.status === 'returned' && canWrite
                      ? [
                          {
                            label: 'Xóa phiếu',
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                            dividerBefore: true,
                            onClick: () => void remove(assignment)
                          }
                        ]
                      : [])
                  ]

                  return (
                    <tr key={assignment.id}>
                      <td>
                        <span className="font-mono text-[11.5px] font-medium text-slate-700 dark:text-slate-200">
                          {assignment.code}
                        </span>
                        <p className="text-[10.5px] text-slate-400">{formatDate(assignment.createdAt)}</p>
                      </td>
                      <td>
                        <Link
                          to={`/assets/${assignment.assetId}`}
                          className="block max-w-[220px] truncate text-[12.5px] font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400"
                        >
                          {assignment.assetName}
                        </Link>
                        <p className="font-mono text-[10.5px] text-slate-400">
                          {assignment.assetCode} · {assignment.categoryName}
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <UserRound className="h-3.5 w-3.5" />
                          </span>
                          <div>
                            <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                              {assignment.employeeName}
                            </p>
                            <p className="text-[10.5px] text-slate-400">{assignment.departmentName ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-[12px] text-slate-600 dark:text-slate-300">
                          {formatDate(assignment.assignedDate)}
                        </span>
                        {assignment.conditionBefore && (
                          <p className="text-[10.5px] text-slate-400">
                            {ASSET_CONDITION_META[assignment.conditionBefore].label}
                          </p>
                        )}
                      </td>
                      <td>
                        <span
                          className={cn(
                            'text-[12px]',
                            isOverdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
                          )}
                        >
                          {formatDate(assignment.expectedReturnDate)}
                        </span>
                        {assignment.returnedDate && (
                          <p className="text-[10.5px] text-slate-400">
                            Đã trả {formatDate(assignment.returnedDate)}
                          </p>
                        )}
                      </td>
                      <td>
                        {assignment.status === 'active' ? (
                          <Badge tone={isOverdue ? 'danger' : 'info'} dot>
                            {isOverdue ? 'Quá hạn' : 'Đang sử dụng'}
                          </Badge>
                        ) : (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" /> Đã thu hồi
                          </Badge>
                        )}
                      </td>
                      <td>
                        <Dropdown
                          width={200}
                          trigger={
                            <span className="icon-btn">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          }
                          ariaLabel={`Thao tác ${assignment.code}`}
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

      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
        <Clock className="h-3 w-3" />
        Phiếu quá hạn được đánh dấu khi ngày dự kiến thu hồi đã qua mà thiết bị chưa được trả.
        <span className="ml-auto">
          Hôm nay: {formatDate(todayISO())}
        </span>
      </div>

      <AssignmentFormModal
        open={formOpen}
        presetAssetId={presetAssetId}
        assets={assets}
        employees={employees}
        departments={departments}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          void load()
          void loadCatalogs()
        }}
      />

      <ReturnAssignmentModal
        open={returnOpen}
        assignment={returning}
        locations={locations}
        onClose={() => setReturnOpen(false)}
        onSaved={() => {
          void load()
          void loadCatalogs()
        }}
      />
    </div>
  )
}
