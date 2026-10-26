import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  FilterX,
  Layers,
  RefreshCw,
  TrendingDown,
  Wallet
} from 'lucide-react'
import type {
  AssetStatus,
  Category,
  Department,
  Location,
  OrgBlock,
  ReportData,
  ReportGroup,
  ReportParams
} from '@shared/types'
import { ASSET_STATUS_META, ORG_BLOCK_META, ORG_BLOCK_OPTIONS, hasPermission } from '@shared/constants'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber
} from '@shared/utils'
import { api, errorMessage } from '../lib/api'
import { useCurrentUser } from '../store/auth'
import { toast } from '../store/toast'
import { PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { SearchInput } from '../components/common/SearchInput'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { EmptyState, Spinner } from '../components/ui/Feedback'
import { CHART_COLORS, STATUS_CHART_COLORS } from '../lib/colors'
import { cn } from '../lib/cn'

const CHART_TOOLTIP = {
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(255,255,255,0.98)',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
  color: '#0f172a'
}

const STATUS_OPTIONS = Object.keys(ASSET_STATUS_META) as AssetStatus[]

function shortLabel(value: string, max = 14): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function GroupTable({
  title,
  description,
  groups,
  emptyText
}: {
  title: string
  description: string
  groups: ReportGroup[]
  emptyText: string
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
        <h2 className="section-title">{title}</h2>
        <p className="mt-0.5 text-[11.5px] muted">{description}</p>
      </div>
      {groups.length === 0 ? (
        <EmptyState title={emptyText} className="py-10" />
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          <table className="data-table min-w-[520px]">
            <thead>
              <tr>
                <th>Nhóm</th>
                <th className="text-right">Số lượng</th>
                <th className="text-right">Nguyên giá</th>
                <th className="text-right">Giá trị còn lại</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={group.key}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="max-w-[190px] truncate text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
                        {group.label}
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <span className="text-[12.5px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {formatNumber(group.count)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="text-[12px] tabular-nums text-slate-600 dark:text-slate-300">
                      {formatCompactCurrency(group.purchaseValue)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="text-[12px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      {formatCompactCurrency(group.currentValue)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ReportsPage() {
  const user = useCurrentUser()
  const canExport = hasPermission(user.role, 'report:read')

  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  const [categoryId, setCategoryId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [block, setBlock] = useState('')
  const [locationId, setLocationId] = useState('')
  const [status, setStatus] = useState<'all' | AssetStatus>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')

  const params: ReportParams = useMemo(
    () => ({
      categoryId: categoryId ? Number(categoryId) : null,
      departmentId: departmentId ? Number(departmentId) : null,
      block: block ? (block as OrgBlock) : null,
      locationId: locationId ? Number(locationId) : null,
      status,
      fromDate: fromDate || null,
      toDate: toDate || null
    }),
    [categoryId, departmentId, block, locationId, status, fromDate, toDate]
  )

  useEffect(() => {
    const loadCatalogs = async (): Promise<void> => {
      try {
        const [categoryList, departmentList, locationList] = await Promise.all([
          api.categories.list(),
          api.departments.list(),
          api.locations.list()
        ])
        setCategories(categoryList)
        setDepartments(departmentList)
        setLocations(locationList)
      } catch (error) {
        toast.error('Không thể tải bộ lọc báo cáo', errorMessage(error))
      }
    }
    void loadCatalogs()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.reports.get(params))
    } catch (error) {
      toast.error('Không thể tạo báo cáo', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    void load()
  }, [load])

  const activeFilterCount = [
    categoryId,
    departmentId,
    block,
    locationId,
    status !== 'all' ? status : '',
    fromDate,
    toDate
  ].filter(Boolean).length

  const resetFilters = (): void => {
    setCategoryId('')
    setDepartmentId('')
    setBlock('')
    setLocationId('')
    setStatus('all')
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  const exportExcel = async (): Promise<void> => {
    setExporting(true)
    try {
      const result = await api.reports.export(params)
      if (result.canceled) return
      toast.success(
        'Đã xuất báo cáo',
        result.filePath ? `${result.count ?? 0} tài sản · ${result.filePath}` : undefined
      )
    } catch (error) {
      toast.error('Không thể xuất báo cáo', errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const filteredRows = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    if (!term) return data.rows
    return data.rows.filter((row) =>
      [row.code, row.name, row.categoryName, row.departmentName, row.employeeName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [data, search])

  const statusChart = data?.byStatus ?? []

  return (
    <div>
      <PageHeader
        title="Báo cáo tài sản"
        description="Tổng hợp giá trị, khấu hao và phân bố tài sản theo khối, danh mục, phòng ban và trạng thái."
        icon={<BarChart3 className="h-5 w-5" />}
        meta={
          data ? (
            <>
              <Badge tone="info">{formatNumber(data.summary.total)} tài sản</Badge>
              <span className="text-[11.5px] text-slate-400">
                Cập nhật {formatDate(data.generatedAt)}
              </span>
            </>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />}
              onClick={() => void load()}
              disabled={loading}
            >
              Làm mới
            </Button>
            {canExport && (
              <Button
                leftIcon={<Download className="h-4 w-4" />}
                loading={exporting}
                onClick={() => void exportExcel()}
              >
                Xuất Excel
              </Button>
            )}
          </>
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-5">
            <Select
              value={block}
              onChange={(event) => {
                setBlock(event.target.value)
                setDepartmentId('')
              }}
              aria-label="Lọc theo khối"
            >
              <option value="">Tất cả các khối</option>
              {ORG_BLOCK_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {ORG_BLOCK_META[value].label}
                </option>
              ))}
            </Select>
            <Select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Lọc theo danh mục"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              aria-label="Lọc theo phòng ban"
            >
              <option value="">Tất cả phòng ban</option>
              {ORG_BLOCK_OPTIONS.filter((value) => !block || value === block).map((value) => {
                const items = departments.filter((department) => department.block === value)
                if (items.length === 0) return null
                return (
                  <optgroup key={value} label={ORG_BLOCK_META[value].label}>
                    {items.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </Select>
            <Select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              aria-label="Lọc theo vị trí"
            >
              <option value="">Tất cả vị trí</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | AssetStatus)}
              aria-label="Lọc theo trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {ASSET_STATUS_META[value].label}
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
                onChange={(event) => setFromDate(event.target.value)}
                className="h-9 w-[122px] border-0 bg-transparent text-[11.5px] text-slate-600 outline-none dark:text-slate-300"
                aria-label="Ngày mua từ"
              />
              <span className="text-slate-300">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-9 w-[122px] border-0 bg-transparent text-[11.5px] text-slate-600 outline-none dark:text-slate-300"
                aria-label="Ngày mua đến"
              />
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

      {loading && !data ? (
        <Spinner className="py-24" />
      ) : !data ? (
        <div className="table-wrap">
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="Không thể tạo báo cáo"
            description="Vui lòng thử lại sau."
            action={<Button onClick={() => void load()}>Thử lại</Button>}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tổng tài sản"
              value={formatNumber(data.summary.total)}
              icon={<Layers className="h-[18px] w-[18px]" />}
              tone="info"
              hint={`${data.byCategory.length} danh mục · ${data.byDepartment.length} phòng ban`}
            />
            <StatCard
              label="Nguyên giá"
              value={formatCompactCurrency(data.summary.purchaseValue)}
              icon={<Wallet className="h-[18px] w-[18px]" />}
              tone="purple"
              hint={formatCurrency(data.summary.purchaseValue)}
            />
            <StatCard
              label="Giá trị còn lại"
              value={formatCompactCurrency(data.summary.currentValue)}
              icon={<CircleDollarSign className="h-[18px] w-[18px]" />}
              tone="success"
              hint={
                data.summary.purchaseValue > 0
                  ? `Còn ${Math.round((data.summary.currentValue / data.summary.purchaseValue) * 100)}% nguyên giá`
                  : 'Chưa có dữ liệu nguyên giá'
              }
            />
            <StatCard
              label="Khấu hao lũy kế"
              value={formatCompactCurrency(data.summary.accumulatedDepreciation)}
              icon={<TrendingDown className="h-[18px] w-[18px]" />}
              tone="warning"
              hint={`Tỷ lệ khấu hao ${formatNumber(data.summary.depreciationRate, 1)}%`}
            />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-2">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="section-title">Giá trị theo danh mục</h2>
                  <p className="mt-0.5 text-[11.5px] muted">
                    So sánh nguyên giá và giá trị còn lại sau khấu hao
                  </p>
                </div>
                <span className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand-600" /> Nguyên giá
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-teal-500" /> Còn lại
                  </span>
                </span>
              </div>
              {data.byCategory.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu" className="py-14" />
              ) : (
                <div className="h-[268px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.byCategory.slice(0, 8)}
                      barSize={18}
                      margin={{ left: -8, right: 8, top: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(148,163,184,0.18)"
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                        interval={0}
                        tickFormatter={(value: string) => shortLabel(value, 12)}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                        tickFormatter={(value: number) => formatCompactCurrency(value)}
                        width={62}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP}
                        cursor={{ fill: 'rgba(148,163,184,0.07)' }}
                        formatter={(value: unknown, name?: unknown) => [
                          formatCurrency(Number(value)),
                          name === 'purchaseValue' ? 'Nguyên giá' : 'Giá trị còn lại'
                        ]}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar dataKey="purchaseValue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="currentValue" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card p-4">
              <div className="mb-2">
                <h2 className="section-title">Phân bố trạng thái</h2>
                <p className="mt-0.5 text-[11.5px] muted">Tỷ lệ trên tổng số tài sản</p>
              </div>
              {statusChart.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu" className="py-12" />
              ) : (
                <>
                  <div className="h-[172px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChart}
                          dataKey="count"
                          nameKey="label"
                          innerRadius={48}
                          outerRadius={70}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {statusChart.map((item) => (
                            <Cell
                              key={item.key}
                              fill={STATUS_CHART_COLORS[item.key] ?? '#64748b'}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={CHART_TOOLTIP}
                          formatter={(value: unknown, name?: unknown) => [
                            `${formatNumber(Number(value))} tài sản`,
                            String(name)
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-1 space-y-1.5">
                    {statusChart.map((item) => (
                      <div key={item.key} className="flex items-center gap-2 text-[12px]">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: STATUS_CHART_COLORS[item.key] ?? '#64748b' }}
                        />
                        <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          {formatNumber(item.count)}
                        </span>
                        <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">
                          {data.summary.total ? Math.round((item.count / data.summary.total) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <GroupTable
              title="Tổng hợp theo khối"
              description="Phân bổ tài sản giữa Khối Đảng và Khối Nhà nước"
              groups={data.byBlock}
              emptyText="Chưa có dữ liệu khối cơ quan"
            />
            <GroupTable
              title="Tổng hợp theo danh mục"
              description="Số lượng và giá trị tài sản của từng loại thiết bị"
              groups={data.byCategory}
              emptyText="Chưa có dữ liệu danh mục"
            />
            <GroupTable
              title="Tổng hợp theo phòng ban"
              description="Phân bổ tài sản theo đơn vị sử dụng"
              groups={data.byDepartment}
              emptyText="Chưa có dữ liệu phòng ban"
            />
          </div>

          <div className="mt-3 table-wrap">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div>
                <h2 className="section-title">Chi tiết tài sản</h2>
                <p className="mt-0.5 text-[11.5px] muted">
                  {formatNumber(filteredRows.length)} / {formatNumber(data.rows.length)} tài sản
                  trong báo cáo
                </p>
              </div>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Tìm mã, tên, phòng ban, nhân viên…"
                className="sm:w-[320px]"
              />
            </div>
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-6 w-6" />}
                title={search ? 'Không tìm thấy tài sản' : 'Chưa có tài sản phù hợp'}
                description={
                  search
                    ? 'Thử từ khóa khác hoặc xóa tìm kiếm.'
                    : 'Thay đổi bộ lọc để xem dữ liệu báo cáo khác.'
                }
                action={
                  activeFilterCount > 0 ? (
                    <Button variant="outline" onClick={resetFilters}>
                      Xóa bộ lọc
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="max-h-[540px] overflow-auto">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>Thiết bị</th>
                      <th>Danh mục</th>
                      <th>Phòng ban / Người dùng</th>
                      <th>Ngày mua</th>
                      <th className="text-right">Nguyên giá</th>
                      <th className="text-right">Còn lại</th>
                      <th>Bảo hành</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <p className="max-w-[210px] truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                            {row.name}
                          </p>
                          <p className="font-mono text-[10.5px] text-slate-400">{row.code}</p>
                        </td>
                        <td>
                          <span className="text-[12px] text-slate-600 dark:text-slate-300">
                            {row.categoryName}
                          </span>
                        </td>
                        <td>
                          <p className="max-w-[180px] truncate text-[12px] text-slate-600 dark:text-slate-300">
                            {row.departmentName ?? '—'}
                          </p>
                          <p className="max-w-[180px] truncate text-[10.5px] text-slate-400">
                            {row.employeeName ?? 'Chưa cấp phát'}
                          </p>
                        </td>
                        <td>
                          <span className="text-[12px] text-slate-600 dark:text-slate-300">
                            {formatDate(row.purchaseDate)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-[12px] tabular-nums text-slate-600 dark:text-slate-300">
                            {formatCurrency(row.purchasePrice)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-[12px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
                            {formatCurrency(row.currentValue)}
                          </span>
                          <p className="text-[10.5px] tabular-nums text-slate-400">
                            -{formatCompactCurrency(row.accumulatedDepreciation)}
                          </p>
                        </td>
                        <td>
                          <span className="text-[12px] text-slate-600 dark:text-slate-300">
                            {formatDate(row.warrantyExpiry)}
                          </span>
                        </td>
                        <td>
                          <Badge tone={ASSET_STATUS_META[row.status].tone}>
                            {ASSET_STATUS_META[row.status].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            Báo cáo được tổng hợp từ dữ liệu hiện tại. Giá trị còn lại được tính theo phương pháp khấu
            hao đường thẳng và không thấp hơn giá trị thanh lý.
          </p>
        </>
      )}
    </div>
  )
}
