import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  MapPin,
  Pencil,
  ScanLine,
  Search,
  Settings2,
  UserRound,
  XCircle
} from 'lucide-react'
import type {
  AuditDetail,
  AuditItem,
  AuditResult,
  AuditSession,
  Employee,
  Location
} from '@shared/types'
import {
  AUDIT_RESULT_META,
  AUDIT_STATUS_META,
  hasPermission
} from '@shared/constants'
import {
  formatDate,
  formatDateTime,
  formatNumber
} from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { Tabs } from '../../components/ui/Tabs'
import { ProgressBar } from '../../components/ui/Avatar'
import { cn } from '../../lib/cn'
import { AuditCompleteModal, AuditItemModal } from './AuditModals'
import { QrScanner } from './QrScanner'

type ItemFilter = 'all' | AuditResult

const FILTER_LABELS: Record<ItemFilter, string> = {
  all: 'Tất cả',
  pending: 'Chưa kiểm',
  matched: 'Đúng',
  wrong_location: 'Sai vị trí',
  wrong_owner: 'Sai người dùng',
  damaged: 'Hỏng',
  missing: 'Không tìm thấy'
}

interface LastScan {
  code: string
  name: string
  result: AuditResult
}

export function AuditDetailPage() {
  const { id } = useParams()
  const sessionId = Number(id)
  const navigate = useNavigate()
  const user = useCurrentUser()

  const [detail, setDetail] = useState<AuditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<Location[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [scanCode, setScanCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [actualLocationId, setActualLocationId] = useState('')
  const [actualEmployeeId, setActualEmployeeId] = useState('')
  const [lastScan, setLastScan] = useState<LastScan | null>(null)
  const [filter, setFilter] = useState<ItemFilter>('all')
  const [itemSearch, setItemSearch] = useState('')
  const [editingItem, setEditingItem] = useState<AuditItem | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const canWrite = hasPermission(user.role, 'audit:write')
  const session = detail?.session ?? null
  const isOpen = session?.status === 'in_progress'

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      navigate('/audits', { replace: true })
      return
    }
    setLoading(true)
    try {
      const result = await api.audits.get(sessionId)
      setDetail(result)
    } catch (error) {
      toast.error('Không thể tải phiên kiểm kê', errorMessage(error))
      navigate('/audits', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [sessionId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void Promise.all([api.locations.list(), api.employees.list()])
      .then(([locationList, employeeList]) => {
        setLocations(locationList)
        setEmployees(employeeList)
      })
      .catch(() => undefined)
  }, [])

  const counts = useMemo(() => {
    const items = detail?.items ?? []
    const map: Record<ItemFilter, number> = {
      all: items.length,
      pending: 0,
      matched: 0,
      wrong_location: 0,
      wrong_owner: 0,
      damaged: 0,
      missing: 0
    }
    for (const item of items) map[item.result] += 1
    return map
  }, [detail])

  const filteredItems = useMemo(() => {
    const items = detail?.items ?? []
    const term = itemSearch.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && item.result !== filter) return false
      if (!term) return true
      return (
        item.assetCode.toLowerCase().includes(term) ||
        item.assetName.toLowerCase().includes(term) ||
        (item.serialNumber ?? '').toLowerCase().includes(term) ||
        (item.expectedEmployeeName ?? '').toLowerCase().includes(term)
      )
    })
  }, [detail, filter, itemSearch])

  const submitScan = async (code: string): Promise<void> => {
    if (!session || !isOpen) return
    const value = code.trim()
    if (!value) return
    setScanning(true)
    try {
      const result = await api.audits.scan({
        sessionId: session.id,
        code: value,
        actualLocationId: actualLocationId ? Number(actualLocationId) : null,
        actualEmployeeId: actualEmployeeId ? Number(actualEmployeeId) : null
      })
      setDetail(result)
      const normalized = value.toUpperCase()
      const scanned =
        result.items.find((item) => item.assetCode.toUpperCase() === normalized) ??
        result.items.find((item) => (item.serialNumber ?? '').toUpperCase() === normalized)
      if (scanned) {
        setLastScan({ code: scanned.assetCode, name: scanned.assetName, result: scanned.result })
        toast.success(
          `Đã kiểm: ${scanned.assetCode}`,
          `${AUDIT_RESULT_META[scanned.result].label} · ${scanned.assetName}`
        )
      }
      setScanCode('')
      inputRef.current?.focus()
    } catch (error) {
      toast.error('Không thể kiểm kê thiết bị', errorMessage(error))
    } finally {
      setScanning(false)
    }
  }

  const exportExcel = async (): Promise<void> => {
    if (!session) return
    try {
      const result = await api.audits.exportExcel(session.id)
      if (!result.canceled && result.filePath) {
        toast.success('Đã xuất kết quả kiểm kê', result.filePath)
      }
    } catch (error) {
      toast.error('Không thể xuất Excel', errorMessage(error))
    }
  }

  const resetScanOptions = (): void => {
    setActualLocationId('')
    setActualEmployeeId('')
    setShowOptions(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!detail || !session) return null
  const statusMeta = AUDIT_STATUS_META[session.status]
  const percent = session.totalItems ? (session.scannedItems / session.totalItems) * 100 : 0

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[12px] text-slate-400">
        <Link to="/audits" className="inline-flex items-center gap-1 hover:text-brand-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Danh sách kiểm kê
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-500 dark:text-slate-400">{session.code}</span>
      </div>

      <PageHeader
        title={session.name}
        description={`Phạm vi: ${session.departmentName ?? 'Tất cả phòng ban'} · ${session.locationName ?? 'Tất cả vị trí'}`}
        icon={<ClipboardCheck className="h-5 w-5" />}
        meta={
          <>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {session.code}
            </span>
            <Badge tone={statusMeta.tone} dot={session.status === 'in_progress'}>
              {statusMeta.label}
            </Badge>
            <span className="text-[11px] text-slate-400">
              {formatDate(session.startDate)} → {formatDate(session.endDate)}
            </span>
            {session.createdByName && (
              <span className="text-[11px] text-slate-400">Tạo bởi {session.createdByName}</span>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => void exportExcel()}>
              Xuất Excel
            </Button>
            {isOpen && canWrite && (
              <Button
                variant="success"
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => setCompleteOpen(true)}
              >
                Hoàn thành kiểm kê
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Tổng thiết bị</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatNumber(session.totalItems)}
              </p>
              <p className="mt-1 text-[10.5px] text-slate-400">Trong phạm vi kiểm kê</p>
            </div>
            <div className="card p-4">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Đã kiểm</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {formatNumber(session.scannedItems)}
              </p>
              <div className="mt-2">
                <ProgressBar value={percent} tone="primary" showLabel />
              </div>
            </div>
            <div className="card p-4">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Đúng vị trí</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatNumber(session.matchedItems)}
              </p>
              <p className="mt-1 text-[10.5px] text-slate-400">Khớp hồ sơ hiện tại</p>
            </div>
            <div className="card p-4">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Cần xử lý</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {formatNumber(session.missingItems + session.wrongItems + session.damagedItems)}
              </p>
              <p className="mt-1 text-[10.5px] text-slate-400">
                {session.missingItems} thiếu · {session.wrongItems} sai · {session.damagedItems} hỏng
              </p>
            </div>
          </div>

          <div className="card">
            <div className="border-b border-slate-100 px-4 pt-3 dark:border-slate-800">
              <Tabs
                value={filter}
                onChange={setFilter}
                items={(Object.keys(FILTER_LABELS) as ItemFilter[]).map((value) => ({
                  value,
                  label: FILTER_LABELS[value],
                  count: counts[value]
                }))}
              />
            </div>
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  placeholder="Tìm thiết bị trong phiên kiểm kê…"
                  className="input h-9 pl-9 text-[12.5px]"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Hiển thị {filteredItems.length} / {detail.items.length} thiết bị
              </p>
            </div>
            <div className="max-h-[560px] overflow-auto border-t border-slate-100 dark:border-slate-800">
              {filteredItems.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck className="h-5 w-5" />}
                  title="Không có thiết bị"
                  description="Không có thiết bị phù hợp với bộ lọc hiện tại."
                  className="py-10"
                />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Thiết bị</th>
                      <th>Dự kiến</th>
                      <th>Thực tế</th>
                      <th>Kết quả</th>
                      <th>Kiểm lúc</th>
                      {isOpen && canWrite && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const meta = AUDIT_RESULT_META[item.result]
                      return (
                        <tr key={item.id}>
                          <td>
                            <Link
                              to={`/assets/${item.assetId}`}
                              className="block max-w-[220px] truncate text-[12px] font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400"
                            >
                              {item.assetName}
                            </Link>
                            <p className="font-mono text-[10px] text-slate-400">
                              {item.assetCode}
                              {item.serialNumber ? ` · ${item.serialNumber}` : ''}
                            </p>
                          </td>
                          <td>
                            <p className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                              <MapPin className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                              <span className="max-w-[130px] truncate">
                                {item.expectedLocationName ?? 'Chưa xác định'}
                              </span>
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-400">
                              <UserRound className="h-2.5 w-2.5 shrink-0" />
                              <span className="max-w-[130px] truncate">
                                {item.expectedEmployeeName ?? 'Chưa cấp phát'}
                              </span>
                            </p>
                          </td>
                          <td>
                            <p className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                              <MapPin className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                              <span className="max-w-[130px] truncate">
                                {item.actualLocationName ?? '—'}
                              </span>
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-400">
                              <UserRound className="h-2.5 w-2.5 shrink-0" />
                              <span className="max-w-[130px] truncate">
                                {item.actualEmployeeName ?? '—'}
                              </span>
                            </p>
                          </td>
                          <td>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {item.note && (
                              <p className="mt-0.5 max-w-[130px] truncate text-[10px] text-slate-400">{item.note}</p>
                            )}
                          </td>
                          <td>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                              {item.scannedAt ? formatDateTime(item.scannedAt) : '—'}
                            </p>
                            <p className="text-[10px] text-slate-400">{item.scannedByName ?? ''}</p>
                          </td>
                          {isOpen && canWrite && (
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item)
                                  setItemOpen(true)
                                }}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-label={`Cập nhật ${item.assetCode}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isOpen && canWrite ? (
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <ScanLine className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Quét thiết bị</h3>
                  <p className="text-[10.5px] text-slate-400">Nhập mã hoặc dùng camera bên dưới</p>
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void submitScan(scanCode)
                }}
                className="mb-2 flex gap-2"
              >
                <input
                  ref={inputRef}
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value)}
                  placeholder="Mã thiết bị / serial…"
                  className="input h-10 flex-1 font-mono text-[12.5px] uppercase"
                  autoFocus
                  disabled={scanning}
                />
                <Button type="submit" loading={scanning} className="h-10">
                  Quét
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setShowOptions((value) => !value)}
                className="mb-2 flex w-full items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400"
              >
                <Settings2 className="h-3 w-3" />
                Tùy chọn đối chiếu thực tế
                <ChevronDown className={cn('ml-auto h-3 w-3 transition', showOptions && 'rotate-180')} />
              </button>

              {showOptions && (
                <div className="mb-2 space-y-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
                  <Select
                    value={actualLocationId}
                    onChange={(event) => setActualLocationId(event.target.value)}
                    className="h-9 text-[12px]"
                    aria-label="Vị trí thực tế"
                  >
                    <option value="">Vị trí thực tế: theo hồ sơ</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={actualEmployeeId}
                    onChange={(event) => setActualEmployeeId(event.target.value)}
                    className="h-9 text-[12px]"
                    aria-label="Người sử dụng thực tế"
                  >
                    <option value="">Người dùng thực tế: theo hồ sơ</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName}
                      </option>
                    ))}
                  </Select>
                  {(actualLocationId || actualEmployeeId) && (
                    <button
                      type="button"
                      onClick={resetScanOptions}
                      className="text-[10.5px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      Đặt lại tùy chọn
                    </button>
                  )}
                </div>
              )}

              <QrScanner onScan={(text) => void submitScan(text)} disabled={scanning} />

              {lastScan && (
                <div
                  className={cn(
                    'mt-2 rounded-xl px-3 py-2.5 text-[11.5px]',
                    lastScan.result === 'matched'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : lastScan.result === 'missing'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {lastScan.result === 'matched' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {lastScan.code} · {AUDIT_RESULT_META[lastScan.result].label}
                  </div>
                  <p className="mt-0.5 truncate opacity-80">{lastScan.name}</p>
                </div>
              )}

              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[10.5px] text-slate-400 dark:bg-slate-800/40">
                Quét mã thiết bị hoặc serial. Hệ thống tự so sánh vị trí và người sử dụng với hồ sơ tại thời điểm tạo phiên.
              </div>
            </div>
          ) : (
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    Phiên đã kết thúc
                  </h3>
                  <p className="text-[10.5px] text-slate-400">
                    {session.completedAt ? `Hoàn thành ${formatDateTime(session.completedAt)}` : statusMeta.label}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <ProgressBar value={percent} tone="success" showLabel />
                <p className="text-[11px] text-slate-400">
                  Đã kiểm {session.scannedItems}/{session.totalItems} thiết bị.
                </p>
              </div>
            </div>
          )}

          <div className="card p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              Tổng hợp kết quả
            </h3>
            <div className="space-y-2">
              {(['matched', 'wrong_location', 'wrong_owner', 'damaged', 'missing', 'pending'] as AuditResult[]).map(
                (result) => (
                  <div key={result} className="flex items-center gap-2 text-[11.5px]">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        result === 'matched'
                          ? 'bg-emerald-500'
                          : result === 'missing'
                            ? 'bg-rose-500'
                            : result === 'pending'
                              ? 'bg-slate-300'
                              : 'bg-amber-500'
                      )}
                    />
                    <span className="text-slate-600 dark:text-slate-300">
                      {AUDIT_RESULT_META[result].label}
                    </span>
                    <span className="ml-auto font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {counts[result]}
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 text-[10.5px] text-slate-400 dark:border-slate-800">
              Cập nhật cuối: {formatDateTime(session.completedAt ?? new Date().toISOString())}
            </div>
          </div>

          {session.note && (
            <div className="card p-4">
              <h3 className="mb-2 text-[12px] font-semibold text-slate-800 dark:text-slate-100">Ghi chú phiên</h3>
              <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                {session.note}
              </p>
            </div>
          )}
        </div>
      </div>

      <AuditItemModal
        open={itemOpen}
        item={editingItem}
        locations={locations}
        employees={employees}
        onClose={() => setItemOpen(false)}
        onSaved={(updated) => setDetail(updated)}
      />

      <AuditCompleteModal
        open={completeOpen}
        session={session}
        onClose={() => setCompleteOpen(false)}
        onCompleted={() => void load()}
      />
    </div>
  )
}
