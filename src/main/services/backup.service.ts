import {
  accessSync,
  constants as fsConstants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { app, dialog } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import type {
  AuthUser,
  AutoBackupResult,
  BackupConfig,
  BackupConfigInput,
  BackupEntry,
  BackupOverview,
  BackupResult,
  BackupRunStatus,
  BackupState,
  BackupTarget
} from '../../shared/types'
import { AppError } from '../lib/errors'
import { dbPath } from '../lib/paths'
import { closeDatabase, getDb, openDatabase } from '../db/database'
import { logActivity } from './log.service'
import { nowISO } from '../../shared/utils'
import {
  deleteDriveBackup,
  downloadDriveBackup,
  getDriveStatus,
  listDriveBackups,
  pruneDriveBackups,
  uploadBackupFile
} from './drive.service'

const BACKUP_NAME_RE = /^manager-device-backup-\d{8}-\d{6}(?:-\d{3})?\.db$/

const BACKUP_KEYS = {
  autoEnabled: 'backup_auto_enabled',
  folder: 'backup_folder',
  retention: 'backup_retention',
  driveEnabled: 'backup_drive_enabled',
  lastAt: 'backup_last_at',
  lastStatus: 'backup_last_status',
  lastTarget: 'backup_last_target',
  lastFile: 'backup_last_file',
  lastMessage: 'backup_last_message',
  lastAutoAt: 'backup_last_auto_at'
} as const

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  autoBackupEnabled: false,
  backupFolder: '',
  retention: 7,
  driveBackupEnabled: false
}

function readSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

function writeSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, nowISO())
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

export function getBackupConfig(): BackupConfig {
  const retention = Number(readSetting(BACKUP_KEYS.retention))
  return {
    autoBackupEnabled: parseBoolean(
      readSetting(BACKUP_KEYS.autoEnabled),
      DEFAULT_BACKUP_CONFIG.autoBackupEnabled
    ),
    backupFolder: readSetting(BACKUP_KEYS.folder) ?? DEFAULT_BACKUP_CONFIG.backupFolder,
    retention:
      Number.isFinite(retention) && retention > 0
        ? Math.min(100, Math.max(1, Math.trunc(retention)))
        : DEFAULT_BACKUP_CONFIG.retention,
    driveBackupEnabled: parseBoolean(
      readSetting(BACKUP_KEYS.driveEnabled),
      DEFAULT_BACKUP_CONFIG.driveBackupEnabled
    )
  }
}

export function getBackupState(): BackupState {
  const status = readSetting(BACKUP_KEYS.lastStatus)
  const target = readSetting(BACKUP_KEYS.lastTarget)
  return {
    lastBackupAt: readSetting(BACKUP_KEYS.lastAt) ?? null,
    lastBackupStatus:
      status === 'success' || status === 'failed' ? (status as BackupRunStatus) : 'never',
    lastBackupTarget: (target as BackupTarget | undefined) ?? null,
    lastBackupFile: readSetting(BACKUP_KEYS.lastFile) ?? null,
    lastBackupMessage: readSetting(BACKUP_KEYS.lastMessage) ?? null
  }
}

export function getBackupOverview(): BackupOverview {
  const config = getBackupConfig()
  return {
    config,
    state: getBackupState(),
    folderAvailable: Boolean(config.backupFolder) && existsSync(config.backupFolder),
    lastAutoBackupAt: readSetting(BACKUP_KEYS.lastAutoAt) ?? null
  }
}

export function updateBackupConfig(input: BackupConfigInput, user: AuthUser | null): BackupOverview {
  const current = getBackupConfig()
  let folder = current.backupFolder

  if (input.backupFolder !== undefined) {
    folder = input.backupFolder.trim()
    if (folder) {
      const resolved = resolve(folder)
      try {
        mkdirSync(resolved, { recursive: true })
        accessSync(resolved, fsConstants.W_OK)
      } catch {
        throw new AppError(
          'Không thể ghi vào thư mục sao lưu đã chọn. Vui lòng kiểm tra quyền truy cập.',
          'BAD_REQUEST'
        )
      }
      folder = resolved
    }
  }

  const retention =
    input.retention === undefined
      ? current.retention
      : Math.min(100, Math.max(1, Math.trunc(Number(input.retention) || current.retention)))

  writeSetting(BACKUP_KEYS.autoEnabled, String(input.autoBackupEnabled ?? current.autoBackupEnabled))
  writeSetting(BACKUP_KEYS.folder, folder)
  writeSetting(BACKUP_KEYS.retention, String(retention))
  writeSetting(
    BACKUP_KEYS.driveEnabled,
    String(input.driveBackupEnabled ?? current.driveBackupEnabled)
  )

  if (user) {
    logActivity(user, 'Cập nhật thiết lập sao lưu', 'settings', null, 'Sao lưu tự động')
  }
  return getBackupOverview()
}

/** Tìm thư mục Google Drive for desktop thường gặp để gợi ý. */
export function detectGoogleDriveFolder(): string | null {
  try {
    const home = app.getPath('home')
    const candidates = [
      join(home, 'Google Drive', 'My Drive'),
      join(home, 'Google Drive'),
      join(home, 'My Drive')
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    if (process.platform === 'win32') {
      for (let code = 68; code <= 90; code++) {
        const candidate = `${String.fromCharCode(code)}:\\My Drive`
        try {
          if (existsSync(candidate)) return candidate
        } catch {
          // bỏ qua ổ đĩa không truy cập được
        }
      }
    }
  } catch {
    // không tìm thấy thư mục gợi ý
  }
  return null
}

export async function chooseBackupFolder(
  user: AuthUser,
  patch: BackupConfigInput = {}
): Promise<BackupOverview | null> {
  const current = getBackupConfig()
  const result = await dialog.showOpenDialog({
    title: 'Chọn thư mục sao lưu',
    defaultPath: current.backupFolder || detectGoogleDriveFolder() || app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Chọn thư mục'
  })
  if (result.canceled || result.filePaths.length === 0) return null
  // Giữ nguyên các thay đổi chưa lưu khác trong biểu mẫu.
  return updateBackupConfig({ ...patch, backupFolder: result.filePaths[0] }, user)
}

export function samePath(a: string, b: string): boolean {
  const left = resolve(a)
  const right = resolve(b)
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}

export function isLiveDatabaseFile(path: string): boolean {
  return [dbPath(), `${dbPath()}-wal`, `${dbPath()}-shm`].some((file) => samePath(path, file))
}

/** Tạo bản snapshot nhất quán bằng VACUUM INTO, không bao giờ ghi đè CSDL đang chạy. */
export function createSnapshotTo(target: string): void {
  if (isLiveDatabaseFile(target)) {
    throw new AppError(
      'Không thể sao lưu đè lên tệp cơ sở dữ liệu đang sử dụng. Vui lòng chọn vị trí khác.',
      'BAD_REQUEST'
    )
  }
  try {
    mkdirSync(dirname(target), { recursive: true })
    if (existsSync(target)) unlinkSync(target)
    const db = getDb()
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
}

export function assertRestorableFile(source: string): void {
  if (isLiveDatabaseFile(source)) {
    throw new AppError(
      'Không thể phục hồi từ tệp cơ sở dữ liệu đang sử dụng. Vui lòng chọn tệp sao lưu khác.',
      'BAD_REQUEST'
    )
  }
  if (!existsSync(source)) {
    throw new AppError('Không tìm thấy tệp sao lưu đã chọn.', 'NOT_FOUND')
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
}

function timestampName(): string {
  const d = new Date()
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0')
  return (
    `manager-device-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}.db`
  )
}

export function listFolderBackups(folder?: string): BackupEntry[] {
  const target = folder ?? getBackupConfig().backupFolder
  if (!target || !existsSync(target)) return []
  let names: string[] = []
  try {
    names = readdirSync(target)
  } catch {
    return []
  }
  const entries: BackupEntry[] = []
  for (const name of names) {
    if (!BACKUP_NAME_RE.test(name)) continue
    const path = join(target, name)
    try {
      const stat = statSync(path)
      if (!stat.isFile()) continue
      entries.push({
        name,
        path,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        target: 'folder'
      })
    } catch {
      // bỏ qua tệp không đọc được
    }
  }
  return entries.sort((left, right) => right.name.localeCompare(left.name))
}

export function pruneFolderBackups(folder: string, retention: number): void {
  if (retention < 1) return
  const entries = listFolderBackups(folder)
  for (const entry of entries.slice(retention)) {
    try {
      if (entry.path) unlinkSync(entry.path)
    } catch {
      // bỏ qua tệp đang được sử dụng
    }
  }
}

function recordBackup(
  status: BackupRunStatus,
  target: BackupTarget | null,
  file: string | null,
  message: string | null,
  automatic = false
): void {
  const now = nowISO()
  writeSetting(BACKUP_KEYS.lastAt, now)
  writeSetting(BACKUP_KEYS.lastStatus, status)
  if (target) writeSetting(BACKUP_KEYS.lastTarget, target)
  if (file) writeSetting(BACKUP_KEYS.lastFile, file)
  writeSetting(BACKUP_KEYS.lastMessage, message ?? '')
  if (automatic && status === 'success') writeSetting(BACKUP_KEYS.lastAutoAt, now)
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function createManualBackup(user: AuthUser): Promise<BackupResult> {
  const defaultName = `manager-device-${new Date().toISOString().slice(0, 10)}.db`
  const result = await dialog.showSaveDialog({
    title: 'Sao lưu cơ sở dữ liệu',
    defaultPath: join(app.getPath('documents'), defaultName),
    filters: [{ name: 'Cơ sở dữ liệu SQLite', extensions: ['db'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }

  const target = result.filePath
  createSnapshotTo(target)
  recordBackup('success', 'manual', basename(target), target)
  logActivity(user, 'Sao lưu dữ liệu', 'settings', null, basename(target))
  return { canceled: false, path: target }
}

export async function backupToFolderNow(user: AuthUser): Promise<BackupResult> {
  const config = getBackupConfig()
  if (!config.backupFolder) {
    throw new AppError(
      'Chưa chọn thư mục sao lưu. Hãy chọn thư mục trong phần thiết lập sao lưu.',
      'BAD_REQUEST'
    )
  }
  try {
    mkdirSync(config.backupFolder, { recursive: true })
    const name = timestampName()
    const target = join(config.backupFolder, name)
    createSnapshotTo(target)
    pruneFolderBackups(config.backupFolder, config.retention)
    recordBackup('success', 'folder', name, target)
    logActivity(user, 'Sao lưu vào thư mục', 'settings', null, name)
    return { canceled: false, path: target, files: 1 }
  } catch (error) {
    recordBackup('failed', 'folder', null, errorText(error))
    if (error instanceof AppError) throw error
    throw new AppError(
      'Không thể sao lưu vào thư mục đã chọn. Vui lòng kiểm tra quyền ghi và dung lượng ổ đĩa.',
      'INTERNAL'
    )
  }
}

async function confirmRestore(message: string, detail: string): Promise<boolean> {
  const confirmed = await dialog.showMessageBox({
    type: 'warning',
    title: 'Xác nhận phục hồi',
    message,
    detail,
    buttons: ['Phục hồi', 'Hủy'],
    defaultId: 1,
    cancelId: 1
  })
  return confirmed.response === 0
}

export async function restoreFromFile(
  source: string,
  user: AuthUser | null,
  options: { message?: string; detail?: string } = {}
): Promise<{ restored: boolean; path?: string }> {
  assertRestorableFile(source)

  const confirmed = await confirmRestore(
    options.message ?? 'Phục hồi dữ liệu sẽ thay thế toàn bộ dữ liệu hiện tại.',
    options.detail ?? 'Ứng dụng sẽ tự khởi động lại sau khi phục hồi. Bạn có chắc chắn?'
  )
  if (!confirmed) return { restored: false }

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
    copyFileSync(dbPath(), safetyCopy)
    copyFileSync(source, dbPath())
    removeJournals()
    openDatabase()
  } catch {
    if (closed) {
      try {
        closeDatabase()
        if (existsSync(safetyCopy)) copyFileSync(safetyCopy, dbPath())
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

export async function restoreManualBackup(
  user: AuthUser
): Promise<{ restored: boolean; path?: string }> {
  const result = await dialog.showOpenDialog({
    title: 'Chọn tệp sao lưu để phục hồi',
    properties: ['openFile'],
    filters: [{ name: 'Cơ sở dữ liệu SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return { restored: false }
  return restoreFromFile(result.filePaths[0], user)
}

export async function restoreFolderBackup(
  name: string,
  user: AuthUser
): Promise<{ restored: boolean; path?: string }> {
  if (!BACKUP_NAME_RE.test(name) || basename(name) !== name) {
    throw new AppError('Tên tệp sao lưu không hợp lệ.', 'BAD_REQUEST')
  }
  const folder = getBackupConfig().backupFolder
  if (!folder) throw new AppError('Chưa chọn thư mục sao lưu.', 'BAD_REQUEST')
  const source = join(folder, name)
  return restoreFromFile(source, user, {
    message: `Phục hồi dữ liệu từ bản sao lưu "${name}"?`,
    detail: 'Toàn bộ dữ liệu hiện tại sẽ được thay thế. Ứng dụng sẽ tự khởi động lại sau khi phục hồi.'
  })
}

export async function backupToDriveNow(user: AuthUser): Promise<BackupEntry> {
  const status = getDriveStatus()
  if (!status.connected) {
    throw new AppError('Chưa kết nối Google Drive. Vui lòng kết nối trong phần Cài đặt.', 'BAD_REQUEST')
  }
  const config = getBackupConfig()
  const temp = join(app.getPath('temp'), `manager-device-drive-${Date.now()}.db`)
  try {
    createSnapshotTo(temp)
    const name = timestampName()
    const entry = await uploadBackupFile(temp, name, config.retention)
    recordBackup('success', 'drive', entry.name, `Google Drive: ${entry.name}`)
    logActivity(user, 'Sao lưu lên Google Drive', 'settings', null, entry.name)
    return entry
  } catch (error) {
    recordBackup('failed', 'drive', null, errorText(error))
    if (error instanceof AppError) throw error
    throw new AppError(`Không thể sao lưu lên Google Drive: ${errorText(error)}`, 'INTERNAL')
  } finally {
    try {
      if (existsSync(temp)) unlinkSync(temp)
    } catch {
      // bỏ qua
    }
  }
}

export async function restoreDriveBackup(
  id: string,
  user: AuthUser
): Promise<{ restored: boolean; path?: string }> {
  const temp = join(app.getPath('temp'), `manager-device-restore-${Date.now()}.db`)
  try {
    await downloadDriveBackup(id, temp)
    let entryName: string | undefined
    try {
      entryName = (await listDriveBackups()).find((item) => item.id === id)?.name
    } catch {
      // Không lấy được tên tệp không ảnh hưởng đến việc phục hồi.
    }
    return await restoreFromFile(temp, user, {
      message: entryName
        ? `Phục hồi dữ liệu từ bản sao lưu Google Drive "${entryName}"?`
        : 'Phục hồi dữ liệu từ bản sao lưu Google Drive?',
      detail: 'Toàn bộ dữ liệu hiện tại sẽ được thay thế. Ứng dụng sẽ tự khởi động lại sau khi phục hồi.'
    })
  } finally {
    try {
      if (existsSync(temp)) unlinkSync(temp)
    } catch {
      // bỏ qua
    }
  }
}

export async function removeDriveBackup(id: string): Promise<void> {
  await deleteDriveBackup(id)
}

export { listDriveBackups, pruneDriveBackups }

export function isDailyBackupDue(): boolean {
  const state = getBackupState()
  if (state.lastBackupStatus === 'success' && state.lastBackupAt) {
    const elapsed = Date.now() - new Date(state.lastBackupAt).getTime()
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) return false
  }
  return true
}

export async function runAutoBackup(
  reason: 'startup' | 'daily' | 'quit' | 'manual' = 'daily'
): Promise<AutoBackupResult> {
  const config = getBackupConfig()
  if (!config.autoBackupEnabled) return { ran: false, skipped: 'disabled' }

  const folderReady = Boolean(config.backupFolder) && existsSync(config.backupFolder)
  const driveReady = config.driveBackupEnabled && getDriveStatus().connected
  if (!folderReady && !driveReady) return { ran: false, skipped: 'no-target' }

  const temp = join(app.getPath('temp'), `manager-device-auto-${Date.now()}.db`)
  let folderFile: string | undefined
  let driveFile: string | undefined
  const errors: string[] = []

  try {
    createSnapshotTo(temp)
    if (folderReady) {
      try {
        const name = timestampName()
        copyFileSync(temp, join(config.backupFolder, name))
        pruneFolderBackups(config.backupFolder, config.retention)
        folderFile = name
      } catch (error) {
        errors.push(`thư mục: ${errorText(error)}`)
      }
    }
    if (driveReady) {
      try {
        const entry = await uploadBackupFile(temp, timestampName(), config.retention)
        driveFile = entry.name
      } catch (error) {
        errors.push(`Google Drive: ${errorText(error)}`)
      }
    }
  } catch (error) {
    errors.push(errorText(error))
  } finally {
    try {
      if (existsSync(temp)) unlinkSync(temp)
    } catch {
      // bỏ qua
    }
  }

  const succeeded = Boolean(folderFile || driveFile)
  if (succeeded) {
    const target: BackupTarget =
      folderFile && driveFile ? 'folder+drive' : folderFile ? 'folder' : 'drive'
    const parts = [
      folderFile ? `Thư mục: ${folderFile}` : null,
      driveFile ? `Google Drive: ${driveFile}` : null
    ].filter(Boolean)
    recordBackup('success', target, folderFile ?? driveFile ?? null, parts.join(' • '), true)
    try {
      logActivity(
        null,
        'Sao lưu tự động',
        'settings',
        null,
        `Sao lưu ${reason === 'quit' ? 'khi đóng ứng dụng' : 'định kỳ'}`
      )
    } catch {
      // ghi nhật ký không được làm hỏng quá trình sao lưu
    }
    return {
      ran: true,
      folderFile,
      driveFile,
      message: errors.length ? `Một phần sao lưu lỗi — ${errors.join('; ')}` : undefined
    }
  }

  const message = errors.join('; ') || 'Không thể tạo bản sao lưu.'
  recordBackup('failed', null, null, message, true)
  return { ran: true, message }
}

export async function runAutoBackupIfDue(): Promise<AutoBackupResult> {
  if (!isDailyBackupDue()) return { ran: false, skipped: 'not-due' }
  return runAutoBackup('daily')
}

let intervalTimer: NodeJS.Timeout | null = null
let startupTimer: NodeJS.Timeout | null = null

export function startAutoBackupScheduler(): void {
  stopAutoBackupScheduler()
  startupTimer = setTimeout(() => {
    void runAutoBackupIfDue().catch((error) => {
      console.error('[backup] Không thể sao lưu tự động:', error)
    })
  }, 15_000)
  startupTimer.unref?.()

  intervalTimer = setInterval(
    () => {
      void runAutoBackupIfDue().catch((error) => {
        console.error('[backup] Không thể sao lưu định kỳ:', error)
      })
    },
    60 * 60 * 1000
  )
  intervalTimer.unref?.()
}

export function stopAutoBackupScheduler(): void {
  if (startupTimer) clearTimeout(startupTimer)
  if (intervalTimer) clearInterval(intervalTimer)
  startupTimer = null
  intervalTimer = null
}

export async function shutdownAutoBackup(): Promise<AutoBackupResult> {
  stopAutoBackupScheduler()
  try {
    return await runAutoBackup('quit')
  } catch (error) {
    console.error('[backup] Không thể sao lưu khi đóng ứng dụng:', error)
    return { ran: false, message: errorText(error) }
  }
}
