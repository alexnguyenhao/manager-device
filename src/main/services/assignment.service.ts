import type {
  Assignment,
  AssignmentInput,
  AssignmentListParams,
  AuthUser,
  PageResult,
  ReturnInput
} from '../../shared/types'
import { conflict, notFound } from '../lib/errors'
import { getDb, transaction } from '../db/database'
import { nowISO, todayISO } from '../../shared/utils'
import { closeAssignment, getActiveAssignment, insertAssignment } from './assignment.core'
import { logActivity } from './log.service'
import { refreshAssetSearch } from './asset-search'

interface AssignmentRow {
  id: number
  code: string
  asset_id: number
  asset_code: string
  asset_name: string
  category_name: string | null
  employee_id: number
  employee_name: string
  employee_code: string | null
  department_id: number | null
  department_name: string | null
  assigned_date: string
  expected_return_date: string | null
  returned_date: string | null
  status: 'active' | 'returned'
  condition_before: Assignment['conditionBefore']
  condition_after: Assignment['conditionAfter']
  note: string | null
  return_note: string | null
  created_by_name: string | null
  created_at: string
}

const SELECT = `
  SELECT s.*, a.code AS asset_code, a.name AS asset_name, c.name AS category_name,
         e.full_name AS employee_name, e.code AS employee_code,
         d.name AS department_name, u.full_name AS created_by_name
  FROM asset_assignments s
  JOIN assets a ON a.id = s.asset_id
  JOIN categories c ON c.id = a.category_id
  JOIN employees e ON e.id = s.employee_id
  LEFT JOIN departments d ON d.id = s.department_id
  LEFT JOIN users u ON u.id = s.created_by
`

function mapAssignment(row: AssignmentRow): Assignment {
  const today = todayISO()
  return {
    id: Number(row.id),
    code: row.code,
    assetId: Number(row.asset_id),
    assetCode: row.asset_code,
    assetName: row.asset_name,
    categoryName: row.category_name,
    employeeId: Number(row.employee_id),
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    departmentId: row.department_id ? Number(row.department_id) : null,
    departmentName: row.department_name,
    assignedDate: row.assigned_date,
    expectedReturnDate: row.expected_return_date,
    returnedDate: row.returned_date,
    status: row.status,
    conditionBefore: row.condition_before,
    conditionAfter: row.condition_after,
    note: row.note,
    returnNote: row.return_note,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    isOverdue:
      row.status === 'active' &&
      Boolean(row.expected_return_date) &&
      String(row.expected_return_date) < today
  }
}

export function getAssignment(id: number): Assignment {
  const row = getDb().prepare(`${SELECT} WHERE s.id = ?`).get(id) as unknown as
    | AssignmentRow
    | undefined
  if (!row) throw notFound('phiếu cấp phát')
  return mapAssignment(row)
}

export function listAssignments(params: AssignmentListParams): PageResult<Assignment> {
  const db = getDb()
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(200, Math.max(5, Number(params.pageSize) || 15))
  const where: string[] = []
  const values: Array<string | number> = []
  const today = todayISO()

  if (params.search?.trim()) {
    const term = `%${params.search.trim().toLowerCase()}%`
    where.push(
      '(LOWER(s.code) LIKE ? OR LOWER(a.code) LIKE ? OR LOWER(a.name) LIKE ? OR LOWER(e.full_name) LIKE ?)'
    )
    values.push(term, term, term, term)
  }
  if (params.status === 'overdue') {
    where.push("s.status = 'active' AND s.expected_return_date IS NOT NULL AND s.expected_return_date < ?")
    values.push(today)
  } else if (params.status === 'active' || params.status === 'returned') {
    where.push('s.status = ?')
    values.push(params.status)
  }
  if (params.employeeId) {
    where.push('s.employee_id = ?')
    values.push(params.employeeId)
  }
  if (params.assetId) {
    where.push('s.asset_id = ?')
    values.push(params.assetId)
  }
  if (params.departmentId) {
    where.push('s.department_id = ?')
    values.push(params.departmentId)
  }
  if (params.fromDate) {
    where.push('s.assigned_date >= ?')
    values.push(params.fromDate)
  }
  if (params.toDate) {
    where.push('s.assigned_date <= ?')
    values.push(params.toDate)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM asset_assignments s
           JOIN assets a ON a.id = s.asset_id
           JOIN employees e ON e.id = s.employee_id
           ${whereSql}`
        )
        .get(...values) as { count: number }
    ).count
  )

  const rows = db
    .prepare(`${SELECT} ${whereSql} ORDER BY s.assigned_date DESC, s.id DESC LIMIT ? OFFSET ?`)
    .all(...values, pageSize, (page - 1) * pageSize) as unknown as AssignmentRow[]

  return {
    items: rows.map(mapAssignment),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export function createAssignment(data: AssignmentInput, user: AuthUser): Assignment {
  const db = getDb()
  const asset = db
    .prepare('SELECT id, code, name, status, condition, assigned_employee_id FROM assets WHERE id = ?')
    .get(data.assetId) as
    | {
        id: number
        code: string
        name: string
        status: string
        condition: string
        assigned_employee_id: number | null
      }
    | undefined
  if (!asset) throw notFound('thiết bị')
  if (asset.status === 'disposed' || asset.status === 'lost') {
    throw conflict('Thiết bị đã thanh lý hoặc thất lạc, không thể cấp phát.')
  }
  if (asset.status === 'maintenance') {
    throw conflict('Thiết bị đang bảo trì, không thể cấp phát.')
  }
  if (getActiveAssignment(Number(asset.id))) {
    throw conflict('Thiết bị đang được cấp phát. Vui lòng thu hồi trước khi cấp phát lại.')
  }

  const employee = db
    .prepare('SELECT id, full_name, department_id, is_active FROM employees WHERE id = ?')
    .get(data.employeeId) as
    | { id: number; full_name: string; department_id: number | null; is_active: number }
    | undefined
  if (!employee) throw notFound('nhân viên')
  if (!Number(employee.is_active)) throw conflict('Nhân viên đã ngừng làm việc, không thể cấp phát.')

  if (
    data.expectedReturnDate &&
    data.assignedDate &&
    data.expectedReturnDate < data.assignedDate
  ) {
    throw conflict('Ngày dự kiến thu hồi phải sau ngày cấp phát.')
  }

  const departmentId =
    data.departmentId ?? (employee.department_id ? Number(employee.department_id) : null)
  const departmentName = departmentId
    ? ((db.prepare('SELECT name FROM departments WHERE id = ?').get(departmentId) as
        | { name: string }
        | undefined)?.name ?? null)
    : null
  const now = nowISO()

  let assignmentId = 0
  transaction(() => {
    assignmentId = insertAssignment({
      assetId: data.assetId,
      employeeId: data.employeeId,
      departmentId,
      assignedDate: data.assignedDate,
      expectedReturnDate: data.expectedReturnDate ?? null,
      conditionBefore: data.conditionBefore ?? asset.condition,
      note: data.note ?? null,
      userId: user.id
    })
    db.prepare(
      `UPDATE assets SET status = 'in_use', assigned_employee_id = ?, department_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(data.employeeId, departmentId, now, data.assetId)
  })

  refreshAssetSearch(data.assetId)
  logActivity(
    user,
    'Cấp phát thiết bị',
    'assignment',
    assignmentId,
    `${asset.code} → ${employee.full_name}`,
    `${asset.name}${departmentName ? `, ${departmentName}` : ''}`
  )
  return getAssignment(assignmentId)
}

export function returnAssignment(data: ReturnInput, user: AuthUser): Assignment {
  const db = getDb()
  const assignment = db
    .prepare('SELECT * FROM asset_assignments WHERE id = ?')
    .get(data.assignmentId) as
    | {
        id: number
        asset_id: number
        employee_id: number
        assigned_date: string
        status: string
      }
    | undefined
  if (!assignment) throw notFound('phiếu cấp phát')
  if (assignment.status !== 'active') throw conflict('Phiếu cấp phát đã được thu hồi trước đó.')
  if (data.returnedDate < assignment.assigned_date) {
    throw conflict('Ngày thu hồi không thể trước ngày cấp phát.')
  }

  const asset = db
    .prepare('SELECT id, code, name, status, condition FROM assets WHERE id = ?')
    .get(assignment.asset_id) as
    | { id: number; code: string; name: string; status: string; condition: string }
    | undefined
  if (!asset) throw notFound('thiết bị')

  const now = nowISO()
  transaction(() => {
    closeAssignment(
      data.assignmentId,
      data.returnedDate,
      data.conditionAfter ?? null,
      data.note ?? null
    )
    const nextStatus =
      asset.status === 'maintenance' || asset.status === 'disposed' || asset.status === 'lost'
        ? asset.status
        : 'available'
    const nextCondition = data.conditionAfter ?? asset.condition
    if (data.locationId) {
      db.prepare(
        `UPDATE assets SET status = ?, condition = ?, assigned_employee_id = NULL,
           location_id = ?, updated_at = ? WHERE id = ?`
      ).run(nextStatus, nextCondition, data.locationId, now, asset.id)
    } else {
      db.prepare(
        `UPDATE assets SET status = ?, condition = ?, assigned_employee_id = NULL, updated_at = ?
         WHERE id = ?`
      ).run(nextStatus, nextCondition, now, asset.id)
    }
  })

  refreshAssetSearch(asset.id)
  logActivity(
    user,
    'Thu hồi thiết bị',
    'assignment',
    data.assignmentId,
    `${asset.code} thu hồi`,
    data.note ?? ''
  )
  return getAssignment(data.assignmentId)
}

export function deleteAssignment(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db.prepare('SELECT * FROM asset_assignments WHERE id = ?').get(id) as
    | { id: number; code: string; driver?: string; status: string; asset_id: number }
    | undefined
  if (!row) throw notFound('phiếu cấp phát')
  if (row.status === 'active') {
    throw conflict('Không thể xóa phiếu đang cấp phát. Vui lòng thu hồi thiết bị trước.')
  }
  db.prepare('DELETE FROM asset_assignments WHERE id = ?').run(id)
  logActivity(user, 'Xóa phiếu cấp phát', 'assignment', id, row.code)
}
