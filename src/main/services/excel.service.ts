import ExcelJS from 'exceljs'
import { app, dialog } from 'electron'
import type {
  AssetInput,
  AssetListParams,
  AssetStatus,
  AuthUser,
  Category,
  ExportResult,
  ImportResult,
  ReportParams,
  SpecField
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
  { header: 'Phòng ban', key: 'department', width: 24 },
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
  summary.addRow(['Theo khối', 'Số lượng', 'Nguyên giá', 'Giá trị còn lại'])
  styleHeader(summary.getRow(summary.rowCount))
  for (const group of report.byBlock) {
    summary.addRow([group.label, group.count, group.purchaseValue, group.currentValue])
  }
  summary.addRow([])
  const catStart = summary.rowCount + 1
  summary.addRow(['Theo danh mục', 'Số lượng', 'Nguyên giá', 'Giá trị còn lại'])
  styleHeader(summary.getRow(summary.rowCount))
  for (const group of report.byCategory) {
    summary.addRow([group.label, group.count, group.purchaseValue, group.currentValue])
  }
  summary.addRow([])
  summary.addRow(['Theo phòng ban', 'Số lượng', 'Nguyên giá', 'Giá trị còn lại'])
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
    { header: 'Phòng ban', key: 'department', width: 22 },
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

/* --------------------------- Excel templates --------------------------- */

const SHEET_GUIDE = 'Hướng dẫn'
const SHEET_LISTS = 'Danh sách'
const SHEET_EXAMPLES = 'Ví dụ (không nhập)'
const SKIPPED_SHEETS = new Set([SHEET_GUIDE, SHEET_LISTS, SHEET_EXAMPLES])
const TEMPLATE_MAX_ROW = 500

/** Cột dùng chung cho mọi danh mục, khớp với HEADER_ALIASES khi nhập. */
interface TemplateColumn {
  header: string
  field: string
  width: number
  note?: string
  kind?: 'status' | 'condition' | 'category' | 'department' | 'location' | 'employee' | 'supplier' | 'money' | 'integer'
}

const COMMON_COLUMNS: TemplateColumn[] = [
  {
    header: 'Mã thiết bị',
    field: 'code',
    width: 15,
    note: 'Không bắt buộc. Để trống để hệ thống tự sinh theo tiền tố danh mục.'
  },
  {
    header: 'Tên thiết bị (*)',
    field: 'name',
    width: 36,
    note: 'BẮT BUỘC. Tối thiểu 2 ký tự. Ví dụ: Máy in HP LaserJet Pro M404dn.'
  },
  {
    header: 'Danh mục (*)',
    field: 'category',
    width: 22,
    kind: 'category',
    note: 'Chọn trong danh sách. Có thể để trống để dùng đúng danh mục của sheet.'
  },
  { header: 'Serial', field: 'serial', width: 22, note: 'Số serial của thiết bị (nếu có).' },
  { header: 'Model', field: 'model', width: 22, note: 'Model/series của thiết bị.' },
  { header: 'Hãng sản xuất', field: 'manufacturer', width: 18, note: 'Ví dụ: Dell, HP, Canon, Asus.' },
  {
    header: 'Trạng thái',
    field: 'status',
    width: 16,
    kind: 'status',
    note:
      'Chọn trong danh sách. "Đang sử dụng" bắt buộc phải chọn Người sử dụng; nếu chưa có nhân viên, hãy chọn trạng thái khác hoặc để trống.'
  },
  {
    header: 'Tình trạng',
    field: 'condition',
    width: 14,
    kind: 'condition',
    note: 'Chọn trong danh sách để tránh sai dữ liệu.'
  },
  {
    header: 'Phòng ban',
    field: 'department',
    width: 24,
    kind: 'department',
    note: 'Chọn trong danh sách. Để trống nếu chưa khai báo phòng ban.'
  },
  {
    header: 'Vị trí',
    field: 'location',
    width: 24,
    kind: 'location',
    note: 'Chọn trong danh sách. Để trống nếu chưa khai báo vị trí.'
  },
  {
    header: 'Người sử dụng',
    field: 'employee',
    width: 26,
    kind: 'employee',
    note: 'Chọn trong danh sách. Để trống nếu chưa khai báo nhân viên.'
  },
  {
    header: 'Nhà cung cấp',
    field: 'supplier',
    width: 28,
    kind: 'supplier',
    note: 'Chọn trong danh sách. Để trống nếu chưa khai báo nhà cung cấp.'
  },
  {
    header: 'Ngày mua',
    field: 'purchaseDate',
    width: 13,
    note: 'Định dạng dd/mm/yyyy. Ví dụ: 15/03/2026.'
  },
  {
    header: 'Giá mua',
    field: 'purchasePrice',
    width: 16,
    kind: 'money',
    note: 'Chỉ nhập số tiền, không gõ chữ "đ" hay dấu chấm. Ví dụ: 18500000.'
  },
  {
    header: 'Tháng bảo hành',
    field: 'warrantyMonths',
    width: 15,
    kind: 'integer',
    note: 'Số tháng bảo hành. Để trống để dùng mặc định của danh mục.'
  },
  {
    header: 'Tháng khấu hao',
    field: 'depreciationMonths',
    width: 15,
    kind: 'integer',
    note: 'Số tháng khấu hao. Để trống để dùng mặc định của danh mục.'
  },
  {
    header: 'Giá trị thanh lý',
    field: 'salvageValue',
    width: 16,
    kind: 'money',
    note: 'Chỉ nhập số tiền. Để trống nếu không có.'
  },
  { header: 'Số hóa đơn', field: 'invoice', width: 16, note: 'Số hóa đơn/chứng từ mua hàng.' },
  { header: 'Ghi chú', field: 'note', width: 32, note: 'Ghi chú thêm (nếu có).' }
]

function specHeaderLabel(field: SpecField): string {
  return field.unit ? `${field.label} (${field.unit})` : field.label
}

function specNote(field: SpecField): string {
  const parts: string[] = []
  if (field.type === 'select' && field.options?.length) {
    parts.push(`Chọn một giá trị: ${field.options.join(', ')}.`)
  } else if (field.type === 'number') {
    parts.push(`Chỉ nhập số${field.unit ? ` (${field.unit})` : ''}.`)
  } else {
    parts.push(field.placeholder ? `Ví dụ: ${field.placeholder}.` : 'Nhập giá trị thông số.')
  }
  return parts.join(' ')
}

function buildSpecAliasMap(categories: Category[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const category of categories) {
    for (const field of category.specSchema) {
      map.set(normalizeHeader(specHeaderLabel(field)), field.key)
      map.set(normalizeHeader(field.label), field.key)
      map.set(normalizeHeader(field.key), field.key)
    }
  }
  return map
}

function inlineListFormula(values: string[]): string | null {
  const joined = values.join(',')
  if (joined.length > 230) return null
  return `"${joined.replace(/"/g, '""')}"`
}

function addListValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  formula: string,
  kindLabel: string
): void {
  validationsOf(sheet).add(range, {
    type: 'list',
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Giá trị không hợp lệ',
    error: `Vui lòng chọn ${kindLabel} trong danh sách có sẵn.`,
    formulae: [formula]
  })
}

function addNumberValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  label: string,
  integer = false
): void {
  validationsOf(sheet).add(range, {
    type: integer ? 'whole' : 'decimal',
    operator: 'greaterThanOrEqual',
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Giá trị không hợp lệ',
    error: `${label} phải là ${integer ? 'số nguyên' : 'số'} lớn hơn hoặc bằng 0.`,
    formulae: [0]
  })
}

/** ExcelJS hỗ trợ dataValidations theo vùng nhưng chưa khai báo trong typings. */
function validationsOf(sheet: ExcelJS.Worksheet): {
  add(range: string, value: ExcelJS.DataValidation): void
} {
  return (sheet as unknown as { dataValidations: { add(range: string, value: ExcelJS.DataValidation): void } })
    .dataValidations
}

function columnLetter(columnNumber: number): string {
  let value = columnNumber
  let letters = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    value = Math.floor((value - 1) / 26)
  }
  return letters
}

/** Tạo workbook mẫu nhập thiết bị: mỗi danh mục một sheet, có dropdown chống nhập sai. */
export function buildImportTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Manager Device'
  workbook.lastModifiedBy = 'Manager Device'
  workbook.created = new Date()
  workbook.modified = new Date()

  const categories = listCategories().filter((category) => category.isActive)
  const departments = listDepartments()
  const locations = listLocations()
  const suppliers = listSuppliers()
  const employees = listEmployees()

  const statusOptions = Object.values(ASSET_STATUS_META)
    .map((meta) => meta.label)
    .filter(
      (label) => label !== ASSET_STATUS_META.in_use.label || employees.length > 0
    )
  const conditionOptions = Object.values(ASSET_CONDITION_META).map((meta) => meta.label)

  /* ------------------------------ Lists sheet ----------------------------- */
  const lists = workbook.addWorksheet(SHEET_LISTS)
  lists.state = 'hidden'
  const listColumns: Array<{ header: string; values: string[] }> = [
    { header: 'Danh mục', values: categories.map((category) => category.name) },
    { header: 'Trạng thái', values: statusOptions },
    { header: 'Tình trạng', values: conditionOptions },
    { header: 'Phòng ban', values: departments.map((item) => item.name) },
    { header: 'Vị trí', values: locations.map((item) => item.name) },
    { header: 'Nhà cung cấp', values: suppliers.map((item) => item.name) },
    { header: 'Nhân viên', values: employees.map((item) => item.fullName) }
  ]
  const listRanges = new Map<string, string>()
  listColumns.forEach((column, index) => {
    const col = columnLetter(index + 1)
    const headerCell = lists.getCell(`${col}1`)
    headerCell.value = column.header
    headerCell.font = { bold: true }
    column.values.forEach((value, rowIndex) => {
      lists.getCell(`${col}${rowIndex + 2}`).value = value
    })
    if (column.values.length > 0) {
      listRanges.set(
        column.header,
        `'${SHEET_LISTS}'!$${col}$2:$${col}$${column.values.length + 1}`
      )
    }
  })
  lists.columns = listColumns.map(() => ({ width: 28 }))

  /* ----------------------------- Data sheets ------------------------------ */
  for (const category of categories) {
    const sheet = workbook.addWorksheet(category.name.slice(0, 31), {
      properties: { tabColor: { argb: '1E40AF' } }
    })
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    const specFields = category.specSchema
    const columns: Array<TemplateColumn | { spec: SpecField }> = [
      ...COMMON_COLUMNS,
      ...specFields.map((field) => ({ spec: field }))
    ]
    sheet.columns = columns.map((column) => ({
      width: 'spec' in column ? 22 : column.width
    }))

    const headerRow = sheet.getRow(1)
    headerRow.values = columns.map((column) =>
      'spec' in column ? specHeaderLabel(column.spec) : column.header
    )
    styleHeader(headerRow)
    headerRow.height = 34
    headerRow.alignment = { vertical: 'middle', wrapText: true }

    columns.forEach((column, index) => {
      const cell = headerRow.getCell(index + 1)
      if ('spec' in column) {
        cell.note = specNote(column.spec)
      } else if (column.note) {
        cell.note = column.note
      }
    })

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length }
    }

    const lastRow = TEMPLATE_MAX_ROW
    columns.forEach((column, index) => {
      const letter = columnLetter(index + 1)
      const range = `${letter}2:${letter}${lastRow}`
      if ('spec' in column) {
        const field = column.spec
        if (field.type === 'select' && field.options?.length) {
          const formula = inlineListFormula(field.options)
          if (formula) addListValidation(sheet, range, formula, field.label)
        } else if (field.type === 'number') {
          addNumberValidation(sheet, range, field.label)
        }
        return
      }
      switch (column.kind) {
        case 'status':
        case 'condition': {
          const key = column.kind === 'status' ? 'Trạng thái' : 'Tình trạng'
          const formula = listRanges.get(key)
          if (formula) addListValidation(sheet, range, formula, column.header.toLowerCase())
          break
        }
        case 'department':
        case 'location':
        case 'employee':
        case 'supplier': {
          const key =
            column.kind === 'department'
              ? 'Phòng ban'
              : column.kind === 'location'
                ? 'Vị trí'
                : column.kind === 'employee'
                  ? 'Nhân viên'
                  : 'Nhà cung cấp'
          const formula = listRanges.get(key)
          if (formula) addListValidation(sheet, range, formula, column.header.toLowerCase())
          break
        }
        case 'category': {
          const formula = inlineListFormula([category.name])
          if (formula) addListValidation(sheet, range, formula, 'danh mục')
          break
        }
        case 'money':
          addNumberValidation(sheet, range, column.header)
          break
        case 'integer':
          addNumberValidation(sheet, range, column.header, true)
          break
        default:
          break
      }
    })

    // Định dạng hiển thị tiền tệ cho cột giá mua / giá trị thanh lý.
    columns.forEach((column, index) => {
      if ('spec' in column) return
      if (column.kind === 'money') {
        sheet.getColumn(index + 1).numFmt = '#,##0'
        sheet.getColumn(index + 1).width = column.width
      }
    })
  }

  /* ---------------------------- Hướng dẫn sheet --------------------------- */
  const guide = workbook.addWorksheet(SHEET_GUIDE, { properties: { tabColor: { argb: '16A34A' } } })
  guide.columns = [{ width: 30 }, { width: 92 }, { width: 26 }]
  const title = guide.addRow(['HƯỚNG DẪN NHẬP THIẾT BỊ TỪ EXCEL'])
  title.font = { bold: true, size: 15, color: { argb: '1E3A8A' } }
  guide.mergeCells('A1:C1')
  guide.addRow([])
  const intro = guide.addRow([
    'Mẫu này được tạo từ dữ liệu danh mục hiện có. Mỗi danh mục có một sheet riêng; chỉ nhập vào đúng sheet loại thiết bị.',
    '',
    ''
  ])
  intro.getCell(1).alignment = { wrapText: true }
  guide.mergeCells(`A${intro.number}:C${intro.number}`)
  guide.addRow([])

  const section = (text: string): void => {
    const row = guide.addRow([text])
    row.font = { bold: true, size: 12, color: { argb: '1E40AF' } }
    guide.mergeCells(`A${row.number}:C${row.number}`)
  }
  const bullet = (text: string): void => {
    const row = guide.addRow([`•  ${text}`])
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' }
    guide.mergeCells(`A${row.number}:C${row.number}`)
  }

  section('QUY TẮC BẮT BUỘC')
  bullet('Mỗi dòng là một thiết bị. Không sửa tên cột, không chèn dòng phía trên dòng tiêu đề.')
  bullet('Tên thiết bị là bắt buộc, tối thiểu 2 ký tự.')
  bullet('Cột Danh mục có thể để trống — hệ thống tự dùng đúng danh mục của sheet đang nhập.')
  bullet('Trạng thái, Tình trạng, Phòng ban, Vị trí, Người sử dụng, Nhà cung cấp chỉ chọn từ dropdown để tránh sai dữ liệu.')
  bullet('Trạng thái "Đang sử dụng" bắt buộc phải chọn Người sử dụng. Nếu hệ thống chưa có nhân viên, trạng thái này sẽ không xuất hiện trong dropdown — hãy để trống hoặc chọn trạng thái khác.')
  bullet('Các cột thông số kỹ thuật (CPU, RAM, GPU, ổ cứng, hệ điều hành, tốc độ in…) có dropdown hoặc chỉ nhận số.')
  bullet('Ngày mua nhập dd/mm/yyyy. Tiền chỉ nhập số, không gõ "đ" hoặc dấu chấm phân cách.')
  bullet('Để trống Mã thiết bị nếu muốn hệ thống tự sinh mã theo danh mục.')
  bullet('Dòng trống được bỏ qua. Dòng lỗi sẽ được báo chi tiết, các dòng hợp lệ vẫn được nhập.')
  bullet('Các cột Phòng ban/Vị trí/Người sử dụng/Nhà cung cấp: để trống nếu chưa khai báo trong hệ thống, hoặc chọn đúng giá trị có sẵn.')
  guide.addRow([])

  section('DANH MỤC TRONG MẪU')
  const catHeader = guide.addRow(['Mã', 'Tên danh mục', 'Số trường thông số'])
  catHeader.font = { bold: true }
  for (const category of categories) {
    guide.addRow([category.code, category.name, category.specSchema.length])
  }
  guide.addRow([])

  section('VÍ DỤ CÁCH ĐIỀN')
  const exampleHeader = guide.addRow([
    'Danh mục',
    'Tên thiết bị / Cấu hình',
    'Ghi chú'
  ])
  exampleHeader.font = { bold: true }
  const examples: Array<[string, string, string]> = [
    ['Máy tính để bàn', 'Máy tính để bàn Dell OptiPlex 7010', 'CPU: Intel Core i5-12400; RAM: 16 GB; Ổ cứng: SSD 512GB; OS: Windows 11 Pro'],
    ['Laptop', 'Laptop Dell Latitude 5440', 'CPU: Intel Core i7-1355U; RAM: 16 GB; Ổ cứng: SSD 1TB; OS: Windows 11 Pro'],
    ['Máy in', 'Máy in HP LaserJet Pro M404dn', 'Công nghệ in: Laser đen trắng; Khổ giấy: A4; Kết nối: USB + LAN'],
    ['Máy scan', 'Máy scan Fujitsu fi-7160', 'Loại máy: ADF; Độ phân giải: 600 dpi; Khổ giấy: A4']
  ]
  for (const row of examples) guide.addRow(row)
  guide.addRow([])

  section('QUY TRÌNH NHẬP')
  bullet('1. Mở đúng sheet danh mục (ví dụ "Máy in") và điền từng dòng thiết bị.')
  bullet('2. Lưu tệp dưới định dạng .xlsx.')
  bullet('3. Trong phần mềm: Thiết bị → Nhập Excel → chọn tệp vừa lưu.')
  bullet('4. Kiểm tra kết quả nhập; sửa các dòng báo lỗi rồi nhập lại nếu cần.')
  bullet('Nếu danh mục hoặc phòng ban/vị trí/nhân viên thay đổi, hãy tải lại mẫu mới từ phần mềm để cập nhật dropdown.')

  // Đưa sheet Hướng dẫn lên đầu để mở file là thấy ngay.
  ;(guide as unknown as { orderNo: number }).orderNo = 0

  /* --------------------------- Ví dụ sheet (bỏ qua) ---------------------- */
  const exampleSheet = workbook.addWorksheet(SHEET_EXAMPLES)
  exampleSheet.state = 'hidden'
  const exampleColumns = ['Danh mục', 'Tên thiết bị', 'Serial', 'Model', 'Hãng sản xuất', 'Trạng thái', 'Tình trạng', 'Ngày mua', 'Giá mua', 'Ghi chú']
  exampleSheet.addRow(exampleColumns).font = { bold: true }
  exampleSheet.addRow([
    'Máy tính để bàn',
    'Máy tính để bàn Dell OptiPlex 7010',
    'DLL7010-2026-001',
    'OptiPlex 7010',
    'Dell',
    'Sẵn sàng',
    'Tốt',
    '15/03/2026',
    18500000,
    'Dòng ví dụ - không được nhập'
  ])
  exampleSheet.addRow([
    'Máy in',
    'Máy in HP LaserJet Pro M404dn',
    'HP404-2026-001',
    'LaserJet Pro M404dn',
    'HP',
    'Đang sử dụng',
    'Tốt',
    '20/03/2026',
    6500000,
    'Dòng ví dụ - không được nhập'
  ])

  return workbook
}

export async function downloadImportTemplate(user: AuthUser): Promise<ExportResult> {
  const workbook = buildImportTemplateWorkbook()
  const result = await savePath(workbook, 'mau-nhap-thiet-bi.xlsx', 'Tải mẫu nhập thiết bị')
  if (!result.canceled) {
    logActivity(user, 'Tải mẫu nhập thiết bị Excel', 'asset', null, 'Mẫu nhập')
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
  let text = cellText(value).replace(/[^\d.,-]/g, '')
  if (!text) return 0
  // Hỗ trợ cả 18.500.000 (VN) và 18,500,000 (US), cũng như 1.500,50.
  if (text.includes('.') && text.includes(',')) {
    text = text.replace(/\./g, '').replace(/,/g, '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '')
  } else if (/^\d{1,3}(,\d{3})+$/.test(text)) {
    text = text.replace(/,/g, '')
  } else {
    text = text.replace(/,/g, '.')
  }
  const number = Number(text)
  return Number.isFinite(number) ? number : 0
}

function parseSpecNumberValue(value: string): number | null {
  let text = value.replace(/[^\d.,-]/g, '')
  if (!text) return null
  if (text.includes('.') && text.includes(',')) {
    text = text.replace(/\./g, '').replace(/,/g, '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '')
  } else if (/^\d{1,3}(,\d{3})+$/.test(text)) {
    text = text.replace(/,/g, '')
  } else {
    text = text.replace(/,/g, '.')
  }
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

interface SheetHeader {
  headerRow: number
  columnMap: Map<string, number>
}

function scanSheetHeader(
  sheet: ExcelJS.Worksheet,
  specAliases: Map<string, string>
): SheetHeader | null {
  for (let rowNumber = 1; rowNumber <= Math.min(15, sheet.rowCount); rowNumber++) {
    const candidate = new Map<string, number>()
    sheet.getRow(rowNumber).eachCell((cell, colNumber) => {
      const header = normalizeHeader(cellText(cell.value))
      if (!header) return
      const common = HEADER_ALIASES[header]
      if (common) {
        candidate.set(common, colNumber)
        return
      }
      const specKey = specAliases.get(header)
      if (specKey) candidate.set(`spec:${specKey}`, colNumber)
    })
    if (candidate.has('name') && candidate.has('category')) {
      return { headerRow: rowNumber, columnMap: candidate }
    }
  }
  return null
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

  const categories = listCategories().filter((category) => category.isActive)
  const specAliases = buildSpecAliasMap(categories)
  const categoryBySheet = new Map<string, Category>()
  for (const category of categories) {
    categoryBySheet.set(normalizeForSearch(category.name), category)
  }

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
  let matchedSheets = 0

  const sheets = workbook.worksheets.filter((sheet) => !SKIPPED_SHEETS.has(sheet.name.trim()))

  for (const sheet of sheets) {
    if (errors.length >= 100) break
    const header = scanSheetHeader(sheet, specAliases)
    if (!header) continue
    matchedSheets += 1

    const columnMap = header.columnMap
    const sheetHint = categoryBySheet.get(normalizeForSearch(sheet.name.trim()))
    const maxRow = sheet.rowCount

    for (let rowNumber = header.headerRow + 1; rowNumber <= maxRow; rowNumber++) {
      if (errors.length >= 100) break
      const row = sheet.getRow(rowNumber)
      const get = (field: string): ExcelJS.CellValue => {
        const col = columnMap.get(field)
        return col ? row.getCell(col).value : null
      }

      const name = cellText(get('name'))
      const categoryCell = cellText(get('category'))
      if (!name) {
        const hasData = Array.from(columnMap.values()).some((col) =>
          cellText(row.getCell(col).value)
        )
        if (!hasData) continue
        errors.push({ row: rowNumber, message: `[${sheet.name}] Thiếu tên thiết bị.` })
        continue
      }

      try {
        const categoryName = categoryCell || sheetHint?.name || ''
        if (!categoryName) {
          throw new Error('Thiếu danh mục thiết bị. Hãy chọn danh mục hoặc nhập vào đúng sheet.')
        }
        const category = findByCodeOrName(categories, categoryName)
        if (!category) throw new Error(`Không tìm thấy danh mục "${categoryName}".`)

        const departmentName = cellText(get('department'))
        const department = departmentName ? findByCodeOrName(departments, departmentName) : undefined
        if (departmentName && !department) {
          throw new Error(`Không tìm thấy phòng ban "${departmentName}".`)
        }
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

        const specs: Record<string, string | number> = {}
        for (const field of category.specSchema) {
          const col = columnMap.get(`spec:${field.key}`)
          if (!col) continue
          const raw = cellText(row.getCell(col).value)
          if (!raw) continue
          if (field.type === 'number') {
            const number = parseSpecNumberValue(raw)
            if (number === null) {
              throw new Error(`${field.label} phải là số${field.unit ? ` (${field.unit})` : ''}.`)
            }
            specs[field.key] = number
          } else if (field.type === 'select' && field.options?.length) {
            const canonical = field.options.find(
              (option) => normalizeForSearch(option) === normalizeForSearch(raw)
            )
            if (!canonical) {
              throw new Error(
                `${field.label} "${raw}" không hợp lệ. Giá trị hợp lệ: ${field.options.join(', ')}.`
              )
            }
            specs[field.key] = canonical
          } else {
            specs[field.key] = raw
          }
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
          specs: Object.keys(specs).length > 0 ? specs : undefined,
          note: cellText(get('note')) || null
        }

        const parsed = assetSchema.safeParse(input)
        if (!parsed.success) {
          throw new Error(parsed.error.issues.map((issue) => issue.message).join('; '))
        }

        createAsset(parsed.data as AssetInput, user)
        imported++
      } catch (error) {
        errors.push({ row: rowNumber, message: `[${sheet.name}] ${messageOf(error)}` })
      }
    }
  }

  if (matchedSheets === 0 && errors.length === 0) {
    return {
      canceled: false,
      imported: 0,
      failed: 1,
      errors: [
        {
          row: 0,
          message:
            'Không tìm thấy dòng tiêu đề hợp lệ. Cần có cột "Tên thiết bị" và "Danh mục" (hoặc dùng mẫu tải từ phần mềm).'
        }
      ]
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
