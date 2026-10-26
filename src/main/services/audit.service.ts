import type {
  AuditCompleteInput,
  AuditCreateInput,
  AuditDetail,
  AuditItem,
  AuditItemUpdateInput,
  AuditListParams,
  AuditScanInput,
  AuditSession,
  AuditStatus,
  AuthUser,
  PageResult
} from '../../shared/types'
import { conflict, notFound } from '../lib/errors'
import { getDb, transaction } from '../db/database'
import { nowISO, todayISO } from '../../shared/utils'
import { nextAuditCode } from './code.service'
import { logActivity } from './log.service'
import { closeActiveAssignments } from './assignment.core'
import { refreshAssetSearch } from './asset-search'

interface AuditSessionRow {
  id: number
  code: string
  name: string
  department_id: number | null
  department_name: string | null
  location_id: number | null
  location_name: string | null
  start_date: string
  end_date: string | null
  status: AuditStatus
  note: string | null
  created_by_name: string | null
  created_at: string
  completed_at: string | null
  total_items: number
  scanned_items: number
  matched_items: number
  missing_items: number
  wrong_items: number
  damaged_items: number
}

const SESSION_SELECT = `
  SELECT s.*, d.name AS department_name, l.name AS location_name, u.full_name AS created_by_name,
    (SELECT COUNT(*) FROM audit_items i WHERE i.session_id = s.id) AS total_items,
    (SELECT COUNT(*) FROM audit_items i WHERE i.session_id = s.id AND i.result <> 'pending') AS scanned_items,
    (SELECT COUNT(*) FROM audit_items i WHERE i.session_id = s.id AND i.result = 'matched') AS matched_items,
    (SELECT COUNT(*) FROM audit_items i WHERE i.session_id = s.id AND i.result = 'missing') AS missing_items,
    (SELECT COUNT(*) FROM audit_items i WHERE i.session_id = s.id AND i.result IN ('wrong_location','wrong_owner')) AS wrong_items,
    (SELECT COUNT(*) FROM audit_items i WHERE i.session_id = s.id AND i.result = 'damaged') AS damaged_items
  FROM audit_sessions s
  LEFT JOIN departments d ON d.id = s.department_id
  LEFT JOIN locations l ON l.id = s.location_id
  LEFT JOIN users u ON u.id = s.created_by
`

function mapSession(row: AuditSessionRow): AuditSession {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    departmentId: row.department_id ? Number(row.department_id) : null,
    departmentName: row.department_name,
    locationId: row.location_id ? Number(row.location_id) : null,
    locationName: row.location_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    note: row.note,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    totalItems: Number(row.total_items) || 0,
    scannedItems: Number(row.scanned_items) || 0,
    matchedItems: Number(row.matched_items) || 0,
    missingItems: Number(row.missing_items) || 0,
    wrongItems: Number(row.wrong_items) || 0,
    damagedItems: Number(row.damaged_items) || 0
  }
}

export function getAuditSession(id: number): AuditSession {
  const row = getDb().prepare(`${SESSION_SELECT} WHERE s.id = ?`).get(id) as unknown as
    | AuditSessionRow
    | undefined
  if (!row) throw notFound('phiên kiểm kê')
  return mapSession(row)
}

export function listAudits(params: AuditListParams): PageResult<AuditSession> {
  const db = getDb()
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 15))
  const where: string[] = []
  const values: Array<string | number> = []

  if (params.search?.trim()) {
    const term = `%${params.search.trim().toLowerCase()}%`
    where.push('(LOWER(s.code) LIKE ? OR LOWER(s.name) LIKE ?)')
    values.push(term, term)
  }
  if (params.status && params.status !== 'all') {
    where.push('s.status = ?')
    values.push(params.status)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS count FROM audit_sessions s ${whereSql}`).get(...values) as {
      count: number
    }).count
  )
  const rows = db
    .prepare(`${SESSION_SELECT} ${whereSql} ORDER BY s.start_date DESC, s.id DESC LIMIT ? OFFSET ?`)
    .all(...values, pageSize, (page - 1) * pageSize) as unknown as AuditSessionRow[]

  return {
    items: rows.map(mapSession),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

function listAuditItems(sessionId: number): AuditItem[] {
  const rows = getDb()
    .prepare(
      `SELECT i.*, a.code AS asset_code, a.name AS asset_name, c.name AS category_name,
              a.serial_number,
              el.name AS expected_location_name, ee.full_name AS expected_employee_name,
              al.name AS actual_location_name, ae.full_name AS actual_employee_name,
              su.full_name AS scanned_by_name
       FROM audit_items i
       JOIN assets a ON a.id = i.asset_id
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN locations el ON el.id = i.expected_location_id
       LEFT JOIN employees ee ON ee.id = i.expected_employee_id
       LEFT JOIN locations al ON al.id = i.actual_location_id
       LEFT JOIN employees ae ON ae.id = i.actual_employee_id
       LEFT JOIN users su ON su.id = i.scanned_by
       WHERE i.session_id = ?
       ORDER BY CASE i.result WHEN 'pending' THEN 0 ELSE 1 END, a.code`
    )
    .all(sessionId) as Array<{
    id: number
    session_id: number
    asset_id: number
    asset_code: string
    asset_name: string
    category_name: string | null
    serial_number: string | null
    expected_location_id: number | null
    expected_location_name: string | null
    expected_employee_id: number | null
    expected_employee_name: string | null
    actual_location_id: number | null
    actual_location_name: string | null
    actual_employee_id: number | null
    actual_employee_name: string | null
    result: AuditItem['result']
    note: string | null
    scanned_at: string | null
    scanned_by_name: string | null
  }>

  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: Number(row.session_id),
    assetId: Number(row.asset_id),
    assetCode: row.asset_code,
    assetName: row.asset_name,
    categoryName: row.category_name,
    serialNumber: row.serial_number,
    expectedLocationId: row.expected_location_id ? Number(row.expected_location_id) : null,
    expectedLocationName: row.expected_location_name,
    expectedEmployeeId: row.expected_employee_id ? Number(row.expected_employee_id) : null,
    expectedEmployeeName: row.expected_employee_name,
    actualLocationId: row.actual_location_id ? Number(row.actual_location_id) : null,
    actualLocationName: row.actual_location_name,
    actualEmployeeId: row.actual_employee_id ? Number(row.actual_employee_id) : null,
    actualEmployeeName: row.actual_employee_name,
    result: row.result,
    note: row.note,
    scannedAt: row.scanned_at,
    scannedByName: row.scanned_by_name
  }))
}

export function getAuditDetail(id: number): AuditDetail {
  return { session: getAuditSession(id), items: listAuditItems(id) }
}

export function createAudit(data: AuditCreateInput, user: AuthUser): AuditSession {
  if (data.endDate && data.endDate < data.startDate) {
    throw conflict('Ngày kết thúc phải sau ngày bắt đầu.')
  }
  const db = getDb()
  const where: string[] = ["a.status <> 'disposed'"]
  const values: Array<string | number> = []
  if (data.departmentId) {
    where.push('a.department_id = ?')
    values.push(data.departmentId)
  }
  if (data.locationId) {
    where.push('a.location_id = ?')
    values.push(data.locationId)
  }
  const assets = db
    .prepare(
      `SELECT a.id, a.location_id, a.assigned_employee_id FROM assets a
       WHERE ${where.join(' AND ')} ORDER BY a.code`
    )
    .all(...values) as Array<{
    id: number
    location_id: number | null
    assigned_employee_id: number | null
  }>

  let sessionId = 0
  transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO audit_sessions
          (code, name, department_id, location_id, start_date, end_date, status, note, created_by, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, NULL)`
      )
      .run(
        nextAuditCode(),
        data.name,
        data.departmentId ?? null,
        data.locationId ?? null,
        data.startDate,
        data.endDate ?? null,
        data.note ?? null,
        user.id,
        nowISO()
      )
    sessionId = Number(result.lastInsertRowid)
    const stmt = db.prepare(
      `INSERT INTO audit_items
        (session_id, asset_id, expected_location_id, expected_employee_id, actual_location_id,
         actual_employee_id, result, note, scanned_at, scanned_by)
       VALUES (?, ?, ?, ?, NULL, NULL, 'pending', NULL, NULL, NULL)`
    )
    for (const asset of assets) {
      stmt.run(sessionId, asset.id, asset.location_id, asset.assigned_employee_id)
    }
  })

  const session = getAuditSession(sessionId)
  logActivity(
    user,
    'Tạo phiên kiểm kê',
    'audit',
    sessionId,
    session.code,
    `${session.name} - ${session.totalItems} thiết bị`
  )
  return session
}

interface AuditItemRow {
  id: number
  session_id: number
  asset_id: number
  expected_location_id: number | null
  expected_employee_id: number | null
}

function ensureOpenSession(sessionId: number): void {
  const session = getDb().prepare('SELECT status FROM audit_sessions WHERE id = ?').get(sessionId) as
    | { status: string }
    | undefined
  if (!session) throw notFound('phiên kiểm kê')
  if (session.status !== 'in_progress') throw conflict('Phiên kiểm kê đã kết thúc, không thể cập nhật.')
}

export function scanAuditItem(data: AuditScanInput, user: AuthUser): AuditDetail {
  ensureOpenSession(data.sessionId)
  const db = getDb()
  const code = data.code.trim()
  const asset = db
    .prepare(
      'SELECT id, code, location_id, assigned_employee_id FROM assets WHERE UPPER(code) = UPPER(?) OR UPPER(serial_number) = UPPER(?) LIMIT 1'
    )
    .get(code, code) as
    | { id: number; code: string; location_id: number | null; assigned_employee_id: number | null }
    | undefined
  if (!asset) throw notFound(`thiết bị có mã "${code}"`)

  const item = db
    .prepare('SELECT * FROM audit_items WHERE session_id = ? AND asset_id = ?')
    .get(data.sessionId, asset.id) as unknown as AuditItemRow | undefined
  if (!item) {
    throw conflict('Thiết bị không thuộc phạm vi của phiên kiểm kê này.')
  }

  const actualLocationId =
    data.actualLocationId !== null && data.actualLocationId !== undefined
      ? data.actualLocationId
      : asset.location_id
  const actualEmployeeId =
    data.actualEmployeeId !== null && data.actualEmployeeId !== undefined
      ? data.actualEmployeeId
      : asset.assigned_employee_id

  let result = data.result
  if (!result) {
    if (Number(actualLocationId ?? 0) !== Number(item.expected_location_id ?? 0)) {
      result = 'wrong_location'
    } else if (Number(actualEmployeeId ?? 0) !== Number(item.expected_employee_id ?? 0)) {
      result = 'wrong_owner'
    } else {
      result = 'matched'
    }
  }

  db.prepare(
    `UPDATE audit_items SET actual_location_id = ?, actual_employee_id = ?, result = ?,
      note = COALESCE(?, note), scanned_at = ?, scanned_by = ? WHERE id = ?`
  ).run(
    actualLocationId ?? null,
    actualEmployeeId ?? null,
    result,
    data.note ?? null,
    nowISO(),
    user.id,
    item.id
  )

  return getAuditDetail(data.sessionId)
}

export function updateAuditItem(data: AuditItemUpdateInput, user: AuthUser): AuditDetail {
  const db = getDb()
  const item = db.prepare('SELECT * FROM audit_items WHERE id = ?').get(data.itemId) as unknown as
    | (AuditItemRow & { actual_location_id: number | null; actual_employee_id: number | null })
    | undefined
  if (!item) throw notFound('dòng kiểm kê')
  ensureOpenSession(item.session_id)

  const asset = db
    .prepare('SELECT location_id, assigned_employee_id FROM assets WHERE id = ?')
    .get(item.asset_id) as
    | { location_id: number | null; assigned_employee_id: number | null }
    | undefined

  const actualLocationId =
    data.actualLocationId !== null && data.actualLocationId !== undefined
      ? data.actualLocationId
      : (item.actual_location_id ?? asset?.location_id ?? null)
  const actualEmployeeId =
    data.actualEmployeeId !== null && data.actualEmployeeId !== undefined
      ? data.actualEmployeeId
      : (item.actual_employee_id ?? asset?.assigned_employee_id ?? null)

  db.prepare(
    `UPDATE audit_items SET result = ?, actual_location_id = ?, actual_employee_id = ?,
      note = ?, scanned_at = ?, scanned_by = ? WHERE id = ?`
  ).run(
    data.result,
    actualLocationId,
    actualEmployeeId,
    data.note ?? null,
    data.result === 'pending' ? null : nowISO(),
    data.result === 'pending' ? null : user.id,
    data.itemId
  )

  return getAuditDetail(item.session_id)
}

export function completeAudit(data: AuditCompleteInput, user: AuthUser): AuditSession {
  ensureOpenSession(data.sessionId)
  const db = getDb()
  const session = getAuditSession(data.sessionId)
  const items = listAuditItems(data.sessionId)
  const now = nowISO()

  transaction(() => {
    if (data.applyActualLocation) {
      const stmt = db.prepare('UPDATE assets SET location_id = ?, updated_at = ? WHERE id = ?')
      for (const item of items) {
        if (item.actualLocationId) {
          stmt.run(item.actualLocationId, now, item.assetId)
        }
      }
    }
    if (data.markMissingAsLost) {
      for (const item of items.filter((i) => i.result === 'missing')) {
        closeActiveAssignments(
          item.assetId,
          todayISO(),
          null,
          'Thu hồi tự động do không tìm thấy khi kiểm kê'
        )
        db.prepare(
          "UPDATE assets SET status = 'lost', assigned_employee_id = NULL, updated_at = ? WHERE id = ?"
        ).run(now, item.assetId)
        refreshAssetSearch(item.assetId)
      }
    }
    db.prepare(
      "UPDATE audit_sessions SET status = 'completed', completed_at = ?, end_date = COALESCE(end_date, ?) WHERE id = ?"
    ).run(now, todayISO(), data.sessionId)
  })

  const after = getAuditSession(data.sessionId)
  logActivity(
    user,
    'Hoàn thành kiểm kê',
    'audit',
    data.sessionId,
    after.code,
    `Đã kiểm ${after.scannedItems}/${after.totalItems}, thiếu ${after.missingItems}, sai ${after.wrongItems}`
  )
  return after
}

export function deleteAudit(id: number, user: AuthUser): void {
  const session = getAuditSession(id)
  getDb().prepare('DELETE FROM audit_sessions WHERE id = ?').run(id)
  logActivity(user, 'Xóa phiên kiểm kê', 'audit', id, `${session.code} - ${session.name}`)
}
