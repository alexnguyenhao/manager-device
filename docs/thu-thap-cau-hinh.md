# Thu thập cấu hình máy tính, laptop và máy in

Có 4 cách, từ nhanh nhất đến đầy đủ nhất.

> **Nếu Smart App Control đang bật:** đừng chạy tệp `.bat`. Dùng **web tool** hoặc nút **Quét máy này** trong Manager Device — cả hai đều chạy script qua `powershell.exe` có sẵn trong bộ nhớ, không tạo tệp `.bat`/`.ps1` nên không bị chặn với lỗi *“dangerous file extension”*. Không nên tắt Smart App Control chỉ để chạy công cụ.

---

## Cách 1 — Web tool, máy khác không cần cài đặt (khuyến nghị)

Mở **<https://alexnguyenhao.github.io/manager-device/>** trên máy cần quét:

1. Bấm **Sao chép lệnh**.
2. Nhấn **Win + X** → **Terminal** (hoặc PowerShell) → **Ctrl + V** → **Enter**.
3. Script quét khoảng 3 giây, in mã `MD1:…`, copy vào clipboard và mở sẵn trang kèm kết quả.
4. Kiểm tra bảng cấu hình, sửa tên/danh mục nếu cần rồi bấm **Thêm vào danh sách**.
5. Bấm **Sao chép mã** để copy tất cả mã `MD1:…` của máy đó.
6. Lặp lại trên từng máy, gửi các mã về **một máy tổng hợp** (Zalo, email, USB…).
7. Ở máy tổng hợp: dán tất cả mã vào ô **Dán kết quả**, bấm **Phân tích** rồi **Thêm tất cả N máy**.
8. Bấm **Xuất CSV** một lần, sau đó trong Manager Device: **Thiết bị → Nhập Excel → chọn tệp CSV**.

Danh sách lưu trong trình duyệt của từng máy nên **không tự đồng bộ**; mã `MD1:` chính là cách mang dữ liệu giữa các máy. Cũng có thể dùng **Sao lưu** để xuất tệp JSON rồi **Nạp** ở máy tổng hợp.

Không cần cài phần mềm, không cần Administrator, không tạo tệp thực thi. Dữ liệu chỉ nằm trong trình duyệt, không có máy chủ nhận dữ liệu.

> Cột thông số trong CSV dùng đúng khóa của danh mục (`cpu`, `ram (GB)`, `storage`, `monitor`, `screen (inch)`…), không đổi tên cột để nhập được trực tiếp. Chi tiết: **`web-tool/README.md`**.

---

## Cách 2 — Chạy script CSV tự động (dự phòng)

Script đọc cấu hình máy đang chạy, xuất **CSV nhập thẳng vào phần mềm** và một báo cáo TXT để đọc nhanh.

### Gửi sang máy khác

**Cách A — Chép cả thư mục `tools`** (đầy đủ nhất)

1. Tải hoặc clone kho mã nguồn, lấy **cả thư mục `tools`**.
2. Chép thư mục này sang máy đích (USB, Zalo, Google Drive…).
3. Nhấp đúp **`ThuThapCauHinh.bat`** trong thư mục đó.

> Không chạy được nếu chỉ gửi mỗi `ThuThapCauHinh.bat`, vì file này cần `collect-device-info.ps1` nằm cùng thư mục. Nếu Windows chặn file tải về: chuột phải file → **Properties** → tích **Unblock** → **OK**.

**Cách B — Không cần chép file**

Copy các lệnh PowerShell ở **Cách 3** bên dưới, dán vào PowerShell trên máy đích.

### Chạy

1. Mở thư mục `tools` (hoặc thư mục đã giải nén).
2. Nhấp đúp **`ThuThapCauHinh.bat`**.
3. Kết quả nằm trên Desktop trong thư mục **`ManagerDevice-CauHinh`**:
   - `cau-hinh-thiet-bi_<TÊN MÁY>_<ngày>.csv` — nhập vào phần mềm.
   - `cau-hinh-thiet-bi_<TÊN MÁY>_<ngày>.txt` — báo cáo chi tiết.
4. Trong phần mềm: **Thiết bị → Nhập Excel → chọn tệp CSV** vừa tạo.

Không cần quyền Administrator. Script chỉ đọc thông tin trên máy, **không gửi dữ liệu đi đâu**.

### Thu thập được gì

| Thiết bị | Thông tin |
| --- | --- |
| Máy tính để bàn | Hãng, model, serial BIOS, CPU + số nhân/số luồng, RAM + loại RAM + bus, ổ cứng (SSD/HDD + dung lượng), GPU + bộ nhớ, màn hình, hệ điều hành, bản quyền Windows, IP |
| Laptop | Như trên, tự nhận diện qua chassis/pin; bỏ trống kích thước màn hình và khối lượng để bạn tự điền |
| Máy in | Tên, hãng, model, driver, cổng, độ phân giải, in màu, kết nối USB/LAN, trạng thái, máy in mặc định, IP (nếu có) |

Máy in ảo (Fax, Microsoft Print to PDF, XPS, OneNote, PDF24…) được **bỏ qua** để không nhập rác vào hệ thống.

### Tùy chọn

```powershell
# Không quét máy in
powershell -NoProfile -ExecutionPolicy Bypass -File .\collect-device-info.ps1 -NoPrinters

# Lưu vào thư mục khác
powershell ... -File .\collect-device-info.ps1 -OutputFolder "D:\CauHinh"

# Lấy cả máy in ảo (mặc định đã lọc)
powershell ... -File .\collect-device-info.ps1 -AllPrinters

# Đổi tên danh mục nếu hệ thống của bạn dùng tên khác
powershell ... -File .\collect-device-info.ps1 `
  -CategoryDesktop "Máy tính để bàn" `
  -CategoryLaptop "Laptop" `
  -CategoryPrinter "Máy in"
```

### Lưu ý khi nhập

- Danh mục trong CSV phải **trùng tên danh mục trong phần mềm**. Mặc định đã khớp với 9 danh mục chuẩn.
- Các cột Phòng ban / Vị trí / Người sử dụng / Nhà cung cấp để trống vì script không biết dữ liệu của đơn vị. Sau khi nhập, sửa trong phần mềm hoặc dùng mẫu Excel để điền.
- Mỗi lần chạy là một bản mới. Tránh nhập trùng cùng một thiết bị.
- Muốn thu thập nhiều máy: chép thư mục `tools` sang USB, chạy trên từng máy, rồi gom các file CSV lại để nhập.

---

## Cách 3 — Lệnh nhanh, không cần file

Mở **PowerShell** trên máy cần kiểm tra (Windows + X → Terminal/PowerShell) và dán:

### Tóm tắt máy

```powershell
Get-ComputerInfo | Select-Object CsName, CsManufacturer, CsModel, OsName, OsVersion, OsArchitecture
```

### CPU, RAM, ổ cứng, GPU

```powershell
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors
Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel, @{n='GB';e={[math]::Round($_.Capacity/1GB)}}, Speed, SMBIOSMemoryType, Manufacturer
Get-PhysicalDisk | Select-Object FriendlyName, MediaType, @{n='GB';e={[math]::Round($_.Size/1e9)}}
Get-CimInstance Win32_VideoController | Select-Object Name
```

### Serial, model, bo mạch chủ

```powershell
Get-CimInstance Win32_BIOS | Select-Object SerialNumber
Get-CimInstance Win32_ComputerSystemProduct | Select-Object Vendor, Name, IdentifyingNumber
Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, SerialNumber
```

### Máy in

```powershell
Get-Printer | Format-Table Name, DriverName, PortName, PrinterStatus, Shared -AutoSize
Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, Default, HorizontalResolution, VerticalResolution, WorkOffline
```

### Bản quyền Windows

```powershell
slmgr /xpr
```

### Giao diện đồ họa có sẵn

| Lệnh | Nội dung |
| --- | --- |
| `msinfo32` | Tổng hợp cấu hình, model, serial, RAM, OS |
| `dxdiag` | CPU, RAM, GPU, màn hình, âm thanh |
| `devmgmt.msc` | Danh sách thiết bị và driver |
| `control printers` | Quản lý máy in |

---

## Cách 4 — Quét từ xa qua mạng (nâng cao)

Máy quét cần bật **WinRM/PowerShell Remoting** và tài khoản có quyền admin trên máy đích.

```powershell
$may = "PC01"

Invoke-Command -ComputerName $may -ScriptBlock {
  $cs = Get-CimInstance Win32_ComputerSystem
  $bios = Get-CimInstance Win32_BIOS
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  [pscustomobject]@{
    May = $env:COMPUTERNAME
    Hang = $cs.Manufacturer
    Model = $cs.Model
    Serial = $bios.SerialNumber
    CPU = $cpu.Name
    RAM_GB = [math]::Round($cs.TotalPhysicalMemory/1GB)
  }
} | Format-List
```

Xem máy in trên một máy khác:

```powershell
Get-Printer -ComputerName PC01 | Format-Table Name, DriverName, PortName, PrinterStatus
```

> Nếu lệnh báo lỗi truy cập, kiểm tra firewall, WinRM (`Enable-PSRemoting -Force`) và quyền tài khoản.

---

## Nhập kết quả vào phần mềm

- **CSV từ script**: Thiết bị → Nhập Excel → chọn `.csv`.
- **Mẫu Excel đầy đủ**: tải tại [Release](https://github.com/alexnguyenhao/manager-device/releases/latest) hoặc trong ứng dụng.
- Sau khi nhập, cập nhật thêm **Phòng ban, Vị trí, Người sử dụng, Ngày mua, Giá mua** nếu cần.
