import { app, BrowserWindow, dialog } from 'electron'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ExportResult } from '../../shared/types'

/** Thoát ký tự HTML để chèn dữ liệu người dùng vào báo cáo PDF an toàn. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Kết xuất một trang HTML thành PDF bằng Chromium của Electron.
 * Ghi ra tệp HTML tạm để tránh giới hạn độ dài data URL khi danh sách lớn.
 */
export async function saveHtmlAsPdf(
  html: string,
  defaultName: string,
  title: string,
  options: { landscape?: boolean } = {}
): Promise<ExportResult> {
  const result = await dialog.showSaveDialog({
    title,
    defaultPath: `${app.getPath('documents')}/${defaultName}`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }

  const tempPath = join(app.getPath('temp'), `manager-device-${randomUUID()}.html`)
  writeFileSync(tempPath, html, 'utf8')

  const pdfWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: { offscreen: true, sandbox: true }
  })
  try {
    await pdfWindow.loadFile(tempPath)
    const buffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      landscape: options.landscape ?? true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.45, left: 0.4, right: 0.4 }
    })
    writeFileSync(result.filePath, buffer)
    return { canceled: false, filePath: result.filePath }
  } finally {
    try {
      pdfWindow.destroy()
    } catch {
      // bỏ qua
    }
    try {
      unlinkSync(tempPath)
    } catch {
      // bỏ qua
    }
  }
}

/** Khung HTML chuẩn cho báo cáo PDF tiếng Việt. */
export function wrapReportHtml(input: {
  title: string
  subtitle?: string
  body: string
  footer?: string
  landscape?: boolean
}): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)}</title>
<style>
  @page { size: A4 ${input.landscape === false ? 'portrait' : 'landscape'}; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "DejaVu Sans", Arial, sans-serif;
    font-size: 10.5px;
    color: #0f172a;
    margin: 0;
    line-height: 1.45;
  }
  .header { text-align: center; margin-bottom: 10px; }
  .header .unit { font-size: 10.5px; font-weight: 600; text-transform: uppercase; }
  .header .address { font-size: 9.5px; color: #475569; margin-top: 2px; }
  .header .rule { width: 130px; border-top: 1px solid #94a3b8; margin: 5px auto; }
  h1 { font-size: 16px; margin: 8px 0 2px; text-transform: uppercase; letter-spacing: 0.02em; }
  .subtitle { font-size: 10px; color: #475569; }
  h2 { font-size: 12px; margin: 14px 0 6px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
  th { background: #e2e8f0; font-size: 9.5px; text-align: left; text-transform: uppercase; letter-spacing: 0.02em; }
  td { font-size: 10px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .center { text-align: center; }
  .muted { color: #64748b; }
  .danger { color: #b91c1c; font-weight: 600; }
  .cards { display: flex; gap: 8px; margin-bottom: 8px; }
  .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px; background: #f8fafc; }
  .card .label { font-size: 9px; color: #64748b; text-transform: uppercase; }
  .card .value { font-size: 15px; font-weight: 700; }
  .sign { display: flex; justify-content: space-between; margin-top: 22px; page-break-inside: avoid; }
  .sign div { width: 32%; text-align: center; font-size: 10px; }
  .sign .line { margin-top: 54px; border-top: 1px dashed #94a3b8; padding-top: 4px; }
  .footer { margin-top: 12px; font-size: 9px; color: #64748b; text-align: right; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="header">
    <div class="unit">${escapeHtml(input.subtitle ?? '')}</div>
    <div class="rule"></div>
    <h1>${escapeHtml(input.title)}</h1>
  </div>
  ${input.body}
  ${input.footer ? `<div class="footer">${escapeHtml(input.footer)}</div>` : ''}
</body>
</html>`
}
