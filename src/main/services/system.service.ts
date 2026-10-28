import { basename, extname, join } from 'node:path'
import { copyFileSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dialog, shell } from 'electron'
import type {
  AuthUser,
  InformationSystem,
  InformationSystemDetail,
  InformationSystemFile,
  InformationSystemInput,
  InformationSystemListParams,
  PageResult,
  SystemDashboard,
  SystemDocumentType,
  SystemLevel,
  SystemSaveResult,
  SystemSummaryKpis,
  SystemWarning
} from '../../shared/types'
import { AppError, conflict, notFound } from '../lib/errors'
import { getDb, transaction } from '../db/database'
import { normalizeForSearch, nowISO } from '../../shared/utils'
import { nextSystemCode } from './code.service'
import { logActivity } from './log.service'
import { getSettings } from './settings.service'
import { getInfrastructure } from './infrastructure.service'
import { SYSTEM_STATUS_META } from '../../shared/constants'
import { uploadsDir } from '../lib/paths'

interface SystemRow {
  id: number
  code: string
  name: string
  description: string | null
  managing_unit: string
  department_id: number | null
  department_name: string | null
  level: number | null
  decision_number: string | null
  decision_date: string | null
  decision_agency: string | null
  status: InformationSystem['status']
  hosting_type: InformationSystem['hostingType']
  hosting_detail: string | null
  asset_id: number | null
  asset_code: string | null
  asset_name: string | null
  file_count: number
  decision_file_count: number
  profile_file_count: number
  created_by_name: string | null
  created_at: string
  updated_at: string
}

const SELECT = `
  SELECT s.*, d.name AS department_name,
         a.code AS asset_code, a.name AS asset_name,
         u.full_name AS created_by_name,
         (SELECT COUNT(*) FROM information_system_files f WHERE f.system_id = s.id) AS file_count,
         (SELECT COUNT(*) FROM information_system_files f
           WHERE f.system_id = s.id AND f.document_type = 'decision') AS decision_file_count,
         (SELECT COUNT(*) FROM information_system_files f
           WHERE f.system_id = s.id AND f.document_type = 'profile') AS profile_file_count
  FROM information_systems s
  LEFT JOIN departments d ON d.id = s.department_id
  LEFT JOIN assets a ON a.id = s.asset_id
  LEFT JOIN users u ON u.id = s.created_by
`

function toLevel(value: unknown): SystemLevel | null {
  const number = Number(value)
  if (!number || number < 1 || number > 5) return null
  return number as SystemLevel
}

function mapSystem(row: SystemRow): InformationSystem {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    managingUnit: row.managing_unit,
    departmentId: row.department_id ? Number(row.department_id) : null,
    departmentName: row.department_name,
    level: toLevel(row.level),
    decisionNumber: row.decision_number,
    decisionDate: row.decision_date,
    decisionAgency: row.decision_agency,
    status: row.status,
    hostingType: row.hosting_type ?? 'none',
    hostingDetail: row.hosting_detail,
    assetId: row.asset_id ? Number(row.asset_id) : null,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    fileCount: Number(row.file_count) || 0,
    decisionFileCount: Number(row.decision_file_count) || 0,
    profileFileCount: Number(row.profile_file_count) || 0,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function buildWhere(params: InformationSystemListParams): { sql: string; values: Array<string | number> } {
  const where: string[] = ['s.is_deleted = 0']
  const values: Array<string | number> = []

  if (params.search?.trim()) {
    const terms = normalizeForSearch(params.search).split(' ').filter(Boolean).slice(0, 8)
    for (const term of terms) {
      where.push('s.search_text LIKE ?')
      values.push(`%${term}%`)
    }
  }
  if (params.level === 'unset') {
    where.push('s.level IS NULL')
  } else if (params.level && params.level !== 'all') {
    const level = Number(params.level)
    if (Number.isInteger(level) && level >= 1 && level <= 5) {
      where.push('s.level = ?')
      values.push(level)
    }
  }
  if (params.status && params.status !== 'all') {
    where.push('s.status = ?')
    values.push(params.status)
  }
  if (params.departmentId) {
    where.push('s.department_id = ?')
    values.push(params.departmentId)
  }
  if (params.managingUnit?.trim()) {
    where.push('LOWER(s.managing_unit) LIKE ?')
    values.push(`%${params.managingUnit.trim().toLowerCase()}%`)
  }
  if (params.fromDate) {
    where.push('substr(s.updated_at, 1, 10) >= ?')
    values.push(params.fromDate)
  }
  if (params.toDate) {
    where.push('substr(s.updated_at, 1, 10) <= ?')
    values.push(params.toDate)
  }
  return { sql: `WHERE ${where.join(' AND ')}`, values }
}

const SORT_COLUMNS: Record<string, string> = {
  code: 's.code',
  name: 's.name',
  level: 's.level',
  updatedAt: 's.updated_at'
}

export function listSystems(params: InformationSystemListParams): PageResult<InformationSystem> {
  const db = getDb()
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(1000, Math.max(5, Number(params.pageSize) || 15))
  const { sql: whereSql, values } = buildWhere(params)
  const total = Number(
    (
      db
        .prepare(`SELECT COUNT(*) AS count FROM information_systems s ${whereSql}`)
        .get(...values) as { count: number }
    ).count
  )
  const sortColumn = SORT_COLUMNS[params.sortBy ?? 'updatedAt'] ?? 's.updated_at'
  const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'
  const order =
    sortColumn === 's.level'
      ? `s.level IS NULL, s.level ${sortDir}`
      : `${sortColumn} ${sortDir}`

  const rows = db
    .prepare(`${SELECT} ${whereSql} ORDER BY ${order}, s.id DESC LIMIT ? OFFSET ?`)
    .all(...values, pageSize, (page - 1) * pageSize) as unknown as SystemRow[]

  return {
    items: rows.map(mapSystem),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export function listAllSystems(params: InformationSystemListParams = {}): InformationSystem[] {
  const { sql: whereSql, values } = buildWhere(params)
  const rows = getDb()
    .prepare(`${SELECT} ${whereSql} ORDER BY s.name LIMIT 20000`)
    .all(...values) as unknown as SystemRow[]
  return rows.map(mapSystem)
}

export function getSystem(id: number): InformationSystem {
  const row = getDb().prepare(`${SELECT} WHERE s.id = ?`).get(id) as unknown as
    | SystemRow
    | undefined
  if (!row) throw notFound('hệ thống thông tin')
  return mapSystem(row)
}

/* ----------------------------- Attachments ----------------------------- */

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip'
}

export function listSystemFiles(systemId: number): InformationSystemFile[] {
  const rows = getDb()
    .prepare(
      `SELECT f.*, u.full_name AS created_by_name
       FROM information_system_files f
       LEFT JOIN users u ON u.id = f.created_by
       WHERE f.system_id = ? ORDER BY f.id DESC`
    )
    .all(systemId) as Array<{
    id: number
    system_id: number
    filename: string
    stored_name: string
    mime_type: string | null
    size: number
    document_type: SystemDocumentType
    created_at: string
    created_by_name: string | null
  }>
  return rows.map((row) => ({
    id: Number(row.id),
    systemId: Number(row.system_id),
    filename: row.filename,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: Number(row.size) || 0,
    documentType: row.document_type,
    createdAt: row.created_at,
    createdByName: row.created_by_name
  }))
}

export function getSystemDetail(id: number): InformationSystemDetail {
  return { system: getSystem(id), files: listSystemFiles(id) }
}

export async function uploadSystemFile(
  systemId: number,
  documentType: SystemDocumentType,
  user: AuthUser
): Promise<InformationSystemFile | null> {
  const system = getSystem(systemId)
  const result = await dialog.showOpenDialog({
    title:
      documentType === 'decision'
        ? 'Chọn quyết định phê duyệt cấp độ'
        : documentType === 'profile'
          ? 'Chọn hồ sơ đề xuất cấp độ'
          : 'Chọn tài liệu đính kèm',
    properties: ['openFile'],
    filters: [
      { name: 'Tài liệu PDF, Word, Excel', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'] },
      { name: 'Tất cả tệp', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const source = result.filePaths[0]
  const ext = extname(source).toLowerCase()
  const storedName = `${randomUUID()}${ext}`
  const target = join(uploadsDir(), storedName)
  copyFileSync(source, target)
  const stats = statSync(target)

  const insert = getDb()
    .prepare(
      `INSERT INTO information_system_files
        (system_id, filename, stored_name, mime_type, size, document_type, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      systemId,
      basename(source),
      storedName,
      MIME_MAP[ext] ?? 'application/octet-stream',
      stats.size,
      documentType,
      user.id,
      nowISO()
    )
  logActivity(
    user,
    'Đính kèm tệp HTTT',
    'information_system',
    systemId,
    `${system.code} - ${system.name}`,
    basename(source)
  )
  return listSystemFiles(systemId).find((file) => file.id === Number(insert.lastInsertRowid)) ?? null
}

export async function openSystemFile(id: number): Promise<void> {
  const row = getDb()
    .prepare('SELECT stored_name FROM information_system_files WHERE id = ?')
    .get(id) as { stored_name: string } | undefined
  if (!row) throw notFound('tệp đính kèm')
  const path = join(uploadsDir(), basename(row.stored_name))
  if (!existsSync(path)) {
    throw new AppError('Tệp đính kèm không còn tồn tại trên máy.', 'NOT_FOUND')
  }
  const error = await shell.openPath(path)
  if (error) throw new AppError(`Không thể mở tệp: ${error}`, 'INTERNAL')
}

export function deleteSystemFile(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT f.*, s.code, s.name FROM information_system_files f
       JOIN information_systems s ON s.id = f.system_id WHERE f.id = ?`
    )
    .get(id) as
    | { stored_name: string; filename: string; system_id: number; code: string; name: string }
    | undefined
  if (!row) throw notFound('tệp đính kèm')
  db.prepare('DELETE FROM information_system_files WHERE id = ?').run(id)
  const path = join(uploadsDir(), basename(row.stored_name))
  if (existsSync(path)) {
    try {
      unlinkSync(path)
    } catch {
      // bỏ qua
    }
  }
  logActivity(
    user,
    'Xóa tệp đính kèm HTTT',
    'information_system',
    Number(row.system_id),
    `${row.code} - ${row.name}`,
    row.filename
  )
}

/* ------------------------------- Warnings ------------------------------ */

export function systemIssues(system: InformationSystem): string[] {
  const issues: string[] = []
  if (system.level === null) {
    issues.push('Chưa xác định cấp độ an toàn thông tin')
  }
  if (system.level !== null && !system.decisionNumber) {
    issues.push('Thiếu số quyết định phê duyệt cấp độ')
  }
  if (system.level !== null && system.level >= 3) {
    if (!system.decisionDate) issues.push('Thiếu ngày ký quyết định')
    if (!system.decisionAgency) issues.push('Thiếu cơ quan ban hành quyết định')
    if (system.fileCount === 0) {
      issues.push('Thiếu hồ sơ, quyết định đính kèm')
    } else if (system.profileFileCount === 0) {
      issues.push('Thiếu hồ sơ đề xuất cấp độ')
    }
  }
  return issues
}

/* ------------------------------- Save ---------------------------------- */

function textOf(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildSearchText(data: InformationSystemInput, code: string): string {
  return normalizeForSearch(
    [code, data.name, data.description, data.managingUnit, data.decisionNumber, data.decisionAgency]
      .filter(Boolean)
      .join(' ')
  )
}

export function systemCodeSuggestion(): string {
  return nextSystemCode()
}

export function saveSystem(
  data: InformationSystemInput & { id?: number },
  user: AuthUser
): SystemSaveResult {
  const db = getDb()
  const settings = getSettings()
  const now = nowISO()
  const name = data.name.trim()
  const managingUnit = data.managingUnit.trim()
  const level = data.level ? (Number(data.level) as SystemLevel) : null
  const decisionNumber = textOf(data.decisionNumber)
  const decisionDate = textOf(data.decisionDate)
  const decisionAgency = textOf(data.decisionAgency)
  const status = data.status ?? 'operating'
  const hostingType = data.hostingType ?? 'none'
  const departmentId = data.departmentId ?? null
  const assetId = data.assetId ?? null

  if (level !== null && !decisionNumber) {
    throw conflict(
      'Hệ thống thông tin đã có cấp độ bắt buộc phải nhập số quyết định phê duyệt cấp độ.'
    )
  }
  if (decisionNumber && !settings.allowSharedDecisionNumber) {
    const duplicateDecision = db
      .prepare(
        `SELECT code, name FROM information_systems
         WHERE UPPER(TRIM(decision_number)) = UPPER(?) AND id <> ? AND is_deleted = 0`
      )
      .get(decisionNumber, data.id ?? 0) as { code: string; name: string } | undefined
    if (duplicateDecision) {
      throw conflict(
        `Số quyết định "${decisionNumber}" đã dùng cho HTTT ${duplicateDecision.code} - ${duplicateDecision.name}. ` +
          'Bật tùy chọn "Cho phép nhiều HTTT dùng chung số quyết định" trong Cài đặt nếu một quyết định phê duyệt nhiều hệ thống.'
      )
    }
  }

  const duplicateName = db
    .prepare(
      'SELECT code FROM information_systems WHERE LOWER(name) = LOWER(?) AND id <> ? AND is_deleted = 0'
    )
    .get(name, data.id ?? 0) as { code: string } | undefined
  if (duplicateName) {
    throw conflict(`Tên hệ thống thông tin đã tồn tại ở bản ghi ${duplicateName.code}.`)
  }

  if (departmentId) {
    const department = db.prepare('SELECT id FROM departments WHERE id = ?').get(departmentId)
    if (!department) throw notFound('phòng ban, đơn vị')
  }
  if (assetId) {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(assetId)
    if (!asset) throw notFound('thiết bị liên kết')
  }

  let id = data.id ?? 0
  if (data.id) {
    const existing = db
      .prepare('SELECT id, code FROM information_systems WHERE id = ? AND is_deleted = 0')
      .get(data.id) as { id: number; code: string } | undefined
    if (!existing) throw notFound('hệ thống thông tin')
    const code = (data.code?.trim() || existing.code).toUpperCase()
    const duplicateCode = db
      .prepare('SELECT id FROM information_systems WHERE code = ? AND id <> ?')
      .get(code, data.id)
    if (duplicateCode) throw conflict(`Mã HTTT "${code}" đã tồn tại.`)

    db.prepare(
      `UPDATE information_systems SET
        code = ?, name = ?, description = ?, managing_unit = ?, department_id = ?,
        level = ?, decision_number = ?, decision_date = ?, decision_agency = ?,
        status = ?, hosting_type = ?, hosting_detail = ?, asset_id = ?,
        search_text = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      code,
      name,
      textOf(data.description),
      managingUnit,
      departmentId,
      level,
      decisionNumber,
      decisionDate,
      decisionAgency,
      status,
      hostingType,
      textOf(data.hostingDetail),
      assetId,
      buildSearchText(data, code),
      now,
      data.id
    )
  } else {
    const code = (data.code?.trim() || nextSystemCode()).toUpperCase()
    const duplicateCode = db.prepare('SELECT id FROM information_systems WHERE code = ?').get(code)
    if (duplicateCode) throw conflict(`Mã HTTT "${code}" đã tồn tại.`)
    const result = db
      .prepare(
        `INSERT INTO information_systems
          (code, name, description, managing_unit, department_id, level, decision_number,
           decision_date, decision_agency, status, hosting_type, hosting_detail, asset_id,
           search_text, is_deleted, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(
        code,
        name,
        textOf(data.description),
        managingUnit,
        departmentId,
        level,
        decisionNumber,
        decisionDate,
        decisionAgency,
        status,
        hostingType,
        textOf(data.hostingDetail),
        assetId,
        buildSearchText(data, code),
        user.id,
        now,
        now
      )
    id = Number(result.lastInsertRowid)
  }

  const system = getSystem(id)
  logActivity(
    user,
    data.id ? 'Cập nhật HTTT' : 'Tạo HTTT',
    'information_system',
    id,
    `${system.code} - ${system.name}`,
    [
      level ? `Cấp độ ${level}` : 'Chưa xác định cấp độ',
      decisionNumber ? `QĐ ${decisionNumber}` : 'Chưa có số QĐ',
      SYSTEM_STATUS_META[status]?.label ?? status
    ].join('; ')
  )

  return { system, warnings: systemIssues(system) }
}

export function deleteSystem(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db
    .prepare('SELECT code, name FROM information_systems WHERE id = ? AND is_deleted = 0')
    .get(id) as { code: string; name: string } | undefined
  if (!row) throw notFound('hệ thống thông tin')
  db.prepare(
    'UPDATE information_systems SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?'
  ).run(nowISO(), user.id, id)
  logActivity(user, 'Xóa HTTT', 'information_system', id, `${row.code} - ${row.name}`, 'Xóa mềm, giữ lịch sử')
}

/* ------------------------------ Dashboard ------------------------------ */

export function summarizeSystems(systems: InformationSystem[]): SystemSummaryKpis {
  const total = systems.length
  const approved = systems.filter((system) => system.level !== null && system.decisionNumber).length
  const unsetLevel = systems.filter((system) => system.level === null).length
  const level3Plus = systems.filter((system) => system.level !== null && system.level >= 3).length
  const warningCount = systems.filter((system) => systemIssues(system).length > 0).length
  const infrastructure = getInfrastructure()
  return {
    total,
    approved,
    approvalRate: total ? Math.round((approved / total) * 1000) / 10 : 0,
    unsetLevel,
    level3Plus,
    warningCount,
    infrastructureTotal:
      infrastructure.physicalServers +
      infrastructure.virtualServers +
      infrastructure.switches +
      infrastructure.firewalls
  }
}

export function getSystemSummary(): SystemSummaryKpis {
  return summarizeSystems(listAllSystems())
}

/** Phân bố số lượng HTTT theo cấp độ (0 = chưa xác định). */
export function levelDistribution(
  systems: InformationSystem[]
): Array<{ level: SystemLevel | 0; label: string; count: number }> {
  const byLevel: Array<{ level: SystemLevel | 0; label: string; count: number }> = []
  byLevel.push({
    level: 0,
    label: 'Chưa xác định',
    count: systems.filter((s) => s.level === null).length
  })
  for (let level = 1; level <= 5; level++) {
    byLevel.push({
      level: level as SystemLevel,
      label: `Cấp độ ${level}`,
      count: systems.filter((s) => s.level === level).length
    })
  }
  return byLevel
}

/** Danh sách cảnh báo hồ sơ của một tập HTTT, sắp xếp theo mức độ ưu tiên. */
export function systemWarnings(systems: InformationSystem[]): SystemWarning[] {
  const warnings: SystemWarning[] = []
  for (const system of systems) {
    const issues = systemIssues(system)
    if (issues.length > 0) {
      warnings.push({
        id: system.id,
        code: system.code,
        name: system.name,
        level: system.level,
        issues
      })
    }
  }
  const severity = (item: SystemWarning): number => (item.level ?? 0) * 10 + item.issues.length
  return warnings.sort((a, b) => severity(b) - severity(a))
}

export function getSystemDashboard(): SystemDashboard {
  const systems = listAllSystems()
  const statusCount = new Map<InformationSystem['status'], number>()
  const unitCount = new Map<string, number>()
  for (const system of systems) {
    statusCount.set(system.status, (statusCount.get(system.status) ?? 0) + 1)
    unitCount.set(system.managingUnit, (unitCount.get(system.managingUnit) ?? 0) + 1)
  }

  return {
    kpis: summarizeSystems(systems),
    byLevel: levelDistribution(systems),
    byStatus: (Object.keys(SYSTEM_STATUS_META) as InformationSystem['status'][])
      .map((status) => ({ status, count: statusCount.get(status) ?? 0 }))
      .filter((item) => item.count > 0),
    byUnit: [...unitCount.entries()]
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    warnings: systemWarnings(systems).slice(0, 20),
    infrastructure: getInfrastructure()
  }
}
