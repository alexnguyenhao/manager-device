import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.MD_UI_URL || 'http://127.0.0.1:5199'
const SHOTS = process.env.MD_SHOTS || '/tmp/opencode/shots'
mkdirSync(SHOTS, { recursive: true })

const API_SCRIPT = `
(() => {
  const call = (channel) => (...args) => fetch('/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, args })
  }).then(async (response) => {
    const payload = await response.json()
    if (!payload || !payload.ok) {
      const error = new Error((payload && payload.error && payload.error.message) || 'RPC failed')
      error.code = (payload && payload.error && payload.error.code) || 'INTERNAL'
      throw error
    }
    return payload.data
  })
  const catalog = (kind) => ({
    list: () => call('catalog:list')(kind),
    save: (data) => call('catalog:save')(kind, data),
    remove: (id) => call('catalog:remove')(kind, id)
  })
  window.api = {
    auth: {
      login: (u, p) => call('auth:login')(u, p),
      logout: () => call('auth:logout')(),
      me: () => call('auth:me')(),
      changePassword: (c, n) => call('auth:changePassword')(c, n),
      updateProfile: (d) => call('auth:updateProfile')(d)
    },
    dashboard: { get: () => call('dashboard:get')() },
    assets: {
      list: (p) => call('assets:list')(p),
      get: (id) => call('assets:get')(id),
      create: (d) => call('assets:create')(d),
      update: (id, d) => call('assets:update')(id, d),
      remove: (id) => call('assets:remove')(id),
      bulkRemove: (ids) => call('assets:bulkRemove')(ids),
      nextCode: (id) => call('assets:nextCode')(id),
      byIds: (ids) => call('assets:byIds')(ids),
      updateStatus: (id, s, n) => call('assets:updateStatus')(id, s, n),
      exportExcel: (p) => call('assets:exportExcel')(p),
      importExcel: () => call('assets:importExcel')(),
      downloadTemplate: () => call('assets:downloadTemplate')()
    },
    categories: catalog('categories'),
    departments: catalog('departments'),
    locations: catalog('locations'),
    suppliers: catalog('suppliers'),
    employees: catalog('employees'),
    assignments: {
      list: (p) => call('assignments:list')(p),
      create: (d) => call('assignments:create')(d),
      returnAsset: (d) => call('assignments:return')(d),
      remove: (id) => call('assignments:remove')(id)
    },
    maintenance: {
      list: (p) => call('maintenance:list')(p),
      create: (d) => call('maintenance:create')(d),
      update: (d) => call('maintenance:update')(d),
      complete: (id, d) => call('maintenance:complete')(id, d),
      cancel: (id) => call('maintenance:cancel')(id),
      remove: (id) => call('maintenance:remove')(id)
    },
    audits: {
      list: (p) => call('audits:list')(p),
      get: (id) => call('audits:get')(id),
      create: (d) => call('audits:create')(d),
      scan: (d) => call('audits:scan')(d),
      updateItem: (d) => call('audits:updateItem')(d),
      complete: (d) => call('audits:complete')(d),
      remove: (id) => call('audits:remove')(id),
      exportExcel: (id) => call('audits:exportExcel')(id)
    },
    reports: {
      get: (p) => call('reports:get')(p),
      export: (p) => call('reports:export')(p)
    },
    users: {
      list: () => call('users:list')(),
      create: (d) => call('users:create')(d),
      update: (id, d) => call('users:update')(id, d),
      remove: (id) => call('users:remove')(id),
      resetPassword: (id, p) => call('users:resetPassword')(id, p)
    },
    settings: {
      get: () => call('settings:get')(),
      update: (d) => call('settings:update')(d),
      backup: () => call('settings:backup')(),
      restore: () => call('settings:restore')(),
      openDataFolder: () => call('settings:openDataFolder')(),
      clearDemoData: () => call('settings:clearDemoData')()
    },
    backup: {
      overview: () => call('backup:overview')(),
      updateConfig: (d) => call('backup:updateConfig')(d),
      chooseFolder: (d) => call('backup:chooseFolder')(d),
      folderNow: () => call('backup:folderNow')(),
      listFolder: () => call('backup:listFolder')(),
      restoreFolder: (name) => call('backup:restoreFolder')(name)
    },
    drive: {
      status: () => call('drive:status')(),
      saveConfig: (d) => call('drive:saveConfig')(d),
      connect: () => call('drive:connect')(),
      disconnect: () => call('drive:disconnect')(),
      backup: () => call('drive:backup')(),
      list: () => call('drive:list')(),
      restore: (id) => call('drive:restore')(id),
      remove: (id) => call('drive:remove')(id)
    },
    logs: { list: (p) => call('logs:list')(p) },
    files: {
      list: (id) => call('files:list')(id),
      upload: (id) => call('files:upload')(id),
      open: (id) => call('files:open')(id),
      remove: (id) => call('files:remove')(id)
    },
    app: { info: () => call('app:info')() }
  }
})()
`

const problems = []
let currentRoute = 'start'

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms)
}

async function visit(page, route, expected, name) {
  currentRoute = route
  await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
  await settle(page, 1100)
  const text = await page.locator('body').innerText()
  if (expected && !text.includes(expected)) {
    problems.push(`[${route}] Không thấy nội dung "${expected}"`)
  }
  for (const marker of ['Đã xảy ra lỗi', 'Không thể tải', 'Something went wrong']) {
    if (text.includes(marker)) problems.push(`[${route}] Trang hiển thị lỗi: "${marker}"`)
  }
  await shot(page, name)
  return text
}

async function login(page, username, password) {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' })
  await settle(page, 600)
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.waitForTimeout(1600)
  const text = await page.locator('body').innerText()
  if (!text.includes('Bảng điều khiển')) {
    problems.push(`[login:${username}] Đăng nhập thất bại: ${text.slice(0, 300)}`)
  }
}

async function main() {
  // Phiên đăng nhập được giữ trong main process, đảm bảo bắt đầu từ trạng thái sạch
  await fetch(`${BASE}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'auth:logout', args: [] })
  })

  const browser = await chromium.launch(
    process.env.MD_CHROMIUM_PATH ? { executablePath: process.env.MD_CHROMIUM_PATH } : {}
  )
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(API_SCRIPT)
  const page = await context.newPage()

  page.on('pageerror', (error) => problems.push(`[${currentRoute}] pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/favicon|Download the React DevTools|net::ERR_FILE/.test(text)) return
    problems.push(`[${currentRoute}] console.error: ${text}`)
  })

  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' })
  await settle(page, 800)
  await shot(page, '00-login')
  await login(page, 'admin', 'Admin@123')
  await shot(page, '01-dashboard-light')

  const routes = [
    ['/assets', 'Quản lý toàn bộ tài sản CNTT', '02-assets'],
    ['/assignments', 'Cấp phát', '03-assignments'],
    ['/maintenance', 'Bảo trì', '04-maintenance'],
    ['/audits', 'Kiểm kê', '05-audits'],
    ['/categories', 'Danh mục thiết bị', '06-categories'],
    ['/departments', 'Cơ cấu tổ chức', '07-departments'],
    ['/locations', 'Vị trí', '08-locations'],
    ['/suppliers', 'Nhà cung cấp', '09-suppliers'],
    ['/employees', 'Nhân viên', '10-employees'],
    ['/reports', 'Báo cáo', '11-reports'],
    ['/users', 'Người dùng', '12-users'],
    ['/activity', 'Nhật ký hoạt động', '13-activity'],
    ['/settings', 'Cài đặt', '14-settings']
  ]

  for (const [route, expected, name] of routes) {
    await visit(page, route, expected, name)
  }

  // Mẫu cấu hình trong danh mục: tạo nhanh PC với đầy đủ trường CPU/RAM/GPU/ổ cứng/OS
  currentRoute = '/categories?preset=1'
  await page.goto(`${BASE}/#/categories`, { waitUntil: 'networkidle' })
  await settle(page, 1000)
  await page.getByRole('button', { name: 'Thêm danh mục' }).first().click()
  await settle(page, 600)
  const pcPresetButton = page.getByRole('button', { name: 'Máy tính để bàn (PC)' })
  if ((await pcPresetButton.count()) === 0) {
    problems.push('[categories] Không thấy nút mẫu cấu hình PC')
  } else {
    await pcPresetButton.click()
    await settle(page, 500)
    if ((await page.inputValue('#cat-code')) !== 'PC') {
      problems.push('[categories] Mẫu PC không điền mã danh mục')
    }
    if ((await page.inputValue('#cat-name')) !== 'Máy tính để bàn') {
      problems.push('[categories] Mẫu PC không điền tên danh mục')
    }
    const modalText = await page.locator('body').innerText()
    for (const label of ['CPU', 'RAM', 'Card đồ họa (GPU)', 'Dung lượng ổ cứng', 'Hệ điều hành']) {
      if (!modalText.includes(label)) problems.push(`[categories] Mẫu PC thiếu trường "${label}"`)
    }
    await shot(page, '06a-category-pc-preset')
  }
  await page.getByRole('button', { name: 'Hủy' }).last().click()
  await settle(page, 400)

  // Chi tiết thiết bị: mở dòng đầu tiên
  currentRoute = '/assets'
  await page.goto(`${BASE}/#/assets`, { waitUntil: 'networkidle' })
  await settle(page, 1100)
  const rows = page.locator('tbody tr')
  if ((await rows.count()) > 0) {
    await rows.first().locator('a').first().click()
    await settle(page, 1200)
    const detail = await page.locator('body').innerText()
    if (!detail.includes('Chi tiết thiết bị')) problems.push('[asset-detail] Không mở được chi tiết')
    await shot(page, '15-asset-detail')
    for (const [label, name] of [
      ['Cấp phát', '15a-asset-tab-assignments'],
      ['Bảo trì', '15b-asset-tab-maintenance'],
      ['Tệp đính kèm', '15c-asset-tab-files'],
      ['Lịch sử', '15d-asset-tab-logs']
    ]) {
      await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click()
      await settle(page, 500)
      await shot(page, name)
    }
  } else {
    problems.push('[assets] Bảng thiết bị trống')
  }

  // Drawer thêm thiết bị: bấm nút trên topbar khi đang ở trang danh sách
  currentRoute = '/assets?new=1'
  await page.goto(`${BASE}/#/assets`, { waitUntil: 'networkidle' })
  await settle(page, 1100)
  await page.locator('header').getByRole('button', { name: 'Thêm thiết bị' }).click()
  await settle(page, 1000)
  const drawerText = await page.locator('body').innerText()
  if (!drawerText.includes('Thêm thiết bị mới')) problems.push('[assets] Drawer thêm mới không mở')
  await shot(page, '16-asset-new')
  const close = page.getByRole('button', { name: 'Đóng' }).first()
  if ((await close.count()) > 0) await close.click()
  await settle(page, 500)

  // Tạo thiết bị thật qua giao diện
  currentRoute = '/assets?new=1'
  await page.locator('header').getByRole('button', { name: 'Thêm thiết bị' }).click()
  await settle(page, 700)
  await page.fill('#asset-name', 'Máy kiểm thử giao diện')
  await page.selectOption('#asset-category', { label: 'Laptop' })
  await settle(page, 900)
  await page.fill('#spec-cpu', 'Intel Core i7-1355U')
  await page.fill('#spec-ram', '16')
  await page.fill('#spec-storage', 'SSD NVMe 1TB')
  await page.fill('#spec-gpu', 'Intel Iris Xe')
  await page.selectOption('#spec-os', { label: 'Windows 11 Pro' })
  await page.locator('button').filter({ hasText: /^Thêm thiết bị$/ }).last().click()
  await settle(page, 1600)
  const afterCreate = await page.locator('body').innerText()
  if (!afterCreate.includes('Máy kiểm thử giao diện')) {
    problems.push('[assets] Không thấy thiết bị vừa tạo trong danh sách')
  }
  await shot(page, '16a-asset-created')

  // Mở thiết bị vừa tạo và kiểm tra cấu hình hiển thị đúng nhãn/đơn vị
  currentRoute = '/assets?created=1'
  const createdRow = page.locator('tbody tr').filter({ hasText: 'Máy kiểm thử giao diện' }).first()
  if ((await createdRow.count()) > 0) {
    await createdRow.locator('a').first().click()
    await settle(page, 1200)
    const specText = await page.locator('body').innerText()
    for (const expected of [
      'Cấu hình thiết bị',
      'Intel Core i7-1355U',
      '16 GB',
      'SSD NVMe 1TB',
      'Windows 11 Pro'
    ]) {
      if (!specText.includes(expected)) {
        problems.push(`[asset-detail] Thiếu cấu hình "${expected}"`)
      }
    }
    await shot(page, '16a-asset-config')
  } else {
    problems.push('[assets] Không tìm thấy dòng thiết bị vừa tạo')
  }

  // Modal người dùng
  currentRoute = '/users?new=1'
  await page.goto(`${BASE}/#/users`, { waitUntil: 'networkidle' })
  await settle(page, 900)
  await page.getByRole('button', { name: 'Thêm người dùng' }).first().click()
  await settle(page, 500)
  if ((await page.locator('#user-username').count()) === 0) {
    problems.push('[users] Modal thêm người dùng không mở')
  }
  await shot(page, '16c-user-new')
  await page.getByRole('button', { name: 'Hủy' }).last().click()

  // Các tab cài đặt
  currentRoute = '/settings'
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await settle(page, 900)
  for (const [label, name] of [
    ['Thiết lập hệ thống', '16d-settings-system'],
    ['Dữ liệu & sao lưu', '16e-settings-data'],
    ['Thông tin ứng dụng', '16f-settings-about']
  ]) {
    await page.getByRole('tab', { name: label }).click()
    await settle(page, 500)
    await shot(page, name)
  }

  await page.getByRole('tab', { name: 'Dữ liệu & sao lưu' }).click()
  await settle(page, 600)
  const dataSettingsText = await page.locator('body').innerText()
  for (const expected of [
    'Sao lưu tự động',
    'Google Drive trực tiếp',
    'OAuth Client ID',
    'Sao lưu lên Drive',
    'Bản sao lưu trên Google Drive'
  ]) {
    if (!dataSettingsText.includes(expected)) {
      problems.push(`[settings] Thiếu mục "${expected}"`)
    }
  }

  // Drawer cấp phát: điều hướng kèm query khi đang ở trang cấp phát
  currentRoute = '/assignments?new=1'
  await page.goto(`${BASE}/#/assignments`, { waitUntil: 'networkidle' })
  await settle(page, 900)
  await page.goto(`${BASE}/#/assignments?new=1`, { waitUntil: 'networkidle' })
  await settle(page, 900)
  const assignmentText = await page.locator('body').innerText()
  if (!assignmentText.includes('Cấp phát thiết bị')) problems.push('[assignments] Drawer cấp phát không mở')
  await shot(page, '16b-assignment-new')

  // Chế độ tối
  currentRoute = 'dark'
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await settle(page, 1000)
  await page.getByRole('button', { name: 'Chuyển giao diện tối' }).click()
  await settle(page, 600)
  await shot(page, '17-dashboard-dark')

  // Đăng xuất và kiểm tra vai trò chỉ xem
  currentRoute = 'logout'
  await page.getByRole('button', { name: 'Tài khoản' }).click()
  await settle(page, 300)
  await page.getByText('Đăng xuất', { exact: true }).click()
  await settle(page, 900)
  await login(page, 'viewer', 'Viewer@123')
  currentRoute = 'viewer'
  await settle(page, 900)
  const viewerText = await page.locator('body').innerText()
  for (const hidden of ['Người dùng', 'Nhật ký hoạt động']) {
    if (viewerText.includes(hidden)) problems.push(`[viewer] Vẫn thấy mục "${hidden}"`)
  }
  await shot(page, '18-dashboard-viewer')

  await browser.close()

  if (problems.length) {
    console.log(`UI TEST FOUND ${problems.length} PROBLEM(S)`)
    for (const problem of problems) console.log('- ' + problem)
    process.exitCode = 1
  } else {
    console.log('UI TEST PASSED')
  }
  console.log(`Screenshots: ${SHOTS}`)
}

main().catch((error) => {
  console.error('UI TEST CRASHED', error)
  process.exit(1)
})
