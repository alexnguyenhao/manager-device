# Manager Device

[![Release](https://img.shields.io/github/v/release/alexnguyenhao/manager-device?label=release)](https://github.com/alexnguyenhao/manager-device/releases/latest)
[![Build](https://github.com/alexnguyenhao/manager-device/actions/workflows/build-release.yml/badge.svg)](https://github.com/alexnguyenhao/manager-device/actions/workflows/build-release.yml)

Phần mềm quản lý thiết bị và tài sản công dành cho **UBND cấp xã**, chạy **hoàn toàn cục bộ** trên máy tính Windows/Linux. Ứng dụng giúp theo dõi toàn bộ vòng đời tài sản: tiếp nhận, cấu hình, cấp phát, bảo trì, kiểm kê, khấu hao và thanh lý — tất cả trong một giao diện tiếng Việt duy nhất.

Dữ liệu được lưu trong SQLite tại thư mục người dùng, không gửi lên máy chủ và không cần kết nối Internet. Nếu bạn chủ động bật sao lưu Google Drive, bản snapshot mới được tải lên tài khoản Drive của bạn.

---

## Cơ cấu tổ chức

Phòng ban, đơn vị được quản lý theo hai khối, phục vụ thống kê và báo cáo riêng:

- **Khối Đảng** — Văn phòng Đảng ủy, Ban Xây dựng Đảng, Ủy ban Kiểm tra, Ủy ban Mặt trận Tổ quốc Việt Nam.
- **Khối Nhà nước** — Văn phòng HĐND và UBND, Phòng Kinh tế, Phòng Văn hóa - Xã hội, Trung tâm Phục vụ Hành chính Công, Trung tâm Dịch vụ Tổng hợp.

Có thể thêm, sửa hoặc ngừng sử dụng phòng ban tại **Cơ cấu tổ chức**. Mỗi thiết bị, nhân viên và báo cáo đều gắn với khối tương ứng.

---

## Tính năng chính

- **Bảng điều khiển** — KPI tài sản, giá trị còn lại, cảnh báo bảo hành/bảo trì, cơ cấu tài sản theo Khối Đảng/Khối Nhà nước, biểu đồ phân bố và hoạt động gần đây.
- **Quản lý thiết bị** — Danh sách, tìm kiếm không phân biệt dấu (kể cả cấu hình CPU/RAM/ổ cứng), lọc theo khối/phòng ban, sắp xếp, thêm/sửa/xóa, nhập và xuất Excel.
- **Quét cấu hình máy** — Nút **Quét máy này** đọc CPU, RAM, ổ cứng, GPU, màn hình, Windows, serial và tự điền biểu mẫu PC/Laptop; chạy qua PowerShell có sẵn nên không bị Smart App Control chặn.
- **Thu thập từ xa** — [Web tool](https://alexnguyenhao.github.io/manager-device/) chạy trên trình duyệt, máy cán bộ không cần cài gì: dán một lệnh PowerShell, gom nhiều máy rồi xuất CSV nhập vào phần mềm.
- **Hồ sơ thiết bị** — Cấu hình chi tiết theo danh mục (CPU, RAM, GPU, dung lượng ổ cứng, hệ điều hành/Windows…), khấu hao, bảo hành, tệp đính kèm, lịch sử cấp phát/bảo trì/nhật ký.
- **Xuất cấu hình thiết bị** — Xuất Excel danh sách thiết bị kèm **đầy đủ thông số cấu hình**; mỗi danh mục một sheet với đúng các cột thông số của danh mục đó, thuận tiện lập báo cáo và đối chiếu.
- **Cấp phát & thu hồi** — Bàn giao thiết bị cho cán bộ, công chức **hoặc phân bổ cho phòng ban** mà không cần giao cho nhân viên; theo dõi hạn trả, tình trạng trước/sau khi thu hồi.
- **Hạ tầng CNTT & HTTT** — Quản lý tập trung số liệu máy chủ vật lý, máy ảo, switch, firewall (có lịch sử thay đổi) và danh mục hệ thống thông tin kèm cấp độ an toàn 1–5, số quyết định phê duyệt, hồ sơ PDF, dashboard, báo cáo Excel/PDF và nhập hàng loạt từ Excel.
- **Bảo trì & sửa chữa** — Lập lịch, theo dõi tiến độ, chi phí, nhà cung cấp và lịch sử bảo dưỡng.
- **Kiểm kê** — Tạo phiên kiểm kê, quét QR bằng webcam hoặc đầu đọc mã vạch, đối chiếu vị trí/người sử dụng, xuất kết quả.
- **Danh mục** — Danh mục thiết bị với bộ thông số riêng, mẫu cấu hình dựng sẵn cho PC/Laptop/máy in/thiết bị mạng…, cơ cấu tổ chức, vị trí, nhà cung cấp, nhân viên.
- **Báo cáo** — Tổng hợp theo khối/phòng ban/danh mục/trạng thái, giá trị và khấu hao, xuất Excel.
- **Người dùng & phân quyền** — Bốn vai trò: quản trị viên, quản lý, nhân viên, chỉ xem; kiểm tra quyền ở tiến trình chính.
- **Nhật ký hoạt động** — Ghi nhận tự động mọi thao tác, lọc theo người dùng, đối tượng và thời gian.
- **Cài đặt & sao lưu** — Thông tin đơn vị, quy tắc cảnh báo, sao lưu/phục hồi cơ sở dữ liệu, xóa dữ liệu nghiệp vụ.
- **Giao diện** — Sáng/tối, sidebar thu gọn, tìm kiếm nhanh `Ctrl + K`, thông báo toast, nhãn QR in được.

---

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Desktop | Electron 45 |
| Giao diện | React 19, TypeScript 5.9, Tailwind CSS 4, lucide-react |
| Build | electron-vite 5, Vite 7 |
| Cơ sở dữ liệu | SQLite tích hợp sẵn (`node:sqlite`) |
| Trạng thái | Zustand |
| Biểu đồ | Recharts |
| Excel | ExcelJS |
| Bảo mật | bcryptjs, kiểm tra quyền qua IPC |
| QR | qrcode.react, html5-qrcode |

Ứng dụng dùng `node:sqlite` có sẵn trong Node.js của Electron thay vì module native, nhờ đó không cần biên dịch lại khi cài đặt hoặc đóng gói trên Windows.

---

## Yêu cầu hệ thống

- Windows 10/11 64-bit (khuyến nghị)
- Node.js **22 trở lên** (khuyến nghị 22 LTS hoặc 24)
- npm 10 trở lên
- Khi phát triển trên Linux/macOS vẫn chạy được, nhưng bản đóng gói chính thức hướng tới Windows.

---

## Tải bản phát hành

Bộ cài Windows (.exe) và AppImage Linux được tạo tự động bởi GitHub Actions:

**https://github.com/alexnguyenhao/manager-device/releases/latest**

Tải `ManagerDevice-Setup-1.0.5.exe`, chạy và làm theo hướng dẫn cài đặt. Ứng dụng chạy hoàn toàn cục bộ, dữ liệu lưu trên máy người dùng. File Excel mẫu nhập thiết bị cũng được đính kèm trong mục **Assets** của bản phát hành.

---

## Cài đặt & chạy

```bash
# 1. Cài dependencies
npm install

# 2. Chạy ở chế độ phát triển
npm run dev

# 3. Kiểm tra kiểu dữ liệu
npm run typecheck

# 4. Build production
npm run build

# 5. Tạo bộ cài Windows
npm run build:win
```

Bộ cài sau khi build nằm trong thư mục `release/` với tên dạng `ManagerDevice-Setup-1.0.5.exe`.

> Nếu mạng npm không ổn định, có thể chạy `npm install --prefer-offline` hoặc cấu hình registry nội bộ. Không cần tải binary Electron riêng — npm sẽ tự tải khi cài đặt bình thường.

---

## Thu thập cấu hình nhanh

### Cách 1 — Web tool, máy khác không cần cài đặt

Mở **<https://alexnguyenhao.github.io/manager-device/>** trên máy của cán bộ:

1. Bấm **Sao chép lệnh**.
2. Nhấn **Win + X** → **Terminal** → **Ctrl + V** → **Enter** (không cần Administrator, không tải tệp nào).
3. Trang tự mở kèm kết quả; bấm **Thêm vào danh sách**, rồi **Sao chép mã** để lấy mã `MD1:…`.
4. Lặp lại trên từng máy và gửi mã về một máy tổng hợp. Dán tất cả mã vào ô **Dán kết quả** → **Thêm tất cả** → **Xuất CSV** một lần.
5. Trong Manager Device: **Thiết bị → Nhập Excel → chọn tệp CSV**.

Danh sách không tự đồng bộ giữa các máy — mã `MD1:` (hoặc tệp **Sao lưu** JSON) là cách mang dữ liệu về một chỗ. Lệnh tải `scan.txt` về bộ nhớ rồi chạy nên **không tạo tệp `.bat`/`.ps1`** và không bị **Smart App Control** chặn. Dữ liệu chỉ lưu trong trình duyệt của bạn, không có máy chủ nào nhận.

Xem chi tiết và giới hạn tại **`web-tool/README.md`**.

> Lần đầu triển khai cần bật Pages một lần: **Settings → Pages → Build and deployment → Source: GitHub Actions**, sau đó chạy lại workflow **Deploy web tool**. Nếu chưa bật, workflow sẽ báo lỗi ở bước *Setup Pages*.

### Cách 2 — Quét ngay trong Manager Device (khi máy đã cài ứng dụng)

Mở **Thiết bị** → **Quét máy này** (hoặc nút **Quét máy này** trong biểu mẫu thêm thiết bị). Ứng dụng sẽ:

- Đọc CPU + số nhân/số luồng, RAM + loại RAM + bus, ổ cứng, GPU + bộ nhớ, màn hình/kích thước màn hình, hệ điều hành, bản quyền Windows, serial, hãng/model và địa chỉ IP.
- Tự chọn danh mục **Máy tính để bàn** hoặc **Laptop**, tự sinh mã thiết bị và điền sẵn các trường cấu hình đúng khóa `specs` của ứng dụng.
- Hiển thị bảng tóm tắt kiểu CPU-Z ngay trong biểu mẫu để đối chiếu trước khi lưu. Có thể bấm **Quét lại** nếu vừa thay đổi phần cứng.

Cách hoạt động này **không tạo tệp `.bat`/`.ps1`**. Ứng dụng gọi `powershell.exe` có sẵn của Windows và gửi script qua standard input, nên không bị **Smart App Control** chặn với lỗi *“blocked an app with a dangerous file extension”*. Không cần quyền Administrator và không gửi dữ liệu ra ngoài.

### Cách 3 — Công cụ CSV dự phòng

Chỉ dùng khi máy đích không cài Manager Device và chính sách bảo mật cho phép chạy script. Chạy **`tools/ThuThapCauHinh.bat`** trên máy Windows cần kiểm tra. Script tự đọc cấu hình và xuất:

- **CSV** nhập thẳng vào phần mềm (Thiết bị → Nhập Excel).
- **TXT** báo cáo chi tiết để đọc/đối chiếu.

Nội dung thu thập: hãng, model, serial, CPU + số nhân/số luồng, RAM + loại RAM + bus, ổ cứng, GPU + bộ nhớ, màn hình, hệ điều hành, bản quyền Windows, IP; với máy in: tên, driver, cổng, độ phân giải, in màu, kết nối, trạng thái, máy in mặc định. Máy in ảo (Fax, PDF, XPS, OneNote…) tự động bị bỏ qua.

Không cần Administrator, không gửi dữ liệu ra ngoài. Xem hướng dẫn và các lệnh kiểm tra nhanh tại **`docs/thu-thap-cau-hinh.md`**.

> Nếu Smart App Control đang bật và chặn `.bat`, hãy dùng nút **Quét máy này** trong ứng dụng thay vì cố chạy công cụ CSV. Không nên tắt Smart App Control chỉ để chạy công cụ.

### Gửi công cụ CSV sang máy người khác

Công cụ CSV nằm trong thư mục **`tools/`** của kho mã nguồn:

- Chép **cả thư mục `tools`** (gồm `ThuThapCauHinh.bat` và `collect-device-info.ps1`) sang máy đích, sau đó chạy `ThuThapCauHinh.bat`.
- Không chạy được nếu chỉ gửi mỗi `ThuThapCauHinh.bat`, vì file này cần `collect-device-info.ps1` nằm cùng thư mục.
- Nếu Windows chặn file tải về: chuột phải → **Properties** → tích **Unblock** → **OK**.
- Nếu Smart App Control chặn file `.bat`: dùng **Quét máy này** trong Manager Device trên máy đích, hoặc liên hệ quản trị viên để được cấp quyền chạy công cụ.

---

## Mẫu nhập thiết bị từ Excel

File mẫu sẵn dùng: **`docs/ManagerDevice-Mau-Nhap-Thiet-Bi.xlsx`** (cũng tải được trong ứng dụng tại **Thiết bị → Nhập Excel → Tải mẫu**).

- Mỗi danh mục có một sheet riêng: Máy tính để bàn, Laptop, Máy in, Máy scan, Máy chiếu, Thiết bị mạng, Bộ lưu điện, Màn hình, Thiết bị khác.
- Cột **Danh mục** tự lấy theo tên sheet nếu để trống.
- **Dropdown** cho Danh mục, Trạng thái, Tình trạng, Phòng ban, Vị trí, Người sử dụng, Nhà cung cấp và các trường chọn (Loại RAM, Hệ điều hành, Cổng kết nối…).
- Cột thông số kỹ thuật (CPU, RAM, GPU, ổ cứng, hệ điều hành, tốc độ in, khổ giấy…) khớp đúng `specSchema` của từng danh mục nên được lưu vào `specs` khi nhập.
- Ô số (RAM, giá mua, tháng bảo hành…) chỉ nhận số; ngày mua theo `dd/mm/yyyy`.
- Dòng trống được bỏ qua; dòng lỗi được báo kèm tên sheet và số dòng, các dòng hợp lệ vẫn được nhập.

Tạo lại mẫu khi danh mục/phòng ban/nhân viên thay đổi:

```bash
npm run template:excel
# hoặc chỉ định database và file đầu ra
node scripts/generate-import-template.mjs --db "/path/to/manager-device.db" --out docs/mau-nhap.xlsx
```

---

## Xuất danh sách thiết bị kèm cấu hình

Vào **Thiết bị → Excel → Xuất kèm cấu hình đầy đủ**.

- Áp dụng đúng bộ lọc và thứ tự sắp xếp đang xem: từ khóa, danh mục, trạng thái, hình thức phân bổ, phòng ban, khối, vị trí, bảo hành.
- Workbook gồm:
  - **Danh sách thiết bị** — toàn bộ thiết bị với mã, tên, danh mục, serial, model, hãng, phòng ban, người sử dụng, trạng thái, tình trạng, vị trí, ngày mua, bảo hành và cột **Cấu hình đầy đủ** (ghép mọi thông số thành một chuỗi dễ đọc).
  - **Mỗi danh mục một sheet** (Máy tính để bàn, Laptop, Máy in…) — các cột thông số đúng theo `specSchema` của danh mục (CPU, RAM, ổ cứng, tốc độ in, khổ giấy…), kèm mã, tên, serial, model, hãng, phòng ban, người sử dụng, trạng thái, ghi chú.
- Mỗi sheet có 2 dòng tiêu đề báo cáo, dòng 3 là tiêu đề cột, đóng băng và bật auto-filter; giá trị số (RAM, tốc độ, số cổng…) được giữ ở dạng số để tính toán/sắp xếp.
- Tên tệp: `danh-sach-thiet-bi-cau-hinh-YYYYMMDD.xlsx`.

---

## Hạ tầng CNTT & hệ thống thông tin

Chức năng phục vụ quản lý tập trung hạ tầng và danh mục HTTT, đáp ứng báo cáo, kiểm tra, thanh tra an toàn thông tin.

- **Hạ tầng CNTT** (menu *Hạ tầng & HTTT → Hạ tầng CNTT*): nhập số lượng máy chủ vật lý, máy ảo, switch, firewall; mỗi lần lưu đều ghi người cập nhật, thời điểm và bảng so sánh trước/sau.
- **Danh mục HTTT** (menu *Hạ tầng & HTTT → Hệ thống thông tin*): mã tự sinh `HTTT-0001`, tên duy nhất, đơn vị quản lý, cấp độ 1–5 hoặc “Chưa xác định cấp độ”, số/ngày/cơ quan quyết định, trạng thái, hình thức triển khai, thiết bị liên kết và tệp hồ sơ. Hỗ trợ tìm kiếm, lọc theo cấp độ/trạng thái/phòng ban/thời gian, xóa mềm.
- **Kiểm tra nghiệp vụ**: chặn lưu khi đã có cấp độ mà thiếu số quyết định; chặn trùng số quyết định (có thể bật dùng chung trong **Cài đặt**); cảnh báo HTTT chưa xác định cấp độ hoặc cấp độ ≥ 3 thiếu ngày ký, cơ quan ban hành, hồ sơ đính kèm.
- **Báo cáo**: xuất Excel nhiều sheet (tổng hợp hạ tầng, phân bố cấp độ, danh sách HTTT, cảnh báo) và PDF theo mẫu, áp dụng bộ lọc thời gian đang chọn.
- **Nhập hàng loạt**: tải mẫu Excel, nhập dữ liệu, xem báo cáo dòng lỗi; dòng có mã đã tồn tại sẽ được cập nhật.

Chi tiết thiết kế cơ sở dữ liệu, danh sách màn hình/API và hướng dẫn sử dụng: **`docs/huong-dan-ha-tang-httt.md`**.

---

## Tài khoản dùng thử

Lần chạy đầu tiên, ứng dụng tự tạo dữ liệu mẫu mô phỏng **UBND xã An Bình**: 9 phòng ban, đơn vị thuộc 2 khối, 18 cán bộ công chức, 25 thiết bị (trong đó 01 thiết bị phân bổ cho phòng ban), 4 nhà cung cấp địa phương, 10 hệ thống thông tin và số liệu hạ tầng mẫu, cùng 4 tài khoản:

| Tên đăng nhập | Mật khẩu | Vai trò |
| --- | --- | --- |
| `admin` | `Admin@123` | Quản trị viên |
| `manager` | `Manager@123` | Quản lý |
| `staff` | `Staff@123` | Nhân viên |
| `viewer` | `Viewer@123` | Chỉ xem |

Nên đổi mật khẩu mặc định sau khi bắt đầu sử dụng thật.

---

## Dữ liệu & sao lưu

Ứng dụng lưu dữ liệu tại:

```text
%APPDATA%\Manager Device\
├── data\
│   └── manager-device.db     # Cơ sở dữ liệu SQLite
└── uploads\                  # Tệp đính kèm của thiết bị
```

- **Sao lưu:** Cài đặt → Dữ liệu & sao lưu → Sao lưu ngay. Tệp `.db` có thể cất giữ hoặc chuyển sang máy khác.
- **Phục hồi:** Chọn tệp `.db` đã sao lưu. Ứng dụng sẽ thay thế dữ liệu hiện tại và tự khởi động lại.
- **Tạo lại dữ liệu mẫu:** Đóng ứng dụng, xóa `%APPDATA%\Manager Device\data\manager-device.db`, sau đó mở lại. Ứng dụng sẽ tạo lại dữ liệu và tài khoản demo.

### Sao lưu tự động

Vào **Cài đặt → Dữ liệu & sao lưu → Sao lưu tự động**:

- **Bật sao lưu tự động:** ứng dụng tạo bản snapshot khi đóng app và mỗi 24 giờ một lần trong lúc app đang mở.
- **Thư mục sao lưu:** chọn thư mục bất kỳ, hoặc thư mục Google Drive for desktop (ví dụ `G:\My Drive\Manager Device`).
- **Số bản giữ lại:** từ 1 đến 100; các bản cũ nhất tự động bị xóa.
- **Kèm Google Drive:** tải thêm bản snapshot lên Google Drive trực tiếp nếu đã kết nối.

Ứng dụng không đồng bộ trực tiếp tệp SQLite đang chạy. Mỗi lần sao lưu đều dùng `VACUUM INTO` để tạo snapshot nhất quán, sau đó mới ghi vào thư mục hoặc tải lên Drive. Tên tệp có dạng `manager-device-backup-YYYYMMDD-HHmmss-SSS.db`.

### Google Drive trực tiếp (OAuth)

Tính năng này cho phép tải bản sao lưu lên Drive mà không cần cài Google Drive for desktop.

1. Mở [Google Cloud Console](https://console.cloud.google.com/) và tạo/chọn một project.
2. Bật **Google Drive API** trong **APIs & Services → Library**.
3. Cấu hình **OAuth consent screen** (Internal nếu dùng Google Workspace, hoặc External kèm test users).
4. Vào **Credentials → Create credentials → OAuth client ID → Desktop app**.
5. Dán **Client ID** và **Client Secret** vào Cài đặt → Google Drive trực tiếp, bấm **Kết nối Google Drive** và đăng nhập bằng trình duyệt.

Ứng dụng chỉ xin quyền `drive.file` — chỉ đọc/ghi các tệp do chính ứng dụng tạo. Bản sao lưu được lưu trong thư mục **Manager Device Backups** trên Drive. Refresh token và OAuth secret được lưu cục bộ trong `%APPDATA%\Manager Device\drive-auth.json`, mã hóa bằng Windows `safeStorage` khi khả dụng.

> Lưu ý: OAuth Client Secret của ứng dụng desktop không được coi là bí mật tuyệt đối. Hãy giới hạn OAuth consent screen ở Internal hoặc chỉ thêm người dùng tin cậy nếu dùng External.

### Khởi tạo dữ liệu chính (chỉ giữ tài khoản)

Dùng khi đã xem xong dữ liệu demo và muốn bắt đầu dữ liệu thật. Lệnh sẽ tự sao lưu database cũ vào thư mục `ManagerDevice-backups` trong thư mục người dùng, sau đó xóa toàn bộ danh mục, thiết bị, cấp phát, bảo trì, kiểm kê, tệp đính kèm, nhật ký và cấu hình demo. **Tài khoản người dùng được giữ nguyên.**

```bash
# Windows (đóng ứng dụng trước khi chạy)
npm run reset:data -- --yes

# Linux/WSL
node scripts/reset-production-data.mjs --yes
```

Có thể chỉ định database khác bằng `--db "đường dẫn/manager-device.db"`. Dùng `--no-backup` nếu không muốn tạo bản sao lưu tự động.

---

## Cấu trúc thư mục

```text
managerDevice/
├── build/                        # Tài nguyên đóng gói (icon…)
├── src/
│   ├── main/                     # Tiến trình chính Electron
│   │   ├── db/                   # Schema, migration, seed dữ liệu
│   │   ├── ipc/                  # Đăng ký IPC, kiểm tra quyền
│   │   ├── lib/                  # Đường dẫn, lỗi, schema Zod
│   │   ├── services/             # Nghiệp vụ: tài sản, cấp phát, báo cáo…
│   │   └── index.ts              # Khởi tạo cửa sổ, vòng đời ứng dụng
│   ├── preload/                  # Cầu nối contextBridge → window.api
│   ├── shared/                   # Kiểu dữ liệu, hằng số, tiện ích dùng chung
│   └── renderer/                 # Giao diện React
│       └── src/
│           ├── components/       # UI, layout, common
│           ├── pages/            # Dashboard, assets, assignments…
│           ├── store/            # Zustand: auth, theme, toast
│           ├── lib/              # API client, màu, điều hướng
│           └── assets/           # Tailwind CSS & style in ấn
├── test/                         # Smoke test backend
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig*.json
└── package.json
```

---

## Kiến trúc & bảo mật

- **Main process** sở hữu SQLite và toàn bộ nghiệp vụ. Renderer không bao giờ truy cập trực tiếp cơ sở dữ liệu.
- **Preload** chỉ mở các hàm IPC cần thiết qua `contextBridge`, renderer dùng `window.api` đã được định kiểu.
- Mọi IPC đều kiểm tra phiên đăng nhập và quyền tương ứng (`asset:write`, `settings:write`, `user:manage`…).
- Mật khẩu được băm bằng bcrypt; phiên đăng nhập lưu trong bộ nhớ tiến trình chính nên khởi động lại ứng dụng sẽ yêu cầu đăng nhập lại.
- Nội dung tệp Excel khi nhập được kiểm tra bằng Zod trước khi ghi vào cơ sở dữ liệu.
- Khấu hao tính theo phương pháp đường thẳng theo tháng, không thấp hơn giá trị thanh lý.

---

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy ứng dụng ở chế độ phát triển (hot reload) |
| `npm run start` | Chạy bản build production bằng electron-vite preview |
| `npm run typecheck` | Kiểm tra TypeScript cho cả main và renderer |
| `npm run typecheck:node` | Kiểm tra TypeScript phần main/preload/shared |
| `npm run typecheck:web` | Kiểm tra TypeScript phần renderer |
| `npm run build` | Typecheck + build production vào `out/` |
| `npm run build:win` | Build và tạo bộ cài Windows trong `release/` |
| `npm run build:linux` | Build AppImage cho Linux |
| `npm run seed:catalogs` | Bổ sung danh mục thiết bị mặc định (bỏ qua danh mục đã có) |
| `npm run template:excel` | Tạo file Excel mẫu nhập thiết bị từ dữ liệu danh mục hiện có |
| **Thiết bị → Quét máy này** | Quét cấu hình PC/Laptop hiện tại và tự điền biểu mẫu (không dùng file `.bat`) |
| `tools/ThuThapCauHinh.bat` | Công cụ CSV dự phòng: quét cấu hình PC/Laptop/Máy in và xuất CSV nhập vào phần mềm |
| `npm run reset:data` | Xóa dữ liệu nghiệp vụ, giữ lại tài khoản |

---

## Ghi chú khi phát triển

- `node:sqlite` trên Node.js 22 có thể in cảnh báo thử nghiệm; Electron 45 dùng Node.js 24 nên ổn định khi chạy thật.
- Biểu mẫu thông số kỹ thuật của thiết bị được sinh động từ `specSchema` của danh mục. Khi tạo danh mục, có thể chọn mẫu dựng sẵn (PC, Laptop, màn hình, máy in, thiết bị mạng…) để điền sẵn CPU, RAM, GPU, ổ cứng, hệ điều hành.
- Nếu danh mục PC/Laptop chưa khai báo trường thông số, biểu mẫu thiết bị tự dùng mẫu cấu hình mặc định tương ứng; giá trị vẫn được lưu vào trường `specs` của thiết bị.
- Nhãn QR in qua vùng `.print-area`; chọn khổ in A4 và bật "Background graphics" nếu cần.
- Kiểm kê hỗ trợ cả webcam (html5-qrcode) lẫn đầu đọc mã vạch/QR dạng bàn phím.
- Nhật ký hoạt động chỉ được ghi ở backend, không thể chỉnh sửa từ giao diện.

---

## Khắc phục sự cố

| Vấn đề | Cách xử lý |
| --- | --- |
| `npm install` lỗi mạng | Thử lại, dùng `--prefer-offline`, hoặc kiểm tra proxy/registry |
| Ứng dụng trắng màn hình khi dev | Xóa `out/`, chạy lại `npm run dev`; kiểm tra log terminal |
| Không mở được tệp đính kèm | Kiểm tra đường dẫn `uploads` trong Cài đặt → Thông tin ứng dụng |
| Quên mật khẩu admin | Đăng nhập bằng tài khoản admin khác, hoặc tạo lại dữ liệu mẫu như hướng dẫn ở trên |
| Muốn chuyển dữ liệu sang máy khác | Sao lưu `.db`, cài ứng dụng trên máy mới rồi dùng Phục hồi |

---

© 2026 Manager Device · Phiên bản 1.0.5
