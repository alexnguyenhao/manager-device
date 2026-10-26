import ExcelJS from 'exceljs'
import { app, dialog } from 'electron'
import type {
  AssetInput,
  AssetListParams,
  AssetStatus,
  AuthUser,
  ExportResult,
  ImportResult,
  ReportParams
} from '../../shared/types'
import { listAllAssets } from './asset.service'
import { buildReport } from './report.service'
import { listCategories, listDepartments, listEmployees, listLocations, listSuppliers } from './catalog.service'
import { getAuditDetail } from './audit.service'
import { logActivity } from './log.service'
import { createAsset } from './asset.service'
import { assetSchema } from '../lib/schemas'
import { messageOf } from '../lib/errors'
import {
  ASSET_CONDITION_META,
  ASSET_STATUS_META,
  AUDIT_RESULT_META,
  MAINTENANCE_TYPE_META
} from '../../shared/constants'
import { formatDate, formatNumber, normalizeForSearch, todayISO } from '../../shared/utils'

const HEADER_FILL = '1E40AF'
const HEADER_FONT = 'FFFFFF'
const TITLE_FILL = 'EFF6FF'

const EXPORT_HEADERS: Array<{ header: string; key: string; width: number }> = [
  { header: 'STT', key: 'index', width: 6 },
  { header: 'Mã thiết bị', key: 'code', width: 16 },
  { header: 'Tên thiết bị', key: 'name', width: 38 },
  { header: 'Danh mục', key: 'category', width: 20 },
  { header: 'Số serial', key: 'serial', width: 22 },
  { header: 'Model', key: 'model', width: 22 },
  { header: 'Hãng sản xuất', key: 'manufacturer', width: 16 },
  { header: 'Trạng thái', key: 'status', width: 16 },
  { header: 'Tình trạng', key: 'condition', width: 12 },
  { header: 'Bộ phận', key: 'department', width: 24 },
  { header: 'Vị trí', key: 'location', width: 24 },
  { header: 'Người sử dụng', key: 'employee', width: 24 },
  { header: 'Nhà cung cấp', key: 'supplier', width: 28 },
  { header: 'Ngày mua', key: 'purchaseDate', width: 13 },
  { header: 'Giá mua', key: 'purchasePrice', width: 16 },
  { header: 'Giá trị còn lại', key: 'currentValue', width: 16 },
  { header: 'Khấu hao lũy kế', key: 'depreciation', width: 16 },
  { header: 'Bảo hành đến', key: 'warrantyExpiry', width: 13 },
  { header: 'Còn bảo hành (ngày)', key: 'warrantyDays', width: 16 },
  { header: 'Ghi chú', key: 'note', width: 32 }
]

function styleHeader(row: ExcelJS.Row): void {
  row.height = 24
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    }
  })
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: Array<{ header: string; key: string; width: number }>
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }]
  })
  sheet.columns = headers
  styleHeader(sheet.getRow(1))
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  }
  return sheet
}

function savePath(workbook: ExcelJS.Workbook, defaultName: string, title: string): Promise<ExportResult> {
  return (async () => {
    const result = await dialog.showSaveDialog({
      title,
      defaultPath: `${app.getPath('documents')}/${defaultName}`,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    await workbook.xlsx.writeFile(result.filePath)
    return { canceled: false, filePath: result.filePath }
  })()
}

function workbookTitle(sheet: ExcelJS.Worksheet, title: string, subtitle: string, columns: number): void {
  sheet.mergeCells(1, 1, 1, columns)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 15, color: { argb: '0F172A' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 28
  sheet.mergeCells(2, 1, 2, columns)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = subtitle
  subtitleCell.font = { italic: true, size: 10, color: { argb: '475569' } }
  sheet.getRow(2).height = 20
  for (let i = 1; i <= columns; i++) {
    sheet.getCell(1, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } }
    sheet.getCell(2, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } }
  }
}

export async function exportAssetsExcel(params: AssetListParams, user: AuthUser): Promise<ExportResult> {
  const assets = listAllAssets({ ...params, pageSize: 500 })
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Manager Device'
  workbook.created = new Date()
  const sheet = addDataSheet(workbook, 'Danh sách thiết bị', EXPORT_HEADERS)

  assets.forEach((asset, index) => {
    const row = sheet.addRow({
      index: index + 1,
      code: asset.code,
      name: asset.name,
      category: asset.categoryName,
      serial: asset.serialNumber ?? '',
      model: asset.model ?? '',
      manufacturer: asset.manufacturer ?? '',
      status: ASSET_STATUS_META[asset.status].label,
      condition: ASSET_CONDITION_META[asset.condition].label,
      department: asset.departmentName ?? '',
      location: asset.locationName ?? '',
      employee: asset.assignedEmployeeName ?? '',
      supplier: asset.supplierName ?? '',
      purchaseDate: formatDate(asset.purchaseDate),
      purchasePrice: asset.purchasePrice,
      currentValue: asset.currentValue,
      depreciation: asset.accumulatedDepreciation,
      warrantyExpiry: formatDate(asset.warrantyExpiry),
      warrantyDays: asset.warrantyDaysLeft ?? '',
      note: asset.note ?? ''
    })
    row.getCell('purchasePrice').numFmt = '#,##0'
    row.getCell('currentValue').numFmt = '#,##0'
    row.getCell('depreciation').numFmt = '#,##0'
  })

  const result = await savePath(
    workbook,
    `danh-sach-thiet-bi-${todayISO().replace(/-/g, '')}.xlsx`,
    'Xuất danh sách thiết bị'
  )
  if (!result.canceled) {
    logActivity(user, 'Xuất Excel danh sách thiết bị', 'asset', null, `${assets.length} thiết bị`)
    result.count = assets.length
  }
  return result
}

export async function exportReportExcel(params: ReportParams, user: AuthUser): Promise<ExportResult> {
  const report = buildReport(params)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Manager Device'
  workbook.created = new Date()

  const summary = workbook.addWorksheet('Tổng hợp')
  summary.columns = [
    { width: 34 },
    { width: 20 },
    { width: 20 },
    { width: 20 }
  ]
  workbookTitle(
    summary,
    'BÁO CÁO TỔNG HỢP TÀI SẢN',
    `Lập ngày ${formatDate(todayISO())} · ${report.summary.total} thiết bị`,
    4
  )
  const summaryHeader = summary.getRow(4)
  summaryHeader.values = ['Chỉ tiêu', 'Số lượng', 'Nguyên giá (VND)', 'Giá trị còn lại (VND)']
  styleHeader(summaryHeader)
  summary.addRow([
    'Tổng số thiết bị',
    report.summary.total,
    report.summary.purchaseValue,
    report.summary.currentValue
  ])
  summary.addRow([
    'Khấu hao lũy kế',
    '',
    '',
    report.summary.accumulatedDepreciation
  ])
  summary.addRow(['Tỷ lệ khấu hao', `${report.summary.depreciationRate}%`, '', ''])
  summary.addRow([])
  const catStart = summary.rowCount + 1
  summary.addRow(['Theo danh mục', 'Số lượng', 'Nguyên giá', 'Giá trị còn lại'])
  styleHeader(summary.getRow(summary.rowCount))
  for (const group of report.byCategory) {
    summary.addRow([group.label, group.count, group.purchaseValue, group.currentValue])
  }
  summary.addRow([])
  summary.addRow(['Theo bộ phận', 'Số lượng', 'Nguyên giá', 'Giá trị còn lại'])
  styleHeader(summary.getRow(summary.rowCount))
  for (const group of report.byDepartment) {
    summary.addRow([group.label, group.count, group.purchaseValue, group.currentValue])
  }
  summary.addRow([])
  summary.addRow(['Theo trạng thái', 'Số lượng', 'Nguyên giá', 'Giá trị còn lại'])
  styleHeader(summary.getRow(summary.rowCount))
  for (const group of report.byStatus) {
    summary.addRow([group.label, group.count, group.purchaseValue, group.currentValue])
  }
  summary.eachRow((row, rowNumber) => {
    if (rowNumber === catStart) return
    const c3 = row.getCell(3)
    const c4 = row.getCell(4)
    if (typeof c3.value === 'number') c3.numFmt = '#,##0'
    if (typeof c4.value === 'number') c4.numFmt = '#,##0'
  })

  const detail = addDataSheet(workbook, 'Chi tiết thiết bị', [
    { header: 'STT', key: 'index', width: 6 },
    { header: 'Mã thiết bị', key: 'code', width: 16 },
    { header: 'Tên thiết bị', key: 'name', width: 36 },
    { header: 'Danh mục', key: 'category', width: 20 },
    { header: 'Bộ phận', key: 'department', width: 22 },
    { header: 'Vị trí', key: 'location', width: 22 },
    { header: 'Người sử dụng', key: 'employee', width: 22 },
    { header: 'Ngày mua', key: 'purchaseDate', width: 13 },
    { header: 'Nguyên giá', key: 'purchasePrice', width: 16 },
    { header: 'Giá trị còn lại', key: 'currentValue', width: 16 },
    { header: 'Khấu hao lũy kế', key: 'depreciation', width: 16 },
    { header: 'Trạng thái', key: 'status', width: 16 },
    { header: 'Bảo hành đến', key: 'warrantyExpiry', width: 13 }
  ])
  report.rows.forEach((item, index) => {
    const row = detail.addRow({
      index: index + 1,
      code: item.code,
      name: item.name,
      category: item.categoryName,
      department: item.departmentName ?? '',
      location: item.locationName ?? '',
      employee: item.employeeName ?? '',
      purchaseDate: formatDate(item.purchaseDate),
      purchasePrice: item.purchasePrice,
      currentValue: item.currentValue,
      depreciation: item.accumulatedDepreciation,
      status: ASSET_STATUS_META[item.status].label,
      warrantyExpiry: formatDate(item.warrantyExpiry)
    })
    row.getCell('purchasePrice').numFmt = '#,##0'
    row.getCell('currentValue').numFmt = '#,##0'
    row.getCell('depreciation').numFmt = '#,##0'
  })

  const result = await savePath(
    workbook,
    `bao-cao-tai-san-${todayISO().replace(/-/g, '')}.xlsx`,
    'Xuất báo cáo tài sản'
  )
  if (!result.canceled) {
    logActivity(user, 'Xuất báo cáo tài sản', 'report', null, `${report.summary.total} thiết bị`)
    result.count = report.summary.total
  }
  return result
}

export async function exportAuditExcel(sessionId: number, user: AuthUser): Promise<ExportResult> {
  const detail = getAuditDetail(sessionId)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Kết quả kiểm kê')
  sheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 36 },
    { width: 20 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 18 },
    { width: 32 }
  ]
  workbookTitle(
    sheet,
    `KẾT QUẢ KIỂM KÊ ${detail.session.code}`,
    `${detail.session.name} · ${detail.session.startDate} → ${detail.session.endDate ?? 'Chưa kết thúc'}`,
    10
  )
  const header = sheet.getRow(4)
  header.values = [
    'STT',
    'Mã thiết bị',
    'Tên thiết bị',
    'Danh mục',
    'Vị trí dự kiến',
    'Người sử dụng dự kiến',
    'Vị trí thực tế',
    'Người sử dụng thực tế',
    'Kết quả',
    'Ghi chú'
  ]
  styleHeader(header)
  detail.items.forEach((item, index) => {
    sheet.addRow([
      index + 1,
      item.assetCode,
      item.assetName,
      item.categoryName ?? '',
      item.expectedLocationName ?? '',
      item.expectedEmployeeName ?? '',
      item.actualLocationName ?? '',
      item.actualEmployeeName ?? '',
      AUDIT_RESULT_META[item.result].label,
      item.note ?? ''
    ])
  })
  const result = await savePath(
    workbook,
    `kiem-ke-${detail.session.code}.xlsx`,
    'Xuất kết quả kiểm kê'
  )
  if (!result.canceled) {
    logActivity(user, 'Xuất kết quả kiểm kê', 'audit', sessionId, detail.session.code)
    result.count = detail.items.length
  }
  return result
}

/* ------------------------------- Import -------------------------------- */

const HEADER_ALIASES: Record<string, string> = {
  'ma thiet bi': 'code',
  code: 'code',
  'ten thiet bi': 'name',
  'ten may': 'name',
  name: 'name',
  'danh muc': 'category',
  'danh muc thiet bi': 'category',
  'loai thiet bi': 'category',
  'serial': 'serial',
  'so serial': 'serial',
  'serial number': 'serial',
  model: 'model',
  'hang san xuat': 'manufacturer',
  hang: 'manufacturer',
  manufacturer: 'manufacturer',
  'trang thai': 'status',
  'tinh trang': 'condition',
  'bo phan': 'department',
  'phong ban': 'department',
  'vi tri': 'location',
  'nguoi su dung': 'employee',
  'nhan vien': 'employee',
  'nha cung cap': 'supplier',
  'ngay mua': 'purchaseDate',
  'gia mua': 'purchasePrice',
  'so hoa don': 'invoice',
  'thang bao hanh': 'warrantyMonths',
  'bao hanh thang': 'warrantyMonths',
  'thang khau hao': 'depreciationMonths',
  'gia tri thanh ly': 'salvageValue',
  'ghi chu': 'note'
}

const STATUS_BY_LABEL = new Map<string, AssetStatus>()
for (const [key, meta] of Object.entries(ASSET_STATUS_META)) {
  STATUS_BY_LABEL.set(normalizeForSearch(meta.label), key as AssetStatus)
  STATUS_BY_LABEL.set(normalizeForSearch(key), key as AssetStatus)
}
STATUS_BY_LABEL.set('dang su dung', 'in_use')
STATUS_BY_LABEL.set('san sang', 'available')
STATUS_BY_LABEL.set('thanh ly', 'disposed')
STATUS_BY_LABEL.set('mat', 'lost')

const CONDITION_BY_LABEL = new Map<string, AssetInput['condition']>()
for (const [key, meta] of Object.entries(ASSET_CONDITION_META)) {
  CONDITION_BY_LABEL.set(normalizeForSearch(meta.label), key as AssetInput['condition'])
  CONDITION_BY_LABEL.set(normalizeForSearch(key), key as AssetInput['condition'])
}

function normalizeHeader(value: string): string {
  return normalizeForSearch(value)
    .replace(/\(.*?\)/g, '')
    .replace(/[*:]/g, '')
    .trim()
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return formatDate(value.toISOString())
  if (typeof value === 'object') {
    if ('text' in value && value.text) return String(value.text).trim()
    if ('result' in value && value.result != null) return cellText(value.result as ExcelJS.CellValue)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim()
    }
    if ('hyperlink' in value) return cellText((value as { text?: string }).text ?? '')
    if ('error' in value) return ''
  }
  return String(value).trim()
}

function parseDateValue(value: ExcelJS.CellValue): string | null {
  if (!value) return null
  if (value instanceof Date) {
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  const text = cellText(value)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  }
  return null
}

function parseNumberValue(value: ExcelJS.CellValue): number {
  if (typeof value === 'number') return value
  const text = cellText(value).replace(/[^\d.-]/g, '')
  const number = Number(text)
  return Number.isFinite(number) ? number : 0
}

export async function importAssetsExcel(user: AuthUser): Promise<ImportResult> {
  const picked = await dialog.showOpenDialog({
    title: 'Chọn tệp Excel để nhập thiết bị',
    properties: ['openFile'],
    filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'csv'] }]
  })
  if (picked.canceled || picked.filePaths.length === 0) {
    return { canceled: true, imported: 0, failed: 0, errors: [] }
  }
  const filePath = picked.filePaths[0]
  const workbook = new ExcelJS.Workbook()
  try {
    if (filePath.toLowerCase().endsWith('.csv')) {
      await workbook.csv.readFile(filePath)
    } else {
      await workbook.xlsx.readFile(filePath)
    }
  } catch {
    return {
      canceled: false,
      imported: 0,
      failed: 1,
      errors: [{ row: 0, message: 'Không thể đọc tệp Excel. Vui lòng kiểm tra định dạng tệp.' }]
    }
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return {
      canceled: false,
      imported: 0,
      failed: 1,
      errors: [{ row: 0, message: 'Tệp không có dữ liệu.' }]
    }
  }

  let headerRow = 0
  const columnMap = new Map<string, number>()
  for (let rowNumber = 1; rowNumber <= Math.min(15, sheet.rowCount); rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const candidate = new Map<string, number>()
    row.eachCell((cell, colNumber) => {
      const field = HEADER_ALIASES[normalizeHeader(cellText(cell.value))]
      if (field) candidate.set(field, colNumber)
    })
    if (candidate.has('name') && candidate.has('category')) {
      headerRow = rowNumber
      candidate.forEach((col, field) => columnMap.set(field, col))
      break
    }
  }

  if (!headerRow) {
    return {
      canceled: false,
      imported: 0,
      failed: 1,
      errors: [
        {
          row: 0,
          message: 'Không tìm thấy dòng tiêu đề. Cần có cột "Tên thiết bị" và "Danh mục".'
        }
      ]
    }
  }

  const categories = listCategories()
  const departments = listDepartments()
  const locations = listLocations()
  const suppliers = listSuppliers()
  const employees = listEmployees()

  const findByCodeOrName = <T extends { code: string; name?: string; fullName?: string }>(
    items: T[],
    value: string
  ): T | undefined => {
    const term = normalizeForSearch(value)
    if (!term) return undefined
    return items.find(
      (item) =>
        normalizeForSearch(item.code) === term ||
        normalizeForSearch(item.name ?? item.fullName ?? '') === term
    )
  }

  let imported = 0
  const errors: ImportResult['errors'] = []
  const maxRow = sheet.rowCount

  for (let rowNumber = headerRow + 1; rowNumber <= maxRow; rowNumber++) {
    if (errors.length >= 100) break
    const row = sheet.getRow(rowNumber)
    const get = (field: string): ExcelJS.CellValue => {
      const col = columnMap.get(field)
      return col ? row.getCell(col).value : null
    }
    const name = cellText(get('name'))
    const categoryName = cellText(get('category'))
    if (!name && !categoryName) continue

    try {
      if (!name) throw new Error('Thiếu tên thiết bị.')
      if (!categoryName) throw new Error('Thiếu danh mục thiết bị.')
      const category = findByCodeOrName(categories, categoryName)
      if (!category) throw new Error(`Không tìm thấy danh mục "${categoryName}".`)
      const departmentName = cellText(get('department'))
      const department = departmentName ? findByCodeOrName(departments, departmentName) : undefined
      if (departmentName && !department) throw new Error(`Không tìm thấy bộ phận "${departmentName}".`)
      const locationName = cellText(get('location'))
      const location = locationName ? findByCodeOrName(locations, locationName) : undefined
      if (locationName && !location) throw new Error(`Không tìm thấy vị trí "${locationName}".`)
      const employeeName = cellText(get('employee'))
      const employee = employeeName ? findByCodeOrName(employees, employeeName) : undefined
      if (employeeName && !employee) {
        throw new Error(`Không tìm thấy nhân viên "${employeeName}".`)
      }
      const supplierName = cellText(get('supplier'))
      const supplier = supplierName ? findByCodeOrName(suppliers, supplierName) : undefined
      if (supplierName && !supplier) {
        throw new Error(`Không tìm thấy nhà cung cấp "${supplierName}".`)
      }

      const statusText = cellText(get('status'))
      const status = statusText ? STATUS_BY_LABEL.get(normalizeForSearch(statusText)) : undefined
      if (statusText && !status) throw new Error(`Trạng thái "${statusText}" không hợp lệ.`)
      const conditionText = cellText(get('condition'))
      const condition = conditionText
        ? CONDITION_BY_LABEL.get(normalizeForSearch(conditionText))
        : undefined
      if (conditionText && !condition) {
        throw new Error(`Tình trạng "${conditionText}" không hợp lệ.`)
      }

      const purchaseDate = parseDateValue(get('purchaseDate'))
      if (get('purchaseDate') && !purchaseDate) {
        throw new Error('Ngày mua không hợp lệ (định dạng dd/mm/yyyy).')
      }

      const input = {
        code: cellText(get('code')) || undefined,
        name,
        categoryId: category.id,
        serialNumber: cellText(get('serial')) || null,
        model: cellText(get('model')) || null,
        manufacturer: cellText(get('manufacturer')) || null,
        status,
        condition,
        departmentId: department?.id ?? null,
        locationId: location?.id ?? null,
        assignedEmployeeId: employee?.id ?? null,
        supplierId: supplier?.id ?? null,
        purchaseDate,
        purchasePrice: parseNumberValue(get('purchasePrice')),
        invoiceNumber: cellText(get('invoice')) || null,
        warrantyMonths: columnMap.has('warrantyMonths')
          ? parseNumberValue(get('warrantyMonths'))
          : undefined,
        depreciationMonths: columnMap.has('depreciationMonths')
          ? parseNumberValue(get('depreciationMonths'))
          : undefined,
        salvageValue: parseNumberValue(get('salvageValue')),
        note: cellText(get('note')) || null
      }

      const parsed = assetSchema.safeParse(input)
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((issue) => issue.message).join('; '))
      }

      createAsset(parsed.data as AssetInput, user)
      imported++
    } catch (error) {
      errors.push({ row: rowNumber, message: messageOf(error) || 'Dữ liệu không hợp lệ.' })
    }
  }

  logActivity(
    user,
    'Nhập Excel danh sách thiết bị',
    'asset',
    null,
    `${imported} thiết bị`,
    errors.length ? `${errors.length} dòng lỗi` : null
  )

  return {
    canceled: false,
    imported,
    failed: errors.length,
    errors,
    filePath
  }
}

export async function downloadImportTemplate(user: AuthUser): Promise<ExportResult> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Manager Device'
  const sheet = workbook.addWorksheet('Nhập thiết bị')

  sheet.columns = [
    { width: 16 },
    { width: 36 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 28 },
    { width: 13 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 30 }
  ]
  const headers = [
    'Mã thiết bị',
    'Tên thiết bị (*)',
    'Danh mục (*)',
    'Serial',
    'Model',
    'Hãng sản xuất',
    'Trạng thái',
    'Tình trạng',
    'Bộ phận',
    'Vị trí',
    'Người sử dụng',
    'Nhà cung cấp',
    'Ngày mua',
    'Giá mua',
    'Tháng bảo hành',
    'Tháng khấu hao',
    'Giá trị thanh lý',
    'Số hóa đơn',
    'Ghi chú'
  ]
  const headerRow = sheet.getRow(1)
  headerRow.values = headers
  styleHeader(headerRow)
  sheet.getRow(1).height = 32

  const sample = sheet.addRow([
    '',
    'Máy tính để bàn Dell OptiPlex 7010',
    'Máy tính để bàn',
    'DLL7010-2026-001',
    'OptiPlex 7010',
    'Dell',
    'Sẵn sàng',
    'Tốt',
    'Phòng IT',
    'Kho thiết bị IT',
    '',
    'Công ty CP Bán lẻ Kỹ thuật số FPT',
    formatDate(todayISO()),
    18500000,
    36,
    60,
    0,
    'HD-2026-001',
    'Dòng ví dụ - hãy xóa trước khi nhập dữ liệu thật'
  ])
  sample.font = { italic: true, color: { argb: '64748B' } }
  sample.getCell(14).numFmt = '#,##0'
  sample.getCell(17).numFmt = '#,##0'

  const statusList = Object.values(ASSET_STATUS_META)
    .map((meta) => meta.label)
    .join(',')
  const conditionList = Object.values(ASSET_CONDITION_META)
    .map((meta) => meta.label)
    .join(',')
  for (let row = 2; row <= 300; row++) {
    sheet.getCell(`G${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${statusList}"`]
    }
    sheet.getCell(`H${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${conditionList}"`]
    }
  }

  const guide = workbook.addWorksheet('Hướng dẫn')
  guide.columns = [{ width: 30 }, { width: 80 }]
  guide.addRow(['HƯỚNG DẪN NHẬP DỮ LIỆU']).font = { bold: true, size: 14 }
  const guideRows: Array<[string, string]> = [
    ['Tên thiết bị', 'Bắt buộc. Ví dụ: Máy in HP LaserJet Pro M404dn'],
    ['Danh mục', 'Bắt buộc. Nhập đúng tên hoặc mã danh mục đã có trong hệ thống.'],
    ['Mã thiết bị', 'Không bắt buộc. Để trống để hệ thống tự sinh theo tiền tố danh mục.'],
    ['Trạng thái', `Một trong các giá trị: ${statusList}`],
    ['Tình trạng', `Một trong các giá trị: ${conditionList}`],
    ['Bộ phận / Vị trí / Người sử dụng / Nhà cung cấp', 'Nhập đúng tên hoặc mã đã có trong hệ thống.'],
    ['Ngày mua', 'Định dạng dd/mm/yyyy hoặc yyyy-mm-dd.'],
    ['Giá mua / Giá trị thanh lý', 'Nhập số tiền VND, có thể dùng dấu chấm phân cách.'],
    ['Tháng bảo hành / Tháng khấu hao', 'Số tháng. Để trống để dùng giá trị mặc định của danh mục.'],
    ['Quy trình', 'Tải mẫu → điền dữ liệu → xóa dòng ví dụ → lưu tệp .xlsx → vào phần mềm chọn Nhập Excel.'],
    ['Lưu ý', 'Các dòng lỗi sẽ được báo chi tiết; các dòng hợp lệ vẫn được nhập bình thường.']
  ]
  for (const [label, value] of guideRows) {
    const row = guide.addRow([label, value])
    row.getCell(1).font = { bold: true }
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  }

  const result = await savePath(
    workbook,
    'mau-nhap-thiet-bi.xlsx',
    'Tải mẫu nhập thiết bị'
  )
  if (!result.canceled) {
    logActivity(user, 'Tải mẫu nhập thiết bị Excel', 'asset', null, 'Mẫu nhập')
  }
  return result
}
