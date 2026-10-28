import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  Cpu,
  HardDrive,
  History,
  Network,
  Pencil,
  Save,
  Server,
  ShieldCheck
} from 'lucide-react'
import type { InfrastructureOverview, ItInfrastructureInput } from '@shared/types'
import { hasPermission } from '@shared/constants'
import { formatDateTime, formatNumber } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { StatCard } from '../../components/common/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, Spinner } from '../../components/ui/Feedback'

const EMPTY_FORM = {
  physicalServers: '0',
  virtualServers: '0',
  switches: '0',
  firewalls: '0',
  note: ''
}

export function InfrastructurePage() {
  const user = useCurrentUser()
  const canWrite = hasPermission(user.role, 'infrastructure:write')

  const [overview, setOverview] = useState<InfrastructureOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOverview(await api.infrastructure.get())
    } catch (error) {
      toast.error('Không thể tải số liệu hạ tầng', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openForm = (): void => {
    const current = overview?.current
    setForm({
      physicalServers: String(current?.physicalServers ?? 0),
      virtualServers: String(current?.virtualServers ?? 0),
      switches: String(current?.switches ?? 0),
      firewalls: String(current?.firewalls ?? 0),
      note: current?.note ?? ''
    })
    setErrors({})
    setOpen(true)
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    for (const key of ['physicalServers', 'virtualServers', 'switches', 'firewalls'] as const) {
      const value = form[key].trim()
      if (value === '') {
        next[key] = 'Vui lòng nhập số lượng.'
        continue
      }
      const number = Number(value)
      if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) {
        next[key] = 'Số lượng phải là số nguyên không âm.'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async (): Promise<void> => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload: ItInfrastructureInput = {
        physicalServers: Number(form.physicalServers),
        virtualServers: Number(form.virtualServers),
        switches: Number(form.switches),
        firewalls: Number(form.firewalls),
        note: form.note.trim() || null
      }
      const result = await api.infrastructure.update(payload)
      setOverview(result)
      toast.success('Đã cập nhật hạ tầng CNTT', 'Số liệu và lịch sử thay đổi đã được lưu.')
      setOpen(false)
    } catch (error) {
      toast.error('Không thể cập nhật hạ tầng', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const current = overview?.current
  const total =
    (current?.physicalServers ?? 0) +
    (current?.virtualServers ?? 0) +
    (current?.switches ?? 0) +
    (current?.firewalls ?? 0)

  return (
    <div>
      <PageHeader
        title="Hạ tầng CNTT"
        description="Số liệu máy chủ vật lý, máy ảo, switch và firewall của đơn vị. Mọi thay đổi đều được lưu lịch sử."
        icon={<Network className="h-5 w-5" />}
        meta={current ? <Badge tone="info">{formatNumber(total)} thiết bị</Badge> : undefined}
        actions={
          canWrite ? (
            <Button leftIcon={<Pencil className="h-4 w-4" />} onClick={openForm}>
              Cập nhật số liệu
            </Button>
          ) : undefined
        }
      />

      {loading && !overview ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Máy chủ vật lý"
              value={formatNumber(current?.physicalServers ?? 0)}
              hint="Máy chủ đặt tại đơn vị"
              icon={<Server className="h-5 w-5" />}
              tone="info"
            />
            <StatCard
              label="Máy ảo"
              value={formatNumber(current?.virtualServers ?? 0)}
              hint="Máy ảo trên nền tảng ảo hóa"
              icon={<Cpu className="h-5 w-5" />}
              tone="teal"
            />
            <StatCard
              label="Switch"
              value={formatNumber(current?.switches ?? 0)}
              hint="Thiết bị chuyển mạch mạng LAN"
              icon={<Network className="h-5 w-5" />}
              tone="purple"
            />
            <StatCard
              label="Firewall"
              value={formatNumber(current?.firewalls ?? 0)}
              hint="Thiết bị tường lửa"
              icon={<ShieldCheck className="h-5 w-5" />}
              tone="danger"
            />
            <StatCard
              label="Tổng thiết bị hạ tầng"
              value={formatNumber(total)}
              hint={
                current?.updatedAt
                  ? `Cập nhật ${formatDateTime(current.updatedAt)}${
                      current.updatedByName ? ` · ${current.updatedByName}` : ''
                    }`
                  : 'Chưa cập nhật'
              }
              icon={<HardDrive className="h-5 w-5" />}
              tone="success"
            />
          </div>

          {current?.note && (
            <div className="card mb-4 px-4 py-3 text-[12.5px] text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Ghi chú hạ tầng: </span>
              {current.note}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
              <History className="h-4 w-4 text-slate-400" />
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                Lịch sử thay đổi số liệu
              </p>
              <Badge tone="neutral">{formatNumber(overview?.history.length ?? 0)}</Badge>
            </div>
            {overview && overview.history.length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.history.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                          {entry.changedByName ?? 'Không xác định'}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatDateTime(entry.changedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="info">MCVL {entry.physicalServers}</Badge>
                        <Badge tone="teal">Máy ảo {entry.virtualServers}</Badge>
                        <Badge tone="purple">Switch {entry.switches}</Badge>
                        <Badge tone="danger">Firewall {entry.firewalls}</Badge>
                      </div>
                    </div>
                    {entry.changes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {entry.changes.map((change) => (
                          <span
                            key={`${entry.id}-${change.field}`}
                            className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400"
                          >
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                              {change.label}
                            </span>
                            <span className="tabular-nums">{change.before ?? '—'}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {change.after ?? '—'}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    {entry.note && (
                      <p className="mt-1.5 text-[11.5px] italic text-slate-500 dark:text-slate-400">
                        {entry.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<History className="h-6 w-6" />}
                title="Chưa có lịch sử thay đổi"
                description={
                  canWrite
                    ? 'Cập nhật số liệu hạ tầng lần đầu để bắt đầu ghi nhận lịch sử.'
                    : 'Số liệu hạ tầng chưa được cập nhật.'
                }
              />
            )}
          </div>
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cập nhật số liệu hạ tầng CNTT"
        description="Số lượng phải là số nguyên không âm. Hệ thống tự ghi nhận người và thời điểm cập nhật."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button leftIcon={<Save className="h-4 w-4" />} onClick={() => void save()} loading={saving}>
              Lưu số liệu
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số lượng máy chủ vật lý" required error={errors.physicalServers}>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.physicalServers}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, physicalServers: event.target.value }))
              }
              invalid={Boolean(errors.physicalServers)}
            />
          </Field>
          <Field label="Số lượng máy ảo" required error={errors.virtualServers}>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.virtualServers}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, virtualServers: event.target.value }))
              }
              invalid={Boolean(errors.virtualServers)}
            />
          </Field>
          <Field label="Số lượng switch" required error={errors.switches}>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.switches}
              onChange={(event) => setForm((prev) => ({ ...prev, switches: event.target.value }))}
              invalid={Boolean(errors.switches)}
            />
          </Field>
          <Field label="Số lượng firewall" required error={errors.firewalls}>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.firewalls}
              onChange={(event) => setForm((prev) => ({ ...prev, firewalls: event.target.value }))}
              invalid={Boolean(errors.firewalls)}
            />
          </Field>
          <Field label="Ghi chú" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="VD: Phòng máy chủ tại tầng 2, nền tảng ảo hóa VMware ESXi 8.0…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
