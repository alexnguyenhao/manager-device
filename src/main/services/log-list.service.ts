import type { ActivityLog, LogListParams, PageResult } from '../../shared/types'
import { getDb } from '../db/database'

export function listLogs(params: LogListParams): PageResult<ActivityLog> {
  const db = getDb()
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(200, Math.max(5, Number(params.pageSize) || 20))
  const where: string[] = []
  const values: Array<string | number> = []

  if (params.search?.trim()) {
    const term = `%${params.search.trim().toLowerCase()}%`
    where.push(
      '(LOWER(action) LIKE ? OR LOWER(username) LIKE ? OR LOWER(entity_label) LIKE ? OR LOWER(details) LIKE ?)'
    )
    values.push(term, term, term, term)
  }
  if (params.action?.trim()) {
    where.push('action = ?')
    values.push(params.action.trim())
  }
  if (params.entityType?.trim()) {
    where.push('entity_type = ?')
    values.push(params.entityType.trim())
  }
  if (params.userId) {
    where.push('user_id = ?')
    values.push(params.userId)
  }
  if (params.fromDate) {
    where.push("date(created_at) >= date(?)")
    values.push(params.fromDate)
  }
  if (params.toDate) {
    where.push("date(created_at) <= date(?)")
    values.push(params.toDate)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS count FROM activity_logs ${whereSql}`).get(...values) as {
      count: number
    }).count
  )
  const rows = db
    .prepare(`SELECT * FROM activity_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...values, pageSize, (page - 1) * pageSize) as Array<{
    id: number
    user_id: number | null
    username: string | null
    action: string
    entity_type: string
    entity_id: number | null
    entity_label: string | null
    details: string | null
    created_at: string
  }>

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      userId: row.user_id ? Number(row.user_id) : null,
      username: row.username,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ? Number(row.entity_id) : null,
      entityLabel: row.entity_label,
      details: row.details,
      createdAt: row.created_at
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}
