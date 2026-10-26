import { readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell } from 'electron'
import type { AppInfo, AppSettings, AuthUser, SettingsInput } from '../../shared/types'
import { dataDir, dbPath, uploadsDir } from '../lib/paths'
import { getDb } from '../db/database'
import { logActivity } from './log.service'
import { nowISO } from '../../shared/utils'

export {
  createManualBackup as createBackup,
  restoreManualBackup as restoreBackup
} from './backup.service'

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'Ủy ban nhân dân xã',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyTaxCode: '',
  companyWebsite: '',
  currency: 'VND',
  dateFormat: 'DD/MM/YYYY',
  warrantyWarningDays: 30,
  maintenanceWarningDays: 14,
  defaultDepreciationMonths: 60,
  loginNotice: 'Hệ thống quản lý thiết bị và tài sản công của UBND xã'
}

const KEY_MAP: Record<keyof AppSettings, string> = {
  companyName: 'company_name',
  companyAddress: 'company_address',
  companyPhone: 'company_phone',
  companyEmail: 'company_email',
  companyTaxCode: 'company_tax_code',
  companyWebsite: 'company_website',
  currency: 'currency',
  dateFormat: 'date_format',
  warrantyWarningDays: 'warranty_warning_days',
  maintenanceWarningDays: 'maintenance_warning_days',
  defaultDepreciationMonths: 'default_depreciation_months',
  loginNotice: 'login_notice'
}

const NUMBER_KEYS: Array<keyof AppSettings> = [
  'warrantyWarningDays',
  'maintenanceWarningDays',
  'defaultDepreciationMonths'
]

export function getSettings(): AppSettings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const settings = { ...DEFAULT_SETTINGS }
  for (const [field, key] of Object.entries(KEY_MAP) as Array<[keyof AppSettings, string]>) {
    const value = byKey.get(key)
    if (value === undefined) continue
    if (NUMBER_KEYS.includes(field)) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) settings[field] = parsed as never
    } else {
      settings[field] = value as never
    }
  }
  return settings
}

export function updateSettings(data: SettingsInput, user: AuthUser): AppSettings {
  const db = getDb()
  const now = nowISO()
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
  db.exec('BEGIN')
  try {
    for (const [field, value] of Object.entries(data) as Array<[keyof AppSettings, unknown]>) {
      if (value === undefined || value === null) continue
      const key = KEY_MAP[field]
      if (!key) continue
      stmt.run(key, String(value), now)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  logActivity(user, 'Cập nhật cài đặt hệ thống', 'settings', null, 'Cài đặt')
  return getSettings()
}

export function getAppInfo(): AppInfo {
  let size = 0
  try {
    size = statSync(dbPath()).size
  } catch {
    size = 0
  }
  return {
    version: app.getVersion(),
    electronVersion: process.versions.electron ?? '',
    nodeVersion: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    dataPath: dataDir(),
    dbPath: dbPath(),
    uploadsPath: uploadsDir(),
    dbSize: size
  }
}

export async function openDataFolder(): Promise<void> {
  await shell.openPath(dataDir())
}

export function clearBusinessData(user: AuthUser): { removed: number } {
  const db = getDb()
  const count = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM assets').get() as { count: number }).count
  )
  db.exec('BEGIN')
  try {
    db.exec('DELETE FROM audit_items')
    db.exec('DELETE FROM audit_sessions')
    db.exec('DELETE FROM maintenance_records')
    db.exec('DELETE FROM asset_assignments')
    db.exec('DELETE FROM attachments')
    db.exec('DELETE FROM assets')
    db.exec('DELETE FROM activity_logs')
    db.exec(
      "DELETE FROM sqlite_sequence WHERE name IN ('audit_items','audit_sessions','maintenance_records','asset_assignments','attachments','assets','activity_logs')"
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  try {
    for (const file of readdirSync(uploadsDir())) {
      const path = join(uploadsDir(), file)
      try {
        rmSync(path, { force: true })
      } catch {
        // bỏ qua tệp đang được sử dụng
      }
    }
  } catch {
    // thư mục uploads có thể chưa tồn tại
  }
  logActivity(user, 'Xóa toàn bộ dữ liệu nghiệp vụ', 'settings', null, 'Thiết bị, cấp phát, bảo trì, kiểm kê')
  return { removed: count }
}
