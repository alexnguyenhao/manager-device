import type {
  AllocationType,
  Asset,
  AssetAttachment,
  AssetDetail,
  AssetInput,
  AssetListParams,
  AssetStatus,
  AuthUser,
  DepartmentAssignment,
  PageResult
} from '../../shared/types'
import {
  addMonths,
  computeDepreciation,
  daysBetween,
  normalizeForSearch,
  nowISO,
  todayISO
} from '../../shared/utils'
import { conflict, notFound } from '../lib/errors'
import { getDb, transaction } from '../db/database'
import { nextAssetCode } from './code.service'
import { logActivity } from './log.service'
import { refreshAssetSearch } from './asset-search'
import { closeActiveAssignments, getActiveAssignment, insertAssignment } from './assignment.core'
import { listAssignments } from './assignment.service'
import { listMaintenance } from './maintenance.service'
import { basename, join } from 'node:path'
import { existsSync, unlinkSync } from 'node:fs'
import { uploadsDir } from '../lib/paths'

const ASSET_SELECT = `
  SELECT a.*, c.name AS category_name, c.prefix AS category_prefix,
         d.name AS department_name, d.block AS department_block,
         l.name AS location_name,
         e.full_name AS assigned_employee_name, s.name AS supplier_name,
         u.full_name AS created_by_name,
         (SELECT da.assigned_date FROM department_assignments da
           WHERE da.asset_id = a.id AND da.status = 'active'
           ORDER BY da.id DESC LIMIT 1) AS allocated_at
  FROM assets a
  JOIN categories c ON c.id = a.category_id
  LEFT JOIN departments d ON d.id = a.department_id
  LEFT JOIN locations l ON l.id = a.location_id
  LEFT JOIN employees e ON e.id = a.assigned_employee_id
  LEFT JOIN suppliers s ON s.id = a.supplier_id
  LEFT JOIN users u ON u.id = a.created_by
`

export interface AssetRow {
  id: number
  code: string
  name: string
  category_id: number
  category_name: string
  category_prefix: string
  serial_number: string | null
  model: string | null
  manufacturer: string | null
  status: AssetStatus
  condition: Asset['condition']
  department_id: number | null
  department_name: string | null
  department_block: Asset['departmentBlock']
  location_id: number | null
  location_name: string | null
  assigned_employee_id: number | null
  assigned_employee_name: string | null
  allocation_type: AllocationType
  allocated_at: string | null
  supplier_id: number | null
  supplier_name: string | null
  purchase_date: string | null
  purchase_price: number
  invoice_number: string | null
  warranty_start: string | null
  warranty_months: number
  warranty_expiry: string | null
  depreciation_months: number
  salvage_value: number
  specs: string
  note: string | null
  image_path: string | null
  created_by: number | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

function parseSpecs(value: string): Record<string, string | number> {
  try {
    const parsed = JSON.parse(value || '{}')
    if (parsed && typeof parsed === 'object') {
      const result: Record<string, string | number> = {}
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'string' || typeof val === 'number') result[key] = val
      }
      return result
    }
  } catch {
    // dữ liệu cũ có thể không hợp lệ
  }
  return {}
}

export function mapAsset(row: AssetRow): Asset {
  const depreciation = computeDepreciation(
    {
      purchaseDate: row.purchase_date,
      purchasePrice: Number(row.purchase_price) || 0,
      depreciationMonths: Number(row.depreciation_months) || 0,
      salvageValue: Number(row.salvage_value) || 0
    },
    todayISO()
  )
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    categoryPrefix: row.category_prefix,
    serialNumber: row.serial_number,
    model: row.model,
    manufacturer: row.manufacturer,
    status: row.status,
    condition: row.condition,
    departmentId: row.department_id ? Number(row.department_id) : null,
    departmentName: row.department_name,
    departmentBlock: row.department_block ?? null,
    locationId: row.location_id ? Number(row.location_id) : null,
    locationName: row.location_name,
    assignedEmployeeId: row.assigned_employee_id ? Number(row.assigned_employee_id) : null,
    assignedEmployeeName: row.assigned_employee_name,
    allocationType: (row.allocation_type as AllocationType) ?? 'none',
    allocatedAt: row.allocated_at ?? null,
    supplierId: row.supplier_id ? Number(row.supplier_id) : null,
    supplierName: row.supplier_name,
    purchaseDate: row.purchase_date,
    purchasePrice: Number(row.purchase_price) || 0,
    invoiceNumber: row.invoice_number,
    warrantyStart: row.warranty_start,
    warrantyMonths: Number(row.warranty_months) || 0,
    warrantyExpiry: row.warranty_expiry,
    depreciationMonths: Number(row.depreciation_months) || 0,
    salvageValue: Number(row.salvage_value) || 0,
    specs: parseSpecs(row.specs),
    note: row.note,
    imagePath: row.image_path,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentValue: depreciation.currentValue,
    accumulatedDepreciation: depreciation.accumulatedDepreciation,
    monthlyDepreciation: depreciation.monthlyDepreciation,
    ageMonths: depreciation.ageMonths,
    warrantyDaysLeft: row.warranty_expiry ? daysBetween(todayISO(), row.warranty_expiry) : null
  }
}

function buildWhere(params: AssetListParams): { sql: string; values: Array<string | number> } {
  const where: string[] = []
  const values: Array<string | number> = []
  const statuses: AssetStatus[] = [
    'available',
    'in_use',
    'maintenance',
    'reserved',
    'disposed',
    'lost'
  ]

  if (params.search?.trim()) {
    const terms = normalizeForSearch(params.search)
      .split(' ')
      .filter(Boolean)
      .slice(0, 8)
    for (const term of terms) {
      where.push('a.search_text LIKE ?')
      values.push(`%${term}%`)
    }
  }
  if (params.categoryId) {
    where.push('a.category_id = ?')
    values.push(params.categoryId)
  }
  if (params.departmentId) {
    where.push('a.department_id = ?')
    values.push(params.departmentId)
  }
  if (params.block) {
    where.push('a.department_id IN (SELECT id FROM departments WHERE block = ?)')
    values.push(params.block)
  }
  if (params.locationId) {
    where.push('a.location_id = ?')
    values.push(params.locationId)
  }
  if (params.status && params.status !== 'all' && statuses.includes(params.status)) {
    where.push('a.status = ?')
    values.push(params.status)
  }
  if (params.condition && params.condition !== 'all') {
    where.push('a.condition = ?')
    values.push(params.condition)
  }
  if (params.supplierId) {
    where.push('a.supplier_id = ?')
    values.push(params.supplierId)
  }
  if (params.assignedEmployeeId) {
    where.push('a.assigned_employee_id = ?')
    values.push(params.assignedEmployeeId)
  }
  if (params.allocationType && params.allocationType !== 'all') {
    where.push('a.allocation_type = ?')
    values.push(params.allocationType)
  }
  if (params.ids && params.ids.length > 0) {
    where.push(`a.id IN (${params.ids.map(() => '?').join(',')})`)
    values.push(...params.ids)
  }
  if (params.warrantyExpiringDays && params.warrantyExpiringDays > 0) {
    const today = todayISO()
    const limit = dateOffset(params.warrantyExpiringDays)
    where.push('a.warranty_expiry IS NOT NULL AND a.warranty_expiry >= ? AND a.warranty_expiry <= ?')
    values.push(today, limit)
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', values }
}

function dateOffset(days: number): string {
  const date = new Date(`${todayISO()}T00:00:00`)
  date.setDate(date.getDate() + days)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const SORT_COLUMNS: Record<string, string> = {
  code: 'a.code',
  name: 'a.name',
  purchaseDate: 'a.purchase_date',
  purchasePrice: 'a.purchase_price',
  createdAt: 'a.created_at',
  status: 'a.status'
}

export function listAssets(params: AssetListParams): PageResult<Asset> {
  const db = getDb()
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(500, Math.max(5, Number(params.pageSize) || 15))
  const { sql: whereSql, values } = buildWhere(params)
  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS count FROM assets a ${whereSql}`).get(...values) as { count: number })
      .count
  )
  const sortColumn = SORT_COLUMNS[params.sortBy ?? 'createdAt'] ?? 'a.created_at'
  const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'
  const rows = db
    .prepare(`${ASSET_SELECT} ${whereSql} ORDER BY ${sortColumn} ${sortDir}, a.id DESC LIMIT ? OFFSET ?`)
    .all(...values, pageSize, (page - 1) * pageSize) as unknown as AssetRow[]

  return {
    items: rows.map(mapAsset),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export function listAllAssets(params: AssetListParams): Asset[] {
  const db = getDb()
  const { sql: whereSql, values } = buildWhere(params)
  const sortColumn = SORT_COLUMNS[params.sortBy ?? 'createdAt'] ?? 'a.created_at'
  const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'
  const rows = db
    .prepare(`${ASSET_SELECT} ${whereSql} ORDER BY ${sortColumn} ${sortDir}, a.id DESC LIMIT 20000`)
    .all(...values) as unknown as AssetRow[]
  return rows.map(mapAsset)
}

export function getAssetRow(id: number): AssetRow {
  const row = getDb().prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(id) as unknown as
    | AssetRow
    | undefined
  if (!row) throw notFound('thiết bị')
  return row
}

export function getAssetDetail(id: number): AssetDetail {
  const row = getAssetRow(id)
  const asset = mapAsset(row)
  const attachments = listAttachments(id)
  const assignments = listAssignments({ assetId: id, pageSize: 100 }).items
  const maintenance = listMaintenance({ assetId: id, pageSize: 100 }).items
  const logs = getDb()
    .prepare(
      `SELECT id, user_id, username, action, entity_type, entity_id, entity_label, details, created_at
       FROM activity_logs WHERE entity_type = 'asset' AND entity_id = ?
       ORDER BY id DESC LIMIT 50`
    )
    .all(id) as Array<{
    id: number
    user_id: number | null
    username: string | null
    action: string
    entity_type: string
    entity_id: number | null
    entity_label: string | null
    details: string | null
    created_at: string
  }>

  return {
    asset,
    attachments,
    assignments,
    departmentAssignments: listDepartmentAssignments(id),
    maintenance,
    logs: logs.map((log) => ({
      id: Number(log.id),
      userId: log.user_id ? Number(log.user_id) : null,
      username: log.username,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id ? Number(log.entity_id) : null,
      entityLabel: log.entity_label,
      details: log.details,
      createdAt: log.created_at
    }))
  }
}

export function getAssetsByIds(ids: number[]): Asset[] {
  if (!ids.length) return []
  const rows = getDb()
    .prepare(`${ASSET_SELECT} WHERE a.id IN (${ids.map(() => '?').join(',')}) ORDER BY a.code`)
    .all(...ids) as unknown as AssetRow[]
  return rows.map(mapAsset)
}

export function suggestAssetCode(categoryId?: number): string {
  if (!categoryId) return nextAssetCode('TB')
  const category = getDb()
    .prepare('SELECT prefix FROM categories WHERE id = ?')
    .get(categoryId) as { prefix: string } | undefined
  return nextAssetCode(category?.prefix ?? 'TB')
}

function sanitizeSpecs(specs?: Record<string, string | number>): string {
  if (!specs) return '{}'
  const result: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(specs)) {
    if (value === null || value === undefined || value === '') continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    result[key] = value
  }
  return JSON.stringify(result)
}

interface CategoryDefaults {
  id: number
  prefix: string
  default_depreciation_months: number
  default_warranty_months: number
  is_active: number
}

function getCategory(id: number, allowInactive = false): CategoryDefaults {
  const category = getDb()
    .prepare(
      'SELECT id, prefix, default_depreciation_months, default_warranty_months, is_active FROM categories WHERE id = ?'
    )
    .get(id) as CategoryDefaults | undefined
  if (!category) throw notFound('danh mục thiết bị')
  if (!allowInactive && !Number(category.is_active)) {
    throw conflict('Danh mục thiết bị đã ngừng sử dụng.')
  }
  return category
}

function employeeInfo(
  id: number,
  allowInactive = false
): { id: number; department_id: number | null; is_active: number; full_name: string } {
  const employee = getDb()
    .prepare('SELECT id, department_id, is_active, full_name FROM employees WHERE id = ?')
    .get(id) as
    | { id: number; department_id: number | null; is_active: number; full_name: string }
    | undefined
  if (!employee) throw notFound('nhân viên')
  if (!allowInactive && !Number(employee.is_active)) {
    throw conflict('Nhân viên đã ngừng làm việc.')
  }
  return employee
}

function validateDates(input: AssetInput): void {
  if (input.purchaseDate && input.warrantyStart && input.warrantyStart < input.purchaseDate) {
    // Cho phép bảo hành bắt đầu trước ngày mua (mua lại/khai báo bổ sung) nhưng cảnh báo qua dữ liệu.
  }
  if (input.purchasePrice !== undefined && input.purchasePrice < 0) {
    throw conflict('Giá mua không được âm.')
  }
  if (input.salvageValue !== undefined && input.salvageValue < 0) {
    throw conflict('Giá trị thanh lý không được âm.')
  }
  if (
    input.purchasePrice !== undefined &&
    input.salvageValue !== undefined &&
    input.salvageValue > input.purchasePrice
  ) {
    throw conflict('Giá trị thanh lý không được lớn hơn giá mua.')
  }
}

/* ---------------------- Department-level allocation --------------------- */

interface ActiveDepartmentAssignment {
  id: number
  asset_id: number
  department_id: number
}

export function listDepartmentAssignments(assetId: number): DepartmentAssignment[] {
  const rows = getDb()
    .prepare(
      `SELECT da.*, d.name AS department_name, u.full_name AS created_by_name
       FROM department_assignments da
       JOIN departments d ON d.id = da.department_id
       LEFT JOIN users u ON u.id = da.created_by
       WHERE da.asset_id = ? ORDER BY da.id DESC`
    )
    .all(assetId) as Array<{
    id: number
    asset_id: number
    department_id: number
    department_name: string
    assigned_date: string
    returned_date: string | null
    status: 'active' | 'returned'
    note: string | null
    return_note: string | null
    created_by_name: string | null
    created_at: string
  }>
  return rows.map((row) => ({
    id: Number(row.id),
    assetId: Number(row.asset_id),
    departmentId: Number(row.department_id),
    departmentName: row.department_name,
    assignedDate: row.assigned_date,
    returnedDate: row.returned_date,
    status: row.status,
    note: row.note,
    returnNote: row.return_note,
    createdByName: row.created_by_name,
    createdAt: row.created_at
  }))
}

function getActiveDepartmentAssignment(assetId: number): ActiveDepartmentAssignment | undefined {
  return getDb()
    .prepare(
      `SELECT id, asset_id, department_id FROM department_assignments
       WHERE asset_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`
    )
    .get(assetId) as ActiveDepartmentAssignment | undefined
}

function insertDepartmentAssignment(input: {
  assetId: number
  departmentId: number
  assignedDate: string
  note: string | null
  userId: number
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO department_assignments
        (asset_id, department_id, assigned_date, returned_date, status, note, created_by, created_at)
       VALUES (?, ?, ?, NULL, 'active', ?, ?, ?)`
    )
    .run(
      input.assetId,
      input.departmentId,
      input.assignedDate,
      input.note,
      input.userId,
      nowISO()
    )
  return Number(result.lastInsertRowid)
}

function closeActiveDepartmentAssignments(
  assetId: number,
  returnedDate: string,
  returnNote: string | null
): void {
  getDb()
    .prepare(
      `UPDATE department_assignments
       SET status = 'returned', returned_date = ?, return_note = ?
       WHERE asset_id = ? AND status = 'active'`
    )
    .run(returnedDate, returnNote, assetId)
}

function normalizeAllocationType(
  requested: AllocationType | undefined,
  employeeId: number | null,
  existing?: { allocation_type: AllocationType; assigned_employee_id: number | null }
): AllocationType {
  if (requested === 'department') return 'department'
  if (requested === 'employee') return employeeId ? 'employee' : 'none'
  if (requested === 'none') return employeeId ? 'employee' : 'none'
  if (employeeId) return 'employee'
  if (existing?.allocation_type === 'department') return 'department'
  if (existing?.assigned_employee_id) return 'employee'
  return 'none'
}

export function createAsset(input: AssetInput, user: AuthUser): Asset {
  const db = getDb()
  validateDates(input)
  const category = getCategory(input.categoryId)
  const code = (input.code?.trim() || suggestAssetCode(input.categoryId)).toUpperCase()
  const exists = db.prepare('SELECT id FROM assets WHERE code = ?').get(code)
  if (exists) throw conflict(`Mã thiết bị "${code}" đã tồn tại.`)

  let status: AssetStatus =
    input.status ??
    (input.allocationType === 'department' || input.assignedEmployeeId ? 'in_use' : 'available')
  let employeeId = input.assignedEmployeeId ?? null
  let departmentId = input.departmentId ?? null
  let employee: ReturnType<typeof employeeInfo> | null = null
  let allocationType = normalizeAllocationType(input.allocationType, employeeId)

  if (allocationType === 'employee' && employeeId) {
    employee = employeeInfo(employeeId)
    if (!departmentId) departmentId = employee.department_id ? Number(employee.department_id) : null
  }
  if (allocationType === 'department') {
    if (!departmentId) {
      throw conflict('Vui lòng chọn phòng ban, đơn vị khi phân bổ thiết bị cho phòng ban.')
    }
    const department = db
      .prepare('SELECT id, name, is_active FROM departments WHERE id = ?')
      .get(departmentId) as { id: number; name: string; is_active: number } | undefined
    if (!department) throw notFound('phòng ban, đơn vị')
    if (!Number(department.is_active)) {
      throw conflict('Phòng ban đã ngừng sử dụng, không thể phân bổ thiết bị.')
    }
    employeeId = null
    employee = null
    if (status !== 'maintenance') status = 'in_use'
  }
  if (status === 'in_use' && allocationType === 'none') {
    throw conflict(
      'Vui lòng chọn người sử dụng hoặc phòng ban được phân bổ khi thiết bị ở trạng thái "Đang sử dụng".'
    )
  }
  if (status !== 'in_use' && status !== 'maintenance') {
    employeeId = null
    allocationType = 'none'
  }
  if (status === 'maintenance' && employeeId && !input.assignedEmployeeId) {
    employeeId = null
    allocationType = 'none'
  }
  if (status === 'disposed' || status === 'lost' || status === 'available' || status === 'reserved') {
    employeeId = null
    allocationType = 'none'
  }

  const warrantyMonths = input.warrantyMonths ?? Number(category.default_warranty_months) ?? 0
  const depreciationMonths =
    input.depreciationMonths ?? Number(category.default_depreciation_months) ?? 0
  const warrantyStart = input.warrantyStart ?? input.purchaseDate ?? null
  const warrantyExpiry = addMonths(warrantyStart, warrantyMonths)
  const now = nowISO()

  let assetId = 0
  transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO assets
          (code, name, category_id, serial_number, model, manufacturer, status, condition,
           department_id, location_id, assigned_employee_id, allocation_type, supplier_id,
           purchase_date, purchase_price, invoice_number, warranty_start, warranty_months, warranty_expiry,
           depreciation_months, salvage_value, specs, note, image_path, search_text, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`
      )
      .run(
        code,
        input.name.trim(),
        input.categoryId,
        input.serialNumber ?? null,
        input.model ?? null,
        input.manufacturer ?? null,
        status,
        input.condition ?? 'good',
        departmentId,
        input.locationId ?? null,
        employeeId,
        allocationType,
        input.supplierId ?? null,
        input.purchaseDate ?? null,
        input.purchasePrice ?? 0,
        input.invoiceNumber ?? null,
        warrantyStart,
        warrantyMonths,
        warrantyExpiry,
        depreciationMonths,
        input.salvageValue ?? 0,
        sanitizeSpecs(input.specs),
        input.note ?? null,
        input.imagePath ?? null,
        user.id,
        now,
        now
      )
    assetId = Number(result.lastInsertRowid)

    if (allocationType === 'employee' && status === 'in_use' && employeeId) {
      insertAssignment({
        assetId,
        employeeId,
        departmentId,
        assignedDate: todayISO(),
        expectedReturnDate: null,
        conditionBefore: input.condition ?? 'good',
        note: 'Cấp phát khi tạo thiết bị',
        userId: user.id
      })
    }
    if (allocationType === 'department' && departmentId) {
      insertDepartmentAssignment({
        assetId,
        departmentId,
        assignedDate: todayISO(),
        note: 'Phân bổ cho phòng ban khi tạo thiết bị',
        userId: user.id
      })
    }
  })

  refreshAssetSearch(assetId)
  logActivity(
    user,
    'Tạo thiết bị',
    'asset',
    assetId,
    `${code} - ${input.name}`,
    `Danh mục: ${category.prefix}${employee ? `, nhân viên: ${employee.full_name}` : ''}${
      allocationType === 'department' ? ', phân bổ cho phòng ban' : ''
    }`
  )
  return getAssetDetail(assetId).asset
}

interface UpdateAssignmentPlan {
  closeEmployeeAssignment: boolean
  createEmployeeFor: number | null
  closeDepartmentAssignment: boolean
  createDepartmentFor: number | null
  employeeId: number | null
  departmentId: number | null
  allocationType: AllocationType
}

function planAssignments(
  existing: AssetRow,
  status: AssetStatus,
  allocationType: AllocationType,
  employeeId: number | null,
  departmentId: number | null
): UpdateAssignmentPlan {
  const activeEmployee = getActiveAssignment(Number(existing.id))
  const activeDepartment = getActiveDepartmentAssignment(Number(existing.id))
  const plan: UpdateAssignmentPlan = {
    closeEmployeeAssignment: false,
    createEmployeeFor: null,
    closeDepartmentAssignment: false,
    createDepartmentFor: null,
    employeeId,
    departmentId,
    allocationType
  }

  if (status === 'available' || status === 'disposed' || status === 'lost' || status === 'reserved') {
    plan.closeEmployeeAssignment = Boolean(activeEmployee)
    plan.closeDepartmentAssignment = Boolean(activeDepartment)
    plan.employeeId = null
    plan.allocationType = 'none'
    return plan
  }

  if (allocationType === 'department') {
    plan.closeEmployeeAssignment = Boolean(activeEmployee)
    plan.employeeId = null
    if (!departmentId) return plan
    if (!activeDepartment) {
      plan.createDepartmentFor = departmentId
    } else if (Number(activeDepartment.department_id) !== Number(departmentId)) {
      plan.closeDepartmentAssignment = true
      plan.createDepartmentFor = departmentId
    }
    return plan
  }

  // Mọi hình thức khác đều thu hồi phân bổ phòng ban đang mở.
  plan.closeDepartmentAssignment = Boolean(activeDepartment)

  if (allocationType === 'none' || employeeId === null) {
    plan.closeEmployeeAssignment = Boolean(activeEmployee)
    plan.employeeId = null
    plan.allocationType = 'none'
    return plan
  }

  if (!activeEmployee) {
    plan.createEmployeeFor = employeeId
  } else if (Number(activeEmployee.employeeId) !== Number(employeeId)) {
    plan.closeEmployeeAssignment = true
    plan.createEmployeeFor = employeeId
  }
  plan.employeeId = employeeId
  plan.allocationType = 'employee'

  if (!departmentId) {
    const employee = getDb()
      .prepare('SELECT department_id FROM employees WHERE id = ?')
      .get(employeeId) as { department_id: number | null } | undefined
    plan.departmentId = employee?.department_id ? Number(employee.department_id) : null
  }
  return plan
}

export function updateAsset(id: number, input: AssetInput, user: AuthUser): Asset {
  const existing = getAssetRow(id)
  validateDates(input)
  const category = getCategory(
    input.categoryId,
    Number(existing.category_id) === Number(input.categoryId)
  )
  const code = (input.code?.trim() || existing.code).toUpperCase()
  const duplicate = getDb().prepare('SELECT id FROM assets WHERE code = ? AND id <> ?').get(code, id)
  if (duplicate) throw conflict(`Mã thiết bị "${code}" đã tồn tại.`)

  let status: AssetStatus = input.status ?? existing.status
  let employeeId = input.assignedEmployeeId ?? null
  let departmentId = input.departmentId ?? (existing.department_id ? Number(existing.department_id) : null)
  let employee: ReturnType<typeof employeeInfo> | null = null
  const currentEmployeeId = existing.assigned_employee_id
    ? Number(existing.assigned_employee_id)
    : null
  let allocationType = normalizeAllocationType(input.allocationType, employeeId, {
    allocation_type: (existing.allocation_type as AllocationType) ?? 'none',
    assigned_employee_id: currentEmployeeId
  })

  if (allocationType === 'employee') {
    if (!employeeId) {
      if (status === 'in_use') {
        throw conflict('Vui lòng chọn người sử dụng khi thiết bị ở trạng thái "Đang sử dụng".')
      }
      allocationType = 'none'
    } else {
      employee = employeeInfo(employeeId, currentEmployeeId === employeeId)
      if (!departmentId) {
        departmentId = employee.department_id ? Number(employee.department_id) : null
      }
    }
  }

  if (allocationType === 'department') {
    if (!departmentId) {
      throw conflict('Vui lòng chọn phòng ban, đơn vị khi phân bổ thiết bị cho phòng ban.')
    }
    const department = getDb()
      .prepare('SELECT id, is_active FROM departments WHERE id = ?')
      .get(departmentId) as { id: number; is_active: number } | undefined
    if (!department) throw notFound('phòng ban, đơn vị')
    const isCurrentDepartment = Number(existing.department_id) === Number(departmentId)
    if (!Number(department.is_active) && !isCurrentDepartment) {
      throw conflict('Phòng ban đã ngừng sử dụng, không thể phân bổ thiết bị.')
    }
    employeeId = null
    employee = null
    if (status !== 'maintenance') status = 'in_use'
  }

  if (status === 'in_use' && allocationType === 'none') {
    throw conflict(
      'Vui lòng chọn người sử dụng hoặc phòng ban được phân bổ khi thiết bị ở trạng thái "Đang sử dụng".'
    )
  }
  if (status !== 'in_use' && status !== 'maintenance') {
    employeeId = null
    allocationType = 'none'
  }

  const warrantyMonths = input.warrantyMonths ?? Number(existing.warranty_months) ?? 0
  const depreciationMonths = input.depreciationMonths ?? Number(existing.depreciation_months) ?? 0
  const warrantyStart = input.warrantyStart ?? input.purchaseDate ?? existing.warranty_start
  const warrantyExpiry = addMonths(warrantyStart, warrantyMonths)
  const condition = input.condition ?? existing.condition
  const plan = planAssignments(existing, status, allocationType, employeeId, departmentId)
  employeeId = plan.employeeId
  const now = nowISO()

  transaction(() => {
    if (plan.closeEmployeeAssignment) {
      closeActiveAssignments(
        id,
        todayISO(),
        condition,
        'Thu hồi tự động khi cập nhật trạng thái thiết bị'
      )
    }
    if (plan.closeDepartmentAssignment) {
      closeActiveDepartmentAssignments(
        id,
        todayISO(),
        'Thu hồi tự động khi cập nhật hình thức phân bổ'
      )
    }
    if (plan.createEmployeeFor) {
      insertAssignment({
        assetId: id,
        employeeId: plan.createEmployeeFor,
        departmentId: plan.departmentId,
        assignedDate: todayISO(),
        expectedReturnDate: null,
        conditionBefore: condition,
        note: 'Cấp phát khi cập nhật thiết bị',
        userId: user.id
      })
    }
    if (plan.createDepartmentFor) {
      insertDepartmentAssignment({
        assetId: id,
        departmentId: plan.createDepartmentFor,
        assignedDate: todayISO(),
        note: 'Phân bổ cho phòng ban khi cập nhật thiết bị',
        userId: user.id
      })
    }

    getDb()
      .prepare(
        `UPDATE assets SET
          code = ?, name = ?, category_id = ?, serial_number = ?, model = ?, manufacturer = ?,
          status = ?, condition = ?, department_id = ?, location_id = ?, assigned_employee_id = ?,
          allocation_type = ?, supplier_id = ?, purchase_date = ?, purchase_price = ?, invoice_number = ?,
          warranty_start = ?, warranty_months = ?, warranty_expiry = ?, depreciation_months = ?,
          salvage_value = ?, specs = ?, note = ?, image_path = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        code,
        input.name.trim(),
        input.categoryId,
        input.serialNumber ?? null,
        input.model ?? null,
        input.manufacturer ?? null,
        status,
        condition,
        plan.departmentId,
        input.locationId ?? null,
        employeeId,
        plan.allocationType,
        input.supplierId ?? null,
        input.purchaseDate ?? null,
        input.purchasePrice ?? 0,
        input.invoiceNumber ?? null,
        warrantyStart,
        warrantyMonths,
        warrantyExpiry,
        depreciationMonths,
        input.salvageValue ?? 0,
        sanitizeSpecs(input.specs),
        input.note ?? null,
        input.imagePath ?? existing.image_path,
        now,
        id
      )
  })

  refreshAssetSearch(id)
  const changes: string[] = []
  if (existing.status !== status) changes.push(`trạng thái: ${existing.status} → ${status}`)
  if (Number(existing.category_id) !== Number(input.categoryId)) {
    changes.push(`danh mục: ${existing.category_name} → ${category.prefix}`)
  }
  if (Number(existing.assigned_employee_id ?? 0) !== Number(employeeId ?? 0)) {
    changes.push(`người sử dụng: ${existing.assigned_employee_name ?? 'Không'} → ${employee?.full_name ?? 'Không'}`)
  }
  const previousAllocation = (existing.allocation_type as AllocationType) ?? 'none'
  if (previousAllocation !== plan.allocationType) {
    changes.push(`hình thức phân bổ: ${previousAllocation} → ${plan.allocationType}`)
  }
  if (previousAllocation === 'department' && plan.allocationType === 'department') {
    const previousDepartment = existing.department_id ? Number(existing.department_id) : null
    if (previousDepartment !== (plan.departmentId ? Number(plan.departmentId) : null)) {
      changes.push(`phòng ban được phân bổ: ${existing.department_name ?? 'Không'} → ${plan.departmentId ?? 'Không'}`)
    }
  }
  logActivity(
    user,
    'Cập nhật thiết bị',
    'asset',
    id,
    `${code} - ${input.name}`,
    changes.length ? changes.join('; ') : null
  )
  return getAssetDetail(id).asset
}

export function updateAssetStatus(
  id: number,
  status: AssetStatus,
  user: AuthUser,
  note?: string
): Asset {
  const existing = getAssetRow(id)
  if (existing.status === status) return mapAsset(existing)

  if (
    status === 'in_use' &&
    !getActiveAssignment(id) &&
    !existing.assigned_employee_id &&
    existing.allocation_type !== 'department'
  ) {
    throw conflict(
      'Vui lòng cấp phát hoặc phân bổ thiết bị cho phòng ban trước khi chuyển sang trạng thái đang sử dụng.'
    )
  }

  const now = nowISO()
  transaction(() => {
    if (status === 'available' || status === 'disposed' || status === 'lost' || status === 'reserved') {
      closeActiveAssignments(id, todayISO(), existing.condition, note || 'Thu hồi khi chuyển trạng thái')
      closeActiveDepartmentAssignments(id, todayISO(), note || 'Thu hồi khi chuyển trạng thái')
      getDb()
        .prepare(
          "UPDATE assets SET status = ?, assigned_employee_id = NULL, allocation_type = 'none', updated_at = ? WHERE id = ?"
        )
        .run(status, now, id)
    } else {
      getDb().prepare('UPDATE assets SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
    }
  })

  refreshAssetSearch(id)
  logActivity(
    user,
    'Cập nhật trạng thái thiết bị',
    'asset',
    id,
    `${existing.code} - ${existing.name}`,
    `${existing.status} → ${status}${note ? `. ${note}` : ''}`
  )
  return getAssetDetail(id).asset
}

export function deleteAsset(id: number, user: AuthUser): void {
  const existing = getAssetRow(id)
  if (getActiveAssignment(id)) {
    throw conflict('Thiết bị đang được cấp phát. Vui lòng thu hồi trước khi xóa.')
  }
  if (getActiveDepartmentAssignment(id)) {
    throw conflict(
      'Thiết bị đang được phân bổ cho phòng ban. Vui lòng thu hồi về kho trước khi xóa.'
    )
  }
  const db = getDb()
  const inProgress = db
    .prepare("SELECT COUNT(*) AS count FROM maintenance_records WHERE asset_id = ? AND status IN ('scheduled','in_progress')")
    .get(id) as { count: number }
  if (Number(inProgress.count) > 0) {
    throw conflict('Thiết bị đang có phiếu bảo trì chưa hoàn thành. Vui lòng xử lý phiếu trước khi xóa.')
  }
  const files = db.prepare('SELECT stored_name FROM attachments WHERE asset_id = ?').all(id) as Array<{
    stored_name: string
  }>
  db.prepare('DELETE FROM assets WHERE id = ?').run(id)
  for (const file of files) {
    const path = join(uploadsDir(), basename(file.stored_name))
    if (existsSync(path)) {
      try {
        unlinkSync(path)
      } catch {
        // bỏ qua
      }
    }
  }
  logActivity(user, 'Xóa thiết bị', 'asset', id, `${existing.code} - ${existing.name}`)
}

export function bulkDeleteAssets(ids: number[], user: AuthUser): number {
  let deleted = 0
  for (const id of ids) {
    try {
      deleteAsset(id, user)
      deleted++
    } catch {
      // bỏ qua thiết bị đang cấp phát hoặc đang bảo trì
    }
  }
  return deleted
}

export function listAttachments(assetId: number): AssetAttachment[] {
  const rows = getDb()
    .prepare(
      `SELECT t.*, u.full_name AS created_by_name
       FROM attachments t LEFT JOIN users u ON u.id = t.created_by
       WHERE t.asset_id = ? ORDER BY t.id DESC`
    )
    .all(assetId) as Array<{
    id: number
    asset_id: number
    filename: string
    stored_name: string
    mime_type: string | null
    size: number
    created_at: string
    created_by_name: string | null
  }>
  return rows.map((row) => ({
    id: Number(row.id),
    assetId: Number(row.asset_id),
    filename: row.filename,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: Number(row.size),
    createdAt: row.created_at,
    createdByName: row.created_by_name
  }))
}

export function assetCounts(): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT status, COUNT(*) AS count FROM assets GROUP BY status")
    .all() as Array<{ status: string; count: number }>
  const result: Record<string, number> = {}
  for (const row of rows) result[row.status] = Number(row.count)
  return result
}

export function normalizeSearchTerm(value: string): string {
  return normalizeForSearch(value)
}
