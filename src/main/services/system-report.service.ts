import ExcelJS from 'exceljs'
import { app, dialog } from 'electron'
import type {
  AuthUser,
  ExportResult,
  ImportResult,
  InformationSystem,
  InformationSystemInput,
  InformationSystemListParams,
  SystemLevel,
  SystemStatus
} from '../../shared/types'
import {
  levelDistribution,
  listAllSystems,
  listSystems,
  saveSystem,
  summarizeSystems,
  systemIssues,
  systemWarnings
} from './system.service'
import { getInfrastructure } from './infrastructure.service'
import { getSettings } from './settings.service'
import { listDepartments } from './catalog.service'
import { logActivity } from './log.service'
import {
  SYSTEM_HOSTING_META,
  SYSTEM_LEVEL_META,
  SYSTEM_STATUS_META,
  systemLevelLabel
} from '../../shared/constants'
import { formatDate, formatDateTime, normalizeForSearch, todayISO } from '../../shared/utils'
import { escapeHtml, saveHtmlAsPdf, wrapReportHtml } from './pdf.service'

const HEADER_FILL = '1E40AF'
const HEADER_FONT = 'FFFFFF'
const TITLE_FILL = 'EFF6FF'

/* -------------------------------- Helpers ------------------------------- */

function styleHeader(row: ExcelJS.Row): void {
  row.height = 26
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

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: Array<{ header: string; key: string; width: number }>
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = headers
  styleHeader(sheet.getRow(1))
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  }
  return sheet
}

function titleRows(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  columns: number
): void {
  sheet.spliceRows(1, 0, [], [])
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
  sheet.views = [{ state: 'frozen', ySplit: 3 }]
  if (sheet.autoFilter) {
    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: columns }
    }
  }
}

function periodLabel(params: InformationSystemListParams): string {
  if (params.fromDate && params.toDate) {
    return `Từ ngày ${formatDate(params.fromDate)} đến ngày ${formatDate(params.toDate)}`
  }
  if (params.fromDate) return `Từ ngày ${formatDate(params.fromDate)}`
  if (params.toDate) return `Đến ngày ${formatDate(params.toDate)}`
  return `Tính đến ngày ${formatDate(todayISO())}`
}

async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  defaultName: string,
  title: string
): Promise<ExportResult> {
  const result = await dialog.showSaveDialog({
    title,
    defaultPath: `${app.getPath('documents')}/${defaultName}`,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  await workbook.xlsx.writeFile(result.filePath)
  return { canceled: false, filePath: result.filePath }
}

function statusLabel(status: SystemStatus): string {
  return SYSTEM_STATUS_META[status]?.label ?? status
}

/* ----------------------------- Excel export ----------------------------- */

const SYSTEM_HEADERS: Array<{ header: string; key: string; width: number }> = [
  { header: 'STT', key: 'index', width: 6 },
  { header: 'Mã HTTT', key: 'code', width: 14 },
  { header: 'Tên hệ thống thông tin', key: 'name', width: 38 },
  { header: 'Mô tả / chức năng chính', key: 'description', width: 40 },
  { header: 'Đơn vị quản lý, vận hành', key: 'managingUnit', width: 28 },
  { header: 'Phòng ban', key: 'department', width: 24 },
  { header: 'Cấp độ HTTT', key: 'level', width: 16 },
  { header: 'Số quyết định phê duyệt', key: 'decisionNumber', width: 22 },
  { header: 'Ngày ký quyết định', key: 'decisionDate', width: 16 },
  { header: 'Cơ quan ban hành', key: 'decisionAgency', width: 26 },
  { header: 'Trạng thái', key: 'status', width: 18 },
  { header: 'Hình thức triển khai', key: 'hostingType', width: 22 },
  { header: 'Máy chủ / hạ tầng chạy HTTT', key: 'hostingDetail', width: 28 },
  { header: 'Thiết bị liên kết', key: 'asset', width: 22 },
  { header: 'Tệp hồ sơ', key: 'files', width: 12 },
  { header: 'Cảnh báo', key: 'warnings', width: 42 },
  { header: 'Người tạo', key: 'createdBy', width: 20 },
  { header: 'Cập nhật lúc', key: 'updatedAt', width: 20 }
]

export async function exportSystemsExcel(
  params: InformationSystemListParams,
  user: AuthUser
): Promise<ExportResult> {
  const systems = listAllSystems(params)
  const infrastructure = getInfrastructure()
  const kpis = summarizeSystems(systems)
  const settings = getSettings()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Manager Device'
  workbook.created = new Date()

  /* ------------------------------ Tổng hợp ------------------------------ */
  const summary = workbook.addWorksheet('Tổng hợp hạ tầng')
  summary.columns = [
    { header: 'Chỉ tiêu', key: 'label', width: 42 },
    { header: 'Giá trị', key: 'value', width: 20 },
    { header: 'Ghi chú', key: 'note', width: 46 }
  ]
  styleHeader(summary.getRow(1))
  summary.addRows([
    { label: 'Số máy chủ vật lý', value: infrastructure.physicalServers, note: '' },
    { label: 'Số máy ảo', value: infrastructure.virtualServers, note: '' },
    { label: 'Số switch', value: infrastructure.switches, note: '' },
    { label: 'Số firewall', value: infrastructure.firewalls, note: '' },
    { label: 'Tổng số thiết bị hạ tầng', value: kpis.infrastructureTotal, note: '' },
    { label: 'Tổng số hệ thống thông tin', value: kpis.total, note: '' },
    {
      label: 'HTTT đã phê duyệt cấp độ',
      value: kpis.approved,
      note: `Tỷ lệ ${kpis.approvalRate}%`
    },
    { label: 'HTTT chưa xác định cấp độ', value: kpis.unsetLevel, note: '' },
    { label: 'HTTT cấp độ 3 trở lên', value: kpis.level3Plus, note: '' },
    { label: 'HTTT có cảnh báo hồ sơ', value: kpis.warningCount, note: '' }
  ])
  titleRows(
    summary,
    'TỔNG HỢP HẠ TẦNG CNTT VÀ HỆ THỐNG THÔNG TIN',
    `${settings.companyName || 'Đơn vị'} · ${periodLabel(params)}`,
    3
  )
  summary.addRow([])
  summary.addRow(['Máy chủ đang chạy HTTT (chi tiết)', infrastructure.note ?? ''])
  if (infrastructure.updatedAt) {
    summary.addRow([
      'Cập nhật hạ tầng gần nhất',
      `${formatDateTime(infrastructure.updatedAt)}${
        infrastructure.updatedByName ? ` · ${infrastructure.updatedByName}` : ''
      }`
    ])
  }

  /* --------------------------- Phân bố cấp độ --------------------------- */
  const levelSheet = workbook.addWorksheet('Phân bố cấp độ')
  levelSheet.columns = [
    { header: 'Cấp độ', key: 'label', width: 32 },
    { header: 'Số lượng HTTT', key: 'count', width: 18 }
  ]
  styleHeader(levelSheet.getRow(1))
  levelSheet.addRows(
    levelDistribution(systems).map((item) => ({ label: item.label, count: item.count }))
  )
  levelSheet.addRow({ label: 'Tổng cộng', count: kpis.total })
  levelSheet.getRow(levelSheet.rowCount).font = { bold: true }
  titleRows(
    levelSheet,
    'PHÂN BỐ HỆ THỐNG THÔNG TIN THEO CẤP ĐỘ AN TOÀN',
    periodLabel(params),
    2
  )

  /* ---------------------------- Danh sách HTTT --------------------------- */
  const sheet = addSheet(workbook, 'Danh sách HTTT', SYSTEM_HEADERS)
  systems.forEach((system, index) => {
    sheet.addRow({
      index: index + 1,
      code: system.code,
      name: system.name,
      description: system.description ?? '',
      managingUnit: system.managingUnit,
      department: system.departmentName ?? '',
      level: systemLevelLabel(system.level),
      decisionNumber: system.decisionNumber ?? '',
      decisionDate: formatDate(system.decisionDate),
      decisionAgency: system.decisionAgency ?? '',
      status: statusLabel(system.status),
      hostingType: SYSTEM_HOSTING_META[system.hostingType]?.label ?? system.hostingType,
      hostingDetail: system.hostingDetail ?? '',
      asset: system.assetCode ? `${system.assetCode} - ${system.assetName ?? ''}` : '',
      files: system.fileCount,
      warnings: systemIssues(system).join('; '),
      createdBy: system.createdByName ?? '',
      updatedAt: formatDateTime(system.updatedAt)
    })
  })
  sheet.getColumn('level').alignment = { horizontal: 'center' }
  sheet.getColumn('index').alignment = { horizontal: 'center' }
  sheet.getColumn('files').alignment = { horizontal: 'center' }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.alignment = { vertical: 'top', wrapText: true }
  })
  titleRows(
    sheet,
    'DANH SÁCH HỆ THỐNG THÔNG TIN',
    `${periodLabel(params)} · Tổng số: ${systems.length} hệ thống`,
    SYSTEM_HEADERS.length
  )

  /* ------------------------------- Cảnh báo ------------------------------ */
  const warnings = systemWarnings(systems)
  if (warnings.length > 0) {
    const warningSheet = addSheet(workbook, 'Cảnh báo', [
      { header: 'Mã HTTT', key: 'code', width: 16 },
      { header: 'Tên HTTT', key: 'name', width: 40 },
      { header: 'Cấp độ', key: 'level', width: 16 },
      { header: 'Nội dung cảnh báo', key: 'issues', width: 70 }
    ])
    warnings.forEach((warning) => {
      warningSheet.addRow({
        code: warning.code,
        name: warning.name,
        level: systemLevelLabel(warning.level),
        issues: warning.issues.join('; ')
      })
    })
  }

  const result = await saveWorkbook(
    workbook,
    `Bao-cao-he-thong-thong-tin-${todayISO()}.xlsx`,
    'Xuất báo cáo HTTT và hạ tầng CNTT'
  )
  if (!result.canceled) {
    logActivity(
      user,
      'Xuất Excel HTTT',
      'information_system',
      null,
      `${systems.length} hệ thống`,
      result.filePath ?? null
    )
  }
  return result
}

/* -------------------------------- PDF ----------------------------------- */

export async function exportSystemsPdf(
  params: InformationSystemListParams,
  user: AuthUser
): Promise<ExportResult> {
  const systems = listAllSystems(params)
  const infrastructure = getInfrastructure()
  const kpis = summarizeSystems(systems)
  const settings = getSettings()

  const levelRows = levelDistribution(systems)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.label)}</td><td class="num">${item.count}</td><td class="num">${
          kpis.total ? Math.round((item.count / kpis.total) * 1000) / 10 : 0
        }%</td></tr>`
    )
    .join('')

  const rows = systems
    .map((system, index) => {
      const issues = systemIssues(system)
      return `<tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(system.code)}</td>
        <td>${escapeHtml(system.name)}</td>
        <td>${escapeHtml(system.managingUnit)}</td>
        <td class="center">${escapeHtml(systemLevelLabel(system.level))}</td>
        <td>${escapeHtml(system.decisionNumber ?? '—')}</td>
        <td>${escapeHtml(formatDate(system.decisionDate) || '—')}</td>
        <td>${escapeHtml(statusLabel(system.status))}</td>
        <td>${issues.length ? `<span class="danger">${escapeHtml(issues.join('; '))}</span>` : '—'}</td>
      </tr>`
    })
    .join('')

  const body = `
  <div class="cards">
    <div class="card"><div class="label">Máy chủ vật lý</div><div class="value">${infrastructure.physicalServers}</div></div>
    <div class="card"><div class="label">Máy ảo</div><div class="value">${infrastructure.virtualServers}</div></div>
    <div class="card"><div class="label">Switch</div><div class="value">${infrastructure.switches}</div></div>
    <div class="card"><div class="label">Firewall</div><div class="value">${infrastructure.firewalls}</div></div>
    <div class="card"><div class="label">Tổng HTTT</div><div class="value">${kpis.total}</div></div>
    <div class="card"><div class="label">Đã phê duyệt</div><div class="value">${kpis.approvalRate}%</div></div>
  </div>
  <h2>I. Số liệu hạ tầng CNTT</h2>
  <table>
    <thead><tr><th>Chỉ tiêu</th><th class="num">Số lượng</th></tr></thead>
    <tbody>
      <tr><td>Máy chủ vật lý</td><td class="num">${infrastructure.physicalServers}</td></tr>
      <tr><td>Máy ảo</td><td class="num">${infrastructure.virtualServers}</td></tr>
      <tr><td>Switch</td><td class="num">${infrastructure.switches}</td></tr>
      <tr><td>Firewall</td><td class="num">${infrastructure.firewalls}</td></tr>
      <tr><td><strong>Tổng cộng</strong></td><td class="num"><strong>${kpis.infrastructureTotal}</strong></td></tr>
    </tbody>
  </table>
  ${infrastructure.note ? `<p class="muted">Ghi chú hạ tầng: ${escapeHtml(infrastructure.note)}</p>` : ''}

  <h2>II. Phân bố HTTT theo cấp độ an toàn</h2>
  <table>
    <thead><tr><th>Cấp độ</th><th class="num">Số lượng</th><th class="num">Tỷ lệ</th></tr></thead>
    <tbody>${levelRows}</tbody>
  </table>

  <h2>III. Danh sách hệ thống thông tin</h2>
  <table>
    <thead>
      <tr>
        <th>STT</th><th>Mã HTTT</th><th>Tên HTTT</th><th>Đơn vị quản lý</th>
        <th>Cấp độ</th><th>Số QĐ</th><th>Ngày ký</th><th>Trạng thái</th><th>Cảnh báo</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="9" class="center">Chưa có dữ liệu</td></tr>'}</tbody>
  </table>

  <div class="sign">
    <div><strong>Người lập biểu</strong><div class="line">Ký, ghi rõ họ tên</div></div>
    <div><strong>Trưởng phòng CNTT</strong><div class="line">Ký, ghi rõ họ tên</div></div>
    <div><strong>Lãnh đạo đơn vị</strong><div class="line">Ký, ghi rõ họ tên</div></div>
  </div>`

  const html = wrapReportHtml({
    title: 'Báo cáo hạ tầng CNTT và hệ thống thông tin',
    subtitle: `${settings.companyName || 'Đơn vị'} — ${settings.companyAddress || ''}`,
    body,
    footer: `Lập lúc ${formatDateTime(new Date().toISOString())} · ${periodLabel(params)}`,
    landscape: true
  })

  const result = await saveHtmlAsPdf(
    html,
    `Bao-cao-he-thong-thong-tin-${todayISO()}.pdf`,
    'Xuất báo cáo PDF HTTT và hạ tầng CNTT',
    { landscape: true }
  )
  if (!result.canceled) {
    logActivity(
      user,
      'Xuất PDF HTTT',
      'information_system',
      null,
      `${systems.length} hệ thống`,
      result.filePath ?? null
    )
  }
  return result
}

/* ------------------------------- Template ------------------------------- */

const TEMPLATE_HEADERS = [
  'Mã HTTT',
  'Tên hệ thống thông tin',
  'Mô tả / chức năng chính',
  'Đơn vị quản lý, vận hành',
  'Phòng ban',
  'Cấp độ HTTT',
  'Số quyết định phê duyệt',
  'Ngày ký quyết định',
  'Cơ quan ban hành',
  'Trạng thái',
  'Hình thức triển khai',
  'Chi tiết máy chủ / hạ tầng'
]

const TEMPLATE_SAMPLES: string[][] = [
  [
    'HTTT-0001',
    'Hệ thống quản lý văn bản và điều hành',
    'Tiếp nhận, xử lý văn bản đi - đến; điều hành tác nghiệp',
    'Văn phòng UBND xã',
    'Văn phòng',
    '3',
    '85/QĐ-UBND',
    '2024-06-15',
    'UBND xã An Bình',
    'Đang vận hành',
    'Máy ảo',
    'Máy chủ ảo ESXi-01'
  ],
  [
    'HTTT-0002',
    'Hệ thống một cửa điện tử',
    'Tiếp nhận và giải quyết thủ tục hành chính',
    'Bộ phận Một cửa',
    'Bộ phận Một cửa',
    '2',
    '86/QĐ-UBND',
    '2024-07-02',
    'UBND xã An Bình',
    'Đang vận hành',
    'Máy chủ vật lý',
    'Máy chủ vật lý tại phòng máy'
  ]
]

const HEADER_ALIASES: Record<string, string> = {
  'ma httt': 'code',
  'ma he thong': 'code',
  code: 'code',
  'ten httt': 'name',
  'ten he thong thong tin': 'name',
  name: 'name',
  'mo ta': 'description',
  'mo ta chuc nang chinh': 'description',
  description: 'description',
  'don vi quan ly': 'managingUnit',
  'don vi quan ly van hanh': 'managingUnit',
  'don vi van hanh': 'managingUnit',
  'phong ban': 'department',
  department: 'department',
  'cap do': 'level',
  'cap do httt': 'level',
  level: 'level',
  'so quyet dinh': 'decisionNumber',
  'so quyet dinh phe duyet': 'decisionNumber',
  'so qd': 'decisionNumber',
  decision: 'decisionNumber',
  'ngay ky': 'decisionDate',
  'ngay ky quyet dinh': 'decisionDate',
  'co quan ban hanh': 'decisionAgency',
  'trang thai': 'status',
  status: 'status',
  'hinh thuc trien khai': 'hostingType',
  hosting: 'hostingType',
  'chi tiet may chu': 'hostingDetail',
  'may chu': 'hostingDetail',
  'ha tang': 'hostingDetail'
}

/** Chuẩn hóa tiêu đề cột: bỏ dấu, dấu câu và khoảng trắng thừa. */
function normalizeHeader(value: string): string {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const HEADER_BY_KEY = new Map<string, string>()
for (const [key, field] of Object.entries(HEADER_ALIASES)) {
  HEADER_BY_KEY.set(normalizeHeader(key), field)
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
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

export async function downloadSystemImportTemplate(user: AuthUser): Promise<ExportResult> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Manager Device'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Danh sách HTTT')
  sheet.columns = TEMPLATE_HEADERS.map((header, index) => ({
    header,
    key: `c${index}`,
    width: index === 1 || index === 2 ? 38 : 22
  }))
  styleHeader(sheet.getRow(1))
  TEMPLATE_SAMPLES.forEach((sample) => {
    sheet.addRow(sample)
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const guide = workbook.addWorksheet('Hướng dẫn')
  guide.columns = [{ header: 'Nội dung', key: 'text', width: 110 }]
  styleHeader(guide.getRow(1))
  const notes = [
    '1. Nhập dữ liệu vào sheet "Danh sách HTTT", mỗi dòng là một hệ thống thông tin.',
    '2. Cột "Mã HTTT": bỏ trống để hệ thống tự sinh (HTTT-0001, HTTT-0002...). Nếu nhập mã đã tồn tại, dòng đó sẽ được cập nhật.',
    '3. Cột "Tên hệ thống thông tin" và "Đơn vị quản lý, vận hành" là bắt buộc.',
    '4. Cột "Cấp độ HTTT" chỉ nhận giá trị 1, 2, 3, 4, 5 hoặc "Chưa xác định".',
    '5. Khi đã có cấp độ, bắt buộc phải nhập "Số quyết định phê duyệt".',
    '6. Số quyết định không được trùng giữa các HTTT, trừ khi bật tùy chọn trong Cài đặt.',
    '7. Cột "Phòng ban" nhập tên hoặc mã phòng ban đã có trong danh mục.',
    '8. Cột "Trạng thái" nhận: Đang vận hành, Đang xây dựng, Ngừng hoạt động.',
    '9. Cột "Hình thức triển khai" nhận: Máy chủ vật lý, Máy ảo, Điện toán đám mây, Kết hợp, Chưa xác định.',
    '10. Ngày tháng nhập theo định dạng YYYY-MM-DD (ví dụ 2024-06-15).',
    '11. Các dòng có lỗi sẽ không được lưu và hiển thị trong báo cáo kết quả nhập dữ liệu.'
  ]
  notes.forEach((text) => guide.addRow([text]))

  const result = await saveWorkbook(
    workbook,
    'Mau-nhap-he-thong-thong-tin.xlsx',
    'Tải mẫu nhập dữ liệu HTTT'
  )
  if (!result.canceled) {
    logActivity(user, 'Tải mẫu nhập HTTT', 'information_system', null, 'Mẫu Excel HTTT')
  }
  return result
}

/* -------------------------------- Import -------------------------------- */

const LEVEL_BY_LABEL = new Map<string, SystemLevel>()
for (const level of [1, 2, 3, 4, 5] as SystemLevel[]) {
  LEVEL_BY_LABEL.set(String(level), level)
  LEVEL_BY_LABEL.set(`cap do ${level}`, level)
  LEVEL_BY_LABEL.set(normalizeForSearch(SYSTEM_LEVEL_META[level].label), level)
}

const STATUS_BY_LABEL = new Map<string, SystemStatus>()
for (const [key, meta] of Object.entries(SYSTEM_STATUS_META)) {
  STATUS_BY_LABEL.set(normalizeForSearch(meta.label), key as SystemStatus)
  STATUS_BY_LABEL.set(normalizeForSearch(key), key as SystemStatus)
}

const HOSTING_BY_LABEL = new Map<string, InformationSystemInput['hostingType']>()
for (const [key, meta] of Object.entries(SYSTEM_HOSTING_META)) {
  HOSTING_BY_LABEL.set(normalizeForSearch(meta.label), key as InformationSystemInput['hostingType'])
  HOSTING_BY_LABEL.set(normalizeForSearch(key), key as InformationSystemInput['hostingType'])
}

function parseLevel(value: string): SystemLevel | null {
  const term = normalizeForSearch(value)
  if (!term || term.includes('chua xac dinh') || term === 'khong') return null
  const direct = LEVEL_BY_LABEL.get(term)
  if (direct) return direct
  const digits = term.replace(/[^0-9]/g, '')
  if (digits.length === 1) {
    const level = Number(digits)
    if (level >= 1 && level <= 5) return level as SystemLevel
  }
  throw new Error(`Cấp độ "${value}" không hợp lệ (chỉ nhận 1-5 hoặc "Chưa xác định").`)
}

function parseDateText(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    return `${match[3]}-${month}-${day}`
  }
  throw new Error(`Ngày "${value}" không hợp lệ (định dạng YYYY-MM-DD).`)
}

export async function importSystemsExcel(user: AuthUser): Promise<ImportResult> {
  const picked = await dialog.showOpenDialog({
    title: 'Chọn tệp Excel để nhập hệ thống thông tin',
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

  const sheet = workbook.worksheets.find((item) => item.name !== 'Hướng dẫn') ?? workbook.worksheets[0]
  if (!sheet) {
    return {
      canceled: false,
      imported: 0,
      failed: 1,
      errors: [{ row: 0, message: 'Tệp Excel không có sheet dữ liệu.' }]
    }
  }

  const headerRow = sheet.getRow(1)
  const columnMap = new Map<string, number>()
  headerRow.eachCell((cell, colNumber) => {
    const text = normalizeHeader(cellText(cell.value))
    if (!text) return
    const field = HEADER_BY_KEY.get(text)
    if (field && !columnMap.has(field)) columnMap.set(field, colNumber)
  })
  if (!columnMap.has('name')) {
    return {
      canceled: false,
      imported: 0,
      failed: 1,
      errors: [
        {
          row: 1,
          message:
            'Không tìm thấy cột "Tên hệ thống thông tin". Vui lòng dùng đúng mẫu nhập dữ liệu.'
        }
      ]
    }
  }

  const departments = listDepartments()
  const systems = listAllSystems()
  const settings = getSettings()
  const byCode = new Map(systems.map((system) => [system.code.toUpperCase(), system]))
  const byName = new Map(systems.map((system) => [normalizeForSearch(system.name), system]))
  const decisionOwners = new Map<string, string>()
  for (const system of systems) {
    if (system.decisionNumber) {
      decisionOwners.set(system.decisionNumber.trim().toUpperCase(), system.code)
    }
  }

  let imported = 0
  let failed = 0
  const errors: ImportResult['errors'] = []

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    if (errors.length >= 200) break
    const row = sheet.getRow(rowNumber)
    const get = (field: string): string => {
      const col = columnMap.get(field)
      return col ? cellText(row.getCell(col).value) : ''
    }
    const hasData = Array.from(columnMap.values()).some((col) => cellText(row.getCell(col).value))
    if (!hasData) continue

    const name = get('name')
    const managingUnit = get('managingUnit')
    let code = get('code').toUpperCase()

    if (!name) {
      failed += 1
      errors.push({ row: rowNumber, message: 'Thiếu tên hệ thống thông tin.' })
      continue
    }
    if (!managingUnit) {
      failed += 1
      errors.push({ row: rowNumber, message: `[${name}] Thiếu đơn vị quản lý, vận hành.` })
      continue
    }

    try {
      const level = parseLevel(get('level'))
      const decisionNumber = get('decisionNumber') || null
      if (level !== null && !decisionNumber) {
        throw new Error('Đã có cấp độ nhưng thiếu số quyết định phê duyệt cấp độ.')
      }
      if (decisionNumber && !settings.allowSharedDecisionNumber) {
        const key = decisionNumber.trim().toUpperCase()
        const owner = decisionOwners.get(key)
        if (owner && owner !== code) {
          throw new Error(
            `Số quyết định "${decisionNumber}" đã dùng cho HTTT ${owner}. Bật tùy chọn cho phép dùng chung số quyết định nếu cần.`
          )
        }
      }

      const statusText = get('status')
      const status = statusText ? STATUS_BY_LABEL.get(normalizeForSearch(statusText)) : undefined
      if (statusText && !status) {
        throw new Error(`Trạng thái "${statusText}" không hợp lệ.`)
      }
      const hostingText = get('hostingType')
      const hostingType = hostingText
        ? HOSTING_BY_LABEL.get(normalizeForSearch(hostingText))
        : undefined
      if (hostingText && !hostingType) {
        throw new Error(`Hình thức triển khai "${hostingText}" không hợp lệ.`)
      }
      const departmentText = get('department')
      let departmentId: number | null = null
      if (departmentText) {
        const term = normalizeForSearch(departmentText)
        const department = departments.find(
          (item) => normalizeForSearch(item.code) === term || normalizeForSearch(item.name) === term
        )
        if (!department) throw new Error(`Không tìm thấy phòng ban "${departmentText}".`)
        departmentId = department.id
      }

      let existingId: number | undefined
      if (code) {
        const existing = byCode.get(code)
        existingId = existing?.id
      } else {
        const existing = byName.get(normalizeForSearch(name))
        if (existing) {
          code = existing.code
          existingId = existing.id
        }
      }

      const payload: InformationSystemInput & { id?: number } = {
        id: existingId,
        code: code || undefined,
        name,
        description: get('description') || null,
        managingUnit,
        departmentId,
        level,
        decisionNumber,
        decisionDate: parseDateText(get('decisionDate')),
        decisionAgency: get('decisionAgency') || null,
        status: status ?? 'operating',
        hostingType: hostingType ?? 'none',
        hostingDetail: get('hostingDetail') || null,
        assetId: null
      }

      const saved = saveSystem(payload, user)
      if (saved.system.decisionNumber) {
        decisionOwners.set(saved.system.decisionNumber.trim().toUpperCase(), saved.system.code)
      }
      byCode.set(saved.system.code.toUpperCase(), saved.system)
      byName.set(normalizeForSearch(saved.system.name), saved.system)
      imported += 1
    } catch (error) {
      failed += 1
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Không thể lưu dòng dữ liệu.'
      })
    }
  }

  logActivity(
    user,
    'Nhập Excel HTTT',
    'information_system',
    null,
    `Thành công ${imported}, lỗi ${failed}`,
    filePath
  )

  return { canceled: false, imported, failed, errors, filePath }
}

/* ------------------------- Convenience for lists ------------------------ */

export function exportSystemsForList(
  params: InformationSystemListParams,
  user: AuthUser
): Promise<ExportResult> {
  return exportSystemsExcel(params, user)
}

/** Đếm nhanh số HTTT theo bộ lọc (dùng cho hiển thị trên UI). */
export function countSystems(params: InformationSystemListParams): number {
  return listSystems({ ...params, page: 1, pageSize: 5 }).total
}
