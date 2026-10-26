import type {
  AuthUser,
  Category,
  CategoryInput,
  Department,
  DepartmentInput,
  Employee,
  EmployeeInput,
  Location,
  LocationInput,
  Supplier,
  SupplierInput,
  CatalogKind,
  SpecField
} from '../../shared/types'
import { conflict, notFound } from '../lib/errors'
import { getDb } from '../db/database'
import { nowISO } from '../../shared/utils'
import { logActivity } from './log.service'
import { refreshAllAssetSearch } from './asset-search'

/* ------------------------------ Categories ----------------------------- */

function mapCategory(row: Record<string, unknown>): Category {
  let specSchema: SpecField[] = []
  try {
    const parsed = JSON.parse(String(row.spec_schema ?? '[]'))
    if (Array.isArray(parsed)) specSchema = parsed as SpecField[]
  } catch {
    specSchema = []
  }
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    prefix: String(row.prefix),
    description: (row.description as string | null) ?? null,
    specSchema,
    defaultDepreciationMonths: Number(row.default_depreciation_months) || 0,
    defaultWarrantyMonths: Number(row.default_warranty_months) || 0,
    isActive: Boolean(row.is_active),
    assetCount: Number(row.asset_count) || 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export function listCategories(): Category[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, COUNT(a.id) AS asset_count FROM categories c
       LEFT JOIN assets a ON a.category_id = c.id
       GROUP BY c.id ORDER BY c.name`
    )
    .all() as Array<Record<string, unknown>>
  return rows.map(mapCategory)
}

export function saveCategory(data: CategoryInput & { id?: number }, user: AuthUser): Category {
  const db = getDb()
  const now = nowISO()
  const code = data.code.trim().toUpperCase()
  const prefix = data.prefix.trim().toUpperCase()
  const duplicate = db
    .prepare('SELECT id FROM categories WHERE (UPPER(code) = ? OR UPPER(prefix) = ?) AND id <> ?')
    .get(code, prefix, data.id ?? 0)
  if (duplicate) {
    throw conflict('Mã danh mục hoặc tiền tố đã được sử dụng.')
  }
  const nameDuplicate = db
    .prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id <> ?')
    .get(data.name.trim(), data.id ?? 0)
  if (nameDuplicate) throw conflict('Tên danh mục đã tồn tại.')
  const specSchema = JSON.stringify(data.specSchema ?? [])
  let id = data.id ?? 0
  if (data.id) {
    const exists = db.prepare('SELECT id FROM categories WHERE id = ?').get(data.id)
    if (!exists) throw notFound('danh mục')
    db.prepare(
      `UPDATE categories SET code = ?, name = ?, prefix = ?, description = ?, spec_schema = ?,
        default_depreciation_months = ?, default_warranty_months = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      code,
      data.name.trim(),
      prefix,
      data.description ?? null,
      specSchema,
      data.defaultDepreciationMonths ?? 60,
      data.defaultWarrantyMonths ?? 12,
      data.isActive === false ? 0 : 1,
      now,
      data.id
    )
  } else {
    const result = db
      .prepare(
        `INSERT INTO categories
          (code, name, prefix, description, spec_schema, default_depreciation_months,
           default_warranty_months, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        data.name.trim(),
        prefix,
        data.description ?? null,
        specSchema,
        data.defaultDepreciationMonths ?? 60,
        data.defaultWarrantyMonths ?? 12,
        data.isActive === false ? 0 : 1,
        now,
        now
      )
    id = Number(result.lastInsertRowid)
  }
  refreshAllAssetSearch()
  logActivity(
    user,
    data.id ? 'Cập nhật danh mục' : 'Tạo danh mục',
    'category',
    id,
    `${code} - ${data.name}`
  )
  return listCategories().find((c) => c.id === id) as Category
}

export function deleteCategory(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db.prepare('SELECT code, name FROM categories WHERE id = ?').get(id) as
    | { code: string; name: string }
    | undefined
  if (!row) throw notFound('danh mục')
  const count = db.prepare('SELECT COUNT(*) AS count FROM assets WHERE category_id = ?').get(id) as {
    count: number
  }
  if (Number(count.count) > 0) {
    throw conflict('Danh mục đang được sử dụng bởi thiết bị, không thể xóa.')
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  logActivity(user, 'Xóa danh mục', 'category', id, `${row.code} - ${row.name}`)
}

/* ----------------------------- Departments ----------------------------- */

function mapDepartment(row: Record<string, unknown>): Department {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    managerName: (row.manager_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    isActive: Boolean(row.is_active),
    assetCount: Number(row.asset_count) || 0,
    employeeCount: Number(row.employee_count) || 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export function listDepartments(): Department[] {
  const rows = getDb()
    .prepare(
      `SELECT d.*,
        (SELECT COUNT(*) FROM assets a WHERE a.department_id = d.id) AS asset_count,
        (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) AS employee_count
       FROM departments d ORDER BY d.name`
    )
    .all() as Array<Record<string, unknown>>
  return rows.map(mapDepartment)
}

export function saveDepartment(data: DepartmentInput & { id?: number }, user: AuthUser): Department {
  const db = getDb()
  const now = nowISO()
  const code = data.code.trim().toUpperCase()
  const duplicate = db
    .prepare('SELECT id FROM departments WHERE UPPER(code) = ? AND id <> ?')
    .get(code, data.id ?? 0)
  if (duplicate) throw conflict('Mã bộ phận đã được sử dụng.')
  const nameDuplicate = db
    .prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) AND id <> ?')
    .get(data.name.trim(), data.id ?? 0)
  if (nameDuplicate) throw conflict('Tên bộ phận đã tồn tại.')

  let id = data.id ?? 0
  if (data.id) {
    if (!db.prepare('SELECT id FROM departments WHERE id = ?').get(data.id)) {
      throw notFound('bộ phận')
    }
    db.prepare(
      `UPDATE departments SET code = ?, name = ?, manager_name = ?, phone = ?, description = ?,
        is_active = ?, updated_at = ? WHERE id = ?`
    ).run(
      code,
      data.name.trim(),
      data.managerName ?? null,
      data.phone ?? null,
      data.description ?? null,
      data.isActive === false ? 0 : 1,
      now,
      data.id
    )
  } else {
    const result = db
      .prepare(
        `INSERT INTO departments (code, name, manager_name, phone, description, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        data.name.trim(),
        data.managerName ?? null,
        data.phone ?? null,
        data.description ?? null,
        data.isActive === false ? 0 : 1,
        now,
        now
      )
    id = Number(result.lastInsertRowid)
  }
  refreshAllAssetSearch()
  logActivity(
    user,
    data.id ? 'Cập nhật bộ phận' : 'Tạo bộ phận',
    'department',
    id,
    `${code} - ${data.name}`
  )
  return listDepartments().find((d) => d.id === id) as Department
}

export function deleteDepartment(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db.prepare('SELECT code, name FROM departments WHERE id = ?').get(id) as
    | { code: string; name: string }
    | undefined
  if (!row) throw notFound('bộ phận')
  const usage = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM assets WHERE department_id = ?) AS assets,
        (SELECT COUNT(*) FROM employees WHERE department_id = ?) AS employees`
    )
    .get(id, id) as { assets: number; employees: number }
  if (Number(usage.assets) > 0 || Number(usage.employees) > 0) {
    throw conflict('Bộ phận đang được sử dụng, không thể xóa.')
  }
  db.prepare('DELETE FROM departments WHERE id = ?').run(id)
  logActivity(user, 'Xóa bộ phận', 'department', id, `${row.code} - ${row.name}`)
}

/* ------------------------------- Locations ----------------------------- */

function mapLocation(row: Record<string, unknown>): Location {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    address: (row.address as string | null) ?? null,
    building: (row.building as string | null) ?? null,
    floor: (row.floor as string | null) ?? null,
    room: (row.room as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    isActive: Boolean(row.is_active),
    assetCount: Number(row.asset_count) || 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export function listLocations(): Location[] {
  const rows = getDb()
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM assets a WHERE a.location_id = l.id) AS asset_count
       FROM locations l ORDER BY l.name`
    )
    .all() as Array<Record<string, unknown>>
  return rows.map(mapLocation)
}

export function saveLocation(data: LocationInput & { id?: number }, user: AuthUser): Location {
  const db = getDb()
  const now = nowISO()
  const code = data.code.trim().toUpperCase()
  const duplicate = db
    .prepare('SELECT id FROM locations WHERE UPPER(code) = ? AND id <> ?')
    .get(code, data.id ?? 0)
  if (duplicate) throw conflict('Mã vị trí đã được sử dụng.')
  const nameDuplicate = db
    .prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(?) AND id <> ?')
    .get(data.name.trim(), data.id ?? 0)
  if (nameDuplicate) throw conflict('Tên vị trí đã tồn tại.')

  let id = data.id ?? 0
  if (data.id) {
    if (!db.prepare('SELECT id FROM locations WHERE id = ?').get(data.id)) {
      throw notFound('vị trí')
    }
    db.prepare(
      `UPDATE locations SET code = ?, name = ?, address = ?, building = ?, floor = ?, room = ?,
        note = ?, is_active = ?, updated_at = ? WHERE id = ?`
    ).run(
      code,
      data.name.trim(),
      data.address ?? null,
      data.building ?? null,
      data.floor ?? null,
      data.room ?? null,
      data.note ?? null,
      data.isActive === false ? 0 : 1,
      now,
      data.id
    )
  } else {
    const result = db
      .prepare(
        `INSERT INTO locations (code, name, address, building, floor, room, note, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        data.name.trim(),
        data.address ?? null,
        data.building ?? null,
        data.floor ?? null,
        data.room ?? null,
        data.note ?? null,
        data.isActive === false ? 0 : 1,
        now,
        now
      )
    id = Number(result.lastInsertRowid)
  }
  refreshAllAssetSearch()
  logActivity(
    user,
    data.id ? 'Cập nhật vị trí' : 'Tạo vị trí',
    'location',
    id,
    `${code} - ${data.name}`
  )
  return listLocations().find((l) => l.id === id) as Location
}

export function deleteLocation(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db.prepare('SELECT code, name FROM locations WHERE id = ?').get(id) as
    | { code: string; name: string }
    | undefined
  if (!row) throw notFound('vị trí')
  const count = db.prepare('SELECT COUNT(*) AS count FROM assets WHERE location_id = ?').get(id) as {
    count: number
  }
  if (Number(count.count) > 0) {
    throw conflict('Vị trí đang được sử dụng bởi thiết bị, không thể xóa.')
  }
  db.prepare('DELETE FROM locations WHERE id = ?').run(id)
  logActivity(user, 'Xóa vị trí', 'location', id, `${row.code} - ${row.name}`)
}

/* ------------------------------- Suppliers ----------------------------- */

function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    contactName: (row.contact_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    taxCode: (row.tax_code as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    isActive: Boolean(row.is_active),
    assetCount: Number(row.asset_count) || 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export function listSuppliers(): Supplier[] {
  const rows = getDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM assets a WHERE a.supplier_id = s.id) AS asset_count
       FROM suppliers s ORDER BY s.name`
    )
    .all() as Array<Record<string, unknown>>
  return rows.map(mapSupplier)
}

export function saveSupplier(data: SupplierInput & { id?: number }, user: AuthUser): Supplier {
  const db = getDb()
  const now = nowISO()
  const code = data.code.trim().toUpperCase()
  const duplicate = db
    .prepare('SELECT id FROM suppliers WHERE UPPER(code) = ? AND id <> ?')
    .get(code, data.id ?? 0)
  if (duplicate) throw conflict('Mã nhà cung cấp đã được sử dụng.')

  let id = data.id ?? 0
  if (data.id) {
    if (!db.prepare('SELECT id FROM suppliers WHERE id = ?').get(data.id)) {
      throw notFound('nhà cung cấp')
    }
    db.prepare(
      `UPDATE suppliers SET code = ?, name = ?, contact_name = ?, phone = ?, email = ?, address = ?,
        tax_code = ?, website = ?, note = ?, is_active = ?, updated_at = ? WHERE id = ?`
    ).run(
      code,
      data.name.trim(),
      data.contactName ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.address ?? null,
      data.taxCode ?? null,
      data.website ?? null,
      data.note ?? null,
      data.isActive === false ? 0 : 1,
      now,
      data.id
    )
  } else {
    const result = db
      .prepare(
        `INSERT INTO suppliers
          (code, name, contact_name, phone, email, address, tax_code, website, note, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        data.name.trim(),
        data.contactName ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.address ?? null,
        data.taxCode ?? null,
        data.website ?? null,
        data.note ?? null,
        data.isActive === false ? 0 : 1,
        now,
        now
      )
    id = Number(result.lastInsertRowid)
  }
  refreshAllAssetSearch()
  logActivity(
    user,
    data.id ? 'Cập nhật nhà cung cấp' : 'Tạo nhà cung cấp',
    'supplier',
    id,
    `${code} - ${data.name}`
  )
  return listSuppliers().find((s) => s.id === id) as Supplier
}

export function deleteSupplier(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db.prepare('SELECT code, name FROM suppliers WHERE id = ?').get(id) as
    | { code: string; name: string }
    | undefined
  if (!row) throw notFound('nhà cung cấp')
  const count = db.prepare('SELECT COUNT(*) AS count FROM assets WHERE supplier_id = ?').get(id) as {
    count: number
  }
  if (Number(count.count) > 0) {
    throw conflict('Nhà cung cấp đang được sử dụng bởi thiết bị, không thể xóa.')
  }
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
  logActivity(user, 'Xóa nhà cung cấp', 'supplier', id, `${row.code} - ${row.name}`)
}

/* ------------------------------- Employees ----------------------------- */

function mapEmployee(row: Record<string, unknown>): Employee {
  return {
    id: Number(row.id),
    code: String(row.code),
    fullName: String(row.full_name),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    position: (row.position as string | null) ?? null,
    departmentId: row.department_id ? Number(row.department_id) : null,
    departmentName: (row.department_name as string | null) ?? null,
    isActive: Boolean(row.is_active),
    note: (row.note as string | null) ?? null,
    assetCount: Number(row.asset_count) || 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export function listEmployees(): Employee[] {
  const rows = getDb()
    .prepare(
      `SELECT e.*, d.name AS department_name,
        (SELECT COUNT(*) FROM assets a WHERE a.assigned_employee_id = e.id) AS asset_count
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
       ORDER BY e.full_name`
    )
    .all() as Array<Record<string, unknown>>
  return rows.map(mapEmployee)
}

export function saveEmployee(data: EmployeeInput & { id?: number }, user: AuthUser): Employee {
  const db = getDb()
  const now = nowISO()
  const code = data.code.trim().toUpperCase()
  const duplicate = db
    .prepare('SELECT id FROM employees WHERE UPPER(code) = ? AND id <> ?')
    .get(code, data.id ?? 0)
  if (duplicate) throw conflict('Mã nhân viên đã được sử dụng.')

  let id = data.id ?? 0
  if (data.id) {
    if (!db.prepare('SELECT id FROM employees WHERE id = ?').get(data.id)) {
      throw notFound('nhân viên')
    }
    db.prepare(
      `UPDATE employees SET code = ?, full_name = ?, email = ?, phone = ?, position = ?,
        department_id = ?, is_active = ?, note = ?, updated_at = ? WHERE id = ?`
    ).run(
      code,
      data.fullName.trim(),
      data.email ?? null,
      data.phone ?? null,
      data.position ?? null,
      data.departmentId ?? null,
      data.isActive === false ? 0 : 1,
      data.note ?? null,
      now,
      data.id
    )
  } else {
    const result = db
      .prepare(
        `INSERT INTO employees
          (code, full_name, email, phone, position, department_id, is_active, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        data.fullName.trim(),
        data.email ?? null,
        data.phone ?? null,
        data.position ?? null,
        data.departmentId ?? null,
        data.isActive === false ? 0 : 1,
        data.note ?? null,
        now,
        now
      )
    id = Number(result.lastInsertRowid)
  }
  refreshAllAssetSearch()
  logActivity(
    user,
    data.id ? 'Cập nhật nhân viên' : 'Tạo nhân viên',
    'employee',
    id,
    `${code} - ${data.fullName}`
  )
  return listEmployees().find((e) => e.id === id) as Employee
}

export function deleteEmployee(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db.prepare('SELECT code, full_name FROM employees WHERE id = ?').get(id) as
    | { code: string; full_name: string }
    | undefined
  if (!row) throw notFound('nhân viên')
  const usage = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM assets WHERE assigned_employee_id = ?) AS assets,
        (SELECT COUNT(*) FROM asset_assignments WHERE employee_id = ?) AS assignments`
    )
    .get(id, id) as { assets: number; assignments: number }
  if (Number(usage.assets) > 0 || Number(usage.assignments) > 0) {
    throw conflict('Nhân viên đã có lịch sử cấp phát thiết bị, không thể xóa. Hãy chuyển sang ngừng hoạt động.')
  }
  db.prepare('DELETE FROM employees WHERE id = ?').run(id)
  logActivity(user, 'Xóa nhân viên', 'employee', id, `${row.code} - ${row.full_name}`)
}

export function listCatalog(kind: CatalogKind): unknown[] {
  switch (kind) {
    case 'categories':
      return listCategories()
    case 'departments':
      return listDepartments()
    case 'locations':
      return listLocations()
    case 'suppliers':
      return listSuppliers()
    case 'employees':
      return listEmployees()
    default:
      return []
  }
}
