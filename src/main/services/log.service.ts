import { getDb } from '../db/database'
import type { AuthUser } from '../../shared/types'
import { nowISO } from '../../shared/utils'

export function logActivity(
  user: AuthUser | null,
  action: string,
  entityType: string,
  entityId?: number | null,
  entityLabel?: string | null,
  details?: string | null
): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, entity_label, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user?.id ?? null,
    user?.username ?? null,
    action,
    entityType,
    entityId ?? null,
    entityLabel ?? null,
    details ?? null,
    nowISO()
  )
}
