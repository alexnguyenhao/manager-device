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
    seedInfrastructure(users)
    seedSystems(users, departments)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function seedSettings(): void {
  const now = nowISO()
  const settings: Record<string, string> = {
    company_name: 'ỦY BAN NHÂN DÂN XÃ AN BÌNH',
    company_address: 'Số 01, đường Trần Phú, xã An Bình',
    company_phone: '0229 3861 234',
    company_email: 'ubnd@anbinh.gov.vn',
    company_tax_code: '5701234567',
    company_website: 'https://anbinh.gov.vn',
    currency: 'VND',
    date_format: 'DD/MM/YYYY',
    warranty_warning_days: '30',
    maintenance_warning_days: '14',
    default_depreciation_months: '60',
    login_notice: 'Hệ thống quản lý thiết bị của UBND xã An Bình'
  }
  const stmt = db.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING'
  )
  for (const [key, value] of Object.entries(settings)) stmt.run(key, value, now)
}

function seedUsers(): Record<string, number> {
  const now = nowISO()
  const rows: Array<[string, string, string, string, string, string]> = [
    ['admin', 'Admin@123', 'Nguyễn Minh Quân', 'quan.nguyen@anbinh.gov.vn', 'admin', '0901 234 567'],
    ['manager', 'Manager@123', 'Trần Thị Bích', 'bich.tran@anbinh.gov.vn', 'manager', '0902 345 678'],
    ['staff', 'Staff@123', 'Bùi Quang Huy', 'huy.bui@anbinh.gov.vn', 'staff', '0903 456 789'],
    ['viewer', 'Viewer@123', 'Đỗ Thị Hương', 'huong.do@anbinh.gov.vn', 'viewer', '0904 567 890']
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
  const rows: Array<[string, string, string, string, string, string]> = [
    ['VP-DU', 'Văn phòng Đảng ủy', 'party', 'Lê Hoàng Minh', '0229 3861 235', 'Tham mưu, tổng hợp phục vụ Đảng ủy'],
    ['BXD-D', 'Ban Xây dựng Đảng', 'party', 'Trần Thị Bích', '0229 3861 236', 'Tham mưu công tác xây dựng Đảng'],
    ['UBKT', 'Ủy ban Kiểm tra', 'party', 'Phạm Thu Hà', '0229 3861 237', 'Kiểm tra, giám sát theo quy định của Đảng'],
    ['MTTQ', 'Ủy ban Mặt trận Tổ quốc Việt Nam', 'party', 'Đặng Thị Mai', '0229 3861 238', 'Vận động quần chúng, giám sát và phản biện xã hội'],
    ['VP', 'Văn phòng HĐND và UBND', 'state', 'Nguyễn Minh Quân', '0229 3861 239', 'Tổng hợp, hành chính, quản trị nội bộ'],
    ['KT', 'Phòng Kinh tế', 'state', 'Hoàng Văn Nam', '0229 3861 240', 'Quản lý kinh tế, đất đai, xây dựng và tài chính'],
    ['VHXH', 'Phòng Văn hóa - Xã hội', 'state', 'Ngô Thị Lan', '0229 3861 241', 'Văn hóa, giáo dục, y tế và chính sách xã hội'],
    ['PVHCC', 'Trung tâm Phục vụ Hành chính Công', 'state', 'Vũ Đức Long', '0229 3861 242', 'Tiếp nhận và trả kết quả thủ tục hành chính'],
    ['DVTH', 'Trung tâm Dịch vụ Tổng hợp', 'state', 'Bùi Quang Huy', '0229 3861 243', 'Cung cấp dịch vụ công ích và hỗ trợ vận hành']
  ]
  const result: Record<string, number> = {}
  for (const [code, name, block, manager, phone, description] of rows) {
    result[code] = insert(
      `INSERT INTO departments (code, name, block, manager_name, phone, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [code, name, block, manager, phone, description, now, now]
    )
  }
  return result
}

function seedLocations(): Record<string, number> {
  const now = nowISO()
  const rows: Array<[string, string, string, string, string, string, string]> = [
    ['TRU-SO', 'Trụ sở UBND xã', 'Số 01, đường Trần Phú, xã An Bình', 'Nhà làm việc chính', 'Tầng 1', 'Toàn bộ', 'Khu hành chính trung tâm'],
    ['P-HOP', 'Phòng họp HĐND - UBND', 'Số 01, đường Trần Phú, xã An Bình', 'Nhà làm việc chính', 'Tầng 2', 'Phòng 201', 'Phòng họp, hội nghị'],
    ['P-TN', 'Bộ phận Tiếp nhận và Trả kết quả', 'Số 01, đường Trần Phú, xã An Bình', 'Nhà làm việc chính', 'Tầng 1', 'Phòng 101', 'Khu một cửa phục vụ nhân dân'],
    ['P-DU', 'Khu làm việc Khối Đảng', 'Số 01, đường Trần Phú, xã An Bình', 'Nhà làm việc chính', 'Tầng 2', 'Phòng 202', 'Văn phòng Đảng ủy và các ban Đảng'],
    ['HOI-TRUONG', 'Hội trường UBND xã', 'Số 01, đường Trần Phú, xã An Bình', 'Nhà văn hóa', 'Tầng 1', 'Hội trường', 'Tổ chức hội nghị, tập huấn'],
    ['KHO', 'Kho thiết bị', 'Số 01, đường Trần Phú, xã An Bình', 'Nhà làm việc chính', 'Tầng 1', 'Kho K01', 'Lưu trữ thiết bị chờ cấp phát, sửa chữa']
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
        { key: 'screenResolution', label: 'Độ phân giải màn hình', type: 'text', placeholder: '1920 x 1080' },
        { key: 'refreshRate', label: 'Tần số quét', type: 'number', unit: 'Hz' },
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
        { key: 'screenResolution', label: 'Độ phân giải màn hình', type: 'text', placeholder: '1920 x 1080' },
        { key: 'refreshRate', label: 'Tần số quét', type: 'number', unit: 'Hz' },
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
        { key: 'color', label: 'In màu', type: 'select', options: ['Có', 'Không'] },
        { key: 'duplex', label: 'In hai mặt', type: 'select', options: ['Không', 'Có (trục dài)', 'Có (trục ngắn)'] },
        { key: 'ipAddress', label: 'Địa chỉ IP', type: 'text', placeholder: '192.168.1.50' },
        { key: 'driver', label: 'Driver máy in', type: 'text' },
        { key: 'port', label: 'Cổng in', type: 'text', placeholder: 'IP_192.168.1.50' }
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
    ['NCC-PA', 'Công ty CP Thiết bị Văn phòng Phúc An', 'Trần Quốc Bảo', '0229 3888 666', 'kinhdoanh@phucan.vn', 'Số 12, đường Lê Lợi, xã An Bình', '5700123456', 'phucan.vn'],
    ['NCC-MT', 'Công ty TNHH Máy tính Minh Thành', 'Nguyễn Thị Hồng', '0229 3777 555', 'kinhdoanh@minhthanh.vn', 'Số 45, đường Trần Phú, xã An Bình', '5700234567', 'minhthanh.vn'],
    ['NCC-VT', 'Công ty CP Công nghệ Việt Tín', 'Lê Anh Tuấn', '1800 1069', 'hotro@viettin.vn', 'Số 88, đường Nguyễn Huệ, thành phố Ninh Bình', '5700345678', 'viettin.vn'],
    ['NCC-BH', 'Trung tâm Bảo hành HP - Ninh Bình', 'Phạm Văn Dũng', '0229 3666 444', 'baohanh@hpninhbinh.vn', 'Số 26, đường Đinh Tiên Hoàng, thành phố Ninh Bình', '5700456789', 'hpninhbinh.vn']
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
    ['CB001', 'Nguyễn Văn Hùng', 'hung.nguyen@anbinh.gov.vn', '0912 345 001', 'Bí thư Đảng ủy', 'VP-DU', ''],
    ['CB002', 'Lê Hoàng Minh', 'minh.le@anbinh.gov.vn', '0912 345 002', 'Phó Bí thư Thường trực Đảng ủy', 'VP-DU', ''],
    ['CB003', 'Trần Thị Bích', 'bich.tran@anbinh.gov.vn', '0912 345 003', 'Trưởng ban Xây dựng Đảng', 'BXD-D', ''],
    ['CB004', 'Phạm Thu Hà', 'ha.pham@anbinh.gov.vn', '0912 345 004', 'Chủ nhiệm Ủy ban Kiểm tra', 'UBKT', ''],
    ['CB005', 'Đặng Thị Mai', 'mai.dang@anbinh.gov.vn', '0912 345 005', 'Chủ tịch Ủy ban MTTQ', 'MTTQ', ''],
    ['CB006', 'Nguyễn Thị Hồng', 'hong.nguyen@anbinh.gov.vn', '0912 345 006', 'Chuyên viên Văn phòng Đảng ủy', 'VP-DU', ''],
    ['CB007', 'Đỗ Văn Thành', 'thanh.do@anbinh.gov.vn', '0912 345 007', 'Phó Chủ nhiệm Ủy ban Kiểm tra', 'UBKT', ''],
    ['CB008', 'Nguyễn Minh Quân', 'quan.nguyen@anbinh.gov.vn', '0912 345 008', 'Chánh Văn phòng HĐND và UBND', 'VP', ''],
    ['CB009', 'Hoàng Văn Nam', 'nam.hoang@anbinh.gov.vn', '0912 345 009', 'Trưởng phòng Kinh tế', 'KT', ''],
    ['CB010', 'Ngô Thị Lan', 'lan.ngo@anbinh.gov.vn', '0912 345 010', 'Trưởng phòng Văn hóa - Xã hội', 'VHXH', ''],
    ['CB011', 'Vũ Đức Long', 'long.vu@anbinh.gov.vn', '0912 345 011', 'Giám đốc Trung tâm Phục vụ Hành chính Công', 'PVHCC', ''],
    ['CB012', 'Bùi Quang Huy', 'huy.bui@anbinh.gov.vn', '0912 345 012', 'Giám đốc Trung tâm Dịch vụ Tổng hợp', 'DVTH', ''],
    ['CB013', 'Nguyễn Văn An', 'an.nguyen@anbinh.gov.vn', '0912 345 013', 'Công chức Văn phòng - Thống kê', 'VP', ''],
    ['CB014', 'Trần Quốc Bảo', 'bao.tran@anbinh.gov.vn', '0912 345 014', 'Công chức Kế toán', 'VP', ''],
    ['CB015', 'Lê Thị Thu', 'thu.le@anbinh.gov.vn', '0912 345 015', 'Công chức Tư pháp - Hộ tịch', 'VP', ''],
    ['CB016', 'Phạm Văn Dũng', 'dung.pham@anbinh.gov.vn', '0912 345 016', 'Công chức Địa chính - Xây dựng', 'KT', ''],
    ['CB017', 'Nguyễn Thị Hương', 'huong.nguyen@anbinh.gov.vn', '0912 345 017', 'Chuyên viên Phòng Văn hóa - Xã hội', 'VHXH', ''],
    ['CB018', 'Trần Văn Sơn', 'son.tran@anbinh.gov.vn', '0912 345 018', 'Nhân viên Trung tâm Dịch vụ Tổng hợp', 'DVTH', '']
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB013',
      supplier: 'NCC-MT',
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
      location: 'TRU-SO',
      employee: 'CB016',
      supplier: 'NCC-VT',
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
      department: 'VHXH',
      location: 'KHO',
      supplier: 'NCC-MT',
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
      department: 'VP-DU',
      location: 'P-DU',
      employee: 'CB006',
      supplier: 'NCC-VT',
      purchaseDate: monthsAgo(8),
      purchasePrice: 16900000,
      warrantyMonths: 36,
      depreciationMonths: 60,
      specs: { cpu: 'Intel Core i5-13400', ram: 16, storage: 'SSD NVMe 512GB', gpu: 'Intel UHD 730', monitor: 'Dell S2421HN', os: 'Windows 11 Pro' }
    },
    {
      code: 'PC-0005',
      name: 'Máy tính để bàn HP ProDesk 600 G6',
      category: 'PC',
      serial: 'HPP600-2024-006',
      model: 'ProDesk 600 G6 SFF',
      manufacturer: 'HP',
      status: 'in_use',
      condition: 'good',
      department: 'UBKT',
      location: 'P-DU',
      employee: 'CB007',
      supplier: 'NCC-MT',
      purchaseDate: monthsAgo(26),
      purchasePrice: 15800000,
      warrantyMonths: 36,
      depreciationMonths: 60,
      specs: { cpu: 'Intel Core i5-10500', ram: 8, storage: 'SSD NVMe 256GB', gpu: 'Intel UHD 630', monitor: 'HP P22h G5', os: 'Windows 11 Pro' }
    },
    {
      code: 'PC-0006',
      name: 'Máy tính để bàn Dell OptiPlex 3000',
      category: 'PC',
      serial: 'DLL3000-2023-022',
      model: 'OptiPlex 3000 SFF',
      manufacturer: 'Dell',
      status: 'in_use',
      condition: 'good',
      department: 'MTTQ',
      location: 'P-DU',
      employee: 'CB005',
      supplier: 'NCC-MT',
      purchaseDate: monthsAgo(24),
      purchasePrice: 13900000,
      warrantyMonths: 36,
      depreciationMonths: 60,
      specs: { cpu: 'Intel Core i5-12400', ram: 8, storage: 'SSD NVMe 256GB', gpu: 'Intel UHD 730', monitor: 'Dell E2222H', os: 'Windows 11 Pro' }
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
      department: 'KT',
      location: 'TRU-SO',
      employee: 'CB009',
      supplier: 'NCC-VT',
      purchaseDate: monthsAgo(20),
      purchasePrice: 26400000,
      warrantyMonths: 36,
      depreciationMonths: 48,
      specs: { cpu: 'Intel Core i5-1245U', ram: 16, storage: 'SSD NVMe 512GB', screen: '14', os: 'Windows 11 Pro', weight: 1.4 }
    },
    {
      code: 'LAP-0002',
      name: 'Laptop Dell Latitude 7440',
      category: 'LAPTOP',
      serial: 'LAT7440-2024-009',
      model: 'Latitude 7440',
      manufacturer: 'Dell',
      status: 'in_use',
      condition: 'good',
      department: 'VP-DU',
      location: 'P-DU',
      employee: 'CB001',
      supplier: 'NCC-MT',
      purchaseDate: monthsAgo(26),
      purchasePrice: 31900000,
      warrantyMonths: 36,
      depreciationMonths: 48,
      specs: { cpu: 'Intel Core i7-1355U', ram: 16, storage: 'SSD NVMe 512GB', screen: '14', os: 'Windows 11 Pro', weight: 1.33 }
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB008',
      supplier: 'NCC-VT',
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
      department: 'BXD-D',
      location: 'KHO',
      supplier: 'NCC-BH',
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
      department: 'DVTH',
      location: 'KHO',
      supplier: 'NCC-MT',
      purchaseDate: monthsAgo(72),
      purchasePrice: 14900000,
      warrantyMonths: 24,
      depreciationMonths: 36,
      salvageValue: 500000,
      specs: { cpu: 'Intel Core i5-8265U', ram: 8, storage: 'SSD 256GB', screen: '14', os: 'Windows 10 Pro', weight: 1.5 },
      note: 'Đã thanh lý theo quyết định của UBND xã'
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB014',
      supplier: 'NCC-PA',
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
      department: 'PVHCC',
      location: 'P-TN',
      employee: 'CB011',
      supplier: 'NCC-PA',
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
      department: 'VHXH',
      location: 'KHO',
      supplier: 'NCC-PA',
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
      department: 'DVTH',
      location: 'KHO',
      supplier: 'NCC-MT',
      purchaseDate: monthsAgo(120),
      purchasePrice: 2800000,
      warrantyMonths: 12,
      depreciationMonths: 36,
      specs: { technology: 'Laser đen trắng', speed: 14, resolution: '600 x 600 dpi', paper: 'A4', connection: 'USB', color: 'Không' },
      note: 'Thất lạc sau đợt sắp xếp lại kho thiết bị'
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB015',
      supplier: 'NCC-VT',
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
      department: 'PVHCC',
      location: 'KHO',
      supplier: 'NCC-PA',
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB013',
      supplier: 'NCC-VT',
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
      department: 'VHXH',
      location: 'P-HOP',
      supplier: 'NCC-PA',
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB013',
      supplier: 'NCC-VT',
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
      department: 'DVTH',
      location: 'KHO',
      supplier: 'NCC-VT',
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
      department: 'VP-DU',
      location: 'P-DU',
      employee: 'CB006',
      supplier: 'NCC-VT',
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB013',
      supplier: 'NCC-VT',
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
      department: 'VP',
      location: 'TRU-SO',
      employee: 'CB013',
      supplier: 'NCC-MT',
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
      department: 'KT',
      location: 'TRU-SO',
      employee: 'CB009',
      supplier: 'NCC-PA',
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

  // Thiết bị phân bổ cho phòng ban (không gắn với nhân viên cụ thể)
  const departmentAssetId = assetIds['PRN-0003']
  const departmentAssetDept = ctx.departments['VHXH']
  if (departmentAssetId && departmentAssetDept) {
    db.prepare(
      `UPDATE assets SET status = 'in_use', allocation_type = 'department',
         department_id = ?, location_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(departmentAssetDept, ctx.locations['TRU-SO'] ?? null, now, departmentAssetId)
    insert(
      `INSERT INTO department_assignments
        (asset_id, department_id, assigned_date, returned_date, status, note, return_note, created_by, created_at)
       VALUES (?, ?, ?, NULL, 'active', ?, NULL, ?, ?)`,
      [
        departmentAssetId,
        departmentAssetDept,
        monthsAgo(3),
        'Phân bổ máy in cho phòng ban sử dụng, không gắn nhân viên',
        manager,
        now
      ]
    )
  }

  // Lịch sử cấp phát đã thu hồi
  const historyRows: Array<[string, string, string, string, string | null]> = [
    ['PC-0003', 'CB017', monthsAgo(18), monthsAgo(4), 'Thu hồi do nâng cấp thiết bị'],
    ['LAP-0004', 'CB003', monthsAgo(20), monthsAgo(1), 'Thu hồi để sửa chữa'],
    ['LAP-0005', 'CB012', monthsAgo(48), monthsAgo(20), 'Thu hồi do hỏng, chờ thanh lý'],
    ['SCN-0002', 'CB011', monthsAgo(12), monthsAgo(3), 'Chuyển sang kho dự phòng']
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
      provider: 'Trung tâm Bảo hành HP - Ninh Bình',
      assignee: 'Phạm Văn Dũng',
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
      provider: 'Công ty CP Thiết bị Văn phòng Phúc An',
      assignee: 'Trần Quốc Bảo',
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
      provider: 'Công ty TNHH Máy tính Minh Thành',
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
      provider: 'Văn phòng HĐND và UBND',
      assignee: 'Nguyễn Văn An',
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
      provider: 'Công ty CP Công nghệ Việt Tín',
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
      provider: 'Văn phòng HĐND và UBND',
      assignee: 'Nguyễn Văn An',
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
      provider: 'Văn phòng HĐND và UBND',
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
      'Kiểm kê thiết bị Văn phòng HĐND và UBND - Quý III',
      ctx.departments.VP,
      monthsAgo(1),
      dateOffset(-25),
      'Kiểm kê định kỳ theo quy định quản lý tài sản công',
      admin,
      stampOffset(-30, 8),
      stampOffset(-24, 17)
    ]
  )
  const auditAssets = assets.filter((a) => a.department === 'VP')
  for (const [index, asset] of auditAssets.entries()) {
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
      'Kiểm kê toàn bộ thiết bị của xã, ưu tiên thiết bị đang sử dụng',
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
    [manager, 'Cấp phát thiết bị', 'assignment', 'asset', assetIds['MON-0002'], 'Cấp phát màn hình cho Hoàng Văn Nam', stampOffset(-2, 10)],
    [admin, 'Cập nhật thông tin thiết bị', 'asset', 'asset', assetIds['UPS-0001'], 'Bổ sung ghi chú kiểm tra ắc quy', stampOffset(-3, 16)],
    [manager, 'Tạo phiên kiểm kê', 'audit', 'audit', audit2, 'Kiểm kê toàn bộ thiết bị tháng này', stampOffset(-3, 8)],
    [admin, 'Hoàn thành kiểm kê', 'audit', 'audit', audit1, 'Kiểm kê thiết bị Văn phòng HĐND và UBND - Quý III', stampOffset(-24, 17)],
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

/* --------------------- Hạ tầng CNTT & hệ thống thông tin ------------------ */

function seedInfrastructure(users: Record<string, number>): void {
  const staff = users.staff
  const admin = users.admin
  const first = stampOffset(-180, 9)
  const second = stampOffset(-45, 10)
  const current = {
    physical: 3,
    virtual: 12,
    switches: 14,
    firewalls: 2
  }

  db.prepare(
    `UPDATE it_infrastructure SET
       physical_servers = ?, virtual_servers = ?, switches = ?, firewalls = ?,
       note = ?, updated_by = ?, updated_at = ?
     WHERE id = 1`
  ).run(
    current.physical,
    current.virtual,
    current.switches,
    current.firewalls,
    'Phòng máy chủ đặt tại tầng 2 trụ sở UBND xã; hệ thống ảo hóa VMware ESXi 8.0.',
    staff,
    second
  )

  const history: Array<{
    values: typeof current
    note: string
    changedBy: number
    changedAt: string
    changes: Array<{ field: string; label: string; before: string | null; after: string | null }>
  }> = [
    {
      values: { physical: 2, virtual: 9, switches: 11, firewalls: 2 },
      note: 'Khảo sát, cập nhật số liệu hạ tầng đầu năm.',
      changedBy: admin,
      changedAt: first,
      changes: [
        { field: 'physicalServers', label: 'Số máy chủ vật lý', before: null, after: '2' },
        { field: 'virtualServers', label: 'Số máy ảo', before: null, after: '9' },
        { field: 'switches', label: 'Số switch', before: null, after: '11' },
        { field: 'firewalls', label: 'Số firewall', before: null, after: '2' }
      ]
    },
    {
      values: current,
      note: 'Bổ sung 01 máy chủ vật lý, 03 máy ảo và 03 switch cho hệ thống một cửa.',
      changedBy: staff,
      changedAt: second,
      changes: [
        { field: 'physicalServers', label: 'Số máy chủ vật lý', before: '2', after: '3' },
        { field: 'virtualServers', label: 'Số máy ảo', before: '9', after: '12' },
        { field: 'switches', label: 'Số switch', before: '11', after: '14' }
      ]
    }
  ]

  for (const entry of history) {
    const userName = db
      .prepare('SELECT full_name FROM users WHERE id = ?')
      .get(entry.changedBy) as { full_name: string } | undefined
    insert(
      `INSERT INTO it_infrastructure_history
        (physical_servers, virtual_servers, switches, firewalls, note, changes,
         changed_by, changed_by_name, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.values.physical,
        entry.values.virtual,
        entry.values.switches,
        entry.values.firewalls,
        entry.note,
        JSON.stringify(entry.changes),
        entry.changedBy,
        userName?.full_name ?? null,
        entry.changedAt
      ]
    )
  }
}

interface SeedSystem {
  code: string
  name: string
  description: string
  unit: string
  department: string
  level: number | null
  decision?: string | null
  decisionDate?: string | null
  agency?: string | null
  status: 'operating' | 'building' | 'suspended'
  hosting: 'none' | 'physical' | 'virtual' | 'cloud' | 'hybrid'
  hostingDetail?: string | null
  updatedDaysAgo: number
}

function seedSystems(
  users: Record<string, number>,
  departments: Record<string, number>
): void {
  const rows: SeedSystem[] = [
    {
      code: 'HTTT-0001',
      name: 'Hệ thống Quản lý văn bản và Điều hành',
      description:
        'Tiếp nhận, xử lý văn bản đi - đến; quản lý hồ sơ công việc và điều hành tác nghiệp của UBND xã.',
      unit: 'Văn phòng HĐND và UBND',
      department: 'VP',
      level: 3,
      decision: '85/QĐ-UBND',
      decisionDate: monthsAgo(14),
      agency: 'UBND xã An Bình',
      status: 'operating',
      hosting: 'virtual',
      hostingDetail: 'Máy chủ ảo ESXi-01 (10.10.1.21)',
      updatedDaysAgo: 2
    },
    {
      code: 'HTTT-0002',
      name: 'Cổng thông tin điện tử xã An Bình',
      description:
        'Công bố thông tin, tin tức, thủ tục hành chính và tương tác với người dân trên môi trường mạng.',
      unit: 'Văn phòng HĐND và UBND',
      department: 'VP',
      level: 2,
      decision: '86/QĐ-UBND',
      decisionDate: monthsAgo(13),
      agency: 'UBND xã An Bình',
      status: 'operating',
      hosting: 'cloud',
      hostingDetail: 'Thuê dịch vụ hạ tầng tại Trung tâm dữ liệu tỉnh',
      updatedDaysAgo: 5
    },
    {
      code: 'HTTT-0003',
      name: 'Hệ thống Một cửa điện tử',
      description:
        'Tiếp nhận, luân chuyển và trả kết quả giải quyết thủ tục hành chính theo cơ chế một cửa, một cửa liên thông.',
      unit: 'Trung tâm Phục vụ Hành chính Công',
      department: 'PVHCC',
      level: 3,
      decision: '87/QĐ-UBND',
      decisionDate: monthsAgo(11),
      agency: 'UBND xã An Bình',
      status: 'operating',
      hosting: 'physical',
      hostingDetail: 'Máy chủ vật lý SRV-02 tại phòng máy tầng 2',
      updatedDaysAgo: 1
    },
    {
      code: 'HTTT-0004',
      name: 'Hệ thống Quản lý cán bộ, công chức',
      description: 'Quản lý hồ sơ, quá trình công tác, đào tạo và đánh giá cán bộ, công chức.',
      unit: 'Văn phòng HĐND và UBND',
      department: 'VP',
      level: 1,
      decision: '88/QĐ-UBND',
      decisionDate: monthsAgo(10),
      agency: 'UBND xã An Bình',
      status: 'operating',
      hosting: 'virtual',
      hostingDetail: 'Máy chủ ảo ESXi-02 (10.10.1.24)',
      updatedDaysAgo: 9
    },
    {
      code: 'HTTT-0005',
      name: 'Hệ thống Kế toán tài chính',
      description: 'Hạch toán kế toán, quản lý ngân sách, tài sản và báo cáo tài chính của đơn vị.',
      unit: 'Phòng Kinh tế',
      department: 'KT',
      level: 2,
      decision: '89/QĐ-UBND',
      decisionDate: monthsAgo(9),
      agency: 'UBND xã An Bình',
      status: 'operating',
      hosting: 'virtual',
      hostingDetail: 'Máy chủ ảo ESXi-01 (10.10.1.22)',
      updatedDaysAgo: 15
    },
    {
      code: 'HTTT-0006',
      name: 'Hệ thống Quản lý đất đai',
      description: 'Quản lý hồ sơ địa chính, biến động đất đai và cấp giấy chứng nhận quyền sử dụng đất.',
      unit: 'Phòng Kinh tế',
      department: 'KT',
      level: 3,
      decision: '90/QĐ-UBND',
      decisionDate: null,
      agency: null,
      status: 'operating',
      hosting: 'physical',
      hostingDetail: 'Máy chủ vật lý SRV-03 tại phòng máy tầng 2',
      updatedDaysAgo: 22
    },
    {
      code: 'HTTT-0007',
      name: 'Hệ thống Thư điện tử công vụ',
      description: 'Hộp thư điện tử công vụ phục vụ trao đổi văn bản giữa các cơ quan nhà nước.',
      unit: 'Văn phòng HĐND và UBND',
      department: 'VP',
      level: 2,
      decision: '91/QĐ-UBND',
      decisionDate: monthsAgo(8),
      agency: 'Sở Thông tin và Truyền thông',
      status: 'operating',
      hosting: 'cloud',
      hostingDetail: 'Nền tảng thư điện tử dùng chung của tỉnh',
      updatedDaysAgo: 30
    },
    {
      code: 'HTTT-0008',
      name: 'Hệ thống Quản lý hồ sơ sức khỏe',
      description: 'Quản lý hồ sơ sức khỏe, khám chữa bệnh ban đầu và chính sách bảo hiểm y tế.',
      unit: 'Phòng Văn hóa - Xã hội',
      department: 'VHXH',
      level: null,
      decision: null,
      decisionDate: null,
      agency: null,
      status: 'building',
      hosting: 'none',
      hostingDetail: null,
      updatedDaysAgo: 4
    },
    {
      code: 'HTTT-0009',
      name: 'Hệ thống Giám sát camera an ninh',
      description: 'Giám sát hình ảnh tại trụ sở và các khu vực công cộng trên địa bàn xã.',
      unit: 'Trung tâm Dịch vụ Tổng hợp',
      department: 'DVTH',
      level: null,
      decision: null,
      decisionDate: null,
      agency: null,
      status: 'operating',
      hosting: 'hybrid',
      hostingDetail: 'Đầu ghi hình tại trụ sở, lưu trữ đám mây',
      updatedDaysAgo: 12
    },
    {
      code: 'HTTT-0010',
      name: 'Hệ thống Quản lý tài sản công',
      description: 'Quản lý, theo dõi biến động tài sản công của đơn vị và báo cáo định kỳ.',
      unit: 'Văn phòng HĐND và UBND',
      department: 'VP',
      level: 4,
      decision: '92/QĐ-UBND',
      decisionDate: monthsAgo(6),
      agency: 'UBND huyện',
      status: 'operating',
      hosting: 'hybrid',
      hostingDetail: 'Máy chủ vật lý SRV-01 và sao lưu đám mây',
      updatedDaysAgo: 3
    }
  ]

  const admin = users.admin
  for (const row of rows) {
    const createdAt = stampOffset(-200, 10)
    const updatedAt = stampOffset(-row.updatedDaysAgo, 11)
    const departmentId = departments[row.department] ?? null
    const searchText = normalizeForSearch(
      [
        row.code,
        row.name,
        row.description,
        row.unit,
        row.decision,
        row.agency
      ]
        .filter(Boolean)
        .join(' ')
    )
    insert(
      `INSERT INTO information_systems
        (code, name, description, managing_unit, department_id, level, decision_number,
         decision_date, decision_agency, status, hosting_type, hosting_detail, asset_id,
         search_text, is_deleted, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?)`,
      [
        row.code,
        row.name,
        row.description,
        row.unit,
        departmentId,
        row.level,
        row.decision ?? null,
        row.decisionDate ?? null,
        row.agency ?? null,
        row.status,
        row.hosting,
        row.hostingDetail ?? null,
        searchText,
        admin,
        createdAt,
        updatedAt
      ]
    )
  }

  const logEntries: Array<[string, string, string, string]> = [
    ['Cập nhật HTTT', 'HTTT-0003', 'HTTT-0003 - Hệ thống Một cửa điện tử', 'Bổ sung hình thức triển khai máy chủ vật lý'],
    ['Tạo HTTT', 'HTTT-0010', 'HTTT-0010 - Hệ thống Quản lý tài sản công', 'Cấp độ 4; QĐ 92/QĐ-UBND'],
    ['Tạo HTTT', 'HTTT-0008', 'HTTT-0008 - Hệ thống Quản lý hồ sơ sức khỏe', 'Chưa xác định cấp độ; Đang xây dựng']
  ]
  for (const [action, code, label, details] of logEntries) {
    const target = db
      .prepare('SELECT id FROM information_systems WHERE code = ?')
      .get(code) as { id: number } | undefined
    const userRow = db
      .prepare('SELECT username FROM users WHERE id = ?')
      .get(admin) as { username: string } | undefined
    insert(
      `INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, entity_label, details, created_at)
       VALUES (?, ?, ?, 'information_system', ?, ?, ?, ?)`,
      [
        admin,
        userRow?.username ?? null,
        action,
        target?.id ?? null,
        label,
        details,
        stampOffset(-3, 9)
      ]
    )
  }
}
