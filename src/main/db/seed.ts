import type { DatabaseSync } from 'node:sqlite'
import { hashSync } from 'bcryptjs'
import { addMonths, normalizeForSearch, nowISO, todayISO } from '../../shared/utils'

let db: DatabaseSync

function insert(sql: string, params: Array<string | number | null>): number {
  const result = db.prepare(sql).run(...params)
  return Number(result.lastInsertRowid)
}

function dateOffset(days: number): string {
  const d = new Date(`${todayISO()}T00:00:00`)
  d.setDate(d.getDate() + days)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function monthsAgo(months: number): string {
  return addMonths(todayISO(), -months) ?? todayISO()
}

function monthsAhead(months: number): string {
  return addMonths(todayISO(), months) ?? todayISO()
}

function stampOffset(days: number, hour = 9): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0)
  return d.toISOString()
}

export function seedDatabase(database: DatabaseSync): void {
  db = database
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  if (Number(existing.count) > 0) return

  db.exec('BEGIN')
  try {
    seedSettings()
    const users = seedUsers()
    const departments = seedDepartments()
    const locations = seedLocations()
    const categories = seedCategories()
    const suppliers = seedSuppliers()
    const employees = seedEmployees(departments)
    seedAssetsAndTransactions({
      users,
      departments,
      locations,
      categories,
      suppliers,
      employees
    })
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function seedSettings(): void {
  const now = nowISO()
  const settings: Record<string, string> = {
    company_name: 'CÔNG TY TNHH CÔNG NGHỆ ABC',
    company_address: 'Số 18 Nguyễn Chí Thanh, Đống Đa, Hà Nội',
    company_phone: '024 3974 1234',
    company_email: 'info@abc.vn',
    company_tax_code: '0101234567',
    company_website: 'https://abc.vn',
    currency: 'VND',
    date_format: 'DD/MM/YYYY',
    warranty_warning_days: '30',
    maintenance_warning_days: '14',
    default_depreciation_months: '60',
    login_notice: 'Hệ thống quản lý thiết bị nội bộ'
  }
  const stmt = db.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING'
  )
  for (const [key, value] of Object.entries(settings)) stmt.run(key, value, now)
}

function seedUsers(): Record<string, number> {
  const now = nowISO()
  const rows: Array<[string, string, string, string, string, string]> = [
    ['admin', 'Admin@123', 'Nguyễn Minh Quân', 'admin@abc.vn', 'admin', '0901 234 567'],
    ['manager', 'Manager@123', 'Trần Thị Bích', 'bich.tran@abc.vn', 'manager', '0902 345 678'],
    ['staff', 'Staff@123', 'Bùi Quang Huy', 'huy.bui@abc.vn', 'staff', '0903 456 789'],
    ['viewer', 'Viewer@123', 'Đỗ Thị Hương', 'huong.do@abc.vn', 'viewer', '0904 567 890']
  ]
  const result: Record<string, number> = {}
  for (const [username, password, fullName, email, role, phone] of rows) {
    result[username] = insert(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
      [username, hashSync(password, 10), fullName, email, phone, role, now, now]
    )
  }
  return result
}

function seedDepartments(): Record<string, number> {
  const now = nowISO()
  const rows: Array<[string, string, string, string, string]> = [
    ['BGD', 'Ban Giám đốc', 'Nguyễn Minh Quân', '024 3974 1234', 'Điều hành và quản lý chung'],
    ['HCNS', 'Hành chính - Nhân sự', 'Phạm Thu Hà', '024 3974 1235', 'Quản trị nhân sự và hành chính'],
    ['KT', 'Phòng Kế toán', 'Trần Thị Bích', '024 3974 1236', 'Kế toán, tài chính'],
    ['KD', 'Phòng Kinh doanh', 'Hoàng Văn Nam', '024 3974 1237', 'Kinh doanh và chăm sóc khách hàng'],
    ['IT', 'Phòng IT', 'Nguyễn Văn An', '024 3974 1238', 'Hạ tầng và hỗ trợ kỹ thuật'],
    ['KT-QL', 'Phòng Kỹ thuật', 'Vũ Đức Long', '024 3974 1239', 'Thi công và kỹ thuật dự án']
  ]
  const result: Record<string, number> = {}
  for (const [code, name, manager, phone, description] of rows) {
    result[code] = insert(
      `INSERT INTO departments (code, name, manager_name, phone, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [code, name, manager, phone, description, now, now]
    )
  }
  return result
}

function seedLocations(): Record<string, number> {
  const now = nowISO()
  const rows: Array<[string, string, string, string, string, string, string]> = [
    ['VP-HN', 'Văn phòng Hà Nội', 'Số 18 Nguyễn Chí Thanh, Đống Đa, Hà Nội', 'Tòa nhà ABC', 'Tầng 1-5', 'Toàn bộ', 'Trụ sở chính'],
    ['P-HOP', 'Phòng họp tầng 2', 'Số 18 Nguyễn Chí Thanh, Đống Đa, Hà Nội', 'Tòa nhà ABC', 'Tầng 2', 'Phòng 201', 'Phòng họp nội bộ'],
    ['KHO-IT', 'Kho thiết bị IT', 'Số 18 Nguyễn Chí Thanh, Đống Đa, Hà Nội', 'Tòa nhà ABC', 'Tầng hầm', 'Kho B1', 'Lưu trữ thiết bị chờ cấp phát'],
    ['CN-DN', 'Chi nhánh Đà Nẵng', '125 Bạch Đằng, Hải Châu, Đà Nẵng', 'Tòa nhà Central', 'Tầng 3', 'Phòng 301', ''],
    ['CN-HCM', 'Chi nhánh TP. Hồ Chí Minh', '88 Lê Lợi, Quận 1, TP. Hồ Chí Minh', 'Tòa nhà Pearl', 'Tầng 8', 'Phòng 801', '']
  ]
  const result: Record<string, number> = {}
  for (const [code, name, address, building, floor, room, note] of rows) {
    result[code] = insert(
      `INSERT INTO locations (code, name, address, building, floor, room, note, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [code, name, address, building, floor, room, note, now, now]
    )
  }
  return result
}

function seedCategories(): Record<string, number> {
  const now = nowISO()
  const rows: Array<{
    code: string
    name: string
    prefix: string
    description: string
    months: number
    warranty: number
    specs: unknown[]
  }> = [
    {
      code: 'PC',
      name: 'Máy tính để bàn',
      prefix: 'PC',
      description: 'Máy tính để bàn, máy trạm',
      months: 60,
      warranty: 36,
      specs: [
        { key: 'cpu', label: 'CPU', type: 'text', placeholder: 'Intel Core i5-12400' },
        { key: 'cpuCores', label: 'Số nhân CPU', type: 'number', unit: 'nhân' },
        { key: 'cpuThreads', label: 'Số luồng CPU', type: 'number', unit: 'luồng' },
        { key: 'ram', label: 'RAM', type: 'number', unit: 'GB' },
        {
          key: 'ramType',
          label: 'Loại RAM',
          type: 'select',
          options: ['DDR3', 'DDR4', 'DDR5']
        },
        { key: 'ramBus', label: 'Bus RAM', type: 'number', unit: 'MHz' },
        { key: 'storage', label: 'Dung lượng ổ cứng', type: 'text', placeholder: 'SSD 512GB' },
        { key: 'gpu', label: 'Card đồ họa (GPU)', type: 'text', placeholder: 'Intel UHD 730' },
        { key: 'gpuMemory', label: 'Bộ nhớ GPU', type: 'text', placeholder: '4GB hoặc Chia sẻ' },
        { key: 'monitor', label: 'Màn hình', type: 'text' },
        {
          key: 'os',
          label: 'Hệ điều hành',
          type: 'select',
          options: ['Windows 11 Pro', 'Windows 11 Home', 'Windows 10 Pro', 'Windows 10 Home', 'Ubuntu', 'Khác']
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
        { key: 'cpuCores', label: 'Số nhân CPU', type: 'number', unit: 'nhân' },
        { key: 'cpuThreads', label: 'Số luồng CPU', type: 'number', unit: 'luồng' },
        { key: 'ram', label: 'RAM', type: 'number', unit: 'GB' },
        {
          key: 'ramType',
          label: 'Loại RAM',
          type: 'select',
          options: ['DDR4', 'DDR5', 'LPDDR4X', 'LPDDR5', 'LPDDR5X']
        },
        { key: 'ramBus', label: 'Bus RAM', type: 'number', unit: 'MHz' },
        { key: 'storage', label: 'Dung lượng ổ cứng', type: 'text', placeholder: 'SSD 1TB' },
        { key: 'gpu', label: 'Card đồ họa (GPU)', type: 'text', placeholder: 'Intel Iris Xe' },
        { key: 'gpuMemory', label: 'Bộ nhớ GPU', type: 'text', placeholder: '4GB hoặc Chia sẻ' },
        { key: 'screen', label: 'Kích thước màn hình', type: 'text', unit: 'inch' },
        {
          key: 'os',
          label: 'Hệ điều hành',
          type: 'select',
          options: ['Windows 11 Pro', 'Windows 11 Home', 'Windows 10 Pro', 'Windows 10 Home', 'macOS', 'Ubuntu', 'Khác']
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
        { key: 'technology', label: 'Công nghệ in', type: 'select', options: ['Laser đen trắng', 'Laser màu', 'Phun màu', 'Đa chức năng'] },
        { key: 'speed', label: 'Tốc độ in', type: 'number', unit: 'trang/phút' },
        { key: 'resolution', label: 'Độ phân giải', type: 'text', placeholder: '1200 x 1200 dpi' },
        { key: 'paper', label: 'Khổ giấy', type: 'select', options: ['A4', 'A3', 'A4/A3'] },
        { key: 'connection', label: 'Kết nối', type: 'select', options: ['USB', 'LAN', 'Wi-Fi', 'USB + LAN', 'USB + LAN + Wi-Fi'] },
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
        { key: 'type', label: 'Loại máy', type: 'select', options: ['Flatbed', 'ADF', 'Flatbed + ADF'] },
        { key: 'resolution', label: 'Độ phân giải', type: 'number', unit: 'dpi' },
        { key: 'speed', label: 'Tốc độ quét', type: 'number', unit: 'trang/phút' },
        { key: 'paper', label: 'Khổ giấy', type: 'select', options: ['A4', 'A3', 'A4/A3'] },
        { key: 'connection', label: 'Kết nối', type: 'select', options: ['USB', 'LAN', 'Wi-Fi', 'USB + LAN'] }
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
        { key: 'resolution', label: 'Độ phân giải', type: 'select', options: ['XGA', 'HD', 'Full HD', '4K'] },
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
        { key: 'deviceType', label: 'Loại thiết bị', type: 'select', options: ['Router', 'Switch', 'Access Point', 'Firewall', 'Modem'] },
        { key: 'ports', label: 'Số cổng', type: 'number', unit: 'cổng' },
        { key: 'speed', label: 'Tốc độ', type: 'text', placeholder: '1 Gbps' },
        { key: 'management', label: 'Quản lý', type: 'select', options: ['Web UI', 'CLI', 'Cloud', 'Không'] }
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
        { key: 'resolution', label: 'Độ phân giải', type: 'select', options: ['1920 x 1080', '2560 x 1440', '3840 x 2160'] },
        { key: 'panel', label: 'Tấm nền', type: 'select', options: ['IPS', 'VA', 'TN'] },
        { key: 'ports', label: 'Cổng kết nối', type: 'text', placeholder: 'HDMI, DP, USB-C' }
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
  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.code] = insert(
      `INSERT INTO categories
        (code, name, prefix, description, spec_schema, default_depreciation_months, default_warranty_months, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        row.code,
        row.name,
        row.prefix,
        row.description,
        JSON.stringify(row.specs),
        row.months,
        row.warranty,
        now,
        now
      ]
    )
  }
  return result
}

function seedSuppliers(): Record<string, number> {
  const now = nowISO()
  const rows: Array<[string, string, string, string, string, string, string, string]> = [
    ['NCC-FPT', 'Công ty CP Bán lẻ Kỹ thuật số FPT', 'Trần Quốc Bảo', '1900 6600', 'cskh@fptshop.com.vn', '261 Khánh Hội, Quận 4, TP.HCM', '0304991791', 'fptshop.com.vn'],
    ['NCC-PV', 'Công ty TNHH Thiết bị số Minh Phát', 'Nguyễn Thị Hồng', '024 3555 6677', 'kinhdoanh@minhphat.vn', '45 Thái Hà, Đống Đa, Hà Nội', '0106789123', 'minhphat.vn'],
    ['NCC-DELL', 'Dell Technologies Việt Nam', 'Lê Anh Tuấn', '1800 1069', 'support@dell.com', 'Tòa nhà Vietcombank, Quận 1, TP.HCM', '0312345678', 'dell.com/vn'],
    ['NCC-CANON', 'Canon Việt Nam', 'Phạm Văn Dũng', '1900 5555 88', 'canon@canon.com.vn', 'Tòa nhà Lotte, Ba Đình, Hà Nội', '0101239876', 'canon.com.vn']
  ]
  const result: Record<string, number> = {}
  for (const [code, name, contact, phone, email, address, tax, website] of rows) {
    result[code] = insert(
      `INSERT INTO suppliers (code, name, contact_name, phone, email, address, tax_code, website, note, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
      [code, name, contact, phone, email, address, tax, website, now, now]
    )
  }
  return result
}

function seedEmployees(departments: Record<string, number>): Record<string, number> {
  const now = nowISO()
  const rows: Array<[string, string, string, string, string, string, string]> = [
    ['NV001', 'Nguyễn Văn An', 'an.nguyen@abc.vn', '0912 345 001', 'Trưởng phòng IT', 'IT', ''],
    ['NV002', 'Trần Thị Bích', 'bich.tran@abc.vn', '0912 345 002', 'Kế toán trưởng', 'KT', ''],
    ['NV003', 'Lê Hoàng Minh', 'minh.le@abc.vn', '0912 345 003', 'Nhân viên kinh doanh', 'KD', ''],
    ['NV004', 'Phạm Thu Hà', 'ha.pham@abc.vn', '0912 345 004', 'Chuyên viên hành chính', 'HCNS', ''],
    ['NV005', 'Vũ Đức Long', 'long.vu@abc.vn', '0912 345 005', 'Trưởng phòng Kỹ thuật', 'KT-QL', ''],
    ['NV006', 'Đặng Thị Mai', 'mai.dang@abc.vn', '0912 345 006', 'Thư ký Ban Giám đốc', 'BGD', ''],
    ['NV007', 'Bùi Quang Huy', 'huy.bui@abc.vn', '0912 345 007', 'Quản trị hệ thống', 'IT', ''],
    ['NV008', 'Ngô Thị Lan', 'lan.ngo@abc.vn', '0912 345 008', 'Kế toán viên', 'KT', ''],
    ['NV009', 'Hoàng Văn Nam', 'nam.hoang@abc.vn', '0912 345 009', 'Trưởng nhóm kinh doanh', 'KD', ''],
    ['NV010', 'Đỗ Thị Hương', 'huong.do@abc.vn', '0912 345 010', 'Kỹ sư kỹ thuật', 'KT-QL', '']
  ]
  const result: Record<string, number> = {}
  for (const [code, fullName, email, phone, position, dept, note] of rows) {
    result[code] = insert(
      `INSERT INTO employees (code, full_name, email, phone, position, department_id, is_active, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [code, fullName, email, phone, position, departments[dept] ?? null, note, now, now]
    )
  }
  return result
}

interface SeedContext {
  users: Record<string, number>
  departments: Record<string, number>
  locations: Record<string, number>
  categories: Record<string, number>
  suppliers: Record<string, number>
  employees: Record<string, number>
}

interface SeedAsset {
  code: string
  name: string
  category: string
  serial: string
  model: string
  manufacturer: string
  status: string
  condition: string
  department: string
  location: string
  employee?: string
  supplier: string
  purchaseDate: string
  purchasePrice: number
  invoice?: string
  warrantyStart?: string
  warrantyMonths: number
  depreciationMonths: number
  salvageValue?: number
  specs: Record<string, string | number>
  note?: string
}

function seedAssetsAndTransactions(ctx: SeedContext): void {
  const now = nowISO()
  const admin = ctx.users.admin
  const manager = ctx.users.manager

  const assets: SeedAsset[] = [
    {
      code: 'PC-0001',
      name: 'Máy tính để bàn Dell OptiPlex 7090',
      category: 'PC',
      serial: 'DLL7090-2023-001',
      model: 'OptiPlex 7090 SFF',
      manufacturer: 'Dell',
      status: 'in_use',
      condition: 'good',
      department: 'IT',
      location: 'VP-HN',
      employee: 'NV007',
      supplier: 'NCC-DELL',
      purchaseDate: monthsAgo(30),
      purchasePrice: 18500000,
      invoice: 'HD-2024-0158',
      warrantyMonths: 36,
      depreciationMonths: 60,
      specs: { cpu: 'Intel Core i7-11700', ram: 16, storage: 'SSD NVMe 512GB', gpu: 'Intel UHD 750', monitor: 'Dell U2422H 24"', os: 'Windows 11 Pro' }
    },
    {
      code: 'PC-0002',
      name: 'Máy tính để bàn HP ProDesk 400 G7',
      category: 'PC',
      serial: 'HPP400-2022-014',
      model: 'ProDesk 400 G7 SFF',
      manufacturer: 'HP',
      status: 'in_use',
      condition: 'good',
      department: 'KT',
      location: 'VP-HN',
      employee: 'NV008',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(38),
      purchasePrice: 14200000,
      warrantyMonths: 36,
      depreciationMonths: 60,
      specs: { cpu: 'Intel Core i5-10500', ram: 8, storage: 'SSD 256GB + HDD 1TB', gpu: 'Intel UHD 630', monitor: 'HP P22h G5', os: 'Windows 10 Pro' }
    },
    {
      code: 'PC-0003',
      name: 'Máy tính để bàn Dell OptiPlex 3080',
      category: 'PC',
      serial: 'DLL3080-2022-005',
      model: 'OptiPlex 3080 MT',
      manufacturer: 'Dell',
      status: 'available',
      condition: 'fair',
      department: 'HCNS',
      location: 'KHO-IT',
      supplier: 'NCC-DELL',
      purchaseDate: dateOffset(-350),
      purchasePrice: 12500000,
      warrantyMonths: 12,
      depreciationMonths: 60,
      specs: { cpu: 'Intel Core i5-10505', ram: 8, storage: 'SSD 256GB', gpu: 'Intel UHD 630', monitor: 'Dell E2222H', os: 'Windows 11 Pro' },
      note: 'Thiết bị dự phòng, sắp hết hạn bảo hành'
    },
    {
      code: 'PC-0004',
      name: 'Máy tính để bàn Dell Vostro 3020',
      category: 'PC',
      serial: 'DLLV3020-2025-011',
      model: 'Vostro 3020 SFF',
      manufacturer: 'Dell',
      status: 'in_use',
      condition: 'new',
      department: 'KD',
      location: 'VP-HN',
      employee: 'NV009',
      supplier: 'NCC-DELL',
      purchaseDate: monthsAgo(8),
      purchasePrice: 16900000,
      warrantyMonths: 36,
      depreciationMonths: 60,
      specs: { cpu: 'Intel Core i5-13400', ram: 16, storage: 'SSD NVMe 512GB', gpu: 'Intel UHD 730', monitor: 'Dell S2421HN', os: 'Windows 11 Pro' }
    },
    {
      code: 'LAP-0001',
      name: 'Laptop Dell Latitude 5430',
      category: 'LAPTOP',
      serial: 'LAT5430-2024-021',
      model: 'Latitude 5430',
      manufacturer: 'Dell',
      status: 'in_use',
      condition: 'good',
      department: 'KD',
      location: 'VP-HN',
      employee: 'NV003',
      supplier: 'NCC-DELL',
      purchaseDate: monthsAgo(20),
      purchasePrice: 26400000,
      warrantyMonths: 36,
      depreciationMonths: 48,
      specs: { cpu: 'Intel Core i5-1245U', ram: 16, storage: 'SSD NVMe 512GB', screen: '14', os: 'Windows 11 Pro', weight: 1.4 }
    },
    {
      code: 'LAP-0002',
      name: 'MacBook Air M2 13 inch',
      category: 'LAPTOP',
      serial: 'MBA-M2-2023-009',
      model: 'MacBook Air M2',
      manufacturer: 'Apple',
      status: 'in_use',
      condition: 'good',
      department: 'BGD',
      location: 'VP-HN',
      employee: 'NV006',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(26),
      purchasePrice: 31900000,
      warrantyMonths: 12,
      depreciationMonths: 48,
      specs: { cpu: 'Apple M2 8-core', ram: 16, storage: 'SSD 512GB', screen: '13.6', os: 'macOS', weight: 1.24 }
    },
    {
      code: 'LAP-0003',
      name: 'Laptop Lenovo ThinkPad T14 Gen 3',
      category: 'LAPTOP',
      serial: 'TPT14-2024-034',
      model: 'ThinkPad T14 Gen 3',
      manufacturer: 'Lenovo',
      status: 'in_use',
      condition: 'good',
      department: 'IT',
      location: 'VP-HN',
      employee: 'NV001',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(16),
      purchasePrice: 28900000,
      warrantyMonths: 36,
      depreciationMonths: 48,
      specs: { cpu: 'Intel Core i7-1265U', ram: 16, storage: 'SSD NVMe 1TB', screen: '14', os: 'Windows 11 Pro', weight: 1.21 }
    },
    {
      code: 'LAP-0004',
      name: 'Laptop HP ProBook 450 G9',
      category: 'LAPTOP',
      serial: 'HPB450-2023-018',
      model: 'ProBook 450 G9',
      manufacturer: 'HP',
      status: 'maintenance',
      condition: 'poor',
      department: 'KT-QL',
      location: 'KHO-IT',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(28),
      purchasePrice: 23500000,
      warrantyMonths: 24,
      depreciationMonths: 48,
      specs: { cpu: 'Intel Core i5-1235U', ram: 8, storage: 'SSD 512GB', screen: '15.6', os: 'Windows 11 Pro', weight: 1.74 },
      note: 'Đang thay bàn phím và vệ sinh tản nhiệt'
    },
    {
      code: 'LAP-0005',
      name: 'Laptop Asus ExpertBook P1440FA',
      category: 'LAPTOP',
      serial: 'ASUS-P1440-2017-003',
      model: 'ExpertBook P1440FA',
      manufacturer: 'Asus',
      status: 'disposed',
      condition: 'broken',
      department: 'KT-QL',
      location: 'KHO-IT',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(72),
      purchasePrice: 14900000,
      warrantyMonths: 24,
      depreciationMonths: 36,
      salvageValue: 500000,
      specs: { cpu: 'Intel Core i5-8265U', ram: 8, storage: 'SSD 256GB', screen: '14', os: 'Windows 10 Pro', weight: 1.5 },
      note: 'Đã thanh lý tháng trước'
    },
    {
      code: 'PRN-0001',
      name: 'Máy in HP LaserJet Pro M404dn',
      category: 'PRINTER',
      serial: 'HPM404-2022-007',
      model: 'LaserJet Pro M404dn',
      manufacturer: 'HP',
      status: 'in_use',
      condition: 'good',
      department: 'HCNS',
      location: 'VP-HN',
      employee: 'NV004',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(34),
      purchasePrice: 8900000,
      warrantyMonths: 24,
      depreciationMonths: 60,
      specs: { technology: 'Laser đen trắng', speed: 38, resolution: '1200 x 1200 dpi', paper: 'A4', connection: 'USB + LAN', color: 'Không' }
    },
    {
      code: 'PRN-0002',
      name: 'Máy in đa chức năng Canon imageRUNNER 2630i',
      category: 'PRINTER',
      serial: 'CAN2630-2023-002',
      model: 'imageRUNNER 2630i',
      manufacturer: 'Canon',
      status: 'in_use',
      condition: 'good',
      department: 'KT',
      location: 'VP-HN',
      employee: 'NV002',
      supplier: 'NCC-CANON',
      purchaseDate: monthsAgo(22),
      purchasePrice: 46500000,
      warrantyMonths: 24,
      depreciationMonths: 60,
      specs: { technology: 'Đa chức năng', speed: 30, resolution: '1200 x 1200 dpi', paper: 'A3', connection: 'USB + LAN + Wi-Fi', color: 'Có' }
    },
    {
      code: 'PRN-0003',
      name: 'Máy in Brother HL-L2366DW',
      category: 'PRINTER',
      serial: 'BRL2366-2024-005',
      model: 'HL-L2366DW',
      manufacturer: 'Brother',
      status: 'available',
      condition: 'good',
      department: 'HCNS',
      location: 'KHO-IT',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(14),
      purchasePrice: 3200000,
      warrantyMonths: 12,
      depreciationMonths: 48,
      specs: { technology: 'Laser đen trắng', speed: 30, resolution: '600 x 600 dpi', paper: 'A4', connection: 'USB + Wi-Fi', color: 'Không' }
    },
    {
      code: 'PRN-0004',
      name: 'Máy in HP LaserJet 1020',
      category: 'PRINTER',
      serial: 'HPL1020-2015-001',
      model: 'LaserJet 1020',
      manufacturer: 'HP',
      status: 'lost',
      condition: 'broken',
      department: 'KT-QL',
      location: 'KHO-IT',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(120),
      purchasePrice: 2800000,
      warrantyMonths: 12,
      depreciationMonths: 36,
      specs: { technology: 'Laser đen trắng', speed: 14, resolution: '600 x 600 dpi', paper: 'A4', connection: 'USB', color: 'Không' },
      note: 'Thất lạc sau đợt chuyển văn phòng'
    },
    {
      code: 'SCN-0001',
      name: 'Máy scan Fujitsu fi-7160',
      category: 'SCANNER',
      serial: 'FJT7160-2022-003',
      model: 'fi-7160',
      manufacturer: 'Fujitsu',
      status: 'in_use',
      condition: 'good',
      department: 'KT',
      location: 'VP-HN',
      employee: 'NV008',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(30),
      purchasePrice: 21500000,
      warrantyMonths: 24,
      depreciationMonths: 60,
      specs: { type: 'ADF', resolution: 600, speed: 60, paper: 'A4', connection: 'USB' }
    },
    {
      code: 'SCN-0002',
      name: 'Máy scan Canon DR-C225W',
      category: 'SCANNER',
      serial: 'CANDC225-2023-006',
      model: 'DR-C225W',
      manufacturer: 'Canon',
      status: 'available',
      condition: 'good',
      department: 'HCNS',
      location: 'KHO-IT',
      supplier: 'NCC-CANON',
      purchaseDate: monthsAgo(18),
      purchasePrice: 9800000,
      warrantyMonths: 12,
      depreciationMonths: 48,
      specs: { type: 'Flatbed + ADF', resolution: 600, speed: 25, paper: 'A4', connection: 'USB + Wi-Fi' }
    },
    {
      code: 'SCN-0003',
      name: 'Máy scan Epson DS-530II',
      category: 'SCANNER',
      serial: 'EPS530-2025-004',
      model: 'DS-530II',
      manufacturer: 'Epson',
      status: 'in_use',
      condition: 'new',
      department: 'HCNS',
      location: 'VP-HN',
      employee: 'NV004',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(5),
      purchasePrice: 13200000,
      warrantyMonths: 24,
      depreciationMonths: 48,
      specs: { type: 'ADF', resolution: 600, speed: 35, paper: 'A4', connection: 'USB' }
    },
    {
      code: 'PJ-0001',
      name: 'Máy chiếu Epson EB-X51',
      category: 'PROJECTOR',
      serial: 'EPX51-2023-001',
      model: 'EB-X51',
      manufacturer: 'Epson',
      status: 'available',
      condition: 'good',
      department: 'HCNS',
      location: 'P-HOP',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(24),
      purchasePrice: 16800000,
      warrantyMonths: 24,
      depreciationMonths: 60,
      specs: { technology: 'LCD', brightness: 3800, resolution: 'XGA', connection: 'HDMI, VGA, USB' }
    },
    {
      code: 'NET-0001',
      name: 'Switch Cisco Catalyst 2960-X 24 port',
      category: 'NETWORK',
      serial: 'CSC2960-2021-001',
      model: 'WS-C2960X-24TS-L',
      manufacturer: 'Cisco',
      status: 'in_use',
      condition: 'good',
      department: 'IT',
      location: 'KHO-IT',
      employee: 'NV007',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(48),
      purchasePrice: 38500000,
      warrantyMonths: 60,
      depreciationMonths: 72,
      specs: { deviceType: 'Switch', ports: 24, speed: '1 Gbps', management: 'CLI' }
    },
    {
      code: 'NET-0002',
      name: 'Router TP-Link Archer AX55',
      category: 'NETWORK',
      serial: 'TPAX55-2024-012',
      model: 'Archer AX55',
      manufacturer: 'TP-Link',
      status: 'available',
      condition: 'good',
      department: 'IT',
      location: 'KHO-IT',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(12),
      purchasePrice: 2450000,
      warrantyMonths: 24,
      depreciationMonths: 36,
      specs: { deviceType: 'Router', ports: 5, speed: '3000 Mbps', management: 'Web UI' }
    },
    {
      code: 'NET-0003',
      name: 'Access Point UniFi AC Pro',
      category: 'NETWORK',
      serial: 'UBNTACPRO-2023-004',
      model: 'UAP-AC-Pro',
      manufacturer: 'Ubiquiti',
      status: 'in_use',
      condition: 'good',
      department: 'IT',
      location: 'VP-HN',
      employee: 'NV001',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(30),
      purchasePrice: 3900000,
      warrantyMonths: 24,
      depreciationMonths: 48,
      specs: { deviceType: 'Access Point', ports: 2, speed: '1750 Mbps', management: 'Cloud' }
    },
    {
      code: 'UPS-0001',
      name: 'Bộ lưu điện APC Smart-UPS 1500VA',
      category: 'UPS',
      serial: 'APC1500-2022-002',
      model: 'SMT1500I',
      manufacturer: 'APC',
      status: 'in_use',
      condition: 'fair',
      department: 'IT',
      location: 'KHO-IT',
      employee: 'NV007',
      supplier: 'NCC-PV',
      purchaseDate: monthsAgo(42),
      purchasePrice: 12800000,
      warrantyMonths: 36,
      depreciationMonths: 60,
      specs: { capacity: '1500VA / 980W', backupTime: 15, outlets: 8 },
      note: 'Ắc quy cần kiểm tra định kỳ'
    },
    {
      code: 'MON-0001',
      name: 'Màn hình Dell UltraSharp U2422H 24 inch',
      category: 'MONITOR',
      serial: 'DLLU2422-2024-031',
      model: 'U2422H',
      manufacturer: 'Dell',
      status: 'in_use',
      condition: 'new',
      department: 'IT',
      location: 'VP-HN',
      employee: 'NV007',
      supplier: 'NCC-DELL',
      purchaseDate: monthsAgo(10),
      purchasePrice: 6200000,
      warrantyMonths: 36,
      depreciationMonths: 48,
      specs: { size: 24, resolution: '1920 x 1080', panel: 'IPS', ports: 'HDMI, DP, USB-C' }
    },
    {
      code: 'MON-0002',
      name: 'Màn hình LG 27UP850 4K',
      category: 'MONITOR',
      serial: 'LG27UP-2025-017',
      model: '27UP850',
      manufacturer: 'LG',
      status: 'in_use',
      condition: 'new',
      department: 'KD',
      location: 'VP-HN',
      employee: 'NV009',
      supplier: 'NCC-FPT',
      purchaseDate: monthsAgo(4),
      purchasePrice: 11900000,
      warrantyMonths: 24,
      depreciationMonths: 48,
      specs: { size: 27, resolution: '3840 x 2160', panel: 'IPS', ports: 'HDMI, DP, USB-C' }
    }
  ]

  const assetIds: Record<string, number> = {}
  const employeeByCode = ctx.employees
  const employeeNames: Record<number, string> = {}
  const employeeRows = db.prepare('SELECT id, full_name FROM employees').all() as Array<{
    id: number
    full_name: string
  }>
  for (const row of employeeRows) employeeNames[Number(row.id)] = row.full_name

  for (const asset of assets) {
    const categoryId = ctx.categories[asset.category]
    const employeeId = asset.employee ? employeeByCode[asset.employee] : null
    const warrantyExpiry = addMonths(
      asset.warrantyStart ?? asset.purchaseDate,
      asset.warrantyMonths
    )
    const searchText = normalizeForSearch(
      [
        asset.code,
        asset.name,
        asset.serial,
        asset.model,
        asset.manufacturer,
        employeeId ? employeeNames[employeeId] : ''
      ].join(' ')
    )
    assetIds[asset.code] = insert(
      `INSERT INTO assets
        (code, name, category_id, serial_number, model, manufacturer, status, condition,
         department_id, location_id, assigned_employee_id, supplier_id,
         purchase_date, purchase_price, invoice_number, warranty_start, warranty_months, warranty_expiry,
         depreciation_months, salvage_value, specs, note, image_path, search_text, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        asset.code,
        asset.name,
        categoryId,
        asset.serial,
        asset.model,
        asset.manufacturer,
        asset.status,
        asset.condition,
        ctx.departments[asset.department] ?? null,
        ctx.locations[asset.location] ?? null,
        employeeId ?? null,
        ctx.suppliers[asset.supplier] ?? null,
        asset.purchaseDate,
        asset.purchasePrice,
        asset.invoice ?? null,
        asset.warrantyStart ?? asset.purchaseDate,
        asset.warrantyMonths,
        warrantyExpiry,
        asset.depreciationMonths,
        asset.salvageValue ?? 0,
        JSON.stringify(asset.specs),
        asset.note ?? null,
        searchText,
        admin,
        now,
        now
      ]
    )
  }

  // Phiếu cấp phát đang hiệu lực
  let assignmentSeq = 1
  const inUseCodes = assets.filter((a) => a.employee && a.status === 'in_use')
  for (const [index, asset] of inUseCodes.entries()) {
    const employeeId = employeeByCode[asset.employee as string]
    const deptId = ctx.departments[asset.department] ?? null
    const assignedDate = monthsAgo(Math.max(1, 6 + (index % 10)))
    const expected = asset.code === 'LAP-0001' || asset.code === 'PC-0002' ? dateOffset(-12) : null
    const code = `BG-${todayISO().slice(0, 7).replace('-', '')}-${String(assignmentSeq++).padStart(4, '0')}`
    insert(
      `INSERT INTO asset_assignments
        (code, asset_id, employee_id, department_id, assigned_date, expected_return_date, returned_date,
         status, condition_before, condition_after, note, return_note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'active', ?, NULL, ?, NULL, ?, ?)`,
      [
        code,
        assetIds[asset.code],
        employeeId,
        deptId,
        assignedDate,
        expected,
        asset.condition,
        'Bàn giao thiết bị phục vụ công việc',
        manager,
        now
      ]
    )
  }

  // Lịch sử cấp phát đã thu hồi
  const historyRows: Array<[string, string, string, string, string | null]> = [
    ['PC-0003', 'NV004', monthsAgo(18), monthsAgo(4), 'Thu hồi do nâng cấp thiết bị'],
    ['LAP-0004', 'NV005', monthsAgo(20), monthsAgo(1), 'Thu hồi để sửa chữa'],
    ['LAP-0005', 'NV010', monthsAgo(48), monthsAgo(20), 'Thu hồi do hỏng, chờ thanh lý'],
    ['SCN-0002', 'NV004', monthsAgo(12), monthsAgo(3), 'Chuyển sang kho dự phòng']
  ]
  for (const [assetCode, empCode, assigned, returned, note] of historyRows) {
    const asset = assets.find((a) => a.code === assetCode)
    if (!asset) continue
    const code = `BG-${todayISO().slice(0, 7).replace('-', '')}-${String(assignmentSeq++).padStart(4, '0')}`
    insert(
      `INSERT INTO asset_assignments
        (code, asset_id, employee_id, department_id, assigned_date, expected_return_date, returned_date,
         status, condition_before, condition_after, note, return_note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 'returned', 'good', 'good', ?, ?, ?, ?)`,
      [
        code,
        assetIds[assetCode],
        employeeByCode[empCode],
        ctx.departments[asset.department] ?? null,
        assigned,
        returned,
        'Cấp phát theo đề nghị',
        note,
        manager,
        now
      ]
    )
  }

  // Phiếu bảo trì
  const maintenanceRows: Array<{
    code: string
    assetCode: string
    type: string
    title: string
    description: string
    provider: string
    assignee: string
    scheduled: string
    completed: string | null
    cost: number
    status: string
    priority: string
    result: string | null
  }> = [
    {
      code: 'MT-0001',
      assetCode: 'LAP-0004',
      type: 'corrective',
      title: 'Thay bàn phím và vệ sinh tản nhiệt',
      description: 'Một số phím không nhận, máy nóng và quạt kêu to khi làm việc.',
      provider: 'Trung tâm bảo hành HP - FPT',
      assignee: 'Nguyễn Đức Kỹ Thuật',
      scheduled: dateOffset(-2),
      completed: null,
      cost: 0,
      status: 'in_progress',
      priority: 'high',
      result: null
    },
    {
      code: 'MT-0002',
      assetCode: 'PRN-0002',
      type: 'preventive',
      title: 'Bảo dưỡng định kỳ máy in Canon',
      description: 'Vệ sinh trống mực, kiểm tra bộ nạp giấy và thay hộp mực dự phòng.',
      provider: 'Canon Việt Nam',
      assignee: 'Phạm Văn Dũng',
      scheduled: dateOffset(10),
      completed: null,
      cost: 850000,
      status: 'scheduled',
      priority: 'normal',
      result: null
    },
    {
      code: 'MT-0003',
      assetCode: 'PJ-0001',
      type: 'preventive',
      title: 'Vệ sinh máy chiếu và kiểm tra bóng đèn',
      description: 'Bảo dưỡng trước đợt họp tổng kết quý.',
      provider: 'Công ty TNHH Thiết bị số Minh Phát',
      assignee: 'Nguyễn Thị Hồng',
      scheduled: dateOffset(25),
      completed: null,
      cost: 650000,
      status: 'scheduled',
      priority: 'low',
      result: null
    },
    {
      code: 'MT-0004',
      assetCode: 'PC-0001',
      type: 'inspection',
      title: 'Kiểm tra tổng thể máy tính và cập nhật Windows',
      description: 'Rà soát phần cứng, vệ sinh bụi bên trong và cập nhật bản vá bảo mật.',
      provider: 'Phòng IT',
      assignee: 'Bùi Quang Huy',
      scheduled: dateOffset(-32),
      completed: dateOffset(-30),
      cost: 350000,
      status: 'completed',
      priority: 'normal',
      result: 'Thiết bị hoạt động ổn định, đã thay keo tản nhiệt.'
    },
    {
      code: 'MT-0005',
      assetCode: 'UPS-0001',
      type: 'preventive',
      title: 'Kiểm tra ắc quy và thời gian lưu điện',
      description: 'Thời gian lưu điện có dấu hiệu giảm, cần kiểm tra dung lượng ắc quy.',
      provider: 'Công ty TNHH Thiết bị số Minh Phát',
      assignee: 'Lê Anh Tuấn',
      scheduled: dateOffset(-5),
      completed: null,
      cost: 1200000,
      status: 'scheduled',
      priority: 'high',
      result: null
    },
    {
      code: 'MT-0006',
      assetCode: 'NET-0001',
      type: 'corrective',
      title: 'Sửa cổng uplink bị lỗi',
      description: 'Cổng uplink số 24 chập chờn, ảnh hưởng kết nối tầng 2.',
      provider: 'Phòng IT',
      assignee: 'Bùi Quang Huy',
      scheduled: dateOffset(-65),
      completed: dateOffset(-63),
      cost: 1250000,
      status: 'completed',
      priority: 'urgent',
      result: 'Đã thay module SFP và cấu hình lại VLAN.'
    },
    {
      code: 'MT-0007',
      assetCode: 'PC-0002',
      type: 'upgrade',
      title: 'Nâng cấp RAM từ 8GB lên 16GB',
      description: 'Đáp ứng nhu cầu làm việc với bảng tính lớn.',
      provider: 'Phòng IT',
      assignee: 'Nguyễn Văn An',
      scheduled: dateOffset(40),
      completed: null,
      cost: 1100000,
      status: 'scheduled',
      priority: 'normal',
      result: null
    }
  ]
  for (const row of maintenanceRows) {
    insert(
      `INSERT INTO maintenance_records
        (code, asset_id, type, title, description, provider, assignee, scheduled_date, completed_date,
         cost, status, priority, result, note, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        row.code,
        assetIds[row.assetCode],
        row.type,
        row.title,
        row.description,
        row.provider,
        row.assignee,
        row.scheduled,
        row.completed,
        row.cost,
        row.status,
        row.priority,
        row.result,
        manager,
        stampOffset(-40, 10),
        now
      ]
    )
  }

  // Phiên kiểm kê
  const audit1 = insert(
    `INSERT INTO audit_sessions
      (code, name, department_id, location_id, start_date, end_date, status, note, created_by, created_at, completed_at)
     VALUES (?, ?, ?, NULL, ?, ?, 'completed', ?, ?, ?, ?)`,
    [
      `KK-${todayISO().slice(0, 7).replace('-', '')}-001`,
      'Kiểm kê thiết bị Phòng IT - Quý III',
      ctx.departments.IT,
      monthsAgo(1),
      dateOffset(-25),
      'Kiểm kê định kỳ theo quy trình nội bộ',
      admin,
      stampOffset(-30, 8),
      stampOffset(-24, 17)
    ]
  )
  const itAssets = assets.filter((a) => a.department === 'IT')
  for (const [index, asset] of itAssets.entries()) {
    const assetId = assetIds[asset.code]
    let result = 'matched'
    let actualLocation: number | null = ctx.locations[asset.location]
    let note: string | null = null
    if (index === 1) {
      result = 'wrong_location'
      actualLocation = ctx.locations['P-HOP']
      note = 'Thiết bị được mang sang phòng họp, chưa cập nhật hệ thống'
    }
    if (index === 2) {
      result = 'missing'
      actualLocation = null
      note = 'Không tìm thấy tại vị trí kiểm kê'
    }
    insert(
      `INSERT INTO audit_items
        (session_id, asset_id, expected_location_id, expected_employee_id, actual_location_id, actual_employee_id,
         result, note, scanned_at, scanned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        audit1,
        assetId,
        ctx.locations[asset.location],
        asset.employee ? employeeByCode[asset.employee] : null,
        actualLocation,
        asset.employee ? employeeByCode[asset.employee] : null,
        result,
        note,
        stampOffset(-27 + index, 9 + index),
        admin
      ]
    )
  }

  const audit2 = insert(
    `INSERT INTO audit_sessions
      (code, name, department_id, location_id, start_date, end_date, status, note, created_by, created_at, completed_at)
     VALUES (?, ?, NULL, NULL, ?, NULL, 'in_progress', ?, ?, ?, NULL)`,
    [
      `KK-${todayISO().slice(0, 7).replace('-', '')}-002`,
      'Kiểm kê toàn bộ thiết bị tháng này',
      dateOffset(-3),
      'Kiểm kê toàn công ty, ưu tiên thiết bị đang sử dụng',
      manager,
      stampOffset(-3, 8)
    ]
  )
  for (const [index, asset] of assets.entries()) {
    if (asset.status === 'disposed') continue
    const assetId = assetIds[asset.code]
    const scanned = index < 6
    insert(
      `INSERT INTO audit_items
        (session_id, asset_id, expected_location_id, expected_employee_id, actual_location_id, actual_employee_id,
         result, note, scanned_at, scanned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        audit2,
        assetId,
        ctx.locations[asset.location],
        asset.employee ? employeeByCode[asset.employee] : null,
        scanned ? ctx.locations[asset.location] : null,
        scanned && asset.employee ? employeeByCode[asset.employee] : null,
        scanned ? 'matched' : 'pending',
        scanned ? stampOffset(-2, 9) : null,
        scanned ? manager : null
      ]
    )
  }

  // Nhật ký hoạt động
  const logs: Array<[number, string, string, string, number | null, string, string]> = [
    [admin, 'Đăng nhập hệ thống', 'system', 'system', null, 'Phiên đăng nhập quản trị', stampOffset(0, 8)],
    [manager, 'Tạo phiếu bảo trì MT-0002', 'maintenance', 'maintenance', null, 'Bảo dưỡng định kỳ máy in Canon', stampOffset(-1, 14)],
    [manager, 'Cấp phát thiết bị', 'assignment', 'asset', assetIds['MON-0002'], 'Laptop/Màn hình cho Hoàng Văn Nam', stampOffset(-2, 10)],
    [admin, 'Cập nhật thông tin thiết bị', 'asset', 'asset', assetIds['UPS-0001'], 'Bổ sung ghi chú kiểm tra ắc quy', stampOffset(-3, 16)],
    [manager, 'Tạo phiên kiểm kê', 'audit', 'audit', audit2, 'Kiểm kê toàn bộ thiết bị tháng này', stampOffset(-3, 8)],
    [admin, 'Hoàn thành kiểm kê', 'audit', 'audit', audit1, 'Kiểm kê thiết bị Phòng IT - Quý III', stampOffset(-24, 17)],
    [ctx.users.staff, 'Cập nhật trạng thái bảo trì', 'maintenance', 'asset', assetIds['LAP-0004'], 'Chuyển thiết bị sang trạng thái đang bảo trì', stampOffset(-28, 11)],
    [admin, 'Thanh lý thiết bị', 'asset', 'asset', assetIds['LAP-0005'], 'Thanh lý laptop Asus ExpertBook', stampOffset(-35, 15)]
  ]
  for (const [userId, action, entityType, _entityGroup, entityId, label, createdAt] of logs) {
    const userRow = db
      .prepare('SELECT username FROM users WHERE id = ?')
      .get(userId) as { username: string } | undefined
    insert(
      `INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, entity_label, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      [userId, userRow?.username ?? null, action, entityType, entityId, label, createdAt]
    )
  }
}
