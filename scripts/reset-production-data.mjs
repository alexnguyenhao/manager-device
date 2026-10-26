#!/usr/bin/env node
/**
 * Chuyển dữ liệu demo sang dữ liệu chính:
 * - Giữ nguyên toàn bộ tài khoản người dùng.
 * - Xóa danh mục, bộ phận, vị trí, nhà cung cấp, nhân viên, thiết bị,
 *   cấp phát, bảo trì, kiểm kê, tệp đính kèm, nhật ký và cấu hình demo.
 * - Tự động sao lưu database trước khi xóa.
 *
 * Cách dùng:
 *   node scripts/reset-production-data.mjs --yes
 *   node scripts/reset-production-data.mjs --yes --db "/path/to/manager-device.db"
 */

import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

function defaultDbPath() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'Manager Device', 'data', 'manager-device.db')
  }
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(config, 'Manager Device', 'data', 'manager-device.db')
}

function printHelp() {
  console.log(`Chuyển dữ liệu demo sang dữ liệu chính (giữ lại tài khoản).

Tùy chọn:
  --db <đường dẫn>   Đường dẫn database, mặc định theo hệ điều hành.
  --yes              Xác nhận xóa dữ liệu.
  --no-backup        Không tạo bản sao lưu trước khi xóa.
  --help             Hiển thị trợ giúp.`)
}

const args = process.argv.slice(2)
let dbPath = defaultDbPath()
let confirmed = false
let createBackup = true

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]
  if (arg === '--db') {
    const value = args[i + 1]
    if (!value) {
      console.error('Thiếu đường dẫn sau --db.')
      process.exit(1)
    }
    dbPath = resolve(value)
    i += 1
  } else if (arg === '--yes') {
    confirmed = true
  } else if (arg === '--no-backup') {
    createBackup = false
  } else if (arg === '--help' || arg === '-h') {
    printHelp()
    process.exit(0)
  } else {
    console.error(`Tham số không hợp lệ: ${arg}`)
    printHelp()
    process.exit(1)
  }
}

if (!confirmed) {
  console.error('Thao tác này sẽ xóa toàn bộ dữ liệu nghiệp vụ và danh mục demo.')
  console.error('Thêm --yes để xác nhận.')
  process.exit(1)
}

if (!existsSync(dbPath)) {
  console.error(`Không tìm thấy database: ${dbPath}`)
  process.exit(1)
}

const TABLES_TO_CLEAR = [
  'audit_items',
  'audit_sessions',
  'maintenance_records',
  'asset_assignments',
  'attachments',
  'assets',
  'employees',
  'categories',
  'suppliers',
  'locations',
  'departments',
  'activity_logs',
  'settings'
]

const SEQUENCE_TABLES = TABLES_TO_CLEAR.filter((table) => table !== 'settings')

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA busy_timeout = 5000')

try {
  const userCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM users').get() || { count: 0 }).count
  )
  if (userCount === 0) {
    console.error('Database không có tài khoản nào. Hủy thao tác để tránh mất dữ liệu.')
    process.exit(1)
  }

  let backupPath = null
  if (createBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupDir = join(homedir(), 'ManagerDevice-backups')
    mkdirSync(backupDir, { recursive: true })
    backupPath = join(backupDir, `manager-device-before-reset-${stamp}.db`)
    const escaped = backupPath.replace(/'/g, "''")
    db.exec(`VACUUM INTO '${escaped}'`)
    console.log(`Đã sao lưu dữ liệu cũ: ${backupPath}`)
  }

  db.exec('BEGIN')
  try {
    for (const table of TABLES_TO_CLEAR) {
      db.prepare(`DELETE FROM ${table}`).run()
    }
    db.prepare('UPDATE users SET last_login_at = NULL').run()
    if (SEQUENCE_TABLES.length > 0) {
      const placeholders = SEQUENCE_TABLES.map(() => '?').join(',')
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(
        ...SEQUENCE_TABLES
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db.exec('VACUUM')

  const uploads = join(dirname(dirname(dbPath)), 'uploads')
  if (existsSync(uploads)) {
    for (const entry of readdirSync(uploads)) {
      rmSync(join(uploads, entry), { recursive: true, force: true })
    }
  }

  const remaining = {}
  for (const table of TABLES_TO_CLEAR) {
    remaining[table] = Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)
  }
  const users = Number(db.prepare('SELECT COUNT(*) AS count FROM users').get().count)

  console.log('')
  console.log('Đã khởi tạo dữ liệu chính.')
  console.log(`- Tài khoản giữ lại: ${users}`)
  for (const [table, count] of Object.entries(remaining)) {
    if (count > 0) console.log(`- ${table}: ${count}`)
  }
  console.log('- Danh mục, thiết bị, cấp phát, bảo trì, kiểm kê, nhật ký: 0')
  console.log('- Cấu hình: đã đưa về giá trị mặc định')
} finally {
  db.close()
}
