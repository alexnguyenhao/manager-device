#!/usr/bin/env node
/**
 * Bổ sung danh mục thiết bị mặc định vào database đang dùng.
 * - Idempotent: bỏ qua danh mục đã có (so khớp theo mã hoặc tên).
 * - Không đụng đến tài khoản, thiết bị, cấp phát hay dữ liệu nghiệp vụ khác.
 * - Tự động sao lưu database trước khi thêm (trừ khi dùng --no-backup).
 *
 * Cách dùng:
 *   node scripts/seed-catalogs.mjs
 *   node scripts/seed-catalogs.mjs --db "/path/to/manager-device.db"
 */

import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
  console.log(`Bổ sung danh mục thiết bị mặc định (bỏ qua danh mục đã có).

Tùy chọn:
  --db <đường dẫn>   Đường dẫn database, mặc định theo hệ điều hành.
  --no-backup        Không tạo bản sao lưu trước khi thêm.
  --help             Hiển thị trợ giúp.`)
}

const args = process.argv.slice(2)
let dbPath = defaultDbPath()
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

if (!existsSync(dbPath)) {
  console.error(`Không tìm thấy database: ${dbPath}`)
  process.exit(1)
}

/** Danh mục mặc định, đồng bộ với src/main/db/seed.ts */
const CATEGORIES = [
  {
    code: 'PC',
    name: 'Máy tính để bàn',
    prefix: 'PC',
    description: 'Máy tính để bàn, máy trạm',
    months: 60,
    warranty: 36,
    specs: [
      { key: 'cpu', label: 'CPU', type: 'text', placeholder: 'Intel Core i5-12400' },
      { key: 'ram', label: 'RAM', type: 'number', unit: 'GB' },
      { key: 'ramType', label: 'Loại RAM', type: 'select', options: ['DDR3', 'DDR4', 'DDR5'] },
      { key: 'storage', label: 'Dung lượng ổ cứng', type: 'text', placeholder: 'SSD 512GB' },
      { key: 'gpu', label: 'Card đồ họa (GPU)', type: 'text', placeholder: 'Intel UHD 730' },
      { key: 'monitor', label: 'Màn hình', type: 'text' },
      {
        key: 'os',
        label: 'Hệ điều hành',
        type: 'select',
        options: [
          'Windows 11 Pro',
          'Windows 11 Home',
          'Windows 10 Pro',
          'Windows 10 Home',
          'Ubuntu',
          'Khác'
        ]
      },
      {
        key: 'osLicense',
        label: 'Bản quyền Windows',
        type: 'select',
        options: ['Có bản quyền', 'Không', 'Không rõ']
      }
    ]
  },
  {
    code: 'LAPTOP',
    name: 'Laptop',
    prefix: 'LAP',
    description: 'Máy tính xách tay',
    months: 48,
    warranty: 24,
    specs: [
      { key: 'cpu', label: 'CPU', type: 'text', placeholder: 'Intel Core i7-1355U' },
      { key: 'ram', label: 'RAM', type: 'number', unit: 'GB' },
      {
        key: 'ramType',
        label: 'Loại RAM',
        type: 'select',
        options: ['DDR4', 'DDR5', 'LPDDR4X', 'LPDDR5', 'LPDDR5X']
      },
      { key: 'storage', label: 'Dung lượng ổ cứng', type: 'text', placeholder: 'SSD 1TB' },
      { key: 'gpu', label: 'Card đồ họa (GPU)', type: 'text', placeholder: 'Intel Iris Xe' },
      { key: 'screen', label: 'Kích thước màn hình', type: 'text', unit: 'inch' },
      {
        key: 'os',
        label: 'Hệ điều hành',
        type: 'select',
        options: [
          'Windows 11 Pro',
          'Windows 11 Home',
          'Windows 10 Pro',
          'Windows 10 Home',
          'macOS',
          'Ubuntu',
          'Khác'
        ]
      },
      {
        key: 'osLicense',
        label: 'Bản quyền Windows',
        type: 'select',
        options: ['Có bản quyền', 'Không', 'Không rõ']
      },
      { key: 'weight', label: 'Khối lượng', type: 'number', unit: 'kg' }
    ]
  },
  {
    code: 'PRINTER',
    name: 'Máy in',
    prefix: 'PRN',
    description: 'Máy in laser, phun màu, đa chức năng',
    months: 60,
    warranty: 24,
    specs: [
      {
        key: 'technology',
        label: 'Công nghệ in',
        type: 'select',
        options: ['Laser đen trắng', 'Laser màu', 'Phun màu', 'Đa chức năng']
      },
      { key: 'speed', label: 'Tốc độ in', type: 'number', unit: 'trang/phút' },
      { key: 'resolution', label: 'Độ phân giải', type: 'text', placeholder: '1200 x 1200 dpi' },
      { key: 'paper', label: 'Khổ giấy', type: 'select', options: ['A4', 'A3', 'A4/A3'] },
      {
        key: 'connection',
        label: 'Kết nối',
        type: 'select',
        options: ['USB', 'LAN', 'Wi-Fi', 'USB + LAN', 'USB + LAN + Wi-Fi']
      },
      { key: 'color', label: 'In màu', type: 'select', options: ['Có', 'Không'] }
    ]
  },
  {
    code: 'SCANNER',
    name: 'Máy scan',
    prefix: 'SCN',
    description: 'Máy quét tài liệu',
    months: 60,
    warranty: 24,
    specs: [
      {
        key: 'type',
        label: 'Loại máy',
        type: 'select',
        options: ['Flatbed', 'ADF', 'Flatbed + ADF']
      },
      { key: 'resolution', label: 'Độ phân giải', type: 'number', unit: 'dpi' },
      { key: 'speed', label: 'Tốc độ quét', type: 'number', unit: 'trang/phút' },
      { key: 'paper', label: 'Khổ giấy', type: 'select', options: ['A4', 'A3', 'A4/A3'] },
      {
        key: 'connection',
        label: 'Kết nối',
        type: 'select',
        options: ['USB', 'LAN', 'Wi-Fi', 'USB + LAN']
      }
    ]
  },
  {
    code: 'PROJECTOR',
    name: 'Máy chiếu',
    prefix: 'PJ',
    description: 'Máy chiếu trình chiếu',
    months: 60,
    warranty: 24,
    specs: [
      { key: 'technology', label: 'Công nghệ', type: 'select', options: ['LCD', 'DLP', 'LED'] },
      { key: 'brightness', label: 'Độ sáng', type: 'number', unit: 'ANSI lumens' },
      {
        key: 'resolution',
        label: 'Độ phân giải',
        type: 'select',
        options: ['XGA', 'HD', 'Full HD', '4K']
      },
      { key: 'connection', label: 'Kết nối', type: 'text', placeholder: 'HDMI, VGA, USB' }
    ]
  },
  {
    code: 'NETWORK',
    name: 'Thiết bị mạng',
    prefix: 'NET',
    description: 'Router, switch, access point, firewall',
    months: 60,
    warranty: 36,
    specs: [
      {
        key: 'deviceType',
        label: 'Loại thiết bị',
        type: 'select',
        options: ['Router', 'Switch', 'Access Point', 'Firewall', 'Modem']
      },
      { key: 'ports', label: 'Số cổng', type: 'number', unit: 'cổng' },
      { key: 'speed', label: 'Tốc độ', type: 'text', placeholder: '1 Gbps' },
      {
        key: 'management',
        label: 'Quản lý',
        type: 'select',
        options: ['Web UI', 'CLI', 'Cloud', 'Không']
      }
    ]
  },
  {
    code: 'UPS',
    name: 'Bộ lưu điện',
    prefix: 'UPS',
    description: 'UPS và ắc quy lưu điện',
    months: 48,
    warranty: 24,
    specs: [
      { key: 'capacity', label: 'Công suất', type: 'text', placeholder: '1500VA / 900W' },
      { key: 'backupTime', label: 'Thời gian lưu điện', type: 'number', unit: 'phút' },
      { key: 'outlets', label: 'Số ổ cắm', type: 'number', unit: 'ổ' }
    ]
  },
  {
    code: 'MONITOR',
    name: 'Màn hình',
    prefix: 'MON',
    description: 'Màn hình máy tính',
    months: 48,
    warranty: 36,
    specs: [
      { key: 'size', label: 'Kích thước', type: 'number', unit: 'inch' },
      {
        key: 'resolution',
        label: 'Độ phân giải',
        type: 'select',
        options: ['1920 x 1080', '2560 x 1440', '3840 x 2160']
      },
      { key: 'panel', label: 'Tấm nền', type: 'select', options: ['IPS', 'VA', 'TN'] },
      {
        key: 'ports',
        label: 'Cổng kết nối',
        type: 'text',
        placeholder: 'HDMI, DP, USB-C'
      }
    ]
  },
  {
    code: 'OTHER',
    name: 'Thiết bị khác',
    prefix: 'TB',
    description: 'Thiết bị văn phòng khác',
    months: 36,
    warranty: 12,
    specs: []
  }
]

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA busy_timeout = 5000')

try {
  const userCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM users').get() || { count: 0 }).count
  )
  if (userCount === 0) {
    console.error('Database chưa có tài khoản. Hãy đăng nhập/khởi tạo ứng dụng trước khi thêm danh mục.')
    process.exit(1)
  }

  if (createBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupDir = join(homedir(), 'ManagerDevice-backups')
    mkdirSync(backupDir, { recursive: true })
    const backupPath = join(backupDir, `manager-device-before-catalogs-${stamp}.db`)
    const escaped = backupPath.replace(/'/g, "''")
    db.exec(`VACUUM INTO '${escaped}'`)
    console.log(`Đã sao lưu database: ${backupPath}`)
  }

  const findByCode = db.prepare('SELECT id, code, name FROM categories WHERE code = ?')
  const findByName = db.prepare('SELECT id, code, name FROM categories WHERE name = ?')
  const insert = db.prepare(
    `INSERT INTO categories
       (code, name, prefix, description, spec_schema, default_depreciation_months, default_warranty_months, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )

  const now = new Date().toISOString()
  let added = 0
  let skipped = 0

  db.exec('BEGIN')
  try {
    for (const row of CATEGORIES) {
      const existing = findByCode.get(row.code) || findByName.get(row.name)
      if (existing) {
        skipped += 1
        console.log(`- Bỏ qua: ${row.code} - ${row.name} (đã có: ${existing.code})`)
        continue
      }
      insert.run(
        row.code,
        row.name,
        row.prefix,
        row.description,
        JSON.stringify(row.specs),
        row.months,
        row.warranty,
        now,
        now
      )
      added += 1
      console.log(`- Đã thêm: ${row.code} - ${row.name}`)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const total = Number(db.prepare('SELECT COUNT(*) AS count FROM categories').get().count)
  console.log('')
  console.log(`Hoàn tất: thêm ${added}, bỏ qua ${skipped}. Tổng số danh mục: ${total}.`)
} finally {
  db.close()
}
