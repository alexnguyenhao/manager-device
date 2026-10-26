import { getDb } from '../db/database'
import { nextAssignmentCode } from './code.service'

export interface AssignmentRecordInput {
  assetId: number
  employeeId: number
  departmentId: number | null
  assignedDate: string
  expectedReturnDate: string | null
  conditionBefore: string | null
  note: string | null
  userId: number
}

export function insertAssignment(data: AssignmentRecordInput): number {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO asset_assignments
        (code, asset_id, employee_id, department_id, assigned_date, expected_return_date, returned_date,
         status, condition_before, condition_after, note, return_note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'active', ?, NULL, ?, NULL, ?, ?)`
    )
    .run(
      nextAssignmentCode(),
      data.assetId,
      data.employeeId,
      data.departmentId,
      data.assignedDate,
      data.expectedReturnDate,
      data.conditionBefore,
      data.note,
      data.userId,
      new Date().toISOString()
    )
  return Number(result.lastInsertRowid)
}

export function getActiveAssignment(
  assetId: number
): { id: number; employeeId: number; employeeName: string; code: string } | null {
  const row = getDb()
    .prepare(
      `SELECT s.id, s.employee_id, s.code, e.full_name AS employee_name
       FROM asset_assignments s
       JOIN employees e ON e.id = s.employee_id
       WHERE s.asset_id = ? AND s.status = 'active'
       ORDER BY s.id DESC LIMIT 1`
    )
    .get(assetId) as
    | { id: number; employee_id: number; code: string; employee_name: string }
    | undefined
  if (!row) return null
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeName: row.employee_name,
    code: row.code
  }
}

export function closeAssignment(
  assignmentId: number,
  returnedDate: string,
  conditionAfter: string | null,
  note: string | null
): void {
  getDb()
    .prepare(
      `UPDATE asset_assignments
       SET returned_date = ?, condition_after = ?, status = 'returned', return_note = ?
       WHERE id = ? AND status = 'active'`
    )
    .run(returnedDate, conditionAfter, note, assignmentId)
}

export function closeActiveAssignments(
  assetId: number,
  returnedDate: string,
  conditionAfter: string | null,
  note: string | null
): void {
  getDb()
    .prepare(
      `UPDATE asset_assignments
       SET returned_date = ?, condition_after = ?, status = 'returned', return_note = ?
       WHERE asset_id = ? AND status = 'active'`
    )
    .run(returnedDate, conditionAfter, note, assetId)
}
