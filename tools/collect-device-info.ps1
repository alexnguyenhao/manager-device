# ============================================================================
#  Manager Device - Thu thập cấu hình máy tính / laptop / máy in
#  Chạy trên Windows PowerShell 5.1 trở lên, không cần quyền Administrator.
#
#  Cách dùng:
#    powershell -NoProfile -ExecutionPolicy Bypass -File .\collect-device-info.ps1
#    powershell ... -File .\collect-device-info.ps1 -OutputFolder "D:\CauHinh"
#    powershell ... -File .\collect-device-info.ps1 -NoPrinters
#
#  Kết quả:
#    cau-hinh-thiet-bi_<TENMAY>_<ngay>.csv   -> nhập trực tiếp vào phần mềm
#    cau-hinh-thiet-bi_<TENMAY>_<ngay>.txt   -> báo cáo đọc nhanh
# ============================================================================

[CmdletBinding()]
param(
    [string]$OutputFolder = "",
    [string]$CategoryDesktop = "Máy tính để bàn",
    [string]$CategoryLaptop = "Laptop",
    [string]$CategoryPrinter = "Máy in",
    [switch]$NoPrinters,
    [switch]$AllPrinters,
    [switch]$OpenFolder
)

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"
$Invariant = [System.Globalization.CultureInfo]::InvariantCulture

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

function Write-Step([string]$Text) {
    Write-Host ""
    Write-Host ("  " + $Text) -ForegroundColor Cyan
    Write-Host ("  " + ("-" * $Text.Length)) -ForegroundColor DarkCyan
}

function Get-WmiText($Value) {
    if ($null -eq $Value) { return "" }
    return ([string]$Value).Trim()
}

function Join-UniqueText($Values, [string]$Separator = " + ") {
    $clean = @($Values | Where-Object { $_ -and ([string]$_).Trim() } | ForEach-Object { ([string]$_).Trim() } | Select-Object -Unique)
    return ($clean -join $Separator)
}

function ConvertFrom-WmiId($Bytes) {
    if ($null -eq $Bytes) { return "" }
    $chars = @()
    foreach ($b in $Bytes) {
        if ($b -ne 0) { $chars += [char]$b }
    }
    return (-join $chars).Trim()
}

function Get-RamTypeName([int]$Code) {
    switch ($Code) {
        20 { return "DDR" }
        21 { return "DDR2" }
        22 { return "DDR2" }
        24 { return "DDR3" }
        26 { return "DDR4" }
        34 { return "DDR5" }
        default { return "" }
    }
}

function Get-OsDisplayName([string]$Caption) {
    $text = ($Caption -replace "^Microsoft\s+", "").Trim()
    if ($text -match "Windows 11 Pro") { return "Windows 11 Pro" }
    if ($text -match "Windows 11 Home") { return "Windows 11 Home" }
    if ($text -match "Windows 10 Pro") { return "Windows 10 Pro" }
    if ($text -match "Windows 10 Home") { return "Windows 10 Home" }
    if ($text -match "Ubuntu") { return "Ubuntu" }
    if ($text -match "Windows") { return "Khác" }
    return "Khác"
}

function Get-ConnectionFromPort([string]$PortName) {
    if (-not $PortName) { return "" }
    if ($PortName -match "^USB") { return "USB" }
    if ($PortName -match "^IP_") { return "LAN" }
    if ($PortName -match "^(TCP|\\\\|LPT)") { return "LAN" }
    return ""
}

function Get-PrinterBrand([string]$Text) {
    $brands = @(
        "HP", "Canon", "Epson", "Brother", "Xerox", "Ricoh", "Kyocera",
        "Lexmark", "Samsung", "Dell", "Panasonic", "Sharp", "Toshiba",
        "Konica Minolta", "OKI", "Fuji Xerox", "Zebra", "Label"
    )
    foreach ($brand in $brands) {
        if ($Text -match [regex]::Escape($brand)) { return $brand }
    }
    return ""
}

function Get-PrinterTechnology([string]$Text, [string]$Color) {
    $lower = $Text.ToLowerInvariant()
    if ($lower -match "laser|imageclass|imagerunner|i-sensys|lbp|mfc-l|e-studio|taskalfa|bizhub|workcentre|versalink|ecosys|docuprint") {
        if ($Color -eq "Có") { return "Laser màu" }
        if ($Color -eq "Không") { return "Laser đen trắng" }
        return ""
    }
    if ($lower -match "inkjet|deskjet|officejet|pixma|ecotank|expression|workforce|stylus") {
        return "Phun màu"
    }
    return ""
}

function Get-GpuMemoryLabel([string]$GpuName, [double]$AdapterRam) {
    $isIntegrated = $GpuName -match "Intel.*(UHD|HD|Iris)|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d|Apple M\d"
    if ($GpuName -match "Intel.*Arc") { $isIntegrated = $false }
    if ($isIntegrated) { return "Chia sẻ" }

    $bytes = 0
    try {
        $classKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
        foreach ($key in @(Get-ChildItem -Path $classKey -ErrorAction SilentlyContinue)) {
            $props = Get-ItemProperty -Path $key.PSPath -ErrorAction SilentlyContinue
            if (-not $props -or -not $props.DriverDesc) { continue }
            if ((Get-WmiText $props.DriverDesc) -ne $GpuName) { continue }
            $qw = $props."HardwareInformation.qwMemorySize"
            if ($qw) { $bytes = [double]$qw; break }
        }
    } catch { }

    if ($bytes -le 0) { $bytes = $AdapterRam }
    if ($bytes -le 0) { return "" }

    $gb = $bytes / 1GB
    if ($gb -ge 1) { return ([math]::Round($gb, 0).ToString() + "GB") }
    return ([math]::Round($gb, 1).ToString() + "GB")
}

function Escape-Csv([object]$Value) {
    if ($null -eq $Value) { return "" }
    $text = ([string]$Value).Replace("`r", " ").Replace("`n", " ")
    if ($text -match '[",]') {
        return '"' + $text.Replace('"', '""') + '"'
    }
    return $text
}

function Write-CsvFile([string]$Path, [string[]]$Headers, [object[]]$Rows) {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add(($Headers | ForEach-Object { Escape-Csv $_ }) -join ",")
    foreach ($row in $Rows) {
        $cells = foreach ($header in $Headers) { Escape-Csv $row[$header] }
        $lines.Add(($cells -join ","))
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, ($lines -join "`r`n"), $encoding)
}

function Add-NotePart([string]$Current, [string]$Part) {
    if (-not $Part) { return $Current }
    if (-not $Current) { return $Part }
    return $Current + " • " + $Part
}

# ---------------------------------------------------------------------------
#  Chuẩn bị thư mục và thông tin chung
# ---------------------------------------------------------------------------

if (-not $OutputFolder) {
    $desktop = [Environment]::GetFolderPath("Desktop")
    if (-not $desktop) { $desktop = $env:USERPROFILE }
    $OutputFolder = Join-Path $desktop "ManagerDevice-CauHinh"
}

if (-not (Test-Path -LiteralPath $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}

$now = Get-Date
$stamp = $now.ToString("yyyyMMdd-HHmm")
$computerName = $env:COMPUTERNAME
$baseName = "cau-hinh-thiet-bi_" + $computerName + "_" + $stamp
$csvPath = Join-Path $OutputFolder ($baseName + ".csv")
$reportPath = Join-Path $OutputFolder ($baseName + ".txt")
$report = New-Object System.Collections.Generic.List[string]

$report.Add("THÔNG TIN THU THẬP TỰ ĐỘNG - MANAGER DEVICE")
$report.Add("Thời điểm: " + $now.ToString("dd/MM/yyyy HH:mm:ss"))
$report.Add("Máy: " + $computerName)
$report.Add("")

Write-Host ""
Write-Host "  MANAGER DEVICE - THU THẬP CẤU HÌNH THIẾT BỊ" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
#  Máy tính / Laptop
# ---------------------------------------------------------------------------

Write-Step "Đang đọc thông tin máy tính..."

$cs = Get-CimInstance -ClassName Win32_ComputerSystem
$bios = Get-CimInstance -ClassName Win32_BIOS
$os = Get-CimInstance -ClassName Win32_OperatingSystem
$cpu = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1
$ramModules = @(Get-CimInstance -ClassName Win32_PhysicalMemory)

$manufacturer = Get-WmiText $cs.Manufacturer
$model = Get-WmiText $cs.Model
$serial = Get-WmiText $bios.SerialNumber
if ($serial -match "To be filled|O\.E\.M|Default string|None") { $serial = "" }
if ($model -match "System Product Name|To Be Filled|Default string|All Series") {
    $model = ""
}

$chassisTypes = @((Get-CimInstance -ClassName Win32_SystemEnclosure).ChassisTypes)
$hasBattery = @(Get-CimInstance -ClassName Win32_Battery).Count -gt 0
$isLaptop = $false
foreach ($chassis in $chassisTypes) {
    if ($chassis -in 8, 9, 10, 14, 30, 31, 32) { $isLaptop = $true }
}
if ($hasBattery) { $isLaptop = $true }

$deviceType = if ($isLaptop) { "Laptop" } else { "Máy tính để bàn" }
$categoryName = if ($isLaptop) { $CategoryLaptop } else { $CategoryDesktop }

$cpuName = Get-WmiText $cpu.Name
$cpuName = $cpuName -replace "\s+", " "
$cpuName = $cpuName -replace "\(R\)|\(TM\)", ""
$cpuName = $cpuName -replace "\s+", " "
$cpuName = $cpuName.Trim()

$cpuCores = 0
$cpuThreads = 0
foreach ($proc in @(Get-CimInstance -ClassName Win32_Processor)) {
    if ($proc.NumberOfCores) { $cpuCores += [int]$proc.NumberOfCores }
    if ($proc.NumberOfLogicalProcessors) { $cpuThreads += [int]$proc.NumberOfLogicalProcessors }
}

$ramTotalGB = 0
if ($cs.TotalPhysicalMemory) {
    $ramTotalGB = [int][math]::Round(([double]$cs.TotalPhysicalMemory / 1GB), 0)
}

$ramTypeNames = @()
foreach ($module in $ramModules) {
    if ($module.SMBIOSMemoryType) {
        $name = Get-RamTypeName ([int]$module.SMBIOSMemoryType)
        if ($name) { $ramTypeNames += $name }
    }
}
$ramType = Join-UniqueText $ramTypeNames " / "

$ramBusValues = @()
foreach ($module in $ramModules) {
    $speed = 0
    if ($module.ConfiguredClockSpeed) { $speed = [int]$module.ConfiguredClockSpeed }
    elseif ($module.Speed) { $speed = [int]$module.Speed }
    if ($speed -gt 0) { $ramBusValues += $speed }
}
$ramBus = 0
if ($ramBusValues.Count -gt 0) {
    $ramBus = [int]($ramBusValues | Measure-Object -Maximum).Maximum
}

$gpuNames = @()
$gpuMemories = @()
foreach ($gpu in @(Get-CimInstance -ClassName Win32_VideoController)) {
    $name = Get-WmiText $gpu.Name
    if ($name -and $name -notmatch "Remote|Basic Display|Virtual|Microsoft Hyper-V") {
        $gpuNames += $name
        $adapterRam = 0
        if ($gpu.AdapterRAM) { $adapterRam = [double]$gpu.AdapterRAM }
        $memory = Get-GpuMemoryLabel $name $adapterRam
        if ($memory) { $gpuMemories += $memory }
    }
}
$gpu = Join-UniqueText $gpuNames " + "
$gpuMemory = Join-UniqueText $gpuMemories " + "

$diskParts = @()
$physicalDisks = @(Get-PhysicalDisk | Where-Object { $_.Size -gt 0 })
if ($physicalDisks.Count -gt 0) {
    foreach ($disk in $physicalDisks) {
        $sizeGB = [int][math]::Round(([double]$disk.Size / 1e9), 0)
        if ($sizeGB -le 0) { continue }
        $media = ""
        if ($disk.MediaType -eq "SSD") { $media = "SSD" }
        elseif ($disk.MediaType -eq "HDD") { $media = "HDD" }
        $label = (($media + " " + $sizeGB + "GB").Trim())
        $diskParts += $label
    }
} else {
    foreach ($disk in @(Get-CimInstance -ClassName Win32_DiskDrive)) {
        if (-not $disk.Size) { continue }
        $sizeGB = [int][math]::Round(([double]$disk.Size / 1e9), 0)
        if ($sizeGB -gt 0) { $diskParts += ($sizeGB.ToString() + "GB") }
    }
}$storage = Join-UniqueText $diskParts " + "

$monitorNames = @()
try {
    foreach ($monitor in @(Get-CimInstance -Namespace "root\wmi" -ClassName WmiMonitorID)) {
        $name = ConvertFrom-WmiId $monitor.UserFriendlyName
        if ($name) { $monitorNames += $name }
    }
} catch { }
$monitor = Join-UniqueText $monitorNames " + "

$osCaption = Get-WmiText $os.Caption
$osName = Get-OsDisplayName $osCaption
$osVersion = Get-WmiText $os.Version
$osBuild = Get-WmiText $os.BuildNumber

$license = "Không rõ"
try {
    $licenses = @(Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND Name LIKE 'Windows%'")
    if ($licenses.Count -gt 0) {
        $licensed = @($licenses | Where-Object { $_.LicenseStatus -eq 1 })
        if ($licensed.Count -gt 0) { $license = "Có bản quyền" }
        else { $license = "Không" }
    }
} catch { }

$ipAddresses = @()
try {
    $primaryConfigs = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null })
    if ($primaryConfigs.Count -gt 0) {
        $ipAddresses = @($primaryConfigs |
            ForEach-Object { $_.IPv4Address.IPAddress } |
            Where-Object { $_ -and $_ -notmatch "^169\.254\." } | Select-Object -Unique)
    }
    if ($ipAddresses.Count -eq 0) {
        $ipAddresses = @(Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\.254\." } |
            ForEach-Object { $_.IPAddress } | Select-Object -Unique)
    }
} catch {
    $ipAddresses = @([System.Net.Dns]::GetHostAddresses($computerName) |
        Where-Object { $_.AddressFamily -eq "InterNetwork" } |
        ForEach-Object { $_.IPAddressToString })
}
$ipText = Join-UniqueText $ipAddresses ", "

$displayName = ""
if ($model) {
    if ($manufacturer -and ($model -notmatch [regex]::Escape($manufacturer))) {
        $displayName = ($manufacturer + " " + $model).Trim()
    } else {
        $displayName = $model
    }
} elseif ($manufacturer) {
    $displayName = ($manufacturer + " " + $deviceType).Trim()
} else {
    $displayName = $deviceType + " " + $computerName
}

$computerNoteParts = @()
$computerNoteParts += ("Tự động thu thập " + $now.ToString("dd/MM/yyyy HH:mm"))
$computerNoteParts += ("Máy: " + $computerName)
if ($ipText) { $computerNoteParts += ("IP: " + $ipText) }
if ($cpuName) { $computerNoteParts += ("CPU: " + $cpuName + $(if ($cpuCores -gt 0) { " (" + $cpuCores + " nhân / " + $cpuThreads + " luồng)" } else { "" })) }
if ($ramModules.Count -gt 0) {
    $slotInfo = @()
    foreach ($module in $ramModules) {
        $slot = Get-WmiText $module.DeviceLocator
        $cap = 0
        if ($module.Capacity) { $cap = [int][math]::Round(([double]$module.Capacity / 1GB), 0) }
        if ($cap -gt 0) {
            if ($slot) { $slotInfo += ($slot + " " + $cap + "GB") }
            else { $slotInfo += ($cap.ToString() + "GB") }
        }
    }
    if ($slotInfo.Count -gt 0) { $computerNoteParts += ("RAM: " + ($slotInfo -join ", ")) }
}
if ($monitor) { $computerNoteParts += ("Màn hình: " + $monitor) }
if ($osVersion) { $computerNoteParts += ("Windows: " + $osVersion + "." + $osBuild) }
$computerNote = ($computerNoteParts -join " • ")

$computerRow = [ordered]@{
    "Mã thiết bị"              = ""
    "Tên thiết bị"             = $displayName
    "Danh mục"                 = $categoryName
    "Serial"                   = $serial
    "Model"                    = $model
    "Hãng sản xuất"            = $manufacturer
    "Trạng thái"               = "Sẵn sàng"
    "Tình trạng"               = "Tốt"
    "Bộ phận"                  = ""
    "Vị trí"                   = ""
    "Người sử dụng"            = ""
    "Nhà cung cấp"             = ""
    "Ngày mua"                 = ""
    "Giá mua"                  = ""
    "Tháng bảo hành"           = ""
    "Tháng khấu hao"           = ""
    "Giá trị thanh lý"         = ""
    "Số hóa đơn"               = ""
    "Ghi chú"                  = $computerNote
    "CPU"                      = $cpuName
    "Số nhân CPU"              = if ($cpuCores -gt 0) { $cpuCores.ToString($Invariant) } else { "" }
    "Số luồng CPU"             = if ($cpuThreads -gt 0) { $cpuThreads.ToString($Invariant) } else { "" }
    "RAM (GB)"                 = if ($ramTotalGB -gt 0) { $ramTotalGB.ToString($Invariant) } else { "" }
    "Loại RAM"                 = $ramType
    "Bus RAM"                  = if ($ramBus -gt 0) { $ramBus.ToString($Invariant) } else { "" }
    "Dung lượng ổ cứng"        = $storage
    "Card đồ họa (GPU)"        = $gpu
    "Bộ nhớ GPU"               = $gpuMemory
    "Màn hình"                 = if ($isLaptop) { "" } else { $monitor }
    "Hệ điều hành"             = $osName
    "Bản quyền Windows"        = $license
    "Kích thước màn hình (inch)" = ""
    "Khối lượng"               = ""
    "Công nghệ in"             = ""
    "Tốc độ in"                = ""
    "Độ phân giải"             = ""
    "Khổ giấy"                 = ""
    "Kết nối"                  = ""
    "In màu"                   = ""
}

$report.Add("LOẠI MÁY: " + $deviceType)
$report.Add("Tên thiết bị: " + $displayName)
$report.Add("Hãng / Model: " + $manufacturer + " / " + $model)
$report.Add("Serial BIOS: " + $serial)
$report.Add("CPU: " + $cpuName + $(if ($cpuCores -gt 0) { " (" + $cpuCores + " nhân / " + $cpuThreads + " luồng)" } else { "" }))
$report.Add("RAM: " + $ramTotalGB + " GB" + $(if ($ramType) { " (" + $ramType + ")" } else { "" }) + $(if ($ramBus -gt 0) { " - Bus " + $ramBus + " MHz" } else { "" }))
$report.Add("Ổ cứng: " + $storage)
$report.Add("GPU: " + $gpu + $(if ($gpuMemory) { " (" + $gpuMemory + ")" } else { "" }))
if ($monitor) { $report.Add("Màn hình: " + $monitor) }
$report.Add("Hệ điều hành: " + $osCaption + " (" + $osVersion + "." + $osBuild + ")")
$report.Add("Bản quyền Windows: " + $license)
$report.Add("IP: " + $ipText)
$report.Add("")

Write-Host ("  " + $deviceType + ": " + $displayName) -ForegroundColor Green
Write-Host ("  CPU: " + $cpuName + $(if ($cpuCores -gt 0) { "  (" + $cpuCores + " nhân / " + $cpuThreads + " luồng)" } else { "" }))
Write-Host ("  RAM: " + $ramTotalGB + " GB " + $ramType + $(if ($ramBus -gt 0) { "  Bus " + $ramBus + " MHz" } else { "" }))
Write-Host ("  Ổ cứng: " + $storage)
Write-Host ("  GPU: " + $gpu + $(if ($gpuMemory) { "  (" + $gpuMemory + ")" } else { "" }))
Write-Host ("  OS: " + $osName + " " + $osVersion)

# ---------------------------------------------------------------------------
#  Máy in
# ---------------------------------------------------------------------------

$printerRows = @()
$printerDetails = @()

if (-not $NoPrinters) {
    Write-Step "Đang đọc thông tin máy in..."

    $printers = @()
    try {
        $printers = @(Get-Printer)
    } catch {
        $printers = @()
    }

    if ($printers.Count -eq 0) {
        Write-Host "  Không tìm thấy máy in nào được cài trên máy này." -ForegroundColor Yellow
        $report.Add("MÁY IN: không có máy in nào được cài đặt.")
    } else {
        $winPrinters = @(Get-CimInstance -ClassName Win32_Printer)

        foreach ($printer in $printers) {
            $name = Get-WmiText $printer.Name
            if (-not $name) { continue }

            $winPrinter = $winPrinters | Where-Object { (Get-WmiText $_.Name) -eq $name } | Select-Object -First 1
            $driver = Get-WmiText $printer.DriverName
            $port = Get-WmiText $printer.PortName

            if (-not $AllPrinters) {
                $virtualName = "Fax|Microsoft Print to PDF|Microsoft XPS Document Writer|Send To OneNote|OneNote|PDF24|PDFCreator|PDF Creator|CutePDF|doPDF|Bullzip|Print to File"
                $virtualDriver = "^Microsoft (Shared Fax|Print To PDF|XPS Document Writer)|OneNote|PDF24|PDFCreator|CutePDF|Bullzip|doPDF"
                $virtualPort = "^(SHRFAX:|PORTPROMPT:|nul:|FILE:)"
                if (($name -match $virtualName) -or ($driver -match $virtualDriver) -or ($port -match $virtualPort)) {
                    Write-Host ("  (bỏ qua máy in ảo: " + $name + ")") -ForegroundColor DarkGray
                    continue
                }
            }

            $isDefault = $false
            if ($winPrinter -and $winPrinter.Default) { $isDefault = $true }

            $printerColor = ""
            try {
                $config = Get-PrintConfiguration -PrinterName $name
                if ($null -ne $config.Color) {
                    if ($config.Color) { $printerColor = "Có" } else { $printerColor = "Không" }
                }
            } catch { }

            if (-not $printerColor -and $winPrinter) {
                if ($winPrinter.Monochrome -eq $true) { $printerColor = "Không" }
                elseif ($winPrinter.Monochrome -eq $false) { $printerColor = "Có" }
            }

            $resolution = ""
            if ($winPrinter -and $winPrinter.HorizontalResolution -gt 0) {
                $resolution = ([string]$winPrinter.HorizontalResolution + " x " + [string]$winPrinter.VerticalResolution + " dpi")
            }

            $connection = Get-ConnectionFromPort $port

            $hostAddress = ""
            try {
                $portInfo = Get-PrinterPort -Name $port
                if ($portInfo -and $portInfo.PrinterHostAddress) {
                    $hostAddress = Get-WmiText $portInfo.PrinterHostAddress
                }
            } catch { }
            if (-not $hostAddress -and $port -match "(\d{1,3}(\.\d{1,3}){3})") {
                $hostAddress = $Matches[1]
            }

            $isOffline = $false
            if ($winPrinter) {
                if ($winPrinter.WorkOffline) { $isOffline = $true }
                if ($winPrinter.PrinterStatus -in 1, 2, 7) { $isOffline = $true }
            }
            if ($printer.PrinterStatus -in "Offline", "Error", "NotAvailable") { $isOffline = $true }

            $status = if ($isOffline) { "Bảo trì" } else { "Sẵn sàng" }
            $condition = if ($isOffline) { "Kém" } else { "Tốt" }

            $brand = Get-PrinterBrand ($name + " " + $driver)
            $technology = Get-PrinterTechnology ($name + " " + $driver) $printerColor

            $printerModel = $driver
            if (-not $printerModel -or $printerModel -match "^Microsoft|Class Driver|Generic|Universal") {
                $printerModel = $name
            }

            $printerNoteParts = @()
            $printerNoteParts += ("Tự động thu thập " + $now.ToString("dd/MM/yyyy HH:mm"))
            $printerNoteParts += ("Cổng: " + $port)
            if ($driver) { $printerNoteParts += ("Driver: " + $driver) }
            if ($isDefault) { $printerNoteParts += "Máy in mặc định" }
            if ($printer.Shared) { $printerNoteParts += ("Chia sẻ: " + (Get-WmiText $printer.ShareName)) }
            if ($hostAddress) { $printerNoteParts += ("IP: " + $hostAddress) }
            if ($winPrinter -and $winPrinter.Location -and $winPrinter.Location -notmatch "^https?://") {
                $printerNoteParts += ("Vị trí: " + (Get-WmiText $winPrinter.Location))
            }
            $printerNote = ($printerNoteParts -join " • ")

            $printerRows += [ordered]@{
                "Mã thiết bị"              = ""
                "Tên thiết bị"             = $name
                "Danh mục"                 = $CategoryPrinter
                "Serial"                   = ""
                "Model"                    = $printerModel
                "Hãng sản xuất"            = $brand
                "Trạng thái"               = $status
                "Tình trạng"               = $condition
                "Bộ phận"                  = ""
                "Vị trí"                    = ""
                "Người sử dụng"            = ""
                "Nhà cung cấp"             = ""
                "Ngày mua"                 = ""
                "Giá mua"                  = ""
                "Tháng bảo hành"           = ""
                "Tháng khấu hao"           = ""
                "Giá trị thanh lý"         = ""
                "Số hóa đơn"               = ""
                "Ghi chú"                  = $printerNote
                "CPU"                      = ""
                "Số nhân CPU"              = ""
                "Số luồng CPU"             = ""
                "RAM (GB)"                 = ""
                "Loại RAM"                 = ""
                "Bus RAM"                  = ""
                "Dung lượng ổ cứng"        = ""
                "Card đồ họa (GPU)"        = ""
                "Bộ nhớ GPU"               = ""
                "Màn hình"                 = ""
                "Hệ điều hành"             = ""
                "Bản quyền Windows"        = ""
                "Kích thước màn hình (inch)" = ""
                "Khối lượng"               = ""
                "Công nghệ in"             = $technology
                "Tốc độ in"                = ""
                "Độ phân giải"             = $resolution
                "Khổ giấy"                 = ""
                "Kết nối"                  = $connection
                "In màu"                   = $printerColor
            }

            $printerDetails += ("- " + $name + " | " + $driver + " | " + $port + " | " + $status + " | " + $(if ($isDefault) { "mặc định" } else { "không mặc định" }))

            Write-Host ("  - " + $name) -ForegroundColor Green
            Write-Host ("    Driver: " + $driver)
            Write-Host ("    Cổng: " + $port + "  Kết nối: " + $connection + "  Màu: " + $printerColor)
            Write-Host ("    Trạng thái: " + $status + "  Độ phân giải: " + $resolution)
        }

        $report.Add("MÁY IN (" + $printerRows.Count + "):")
        foreach ($line in $printerDetails) { $report.Add($line) }
    }
}

# ---------------------------------------------------------------------------
#  Ghi file CSV + báo cáo
# ---------------------------------------------------------------------------

$headers = @(
    "Mã thiết bị", "Tên thiết bị", "Danh mục", "Serial", "Model", "Hãng sản xuất",
    "Trạng thái", "Tình trạng", "Bộ phận", "Vị trí", "Người sử dụng", "Nhà cung cấp",
    "Ngày mua", "Giá mua", "Tháng bảo hành", "Tháng khấu hao", "Giá trị thanh lý",
    "Số hóa đơn", "Ghi chú", "CPU", "Số nhân CPU", "Số luồng CPU", "RAM (GB)",
    "Loại RAM", "Bus RAM", "Dung lượng ổ cứng", "Card đồ họa (GPU)", "Bộ nhớ GPU",
    "Màn hình", "Hệ điều hành", "Bản quyền Windows",
    "Kích thước màn hình (inch)", "Khối lượng", "Công nghệ in", "Tốc độ in",
    "Độ phân giải", "Khổ giấy", "Kết nối", "In màu"
)

$rows = @()
$rows += $computerRow
foreach ($row in $printerRows) { $rows += $row }

try {
    Write-CsvFile -Path $csvPath -Headers $headers -Rows $rows
} catch {
    Write-Host ("  LỖI khi ghi CSV: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}

$report.Add("")
$report.Add("Tệp CSV nhập vào phần mềm: " + $csvPath)
$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($reportPath, ($report -join "`r`n"), $encoding)

Write-Step "Hoàn tất"
Write-Host ("  CSV : " + $csvPath) -ForegroundColor Yellow
Write-Host ("  TXT : " + $reportPath) -ForegroundColor Yellow
Write-Host ""
Write-Host "  Nhập vào phần mềm: Thiết bị → Nhập Excel → chọn tệp CSV vừa tạo." -ForegroundColor White
Write-Host "  Lưu ý: mỗi lần chạy là một bản mới; tránh nhập trùng cùng một thiết bị." -ForegroundColor DarkGray
Write-Host ""

if ($OpenFolder) {
    Start-Process explorer.exe -ArgumentList ('"' + $OutputFolder + '"')
}

exit 0
