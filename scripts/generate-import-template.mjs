#!/usr/bin/env node
/**
 * Tạo file Excel mẫu nhập thiết bị trực tiếp từ dữ liệu danh mục hiện có.
 * File sinh ra giống hệt mẫu tải trong phần mềm (Thiết bị → Nhập Excel → Tải mẫu).
 *
 * Cách dùng:
 *   node scripts/generate-import-template.mjs
 *   node scripts/generate-import-template.mjs --db "/path/to/manager-device.db" --out docs/mau.xlsx
 */

import { build } from 'esbuild'
import { rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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
  console.log(`Tạo file Excel mẫu nhập thiết bị từ dữ liệu danh mục hiện có.

Tùy chọn:
  --db <đường dẫn>   Database cần đọc danh mục, mặc định theo hệ điều hành.
  --out <đường dẫn>  File Excel đầu ra, mặc định docs/ManagerDevice-Mau-Nhap-Thiet-Bi.xlsx.
  --help             Hiển thị trợ giúp.`)
}

const args = process.argv.slice(2)
let dbPath = defaultDbPath()
let outPath = join(process.cwd(), 'docs', 'ManagerDevice-Mau-Nhap-Thiet-Bi.xlsx')

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
  } else if (arg === '--out') {
    const value = args[i + 1]
    if (!value) {
      console.error('Thiếu đường dẫn sau --out.')
      process.exit(1)
    }
    outPath = resolve(value)
    i += 1
  } else if (arg === '--help' || arg === '-h') {
    printHelp()
    process.exit(0)
  } else {
    console.error(`Tham số không hợp lệ: ${arg}`)
    printHelp()
    process.exit(1)
  }
}

const root = process.cwd()
const stubPath = join(root, 'test', 'electron-stub.ts')

// electron-stub dùng MD_TEST_DATA làm thư mục userData; database nằm tại <root>/data/manager-device.db.
process.env.MD_TEST_DATA = dirname(dirname(resolve(dbPath)))
process.env.MD_TEMPLATE_OUT = outPath

const bundlePath = join(root, `.md-template-entry-${process.pid}.mjs`)

const entry = `
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { closeDatabase, openDatabase } from './src/main/db/database'
import { buildImportTemplateWorkbook } from './src/main/services/excel.service'

const out = process.env.MD_TEMPLATE_OUT
if (!out) throw new Error('Thiếu MD_TEMPLATE_OUT')

openDatabase()
try {
  const workbook = buildImportTemplateWorkbook()
  mkdirSync(dirname(out), { recursive: true })
  await workbook.xlsx.writeFile(out)
  console.log('Đã tạo mẫu Excel: ' + out)
  console.log('Số sheet dữ liệu: ' + (workbook.worksheets.length - 3))
} finally {
  closeDatabase()
}
`

try {
  await build({
    stdin: {
      contents: entry,
      resolveDir: root,
      sourcefile: 'import-template-entry.ts',
      loader: 'ts'
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    alias: { electron: stubPath },
    outfile: bundlePath,
    logLevel: 'silent'
  })
  await import(pathToFileURL(bundlePath).href)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  rmSync(bundlePath, { force: true })
}
