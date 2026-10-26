import type {
  AuthUser,
  MaintenanceInput,
  MaintenanceListParams,
  MaintenancePriority,
  MaintenanceRecord,
  MaintenanceStatus,
  MaintenanceType,
  MaintenanceUpdateInput,
  PageResult
} from '../../shared/types'
import { conflict, notFound } from '../lib/errors'
import { getDb, transaction } from '../db/database'
import { nowISO, todayISO } from '../../shared/utils'
import { nextMaintenanceCode } from './code.service'
import { logActivity } from './log.service'
import { getActiveAssignment } from './assignment.core'

interface MaintenanceRow {
  id: number
  code: string
  asset_id: number
  asset_code: string
  asset_name: string
  category_name: string | null
  department_name: string | null
  location_name: string | null
  type: MaintenanceType
  title: string
  description: string | null
  provider: string | null
  assignee: string | null
  scheduled_date: string | null
  completed_date: string | null
  cost: number
  status: MaintenanceStatus
  priority: MaintenancePriority
  result: string | null
  note: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

const SELECT = `
  SELECT m.*, a.code AS asset_code, a.name AS asset_name, c.name AS category_name,
         d.name AS department_name, l.name AS location_name, u.full_name AS created_by_name
  FROM maintenance_records m
  JOIN assets a ON a.id = m.asset_id
  JOIN categories c ON c.id = a.category_id
  LEFT JOIN departments d ON d.id = a.department_id
  LEFT JOIN locations l ON l.id = a.location_id
  LEFT JOIN users u ON u.id = m.created_by
`

function mapRecord(row: MaintenanceRow): MaintenanceRecord {
  const today = todayISO()
  return {
    id: Number(row.id),
    code: row.code,
    assetId: Number(row.asset_id),
    assetCode: row.asset_code,
    assetName: row.asset_name,
    categoryName: row.category_name,
    departmentName: row.department_name,
    locationName: row.location_name,
    type: row.type,
    title: row.title,
    description: row.description,
    provider: row.provider,
    assignee: row.assignee,
    scheduledDate: row.scheduled_date,
    completedDate: row.completed_date,
    cost: Number(row.cost) || 0,
    status: row.status,
    priority: row.priority,
    result: row.result,
    note: row.note,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOverdue:
      (row.status === 'scheduled' || row.status === 'in_progress') &&
      Boolean(row.scheduled_date) &&
      String(row.scheduled_date) < today
  }
}

export function listMaintenance(params: MaintenanceListParams): PageResult<MaintenanceRecord> {
  const db = getDb()
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(200, Math.max(5, Number(params.pageSize) || 15))
  const where: string[] = []
  const values: Array<string | number> = []
  const today = todayISO()

  if (params.search?.trim()) {
    const term = `%${params.search.trim().toLowerCase()}%`
    where.push(
      '(LOWER(m.code) LIKE ? OR LOWER(m.title) LIKE ? OR LOWER(a.code) LIKE ? OR LOWER(a.name) LIKE ? OR LOWER(m.provider) LIKE ?)'
    )
    values.push(term, term, term, term, term)
  }
  if (params.status === 'overdue') {
    where.push(
      "m.status IN ('scheduled','in_progress') AND m.scheduled_date IS NOT NULL AND m.scheduled_date < ?"
    )
    values.push(today)
  } else if (
    params.status &&
    ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(params.status)
  ) {
    where.push('m.status = ?')
    values.push(params.status)
  }
  if (params.type && params.type !== 'all') {
    where.push('m.type = ?')
    values.push(params.type)
  }
  if (params.assetId) {
    where.push('m.asset_id = ?')
    values.push(params.assetId)
  }
  if (params.fromDate) {
    where.push('COALESCE(m.scheduled_date, m.completed_date) >= ?')
    values.push(params.fromDate)
  }
  if (params.toDate) {
    where.push('COALESCE(m.scheduled_date, m.completed_date) <= ?')
    values.push(params.toDate)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM maintenance_records m
           JOIN assets a ON a.id = m.asset_id ${whereSql}`
        )
        .get(...values) as { count: number }
    ).count
  )
  const rows = db
    .prepare(
      `${SELECT} ${whereSql}
       ORDER BY CASE m.status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
                COALESCE(m.scheduled_date, m.completed_date) ASC, m.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...values, pageSize, (page - 1) * pageSize) as unknown as MaintenanceRow[]

  return {
    items: rows.map(mapRecord),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export function getMaintenance(id: number): MaintenanceRecord {
  const row = getDb().prepare(`${SELECT} WHERE m.id = ?`).get(id) as unknown as
    | MaintenanceRow
    | undefined
  if (!row) throw notFound('phiếu bảo trì')
  return mapRecord(row)
}

function ensureAssetCanBeServiced(assetId: number): void {
  const asset = getDb().prepare('SELECT id, code, name, status FROM assets WHERE id = ?').get(assetId) as
    | { id: number; code: string; name: string; status: string }
    | undefined
  if (!asset) throw notFound('thiết bị')
  if (asset.status === 'disposed' || asset.status === 'lost') {
    throw conflict('Thiết bị đã thanh lý hoặc thất lạc, không thể tạo phiếu bảo trì.')
  }
}

function setAssetStatusForMaintenance(assetId: number, completed: boolean): void {
  const db = getDb()
  const asset = db
    .prepare('SELECT id, status, assigned_employee_id FROM assets WHERE id = ?')
    .get(assetId) as
    | { id: number; status: string; assigned_employee_id: number | null }
    | undefined
  if (!asset) return
  if (asset.status === 'disposed' || asset.status === 'lost') return
  // Chỉ khôi phục trạng thái nếu thiết bị thực sự đang ở trạng thái bảo trì.
  if (completed && asset.status !== 'maintenance') return
  const active = getActiveAssignment(assetId)
  const stillAssigned = Boolean(active) || Boolean(asset.assigned_employee_id)
  const next = completed ? (stillAssigned ? 'in_use' : 'available') : 'maintenance'
  db.prepare('UPDATE assets SET status = ?, updated_at = ? WHERE id = ?').run(
    next,
    nowISO(),
    assetId
  )
}

function hasOtherInProgress(assetId: number, excludeId: number): boolean {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS count FROM maintenance_records WHERE asset_id = ? AND status = 'in_progress' AND id <> ?"
    )
    .get(assetId, excludeId) as { count: number }
  return Number(row.count) > 0
}

export function createMaintenance(data: MaintenanceInput, user: AuthUser): MaintenanceRecord {
  ensureAssetCanBeServiced(data.assetId)
  const db = getDb()
  const now = nowISO()
  const result = db
    .prepare(
      `INSERT INTO maintenance_records
        (code, asset_id, type, title, description, provider, assignee, scheduled_date, completed_date,
         cost, status, priority, result, note, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'scheduled', ?, NULL, ?, ?, ?, ?)`
    )
    .run(
      nextMaintenanceCode(),
      data.assetId,
      data.type,
      data.title,
      data.description ?? null,
      data.provider ?? null,
      data.assignee ?? null,
      data.scheduledDate ?? null,
      data.cost ?? 0,
      data.priority ?? 'normal',
      data.note ?? null,
      user.id,
      now,
      now
    )
  const id = Number(result.lastInsertRowid)
  const record = getMaintenance(id)
  logActivity(
    user,
    'Tạo phiếu bảo trì',
    'maintenance',
    id,
    `${record.code} - ${record.assetCode}`,
    record.title
  )
  return record
}

export function updateMaintenance(data: MaintenanceUpdateInput, user: AuthUser): MaintenanceRecord {
  const existing = getMaintenance(data.id)
  if (data.assetId) ensureAssetCanBeServiced(data.assetId)
  const nextAssetId = data.assetId ?? existing.assetId
  if (nextAssetId !== existing.assetId && existing.status === 'in_progress') {
    throw conflict(
      'Không thể đổi thiết bị của phiếu đang thực hiện. Vui lòng chuyển phiếu về "Đã lên lịch" trước.'
    )
  }
  const db = getDb()
  const nextStatus = data.status ?? existing.status
  const now = nowISO()
  const nextCompleted =
    nextStatus === 'completed'
      ? (data.completedDate ?? existing.completedDate ?? todayISO())
      : nextStatus === 'scheduled' || nextStatus === 'in_progress'
        ? null
        : existing.completedDate

  transaction(() => {
    db.prepare(
      `UPDATE maintenance_records SET
        asset_id = ?, type = ?, title = ?, description = ?, provider = ?, assignee = ?,
        scheduled_date = ?, completed_date = ?, cost = ?, status = ?, priority = ?, result = ?,
        note = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      nextAssetId,
      data.type ?? existing.type,
      data.title ?? existing.title,
      data.description !== undefined ? data.description : existing.description,
      data.provider !== undefined ? data.provider : existing.provider,
      data.assignee !== undefined ? data.assignee : existing.assignee,
      data.scheduledDate !== undefined ? data.scheduledDate : existing.scheduledDate,
      nextCompleted,
      data.cost ?? existing.cost,
      nextStatus,
      data.priority ?? existing.priority,
      data.result !== undefined ? data.result : existing.result,
      data.note !== undefined ? data.note : existing.note,
      now,
      data.id
    )

    if (existing.status !== nextStatus) {
      if (nextStatus === 'in_progress') {
        setAssetStatusForMaintenance(nextAssetId, false)
      } else if (nextStatus === 'completed') {
        if (!hasOtherInProgress(nextAssetId, data.id)) {
          setAssetStatusForMaintenance(nextAssetId, true)
        }
      } else if (nextStatus === 'cancelled') {
        if (!hasOtherInProgress(nextAssetId, data.id)) {
          setAssetStatusForMaintenance(nextAssetId, true)
        }
      }
    }
  })

  const record = getMaintenance(data.id)
  logActivity(
    user,
    nextStatus !== existing.status ? 'Cập nhật trạng thái bảo trì' : 'Cập nhật phiếu bảo trì',
    'maintenance',
    data.id,
    `${record.code} - ${record.assetCode}`,
    nextStatus !== existing.status ? `${existing.status} → ${nextStatus}` : record.title
  )
  return record
}

export function completeMaintenance(
  id: number,
  data: { result: string; cost?: number; completedDate?: string | null },
  user: AuthUser
): MaintenanceRecord {
  const existing = getMaintenance(id)
  if (existing.status === 'completed') throw conflict('Phiếu bảo trì đã hoàn thành.')
  if (existing.status === 'cancelled') throw conflict('Phiếu bảo trì đã bị hủy.')
  const db = getDb()
  const now = nowISO()
  const completedDate = data.completedDate ?? todayISO()

  transaction(() => {
    db.prepare(
      `UPDATE maintenance_records SET status = 'completed', result = ?, cost = ?, completed_date = ?, updated_at = ?
       WHERE id = ?`
    ).run(data.result, data.cost ?? existing.cost, completedDate, now, id)
    if (!hasOtherInProgress(existing.assetId, id)) {
      setAssetStatusForMaintenance(existing.assetId, true)
    }
  })

  logActivity(
    user,
    'Hoàn thành bảo trì',
    'maintenance',
    id,
    `${existing.code} - ${existing.assetCode}`,
    data.result
  )
  return getMaintenance(id)
}

export function cancelMaintenance(id: number, user: AuthUser): MaintenanceRecord {
  const existing = getMaintenance(id)
  if (existing.status === 'completed') throw conflict('Phiếu bảo trì đã hoàn thành, không thể hủy.')
  const db = getDb()
  const now = nowISO()
  transaction(() => {
    db.prepare("UPDATE maintenance_records SET status = 'cancelled', updated_at = ? WHERE id = ?").run(
      now,
      id
    )
    if (!hasOtherInProgress(existing.assetId, id)) {
      setAssetStatusForMaintenance(existing.assetId, true)
    }
  })
  logActivity(user, 'Hủy phiếu bảo trì', 'maintenance', id, `${existing.code} - ${existing.assetCode}`)
  return getMaintenance(id)
}

export function deleteMaintenance(id: number, user: AuthUser): void {
  const existing = getMaintenance(id)
  const db = getDb()
  transaction(() => {
    db.prepare('DELETE FROM maintenance_records WHERE id = ?').run(id)
    if (existing.status === 'in_progress' && !hasOtherInProgress(existing.assetId, id)) {
      setAssetStatusForMaintenance(existing.assetId, true)
    }
  })
  logActivity(user, 'Xóa phiếu bảo trì', 'maintenance', id, `${existing.code} - ${existing.assetCode}`)
}
