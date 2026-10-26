import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
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
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Clock,
  History,
  MonitorSmartphone,
  Package,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  Wrench
} from 'lucide-react'
import type { DashboardData } from '@shared/types'
import {
  ASSET_STATUS_META,
  MAINTENANCE_STATUS_META,
  MAINTENANCE_TYPE_META,
  ORG_BLOCK_META,
  hasPermission
} from '@shared/constants'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  relativeTime
} from '@shared/utils'
import { api, errorMessage } from '../lib/api'
import { useCurrentUser } from '../store/auth'
import { toast } from '../store/toast'
import { PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, Spinner } from '../components/ui/Feedback'
import { ProgressBar } from '../components/ui/Avatar'
import { STATUS_CHART_COLORS, CHART_COLORS } from '../lib/colors'
import { cn } from '../lib/cn'

const CHART_TOOLTIP = {
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(255,255,255,0.98)',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
  color: '#0f172a'
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

function statusToneClass(status: string): string {
  return STATUS_CHART_COLORS[status] ?? '#64748b'
}

export function DashboardPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true)
      else setLoading(true)
      try {
        const result = await api.dashboard.get()
        setData(result)
      } catch (error) {
        toast.error('Không thể tải bảng điều khiển', errorMessage(error))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <Spinner />
        Đang tải dữ liệu…
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Không thể tải dữ liệu"
        description="Vui lòng thử lại sau."
        action={<Button onClick={() => void load()}>Thử lại</Button>}
      />
    )
  }

  const { kpis } = data
  const statusTotal = data.byStatus.reduce((sum, item) => sum + item.count, 0)
  const today = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user.fullName.split(' ').slice(-1)[0]} 👋`}
        description={`${today.charAt(0).toUpperCase()}${today.slice(1)} · Tổng quan tình hình tài sản của xã.`}
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={<RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />}
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              Làm mới
            </Button>
            {hasPermission(user.role, 'asset:write') && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/assets?new=1')}>
                Thêm thiết bị
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng thiết bị"
          value={formatNumber(kpis.totalAssets)}
          icon={<MonitorSmartphone className="h-[18px] w-[18px]" />}
          tone="info"
          hint={
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {kpis.inUse} đang sử dụng · {kpis.available} sẵn sàng
            </span>
          }
        />
        <StatCard
          label="Nguyên giá tài sản"
          value={formatCompactCurrency(kpis.totalPurchaseValue)}
          icon={<Wallet className="h-[18px] w-[18px]" />}
          tone="purple"
          hint={`Giá trị còn lại ${formatCompactCurrency(kpis.totalCurrentValue)}`}
          footer={
            <ProgressBar
              value={
                kpis.totalPurchaseValue
                  ? (kpis.totalCurrentValue / kpis.totalPurchaseValue) * 100
                  : 0
              }
              tone="primary"
              showLabel
            />
          }
        />
        <StatCard
          label="Đang cấp phát"
          value={formatNumber(kpis.activeAssignments)}
          icon={<Users className="h-[18px] w-[18px]" />}
          tone="success"
          hint={`${kpis.inUse} thiết bị đang được nhân viên sử dụng`}
        />
        <StatCard
          label="Cần chú ý"
          value={formatNumber(kpis.warrantyExpiring + kpis.maintenanceDue)}
          icon={<ShieldAlert className="h-[18px] w-[18px]" />}
          tone="warning"
          hint={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> {kpis.warrantyExpiring} sắp hết bảo hành
              </span>
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-3 w-3" /> {kpis.maintenanceDue} bảo trì đến hạn
              </span>
            </span>
          }
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="section-title">Giá trị tài sản theo danh mục</h2>
              <p className="mt-0.5 text-[11.5px] muted">Giá trị còn lại sau khấu hao</p>
            </div>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Xem báo cáo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="h-[248px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory.slice(0, 6)} barSize={26} margin={{ left: -10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                  interval={0}
                  tickFormatter={(value: string) => (value.length > 12 ? `${value.slice(0, 11)}…` : value)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                  tickFormatter={(value: number) => formatCompactCurrency(value)}
                  width={64}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={(value: unknown) => [formatCurrency(Number(value)), 'Giá trị còn lại']}
                  cursor={{ fill: 'rgba(148,163,184,0.07)' }}
                />
                <Bar dataKey="value" radius={[7, 7, 0, 0]}>
                  {data.byCategory.slice(0, 6).map((item, index) => (
                    <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="section-title">Trạng thái thiết bị</h2>
          <p className="mt-0.5 text-[11.5px] muted">Tỷ lệ trên tổng {statusTotal} thiết bị</p>
          <div className="mt-1 h-[164px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byStatus}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.byStatus.map((item) => (
                    <Cell key={item.status} fill={statusToneClass(item.status)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={(value: unknown, name?: unknown) => [
                    `${formatNumber(Number(value))} thiết bị`,
                    ASSET_STATUS_META[name as keyof typeof ASSET_STATUS_META]?.label ?? name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 space-y-1.5">
            {data.byStatus.map((item) => (
              <div key={item.status} className="flex items-center gap-2 text-[12px]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: statusToneClass(item.status) }}
                />
                <span className="text-slate-600 dark:text-slate-300">
                  {ASSET_STATUS_META[item.status].label}
                </span>
                <span className="ml-auto font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {item.count}
                </span>
                <span className="w-10 text-right text-[11px] tabular-nums text-slate-400">
                  {statusTotal ? Math.round((item.count / statusTotal) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="section-title">Chi phí bảo trì 6 tháng gần nhất</h2>
              <p className="mt-0.5 text-[11.5px] muted">Dựa trên các phiếu bảo trì đã hoàn thành</p>
            </div>
            <Link
              to="/maintenance"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.maintenanceCost} margin={{ left: -14, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                  tickFormatter={(value: string) => `T${Number(value.slice(5))}/${value.slice(2, 4)}`}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                  tickFormatter={(value: number) => formatCompactCurrency(value)}
                  width={58}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={(value: unknown) => [formatCurrency(Number(value)), 'Chi phí']}
                  labelFormatter={(label) => `Tháng ${String(label).slice(5)}/${String(label).slice(0, 4)}`}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#costGradient)"
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="section-title">Cơ cấu tổ chức</h2>
              <p className="mt-0.5 text-[11.5px] muted">Thiết bị theo khối và phòng ban</p>
            </div>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {data.byBlock.map((item) => {
              const meta = ORG_BLOCK_META[item.block]
              return (
                <div
                  key={item.block}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {item.count}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatCompactCurrency(item.value)}</p>
                </div>
              )
            })}
          </div>
          {data.byDepartment.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu" className="py-8" />
          ) : (
            <div className="space-y-3">
              {data.byDepartment.slice(0, 5).map((item) => {
                const max = Math.max(...data.byDepartment.map((dept) => dept.count), 1)
                return (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                      <span className="truncate text-slate-600 dark:text-slate-300">{item.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500"
                        style={{ width: `${(item.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              <h2 className="section-title">Bảo hành sắp hết hạn</h2>
              <Badge tone="warning">{data.warrantyExpiring.length}</Badge>
            </div>
            <Link
              to="/assets?warranty=1"
              className="text-[12px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Xem tất cả
            </Link>
          </div>
          {data.warrantyExpiring.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Không có thiết bị sắp hết hạn"
              description="Tất cả thiết bị đều còn trong thời hạn bảo hành."
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {data.warrantyExpiring.map((asset) => (
                <Link
                  key={asset.id}
                  to={`/assets/${asset.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                      {asset.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {asset.code} · {asset.categoryName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11.5px] font-medium text-amber-600 dark:text-amber-400">
                      {formatDate(asset.warrantyExpiry)}
                    </p>
                    <p className="text-[10.5px] text-slate-400">
                      còn {asset.warrantyDaysLeft ?? 0} ngày
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              <h2 className="section-title">Bảo trì đến hạn</h2>
              <Badge tone="info">{data.maintenanceDue.length}</Badge>
            </div>
            <Link
              to="/maintenance"
              className="text-[12px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Xem tất cả
            </Link>
          </div>
          {data.maintenanceDue.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="Không có lịch bảo trì"
              description="Chưa có phiếu bảo trì nào đến hạn."
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {data.maintenanceDue.map((record) => (
                <Link
                  key={record.id}
                  to="/maintenance"
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                      {record.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {record.assetCode} · {MAINTENANCE_TYPE_META[record.type].label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={MAINTENANCE_STATUS_META[record.status].tone}>
                      {MAINTENANCE_STATUS_META[record.status].label}
                    </Badge>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">
                      {record.isOverdue ? 'Quá hạn ' : ''}
                      {formatDate(record.scheduledDate)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <h2 className="section-title">Hoạt động gần đây</h2>
            </div>
            <Link
              to="/activity"
              className="text-[12px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Nhật ký
            </Link>
          </div>
          {data.recentLogs.length === 0 ? (
            <EmptyState title="Chưa có hoạt động" className="py-8" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {data.recentLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-slate-700 dark:text-slate-200">
                      <span className="font-medium">{log.username ?? 'Hệ thống'}</span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">{log.action.toLowerCase()}</span>
                    </p>
                    {log.entityLabel && (
                      <p className="truncate text-[11px] text-slate-400">{log.entityLabel}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10.5px] text-slate-400">{relativeTime(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              <h2 className="section-title">Cấp phát gần đây</h2>
            </div>
            <Link
              to="/assignments"
              className="text-[12px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Xem tất cả
            </Link>
          </div>
          {data.recentAssignments.length === 0 ? (
            <EmptyState title="Chưa có phiếu cấp phát" className="py-8" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {data.recentAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    {assignment.employeeName.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
                      {assignment.assetName}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {assignment.employeeName} · {formatDate(assignment.assignedDate)}
                    </p>
                  </div>
                  {assignment.status === 'active' ? (
                    <Badge tone={assignment.isOverdue ? 'danger' : 'info'}>
                      {assignment.isOverdue ? 'Quá hạn' : 'Đang dùng'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Đã thu hồi</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Thêm thiết bị mới',
            description: 'Ghi nhận tài sản vào hệ thống',
            icon: <Plus className="h-4 w-4" />,
            to: '/assets?new=1',
            tone: 'from-blue-500 to-indigo-600'
          },
          {
            label: 'Cấp phát thiết bị',
            description: 'Bàn giao cho nhân viên',
            icon: <Users className="h-4 w-4" />,
            to: '/assignments?new=1',
            tone: 'from-emerald-500 to-teal-600'
          },
          {
            label: 'Lập phiếu bảo trì',
            description: 'Theo dõi sửa chữa, bảo dưỡng',
            icon: <Wrench className="h-4 w-4" />,
            to: '/maintenance?new=1',
            tone: 'from-amber-500 to-orange-600'
          },
          {
            label: 'Kiểm kê tài sản',
            description: 'Quét QR và đối chiếu',
            icon: <ClipboardList className="h-4 w-4" />,
            to: '/audits?new=1',
            tone: 'from-violet-500 to-purple-600'
          }
        ].map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="card group flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm', action.tone)}>
              {action.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{action.label}</p>
              <p className="truncate text-[11px] text-slate-400">{action.description}</p>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-brand-500" />
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 text-[11.5px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-brand-500" />
          Tổng khấu hao lũy kế: <strong className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(kpis.totalDepreciation)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
