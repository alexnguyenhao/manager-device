import type {
  AuthUser,
  InfrastructureChange,
  InfrastructureHistoryEntry,
  InfrastructureOverview,
  ItInfrastructure,
  ItInfrastructureInput
} from '../../shared/types'
import { getDb } from '../db/database'
import { nowISO } from '../../shared/utils'
import { logActivity } from './log.service'

interface InfrastructureRow {
  physical_servers: number
  virtual_servers: number
  switches: number
  firewalls: number
  note: string | null
  updated_by: number | null
  updated_by_name: string | null
  updated_at: string | null
}

interface HistoryRow {
  id: number
  physical_servers: number
  virtual_servers: number
  switches: number
  firewalls: number
  note: string | null
  changes: string
  changed_by_name: string | null
  changed_at: string
}

const FIELD_LABELS: Record<InfrastructureChange['field'], string> = {
  physicalServers: 'Số máy chủ vật lý',
  virtualServers: 'Số máy ảo',
  switches: 'Số switch',
  firewalls: 'Số firewall',
  note: 'Ghi chú'
}

function ensureRow(): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO it_infrastructure
        (id, physical_servers, virtual_servers, switches, firewalls, note, updated_by, updated_at)
       VALUES (1, 0, 0, 0, 0, NULL, NULL, ?)`
    )
    .run(nowISO())
}

function mapCurrent(row: InfrastructureRow | undefined): ItInfrastructure {
  return {
    physicalServers: Number(row?.physical_servers) || 0,
    virtualServers: Number(row?.virtual_servers) || 0,
    switches: Number(row?.switches) || 0,
    firewalls: Number(row?.firewalls) || 0,
    note: row?.note ?? null,
    updatedAt: row?.updated_at ?? null,
    updatedByName: row?.updated_by_name ?? null
  }
}

export function getInfrastructure(): ItInfrastructure {
  ensureRow()
  const row = getDb()
    .prepare(
      `SELECT i.*, u.full_name AS updated_by_name
       FROM it_infrastructure i
       LEFT JOIN users u ON u.id = i.updated_by
       WHERE i.id = 1`
    )
    .get() as InfrastructureRow | undefined
  return mapCurrent(row)
}

function parseChanges(value: string): InfrastructureChange[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is InfrastructureChange =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as InfrastructureChange).field === 'string' &&
        typeof (item as InfrastructureChange).label === 'string'
    )
  } catch {
    return []
  }
}

export function getInfrastructureHistory(limit = 100): InfrastructureHistoryEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT id, physical_servers, virtual_servers, switches, firewalls, note, changes,
              changed_by_name, changed_at
       FROM it_infrastructure_history
       ORDER BY id DESC LIMIT ?`
    )
    .all(Math.min(Math.max(limit, 1), 500)) as unknown as HistoryRow[]
  return rows.map((row) => ({
    id: Number(row.id),
    physicalServers: Number(row.physical_servers) || 0,
    virtualServers: Number(row.virtual_servers) || 0,
    switches: Number(row.switches) || 0,
    firewalls: Number(row.firewalls) || 0,
    note: row.note,
    changes: parseChanges(row.changes),
    changedByName: row.changed_by_name,
    changedAt: row.changed_at
  }))
}

export function getInfrastructureOverview(): InfrastructureOverview {
  return { current: getInfrastructure(), history: getInfrastructureHistory() }
}

export function updateInfrastructure(
  data: ItInfrastructureInput,
  user: AuthUser
): InfrastructureOverview {
  ensureRow()
  const db = getDb()
  const current = getInfrastructure()
  const next = {
    physicalServers: Math.max(0, Math.trunc(Number(data.physicalServers) || 0)),
    virtualServers: Math.max(0, Math.trunc(Number(data.virtualServers) || 0)),
    switches: Math.max(0, Math.trunc(Number(data.switches) || 0)),
    firewalls: Math.max(0, Math.trunc(Number(data.firewalls) || 0)),
    note: data.note?.trim() ? data.note.trim() : null
  }

  const changes: InfrastructureChange[] = []
  const compare = (
    field: InfrastructureChange['field'],
    before: number | string | null,
    after: number | string | null
  ): void => {
    const beforeText = before === null || before === '' ? null : String(before)
    const afterText = after === null || after === '' ? null : String(after)
    if (beforeText === afterText) return
    changes.push({
      field,
      label: FIELD_LABELS[field],
      before: beforeText,
      after: afterText
    })
  }
  compare('physicalServers', current.physicalServers, next.physicalServers)
  compare('virtualServers', current.virtualServers, next.virtualServers)
  compare('switches', current.switches, next.switches)
  compare('firewalls', current.firewalls, next.firewalls)
  compare('note', current.note, next.note)

  db.exec('BEGIN')
  try {
    db.prepare(
      `UPDATE it_infrastructure SET
        physical_servers = ?, virtual_servers = ?, switches = ?, firewalls = ?,
        note = ?, updated_by = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      next.physicalServers,
      next.virtualServers,
      next.switches,
      next.firewalls,
      next.note,
      user.id,
      nowISO()
    )
    db.prepare(
      `INSERT INTO it_infrastructure_history
        (physical_servers, virtual_servers, switches, firewalls, note, changes,
         changed_by, changed_by_name, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      next.physicalServers,
      next.virtualServers,
      next.switches,
      next.firewalls,
      next.note,
      JSON.stringify(changes),
      user.id,
      user.fullName,
      nowISO()
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  logActivity(
    user,
    'Cập nhật hạ tầng CNTT',
    'infrastructure',
    null,
    'Hạ tầng CNTT cấp đơn vị',
    changes.length
      ? changes.map((change) => `${change.label}: ${change.before ?? '—'} → ${change.after ?? '—'}`).join('; ')
      : 'Không thay đổi số liệu'
  )

  return getInfrastructureOverview()
}
