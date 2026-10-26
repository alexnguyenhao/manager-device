import { cpSync, existsSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { join, basename, resolve } from 'node:path'
import { app, dialog, shell } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import type { AppInfo, AppSettings, AuthUser, BackupResult, SettingsInput } from '../../shared/types'
import { AppError } from '../lib/errors'
import { dataDir, dbPath, uploadsDir } from '../lib/paths'
import { closeDatabase, getDb, openDatabase } from '../db/database'
import { logActivity } from './log.service'
import { nowISO } from '../../shared/utils'

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'Công ty của bạn',
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
  loginNotice: 'Hệ thống quản lý thiết bị nội bộ'
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

function samePath(a: string, b: string): boolean {
  const left = resolve(a)
  const right = resolve(b)
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}

function isLiveDatabaseFile(path: string): boolean {
  return [dbPath(), `${dbPath()}-wal`, `${dbPath()}-shm`].some((file) => samePath(path, file))
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

export async function createBackup(user: AuthUser): Promise<BackupResult> {
  const defaultName = `manager-device-${new Date().toISOString().slice(0, 10)}.db`
  const result = await dialog.showSaveDialog({
    title: 'Sao lưu cơ sở dữ liệu',
    defaultPath: join(app.getPath('documents'), defaultName),
    filters: [{ name: 'Cơ sở dữ liệu SQLite', extensions: ['db'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }

  const target = result.filePath
  if (isLiveDatabaseFile(target)) {
    throw new AppError(
      'Không thể sao lưu đè lên tệp cơ sở dữ liệu đang sử dụng. Vui lòng chọn vị trí khác.',
      'BAD_REQUEST'
    )
  }

  const db = getDb()
  try {
    // VACUUM INTO yêu cầu tệp đích chưa tồn tại.
    if (existsSync(target)) unlinkSync(target)
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    const escaped = target.replace(/'/g, "''")
    db.exec(`VACUUM INTO '${escaped}'`)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(
      'Không thể tạo tệp sao lưu. Vui lòng kiểm tra quyền ghi và dung lượng ổ đĩa.',
      'INTERNAL'
    )
  }
  logActivity(user, 'Sao lưu dữ liệu', 'settings', null, basename(target))
  return { canceled: false, path: target }
}

export async function restoreBackup(user: AuthUser): Promise<{ restored: boolean; path?: string }> {
  const result = await dialog.showOpenDialog({
    title: 'Chọn tệp sao lưu để phục hồi',
    properties: ['openFile'],
    filters: [{ name: 'Cơ sở dữ liệu SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return { restored: false }
  const source = result.filePaths[0]
  if (isLiveDatabaseFile(source)) {
    throw new AppError(
      'Không thể phục hồi từ tệp cơ sở dữ liệu đang sử dụng. Vui lòng chọn tệp sao lưu khác.',
      'BAD_REQUEST'
    )
  }

  try {
    const test = new DatabaseSync(source, { readOnly: true })
    const tables = test
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>
    test.close()
    const names = new Set(tables.map((t) => t.name))
    if (!names.has('users') || !names.has('assets') || !names.has('settings')) {
      throw new AppError('Tệp đã chọn không phải bản sao lưu hợp lệ của phần mềm.', 'BAD_REQUEST')
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Không thể đọc tệp sao lưu. Tệp có thể bị hỏng.', 'BAD_REQUEST')
  }

  const confirmed = await dialog.showMessageBox({
    type: 'warning',
    title: 'Xác nhận phục hồi',
    message: 'Phục hồi dữ liệu sẽ thay thế toàn bộ dữ liệu hiện tại.',
    detail: 'Ứng dụng sẽ tự khởi động lại sau khi phục hồi. Bạn có chắc chắn?',
    buttons: ['Phục hồi', 'Hủy'],
    defaultId: 1,
    cancelId: 1
  })
  if (confirmed.response !== 0) return { restored: false }

  logActivity(user, 'Phục hồi dữ liệu', 'settings', null, basename(source))
  const safetyCopy = `${dbPath()}.pre-restore`
  let closed = false

  const removeJournals = (): void => {
    for (const suffix of ['-wal', '-shm']) {
      const file = `${dbPath()}${suffix}`
      if (existsSync(file)) unlinkSync(file)
    }
  }

  try {
    getDb().exec('PRAGMA wal_checkpoint(TRUNCATE)')
    closeDatabase()
    closed = true
    // Giữ một bản sao an toàn để khôi phục nếu quá trình ghi đè gặp lỗi.
    cpSync(dbPath(), safetyCopy)
    cpSync(source, dbPath())
    removeJournals()
    openDatabase()
  } catch {
    if (closed) {
      try {
        closeDatabase()
        if (existsSync(safetyCopy)) cpSync(safetyCopy, dbPath())
        removeJournals()
        openDatabase()
      } catch {
        // Không thể khôi phục tự động; người dùng có thể dùng lại tệp sao lưu.
      }
    }
    try {
      if (existsSync(safetyCopy)) unlinkSync(safetyCopy)
    } catch {
      // bỏ qua
    }
    throw new AppError('Không thể phục hồi dữ liệu. Dữ liệu hiện tại đã được giữ nguyên.', 'INTERNAL')
  }

  try {
    if (existsSync(safetyCopy)) unlinkSync(safetyCopy)
  } catch {
    // bỏ qua
  }

  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 700)
  return { restored: true, path: source }
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
