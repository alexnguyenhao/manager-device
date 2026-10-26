/* ============================================================================
 * Manager Device - web tool thu thập cấu hình máy
 * Trang tĩnh, không máy chủ. Dữ liệu chỉ nằm trong localStorage của trình duyệt.
 * ========================================================================== */
;(function () {
  'use strict'

  const STORAGE_KEY = 'md-scan-entries-v1'
  const CODE_PREFIX = 'MD1:'
  const CODE_PATTERN = /MD1:[A-Za-z0-9_-]+/g

  const DESKTOP = 'Máy tính để bàn'
  const LAPTOP = 'Laptop'

  /** Khớp đúng options đang có trong danh mục PC/Laptop của ứng dụng. */
  const RAM_TYPES = {
    [DESKTOP]: ['DDR3', 'DDR4', 'DDR5'],
    [LAPTOP]: ['DDR4', 'DDR5', 'LPDDR4X', 'LPDDR5', 'LPDDR5X']
  }
  const OS_OPTIONS = [
    'Windows 11 Pro',
    'Windows 11 Home',
    'Windows 10 Pro',
    'Windows 10 Home',
    'Ubuntu',
    'macOS',
    'Khác'
  ]

  /**
   * Tiêu đề cột kỹ thuật: dùng đúng khóa thông số (`cpu`, `ram`, `storage`…).
   * Phần nhập của ứng dụng khớp cột theo khóa nên không phụ thuộc nhãn hiển thị,
   * tránh lỗi khi danh mục đổi tên trường.
   */
  const CSV_COLUMNS = [
    'Tên thiết bị (*)',
    'Danh mục (*)',
    'Serial',
    'Model',
    'Hãng sản xuất',
    'Phòng ban',
    'Người sử dụng',
    'cpu',
    'cpuCores (nhân)',
    'cpuThreads (luồng)',
    'ram (GB)',
    'ramType',
    'ramBus (MHz)',
    'storage',
    'gpu',
    'gpuMemory',
    'monitor',
    'screen (inch)',
    'os',
    'osLicense',
    'Ghi chú'
  ]

  const $ = (id) => document.getElementById(id)

  /** --------------------------------------------------------------- tiện ích */

  function text(value) {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    return ''
  }

  function positiveInt(value) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(text(value), 10)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
  }

  function positiveNumber(value) {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(text(value))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  function formatTime(iso) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso || ''
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function timeStamp(date) {
    const pad = (value) => String(value).padStart(2, '0')
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      '-' +
      pad(date.getHours()) +
      pad(date.getMinutes())
    )
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  }

  let toastTimer = null
  function toast(message, kind) {
    const el = $('toast')
    if (!el) return
    el.textContent = message
    el.className = 'toast' + (kind === 'error' ? ' toast-error' : '')
    el.hidden = false
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      el.hidden = true
    }, 4200)
  }

  async function copyToClipboard(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        return true
      }
    } catch {
      /* dùng cách cũ bên dưới */
    }
    try {
      const area = document.createElement('textarea')
      area.value = value
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.top = '-1000px'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }

  /** ---------------------------------------------------------- giải mã kết quả */

  function decodeBase64Url(value) {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4 !== 0) base64 += '='
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }

  function mapOs(rawOs, caption) {
    const os = text(rawOs)
    if (OS_OPTIONS.includes(os)) return os
    if (os === 'Khac') return 'Khác'

    const lower = text(caption).toLowerCase()
    if (lower.includes('windows 11 pro')) return 'Windows 11 Pro'
    if (lower.includes('windows 11 home')) return 'Windows 11 Home'
    if (lower.includes('windows 10 pro')) return 'Windows 10 Pro'
    if (lower.includes('windows 10 home')) return 'Windows 10 Home'
    if (lower.includes('ubuntu')) return 'Ubuntu'
    if (lower.includes('macos') || lower.includes('mac os')) return 'macOS'
    return 'Khác'
  }

  function mapLicense(value) {
    const license = text(value)
    if (license === 'licensed') return 'Có bản quyền'
    if (license === 'unlicensed') return 'Không'
    return 'Không rõ'
  }

  function buildName(manufacturer, model, category, computerName) {
    const label = category === LAPTOP ? 'Laptop' : 'Máy tính để bàn'
    if (manufacturer && model) {
      return model.toLowerCase().includes(manufacturer.toLowerCase())
        ? model
        : manufacturer + ' ' + model
    }
    if (model) return model
    if (manufacturer) return (manufacturer + ' ' + label).trim()
    return (label + ' ' + computerName).trim()
  }

  /** Chuyển payload thô của PowerShell thành kết quả giống ứng dụng. */
  function mapPayload(raw) {
    const isLaptop = raw.isLaptop === true || raw.isLaptop === 'True' || raw.isLaptop === 1
    const category = isLaptop ? LAPTOP : DESKTOP
    const computerName = text(raw.computerName) || 'Máy tính'
    const manufacturer = text(raw.manufacturer)
    const model = text(raw.model)
    const cpu = text(raw.cpu)
    const cpuCores = positiveInt(raw.cpuCores)
    const cpuThreads = positiveInt(raw.cpuThreads)
    const ramGB = positiveInt(raw.ramGB)
    const rawRamType = text(raw.ramType)
    const ramType = (RAM_TYPES[category] || []).includes(rawRamType) ? rawRamType : ''
    const ramBus = positiveInt(raw.ramBus)
    const ramSlots = text(raw.ramSlots)
    const storage = text(raw.storage)
    const gpu = text(raw.gpu)
    const gpuMemory = text(raw.gpuMemory).replace(/Chia se/g, 'Chia sẻ')
    const monitor = text(raw.monitor)
    const screenSizeValue = positiveNumber(raw.screenSize)
    const screenSize = screenSizeValue > 0 ? Math.round(screenSizeValue * 10) / 10 : 0
    const os = mapOs(raw.os, raw.osCaption)
    const osLicense = mapLicense(raw.osLicense)
    const ipAddresses = text(raw.ipAddresses)
    const osVersion = text(raw.osVersion)
    const osBuild = text(raw.osBuild)
    const scannedAt = text(raw.scannedAt) || new Date().toISOString()

    const specs = {}
    const put = (key, value) => {
      if (value === '' || value === 0 || value === undefined || value === null) return
      specs[key] = value
    }
    put('cpu', cpu)
    put('cpuCores', cpuCores)
    put('cpuThreads', cpuThreads)
    put('ram', ramGB)
    put('ramType', ramType)
    put('ramBus', ramBus)
    put('storage', storage)
    put('gpu', gpu)
    put('gpuMemory', gpuMemory)
    if (isLaptop) put('screen', screenSize)
    else put('monitor', monitor)
    put('os', os)
    put('osLicense', osLicense)

    const noteParts = ['Quét tự động ' + formatTime(scannedAt), 'Máy: ' + computerName]
    if (ipAddresses) noteParts.push('IP: ' + ipAddresses)
    if (cpu) {
      noteParts.push(
        'CPU: ' + cpu + (cpuCores > 0 ? ' (' + cpuCores + ' nhân / ' + cpuThreads + ' luồng)' : '')
      )
    }
    if (ramSlots || ramGB > 0) noteParts.push('RAM: ' + (ramSlots || ramGB + 'GB'))
    if (monitor) noteParts.push('Màn hình: ' + monitor)
    if (osVersion) noteParts.push('Windows: ' + osVersion + (osBuild ? '.' + osBuild : ''))

    return {
      computerName,
      deviceType: isLaptop ? 'laptop' : 'desktop',
      category,
      manufacturer,
      model,
      serialNumber: text(raw.serialNumber),
      cpu,
      cpuCores,
      cpuThreads,
      ramGB,
      ramType,
      ramBus,
      ramSlots,
      storage,
      gpu,
      gpuMemory,
      monitor,
      screenSize,
      os,
      osLicense,
      ipAddresses,
      note: noteParts.join(' • '),
      scannedAt,
      specs,
      name: buildName(manufacturer, model, category, computerName)
    }
  }

  function decodeCode(code) {
    const json = decodeBase64Url(code.slice(CODE_PREFIX.length))
    const raw = JSON.parse(json)
    if (!raw || typeof raw !== 'object') throw new Error('Dữ liệu rỗng')
    return mapPayload(raw)
  }

  function extractCodes(value) {
    const found = String(value || '').match(CODE_PATTERN)
    return found ? Array.from(new Set(found)) : []
  }

  /** --------------------------------------------------------------- lưu trữ */

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      toast('Không lưu được vào trình duyệt (bộ nhớ đã đầy).', 'error')
    }
  }

  /** ----------------------------------------------------------------- state */

  let entries = loadEntries()
  let pendingAll = []
  let previewCategory = null
  let nameTouched = false

  /** --------------------------------------------------------- lệnh PowerShell */

  function isHttp() {
    return location.protocol === 'http:' || location.protocol === 'https:'
  }

  function scanUrl() {
    return new URL('scan.txt', location.href).href
  }

  function pageUrl() {
    return isHttp() ? location.origin + location.pathname : location.href.split('#')[0]
  }

  function commandText() {
    return (
      "$s=irm '" +
      scanUrl() +
      "' -UseBasicParsing; & ([scriptblock]::Create($s)) -Page '" +
      pageUrl() +
      "'"
    )
  }

  function renderCommand() {
    $('command-box').querySelector('code').textContent = commandText()
    $('command-warning').hidden = isHttp()
  }

  /** -------------------------------------------------------------- hiển thị */

  function addSpec(grid, label, value) {
    const item = document.createElement('div')
    item.className = 'spec'
    const labelEl = document.createElement('span')
    labelEl.className = 'spec-label'
    labelEl.textContent = label
    const valueEl = document.createElement('span')
    valueEl.className = 'spec-value'
    valueEl.textContent = value || '—'
    item.append(labelEl, valueEl)
    grid.appendChild(item)
  }

  function ramText(entry) {
    if (!entry.ramGB) return ''
    let value = entry.ramGB + ' GB'
    if (entry.ramType) value += ' ' + entry.ramType
    if (entry.ramBus) value += ' · ' + entry.ramBus + ' MHz'
    return value
  }

  function screenText(entry) {
    if (entry.category === LAPTOP) {
      if (entry.screenSize && entry.monitor) return entry.screenSize + '" · ' + entry.monitor
      if (entry.screenSize) return entry.screenSize + '"'
      return entry.monitor
    }
    if (entry.monitor) return entry.monitor
    return entry.screenSize ? entry.screenSize + '"' : ''
  }

  /** Bản xem trước có áp dụng danh mục người dùng chọn. */
  function previewModel() {
    const base = pendingAll[0]
    if (!base) return null
    const category = previewCategory || base.category
    const specs = { ...base.specs }
    if (category === LAPTOP) {
      delete specs.monitor
      if (base.screenSize) specs.screen = base.screenSize
    } else {
      delete specs.screen
      if (base.monitor) specs.monitor = base.monitor
    }
    return {
      ...base,
      category,
      deviceType: category === LAPTOP ? 'laptop' : 'desktop',
      specs
    }
  }

  function renderPreview() {
    const model = previewModel()
    if (!model) return

    $('preview-type').textContent = model.category
    $('preview-host').textContent = model.computerName
    $('preview-time').textContent = formatTime(model.scannedAt)

    const grid = $('preview-specs')
    grid.textContent = ''
    addSpec(
      grid,
      'CPU',
      model.cpu
        ? model.cpu +
            (model.cpuCores > 0
              ? ' · ' + model.cpuCores + ' nhân / ' + model.cpuThreads + ' luồng'
              : '')
        : ''
    )
    addSpec(grid, 'RAM', ramText(model))
    addSpec(grid, 'Ổ cứng', model.storage)
    addSpec(
      grid,
      'Card đồ họa',
      model.gpu ? model.gpu + (model.gpuMemory ? ' · ' + model.gpuMemory : '') : ''
    )
    addSpec(grid, model.category === LAPTOP ? 'Màn hình' : 'Màn hình đi kèm', screenText(model))
    addSpec(grid, 'Hệ điều hành', model.os + ' · ' + model.osLicense)
    addSpec(grid, 'Serial', model.serialNumber)
    addSpec(grid, 'Địa chỉ IP', model.ipAddresses)

    $('edit-category').value = model.category
    const nameInput = $('edit-name')
    if (!nameTouched) nameInput.value = model.name
    $('edit-serial').value = model.serialNumber
    $('edit-note').value = model.note

    $('add-entry').textContent =
      pendingAll.length > 1
        ? 'Thêm tất cả ' + pendingAll.length + ' máy'
        : 'Thêm vào danh sách'

    $('preview').hidden = false
    $('preview').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function setPreview(items) {
    pendingAll = items
    previewCategory = items[0] ? items[0].category : null
    nameTouched = false
    $('edit-department').value = ''
    $('edit-employee').value = ''
    renderPreview()
  }

  function hidePreview() {
    pendingAll = []
    previewCategory = null
    nameTouched = false
    $('preview').hidden = true
  }

  function isDuplicate(entry) {
    const serial = (entry.serialNumber || '').trim().toLowerCase()
    const host = (entry.computerName || '').trim().toLowerCase()
    return entries.some((item) => {
      if (serial && (item.serialNumber || '').trim().toLowerCase() === serial) return true
      if (host && (item.computerName || '').trim().toLowerCase() === host) return true
      return false
    })
  }

  function renderTable() {
    const tbody = $('entry-table').querySelector('tbody')
    tbody.textContent = ''
    $('count').textContent = String(entries.length)
    $('empty-state').hidden = entries.length > 0
    $('entry-table').hidden = entries.length === 0
    $('export-csv').disabled = entries.length === 0
    $('clear-all').disabled = entries.length === 0
    $('backup-json').disabled = entries.length === 0

    entries.forEach((entry, index) => {
      const row = document.createElement('tr')

      const indexCell = document.createElement('td')
      indexCell.className = 'col-index'
      indexCell.textContent = String(index + 1)

      const nameCell = document.createElement('td')
      const nameSpan = document.createElement('span')
      nameSpan.className = 'cell-name'
      nameSpan.textContent = entry.name
      const sub = document.createElement('span')
      sub.className = 'cell-sub'
      sub.textContent = entry.computerName
      nameCell.append(nameSpan, sub)

      const catCell = document.createElement('td')
      catCell.className = 'col-cat'
      const tag = document.createElement('span')
      tag.className = 'tag ' + (entry.category === LAPTOP ? 'tag-laptop' : 'tag-pc')
      tag.textContent = entry.category
      catCell.appendChild(tag)

      const cpuCell = document.createElement('td')
      cpuCell.className = 'col-cpu'
      cpuCell.textContent = entry.cpu || '—'

      const ramCell = document.createElement('td')
      ramCell.className = 'col-ram'
      ramCell.textContent = entry.ramGB
        ? entry.ramGB + ' GB' + (entry.ramType ? ' ' + entry.ramType : '')
        : '—'

      const diskCell = document.createElement('td')
      diskCell.className = 'col-disk'
      diskCell.textContent = entry.storage || '—'

      const serialCell = document.createElement('td')
      serialCell.className = 'col-serial cell-mono'
      serialCell.textContent = entry.serialNumber || '—'

      const timeCell = document.createElement('td')
      timeCell.className = 'col-time'
      timeCell.textContent = formatTime(entry.scannedAt)

      const actionCell = document.createElement('td')
      actionCell.className = 'col-actions'
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'btn-icon'
      remove.dataset.id = entry.id
      remove.setAttribute('aria-label', 'Xóa ' + entry.name)
      remove.textContent = '✕'
      actionCell.appendChild(remove)

      row.append(
        indexCell,
        nameCell,
        catCell,
        cpuCell,
        ramCell,
        diskCell,
        serialCell,
        timeCell,
        actionCell
      )
      tbody.appendChild(row)
    })
  }

  /** --------------------------------------------------------- thêm / xoá máy */

  function addPending() {
    if (!pendingAll.length) return

    const target = pendingAll[0]
    const editedName = $('edit-name').value.trim()
    const editedCategory = $('edit-category').value || target.category
    const editedSerial = $('edit-serial').value.trim()
    const editedNote = $('edit-note').value.trim()
    const department = $('edit-department').value.trim()
    const employee = $('edit-employee').value.trim()

    const prepared = pendingAll.map((item, index) => {
      const isTarget = index === 0
      const category = isTarget ? editedCategory : item.category
      const entry = {
        ...item,
        id: makeId() + index,
        category,
        deviceType: category === LAPTOP ? 'laptop' : 'desktop',
        name: isTarget && editedName ? editedName : item.name,
        serialNumber: isTarget ? editedSerial : item.serialNumber,
        note: isTarget && editedNote ? editedNote : item.note,
        department: isTarget ? department : '',
        employee: isTarget ? employee : '',
        specs: { ...item.specs }
      }
      applyCategorySpecs(entry, item)
      return entry
    })

    const duplicates = prepared.filter(isDuplicate)
    if (duplicates.length) {
      const message =
        duplicates.length === prepared.length
          ? 'Máy "' + duplicates[0].name + '" đã có trong danh sách. Thêm trùng?'
          : 'Đã có ' + duplicates.length + ' máy trùng (' +
            duplicates.map((item) => item.computerName).join(', ') +
            '). Vẫn thêm?'
      if (!window.confirm(message)) {
        const kept = prepared.filter((item) => !isDuplicate(item))
        if (!kept.length) {
          hidePreview()
          return
        }
        prepared.length = 0
        prepared.push(...kept)
      }
    }

    entries = entries.concat(prepared)
    saveEntries()
    renderTable()
    hidePreview()
    $('paste-input').value = ''
    $('paste-error').hidden = true
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
    toast(
      prepared.length === 1
        ? 'Đã thêm ' + prepared[0].name
        : 'Đã thêm ' + prepared.length + ' máy vào danh sách'
    )
  }

  /** Đồng bộ khóa specs theo danh mục (PC dùng monitor, Laptop dùng screen). */
  function applyCategorySpecs(entry, source) {
    if (entry.category === LAPTOP) {
      delete entry.specs.monitor
      if (source.screenSize) entry.specs.screen = source.screenSize
    } else {
      delete entry.specs.screen
      if (source.monitor) entry.specs.monitor = source.monitor
    }
  }

  /** --------------------------------------------------------------- CSV / tệp */

  function csvCell(value) {
    const raw = value === null || value === undefined ? '' : String(value)
    if (/[",\r\n]/.test(raw)) return '"' + raw.replace(/"/g, '""') + '"'
    return raw
  }

  function buildCsv(list) {
    const lines = [CSV_COLUMNS.map(csvCell).join(',')]
    for (const entry of list) {
      const specs = entry.specs || {}
      const isLaptop = entry.category === LAPTOP
      const row = [
        entry.name,
        entry.category,
        entry.serialNumber,
        entry.model,
        entry.manufacturer,
        entry.department,
        entry.employee,
        specs.cpu,
        specs.cpuCores,
        specs.cpuThreads,
        specs.ram,
        specs.ramType,
        specs.ramBus,
        specs.storage,
        specs.gpu,
        specs.gpuMemory,
        isLaptop ? '' : specs.monitor,
        isLaptop ? specs.screen : '',
        specs.os,
        specs.osLicense,
        entry.note
      ]
      lines.push(row.map(csvCell).join(','))
    }
    return '\ufeff' + lines.join('\r\n') + '\r\n'
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  function exportCsv() {
    if (!entries.length) return
    download(
      'cau-hinh-may-' + timeStamp(new Date()) + '.csv',
      buildCsv(entries),
      'text/csv;charset=utf-8'
    )
    toast('Đã xuất CSV. Vào Manager Device → Thiết bị → Nhập Excel.')
  }

  function exportJson() {
    download(
      'cau-hinh-may-' + timeStamp(new Date()) + '.json',
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2),
      'application/json'
    )
    toast('Đã sao lưu danh sách')
  }

  function importJson(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const list = Array.isArray(parsed) ? parsed : parsed.entries
        if (!Array.isArray(list)) throw new Error('Tệp không đúng định dạng')
        const existing = new Set(entries.map((item) => item.id))
        const incoming = list.filter((item) => item && item.name && !existing.has(item.id))
        entries = entries.concat(
          incoming.map((item, index) => ({ ...item, id: item.id || makeId() + index }))
        )
        saveEntries()
        renderTable()
        toast('Đã nạp ' + incoming.length + ' máy từ tệp sao lưu')
      } catch (error) {
        toast('Không đọc được tệp: ' + error.message, 'error')
      }
    }
    reader.readAsText(file)
  }

  /** ---------------------------------------------------------------- xử lý UI */

  async function handleCopy(button, value, successMessage) {
    const ok = await copyToClipboard(value)
    toast(
      ok ? successMessage : 'Không copy được. Hãy bôi đen và copy thủ công.',
      ok ? undefined : 'error'
    )
    if (ok) {
      const original = button.textContent
      button.textContent = 'Đã copy'
      setTimeout(() => {
        button.textContent = original
      }, 1600)
    }
  }

  function analyze() {
    const errorBox = $('paste-error')
    errorBox.hidden = true

    const codes = extractCodes($('paste-input').value)
    if (!codes.length) {
      errorBox.textContent =
        'Không tìm thấy mã MD1 trong nội dung đã dán. Hãy copy lại dòng bắt đầu bằng MD1: ở cửa sổ PowerShell.'
      errorBox.hidden = false
      return
    }

    const decoded = []
    const failed = []
    for (const code of codes) {
      try {
        decoded.push(decodeCode(code))
      } catch {
        failed.push(code.slice(0, 16) + '…')
      }
    }

    if (!decoded.length) {
      errorBox.textContent =
        'Mã đã dán bị lỗi hoặc thiếu ký tự. Hãy copy lại nguyên dòng MD1: rồi thử lại.'
      errorBox.hidden = false
      return
    }

    if (failed.length) {
      errorBox.textContent = 'Bỏ qua ' + failed.length + ' mã không đọc được: ' + failed.join(', ')
      errorBox.hidden = false
    }

    setPreview(decoded)
  }

  function bind() {
    renderCommand()
    renderTable()

    $('copy-command').addEventListener('click', (event) =>
      handleCopy(event.currentTarget, commandText(), 'Đã copy lệnh quét')
    )

    $('copy-inline').addEventListener('click', async (event) => {
      const status = $('inline-status')
      status.textContent = 'Đang tải script…'
      try {
        const response = await fetch('scan.txt', { cache: 'no-store' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        let script = await response.text()
        script = script.replace(/^\s*param\([^)]*\)\s*/i, '')
        const inline = "$Page='" + pageUrl() + "'\r\n" + script
        const ok = await copyToClipboard(inline)
        status.textContent = ok
          ? 'Đã copy toàn bộ script. Dán vào PowerShell rồi nhấn Enter.'
          : 'Không copy được. Hãy mở tệp scan.txt trong kho mã nguồn.'
        if (ok) toast('Đã copy bản script đầy đủ')
      } catch (error) {
        status.textContent = 'Không tải được scan.txt: ' + error.message
      }
      event.currentTarget.blur()
    })

    $('analyze').addEventListener('click', analyze)

    $('paste-input').addEventListener('paste', () => {
      setTimeout(analyze, 40)
    })

    $('paste-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        analyze()
      }
    })

    $('add-entry').addEventListener('click', addPending)
    $('discard-preview').addEventListener('click', () => {
      hidePreview()
      $('paste-input').value = ''
      $('paste-error').hidden = true
    })

    $('edit-name').addEventListener('input', () => {
      nameTouched = true
    })

    $('edit-category').addEventListener('change', () => {
      previewCategory = $('edit-category').value
      renderPreview()
    })

    $('export-csv').addEventListener('click', exportCsv)
    $('backup-json').addEventListener('click', exportJson)
    $('restore-json').addEventListener('click', () => $('restore-file').click())
    $('restore-file').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0]
      if (file) importJson(file)
      event.target.value = ''
    })

    $('clear-all').addEventListener('click', () => {
      if (!entries.length) return
      if (!window.confirm('Xóa toàn bộ ' + entries.length + ' máy trong danh sách?')) return
      entries = []
      saveEntries()
      renderTable()
      toast('Đã xóa danh sách')
    })

    $('entry-table').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-id]')
      if (!button) return
      entries = entries.filter((item) => item.id !== button.dataset.id)
      saveEntries()
      renderTable()
      toast('Đã xóa khỏi danh sách')
    })

    // Mở từ lệnh PowerShell: .../#d=MD1:...
    if (location.hash) {
      const hashCodes = extractCodes(location.hash)
      if (hashCodes.length) {
        $('paste-input').value = hashCodes.join('\n')
        analyze()
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind)
  } else {
    bind()
  }

  /** Cho phép kiểm thử tự động ngoài trình duyệt. */
  window.MDWebTool = { mapPayload, decodeCode, extractCodes, buildCsv, CSV_COLUMNS }
})()
