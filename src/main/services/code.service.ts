import { getDb } from '../db/database'
import { todayISO } from '../../shared/utils'

function nextSequence(table: 'assets' | 'asset_assignments' | 'maintenance_records' | 'audit_sessions', like: string): number {
  const db = getDb()
  const rows = db.prepare(`SELECT code FROM ${table} WHERE code LIKE ?`).all(like) as Array<{ code: string }>
  let max = 0
  for (const row of rows) {
    const match = row.code.match(/(\d+)$/)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

export function nextAssetCode(prefix: string): string {
  const normalized = (prefix || 'TB').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TB'
  const like = `${normalized}-%`
  const db = getDb()
  for (let attempt = 0; attempt < 10000; attempt++) {
    const next = nextSequence('assets', like) + attempt
    const code = `${normalized}-${String(next).padStart(4, '0')}`
    const exists = db.prepare('SELECT id FROM assets WHERE code = ?').get(code)
    if (!exists) return code
  }
  return `${normalized}-${Date.now()}`
}

export function nextAssignmentCode(): string {
  const month = todayISO().slice(0, 7).replace('-', '')
  const like = `BG-${month}-%`
  const seq = nextSequence('asset_assignments', like)
  return `BG-${month}-${String(seq).padStart(4, '0')}`
}

export function nextMaintenanceCode(): string {
  const seq = nextSequence('maintenance_records', 'MT-%')
  return `MT-${String(seq).padStart(4, '0')}`
}

export function nextAuditCode(): string {
  const month = todayISO().slice(0, 7).replace('-', '')
  const like = `KK-${month}-%`
  const seq = nextSequence('audit_sessions', like)
  return `KK-${month}-${String(seq).padStart(3, '0')}`
}
