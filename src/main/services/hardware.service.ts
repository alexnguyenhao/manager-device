import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { HardwareScanResult } from '../../shared/types'
import { formatDateTime, nowISO } from '../../shared/utils'
import { AppError } from '../lib/errors'

const SCAN_MARKER = 'MD_HARDWARE_SCAN:'
const SCAN_TIMEOUT_MS = 60_000

/** Các loại RAM có trong danh mục chọn của mẫu PC/Laptop. */
const SELECTABLE_RAM_TYPES = new Set([
  'DDR3',
  'DDR4',
  'DDR5',
  'LPDDR4',
  'LPDDR4X',
  'LPDDR5',
  'LPDDR5X'
])

/**
 * Script PowerShell 5.1 chạy trong bộ nhớ qua stdin.
 *
 * Không ghi ra tệp .ps1/.bat nên không bị Smart App Control chặn vì
 * "dangerous file extension". Script chỉ dùng ký tự ASCII để tránh lỗi
 * mã hóa khi PowerShell đọc lệnh từ standard input.
 */
const POWERSHELL_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

function T($value) {
    if ($null -eq $value) { return '' }
    return (([string]$value) -replace '\s+', ' ').Trim()
}

function JoinU($values, $separator) {
    $seen = New-Object System.Collections.Generic.HashSet[string]
    $list = New-Object System.Collections.Generic.List[string]
    foreach ($item in @($values)) {
        $text = T $item
        if (-not $text) { continue }
        if ($seen.Add($text)) { $list.Add($text) }
    }
    return ($list -join $separator)
}

function Get-RamTypeName($code) {
    $value = 0
    if ($code) { $value = [int]$code }
    switch ($value) {
        20 { return 'DDR' }
        21 { return 'DDR2' }
        22 { return 'DDR2' }
        24 { return 'DDR3' }
        26 { return 'DDR4' }
        27 { return 'LPDDR' }
        28 { return 'LPDDR2' }
        29 { return 'LPDDR3' }
        30 { return 'LPDDR4' }
        31 { return 'LPDDR4X' }
        34 { return 'DDR5' }
        35 { return 'LPDDR5' }
        default { return '' }
    }
}

function Get-OsName($caption) {
    if (-not $caption) { return 'Khac' }
    if ($caption -match 'Windows 11 Pro') { return 'Windows 11 Pro' }
    if ($caption -match 'Windows 11 Home') { return 'Windows 11 Home' }
    if ($caption -match 'Windows 10 Pro') { return 'Windows 10 Pro' }
    if ($caption -match 'Windows 10 Home') { return 'Windows 10 Home' }
    if ($caption -match 'Ubuntu') { return 'Ubuntu' }
    if ($caption -match 'macOS|Mac OS') { return 'macOS' }
    return 'Khac'
}

function Get-GpuMemoryLabel($name, $adapterRam) {
    $isIntegrated = $false
    if ($name -match 'Intel.*(UHD|HD|Iris)|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d|Apple M\d') {
        $isIntegrated = $true
    }
    if ($name -match 'Intel.*Arc') { $isIntegrated = $false }
    if ($isIntegrated) { return 'Chia se' }

    $bytes = 0
    try {
        $classKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
        foreach ($key in @(Get-ChildItem -Path $classKey -ErrorAction SilentlyContinue)) {
            $props = Get-ItemProperty -Path $key.PSPath -ErrorAction SilentlyContinue
            if (-not $props -or -not $props.DriverDesc) { continue }
            if ((T $props.DriverDesc) -ne $name) { continue }
            $qw = $props.'HardwareInformation.qwMemorySize'
            if ($qw) { $bytes = [double]$qw; break }
        }
    } catch { }

    if ($bytes -le 0) { $bytes = [double]$adapterRam }
    if ($bytes -le 0) { return '' }
    if ($bytes -gt 137438953472) { return '' }

    $gb = $bytes / 1GB
    if ($gb -ge 1) {
        return ([math]::Round($gb, 0).ToString([System.Globalization.CultureInfo]::InvariantCulture) + 'GB')
    }
    return ([math]::Round($gb, 1).ToString([System.Globalization.CultureInfo]::InvariantCulture) + 'GB')
}

function Convert-WmiId($bytes) {
    if ($null -eq $bytes) { return '' }
    $chars = New-Object System.Collections.Generic.List[char]
    foreach ($b in @($bytes)) {
        if ($b -ne 0) { $chars.Add([char]$b) }
    }
    return (-join $chars).Trim()
}

$computerName = T $env:COMPUTERNAME
$cs = Get-CimInstance -ClassName Win32_ComputerSystem
$bios = Get-CimInstance -ClassName Win32_BIOS
$product = Get-CimInstance -ClassName Win32_ComputerSystemProduct
$os = Get-CimInstance -ClassName Win32_OperatingSystem
$processors = @(Get-CimInstance -ClassName Win32_Processor)
$cpu = $processors | Select-Object -First 1
$ramModules = @(Get-CimInstance -ClassName Win32_PhysicalMemory)

$manufacturer = T $cs.Manufacturer
$model = T $cs.Model
$serial = T $bios.SerialNumber
if (-not $serial -or $serial -match 'To be filled|O\.E\.M|Default string|None|System Serial Number|Not Applicable|^0+$') {
    $altSerial = T $product.IdentifyingNumber
    if ($altSerial -and $altSerial -notmatch 'To be filled|O\.E\.M|Default string|None|System Serial Number|Not Applicable|^0+$') {
        $serial = $altSerial
    } else {
        $serial = ''
    }
}
if ($manufacturer -match 'System manufacturer|To Be Filled|Default string|OEM') { $manufacturer = '' }
if ($model -match 'System Product Name|To Be Filled|Default string|All Series|System Version|Not Applicable') { $model = '' }

$chassisTypes = @((Get-CimInstance -ClassName Win32_SystemEnclosure).ChassisTypes)
$hasBattery = @(Get-CimInstance -ClassName Win32_Battery).Count -gt 0
$isLaptop = $hasBattery
foreach ($chassis in $chassisTypes) {
    if ([int]$chassis -in @(8, 9, 10, 14, 30, 31, 32)) { $isLaptop = $true }
}

$cpuName = T $cpu.Name
$cpuName = $cpuName -replace '\(R\)|\(TM\)', ''
$cpuName = T $cpuName

$cpuCores = 0
$cpuThreads = 0
foreach ($processor in $processors) {
    if ($processor.NumberOfCores) { $cpuCores += [int]$processor.NumberOfCores }
    if ($processor.NumberOfLogicalProcessors) { $cpuThreads += [int]$processor.NumberOfLogicalProcessors }
}

$ramBytes = 0
foreach ($module in $ramModules) {
    if ($module.Capacity) { $ramBytes += [double]$module.Capacity }
}
if ($ramBytes -le 0 -and $cs.TotalPhysicalMemory) {
    $ramBytes = [double]$cs.TotalPhysicalMemory
}
$ramGB = 0
if ($ramBytes -gt 0) { $ramGB = [int][math]::Round($ramBytes / 1GB) }

$ramTypes = @()
foreach ($module in $ramModules) {
    $typeCode = 0
    if ($module.SMBIOSMemoryType) { $typeCode = [int]$module.SMBIOSMemoryType }
    elseif ($module.MemoryType) { $typeCode = [int]$module.MemoryType }
    if ($typeCode -gt 0) {
        $typeName = Get-RamTypeName $typeCode
        if ($typeName) { $ramTypes += $typeName }
    }
}
$ramType = JoinU $ramTypes ' / '

$busValues = @()
foreach ($module in $ramModules) {
    $speed = 0
    if ($module.ConfiguredClockSpeed) { $speed = [int]$module.ConfiguredClockSpeed }
    elseif ($module.Speed) { $speed = [int]$module.Speed }
    if ($speed -gt 0) { $busValues += $speed }
}
$ramBus = 0
if ($busValues.Count -gt 0) {
    $ramBus = [int]($busValues | Measure-Object -Maximum).Maximum
}

$slotParts = @()
foreach ($module in $ramModules) {
    $capacity = 0
    if ($module.Capacity) { $capacity = [int][math]::Round([double]$module.Capacity / 1GB) }
    if ($capacity -le 0) { continue }
    $slot = T $module.DeviceLocator
    if ($slot) { $slotParts += ($slot + ' ' + $capacity + 'GB') }
    else { $slotParts += ($capacity.ToString() + 'GB') }
}
$ramSlots = $slotParts -join ', '

$gpuNames = @()
$gpuMemories = @()
foreach ($gpu in @(Get-CimInstance -ClassName Win32_VideoController)) {
    $name = T $gpu.Name
    if (-not $name) { continue }
    if ($name -match 'Remote|Basic Display|Virtual|Microsoft Hyper-V') { continue }
    $gpuNames += $name
    $memory = Get-GpuMemoryLabel $name ([double]$gpu.AdapterRAM)
    if ($memory) { $gpuMemories += $memory }
}
$gpu = JoinU $gpuNames ' + '
$gpuMemory = JoinU $gpuMemories ' + '

$diskParts = @()
$physicalDisks = @(Get-CimInstance -Namespace 'root\Microsoft\Windows\Storage' -ClassName MSFT_PhysicalDisk | Where-Object { $_.Size -gt 0 -and $_.BusType -ne 7 })
if ($physicalDisks.Count -gt 0) {
    foreach ($disk in $physicalDisks) {
        $sizeGB = [int][math]::Round([double]$disk.Size / 1e9)
        if ($sizeGB -le 0) { continue }
        $media = ''
        if ([int]$disk.MediaType -eq 3) { $media = 'HDD' }
        elseif ([int]$disk.MediaType -eq 4) { $media = 'SSD' }
        $bus = ''
        if ([int]$disk.BusType -eq 17) { $bus = 'NVMe' }
        elseif ([int]$disk.BusType -eq 11 -or [int]$disk.BusType -eq 3) { $bus = 'SATA' }
        $label = JoinU (@($media, $bus)) ' '
        $diskParts += (($label + ' ' + $sizeGB + 'GB').Trim())
    }
} else {
    foreach ($disk in @(Get-CimInstance -ClassName Win32_DiskDrive)) {
        if (-not $disk.Size) { continue }
        $sizeGB = [int][math]::Round([double]$disk.Size / 1e9)
        if ($sizeGB -le 0) { continue }
        $media = ''
        if ((T $disk.MediaType) -match 'SSD') { $media = 'SSD' }
        $bus = T $disk.InterfaceType
        if ($bus -notmatch 'NVMe|SATA|SCSI|IDE') { $bus = '' }
        if ($bus -eq 'IDE') { $bus = 'SATA' }
        $label = JoinU (@($media, $bus)) ' '
        $diskParts += (($label + ' ' + $sizeGB + 'GB').Trim())
    }
}
$storage = JoinU $diskParts ' + '

$monitorNames = @()
foreach ($monitor in @(Get-CimInstance -Namespace 'root\wmi' -ClassName WmiMonitorID)) {
    $name = Convert-WmiId $monitor.UserFriendlyName
    if ($name) { $monitorNames += $name }
}
$monitor = JoinU $monitorNames ' + '

$screenSize = 0
foreach ($display in @(Get-CimInstance -Namespace 'root\wmi' -ClassName WmiMonitorBasicDisplayParams)) {
    $width = [double]$display.MaxHorizontalImageSize
    $height = [double]$display.MaxVerticalImageSize
    if ($width -le 0 -or $height -le 0) { continue }
    $inch = [math]::Round(([math]::Sqrt($width * $width + $height * $height) / 2.54), 1)
    if ($inch -lt 8 -or $inch -gt 40) { continue }
    if ($screenSize -eq 0 -or $inch -lt $screenSize) { $screenSize = $inch }
}

$osCaption = T $os.Caption
$osName = Get-OsName $osCaption
$osVersion = T $os.Version
$osBuild = T $os.BuildNumber

$license = 'unknown'
$licenses = @(Get-CimInstance -Query "SELECT Name,LicenseStatus FROM SoftwareLicensingProduct WHERE PartialProductKey IS NOT NULL AND Name LIKE 'Windows%'")
if ($licenses.Count -gt 0) {
    $licensed = @($licenses | Where-Object { $_.LicenseStatus -eq 1 })
    if ($licensed.Count -gt 0) { $license = 'licensed' }
    else { $license = 'unlicensed' }
}

$ipAddresses = @()
try {
    foreach ($adapter in @([System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces())) {
        if ($adapter.OperationalStatus -ne 'Up') { continue }
        if ($adapter.NetworkInterfaceType -eq 'Loopback') { continue }
        $adapterText = (T $adapter.Name) + ' ' + (T $adapter.Description)
        if ($adapterText -match 'Virtual|VMware|Hyper-V|Docker|WSL|TAP|TUN|Loopback') { continue }
        foreach ($unicast in @($adapter.GetIPProperties().UnicastAddresses)) {
            if ($unicast.Address.AddressFamily -ne 'InterNetwork') { continue }
            $ip = [string]$unicast.Address
            if ($ip -match '^127\.' -or $ip -match '^169\.254\.') { continue }
            if ($ipAddresses -notcontains $ip) { $ipAddresses += $ip }
        }
    }
} catch { }
if ($ipAddresses.Count -eq 0) {
    try {
        $ipAddresses = @([System.Net.Dns]::GetHostAddresses($computerName) |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' } |
            ForEach-Object { $_.IPAddressToString })
    } catch { }
}
$ipText = JoinU $ipAddresses ', '

$data = [ordered]@{
    computerName = $computerName
    isLaptop = $isLaptop
    manufacturer = $manufacturer
    model = $model
    serialNumber = $serial
    cpu = $cpuName
    cpuCores = $cpuCores
    cpuThreads = $cpuThreads
    ramGB = $ramGB
    ramType = $ramType
    ramBus = $ramBus
    ramSlots = $ramSlots
    storage = $storage
    gpu = $gpu
    gpuMemory = $gpuMemory
    monitor = $monitor
    screenSize = $screenSize
    os = $osName
    osCaption = $osCaption
    osVersion = $osVersion
    osBuild = $osBuild
    osLicense = $license
    ipAddresses = $ipText
}

$json = $data | ConvertTo-Json -Depth 5 -Compress
$base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
[Console]::Out.WriteLine('MD_HARDWARE_SCAN:' + $base64)
[Console]::Out.Flush()
`

interface RawHardwareScan {
  computerName?: unknown
  isLaptop?: unknown
  manufacturer?: unknown
  model?: unknown
  serialNumber?: unknown
  cpu?: unknown
  cpuCores?: unknown
  cpuThreads?: unknown
  ramGB?: unknown
  ramType?: unknown
  ramBus?: unknown
  ramSlots?: unknown
  storage?: unknown
  gpu?: unknown
  gpuMemory?: unknown
  monitor?: unknown
  screenSize?: unknown
  os?: unknown
  osCaption?: unknown
  osVersion?: unknown
  osBuild?: unknown
  osLicense?: unknown
  ipAddresses?: unknown
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function positiveInt(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(text(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}

function positiveNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(text(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function mapOs(value: unknown, caption: unknown): string {
  const os = text(value)
  if (os === 'Windows 11 Pro' || os === 'Windows 11 Home') return os
  if (os === 'Windows 10 Pro' || os === 'Windows 10 Home') return os
  if (os === 'Ubuntu' || os === 'macOS') return os

  const lower = text(caption).toLowerCase()
  if (lower.includes('windows 11 pro')) return 'Windows 11 Pro'
  if (lower.includes('windows 11 home')) return 'Windows 11 Home'
  if (lower.includes('windows 10 pro')) return 'Windows 10 Pro'
  if (lower.includes('windows 10 home')) return 'Windows 10 Home'
  if (lower.includes('ubuntu')) return 'Ubuntu'
  if (lower.includes('macos') || lower.includes('mac os')) return 'macOS'
  return 'Khác'
}

function mapLicense(value: unknown): string {
  const license = text(value)
  if (license === 'licensed') return 'Có bản quyền'
  if (license === 'unlicensed') return 'Không'
  return 'Không rõ'
}

function buildName(
  manufacturer: string,
  model: string,
  deviceLabel: string,
  computerName: string
): string {
  if (manufacturer && model) {
    return model.toLowerCase().includes(manufacturer.toLowerCase())
      ? model
      : `${manufacturer} ${model}`
  }
  if (model) return model
  if (manufacturer) return `${manufacturer} ${deviceLabel}`.trim()
  return `${deviceLabel} ${computerName}`.trim()
}

/** Chuyển dữ liệu thô từ PowerShell thành kết quả dùng chung với biểu mẫu tài sản. */
export function mapHardwareScan(raw: RawHardwareScan): HardwareScanResult {
  const isLaptop = raw.isLaptop === true
  const computerName = text(raw.computerName) || 'Máy tính'
  const manufacturer = text(raw.manufacturer)
  const model = text(raw.model)
  const serialNumber = text(raw.serialNumber)
  const cpu = text(raw.cpu)
  const cpuCores = positiveInt(raw.cpuCores)
  const cpuThreads = positiveInt(raw.cpuThreads)
  const ramGB = positiveInt(raw.ramGB)
  const ramType = text(raw.ramType)
  const ramBus = positiveInt(raw.ramBus)
  const ramSlots = text(raw.ramSlots)
  const storage = text(raw.storage)
  const gpu = text(raw.gpu)
  const gpuMemory = text(raw.gpuMemory)
  const monitor = text(raw.monitor)
  const screenSizeValue = positiveNumber(raw.screenSize)
  const screenSize = screenSizeValue > 0 ? Math.round(screenSizeValue * 10) / 10 : null
  const os = mapOs(raw.os, raw.osCaption)
  const osLicense = mapLicense(raw.osLicense)
  const ipAddresses = text(raw.ipAddresses)
  const osVersion = text(raw.osVersion)
  const osBuild = text(raw.osBuild)
  const scannedAt = nowISO()
  const deviceLabel = isLaptop ? 'Laptop' : 'Máy tính để bàn'

  const specs: Record<string, string | number> = {}
  const put = (key: string, value: string | number): void => {
    if (value === '' || value === 0 || value === undefined || value === null) return
    specs[key] = value
  }

  put('cpu', cpu)
  put('cpuCores', cpuCores)
  put('cpuThreads', cpuThreads)
  put('ram', ramGB)
  if (SELECTABLE_RAM_TYPES.has(ramType)) put('ramType', ramType)
  put('ramBus', ramBus)
  put('storage', storage)
  put('gpu', gpu)
  put('gpuMemory', gpuMemory)
  if (isLaptop) {
    put('screen', screenSize ?? 0)
  } else {
    put('monitor', monitor)
  }
  put('os', os)
  put('osLicense', osLicense)

  const noteParts: string[] = [`Quét tự động ${formatDateTime(scannedAt)}`, `Máy: ${computerName}`]
  if (ipAddresses) noteParts.push(`IP: ${ipAddresses}`)
  if (cpu) {
    noteParts.push(
      `CPU: ${cpu}${cpuCores > 0 ? ` (${cpuCores} nhân / ${cpuThreads} luồng)` : ''}`
    )
  }
  if (ramSlots || ramGB > 0) {
    noteParts.push(`RAM: ${ramSlots || `${ramGB}GB`}`)
  }
  if (monitor) noteParts.push(`Màn hình: ${monitor}`)
  if (osVersion) noteParts.push(`Windows: ${osVersion}${osBuild ? `.${osBuild}` : ''}`)

  return {
    computerName,
    deviceType: isLaptop ? 'laptop' : 'desktop',
    suggestedCategory: deviceLabel,
    name: buildName(manufacturer, model, deviceLabel, computerName),
    manufacturer,
    model,
    serialNumber,
    cpu,
    cpuCores,
    cpuThreads,
    ramGB,
    ramType,
    ramBus,
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
    specs
  }
}

/** Đọc dòng kết quả base64 do PowerShell in ra. */
export function parseHardwareOutput(stdout: string): HardwareScanResult {
  const line = stdout
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(SCAN_MARKER))

  if (!line) {
    throw new AppError(
      'Không nhận được dữ liệu cấu hình từ Windows. Vui lòng thử quét lại.',
      'INTERNAL'
    )
  }

  let raw: RawHardwareScan
  try {
    raw = JSON.parse(Buffer.from(line.slice(SCAN_MARKER.length), 'base64').toString('utf8')) as RawHardwareScan
  } catch {
    throw new AppError('Dữ liệu cấu hình máy không hợp lệ. Vui lòng thử quét lại.', 'INTERNAL')
  }

  if (!raw || typeof raw !== 'object') {
    throw new AppError('Dữ liệu cấu hình máy không hợp lệ. Vui lòng thử quét lại.', 'INTERNAL')
  }
  return mapHardwareScan(raw)
}

function resolvePowerShell(): string {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const candidate = join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
  return existsSync(candidate) ? candidate : 'powershell.exe'
}

/** Quét cấu hình máy Windows hiện tại bằng PowerShell có sẵn của hệ thống. */
export async function scanHardware(): Promise<HardwareScanResult> {
  if (process.platform !== 'win32') {
    throw new AppError(
      'Tính năng quét cấu hình chỉ chạy trên Windows. Hãy mở Manager Device trên máy cần quét.',
      'BAD_REQUEST'
    )
  }

  return await new Promise<HardwareScanResult>((resolve, reject) => {
    let settled = false
    let stdout = ''
    let stderr = ''
    let timer: NodeJS.Timeout | null = null

    const finish = (action: () => void): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      action()
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(
        resolvePowerShell(),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
      )
    } catch (error) {
      reject(new AppError(`Không mở được PowerShell: ${(error as Error).message}`, 'INTERNAL'))
      return
    }

    timer = setTimeout(() => {
      child.kill()
      finish(() =>
        reject(
          new AppError(
            'Quét cấu hình quá lâu (quá 60 giây). Vui lòng đóng bớt ứng dụng rồi thử lại.',
            'INTERNAL'
          )
        )
      )
    }, SCAN_TIMEOUT_MS)

    child.on('error', (error) => {
      finish(() =>
        reject(new AppError(`Không chạy được PowerShell: ${error.message}`, 'INTERNAL'))
      )
    })

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
      if (stdout.length > 2_000_000) stdout = stdout.slice(-1_000_000)
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000)
    })

    child.on('close', (code) => {
      finish(() => {
        try {
          resolve(parseHardwareOutput(stdout))
        } catch (error) {
          if (error instanceof AppError && stderr.trim()) {
            const detail = stderr.trim().split(/\r?\n/).slice(-3).join(' ').slice(0, 300)
            reject(
              new AppError(
                `${error.message}${code ? ` (PowerShell mã ${code})` : ''}${detail ? ` Chi tiết: ${detail}` : ''}`,
                'INTERNAL'
              )
            )
            return
          }
          reject(error)
        }
      })
    })

    child.stdin?.on('error', () => {
      // PowerShell có thể đóng stdin sớm; lỗi sẽ được xử lý qua sự kiện close.
    })
    child.stdin?.end(POWERSHELL_SCRIPT, 'utf8')
  })
}
