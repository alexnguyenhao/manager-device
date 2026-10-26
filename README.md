# Manager Device

[![Release](https://img.shields.io/github/v/release/alexnguyenhao/manager-device?label=release)](https://github.com/alexnguyenhao/manager-device/releases/latest)
[![Build](https://github.com/alexnguyenhao/manager-device/actions/workflows/build-release.yml/badge.svg)](https://github.com/alexnguyenhao/manager-device/actions/workflows/build-release.yml)

Phần mềm quản lý thiết bị và tài sản CNTT chạy **hoàn toàn cục bộ** trên máy tính Windows/Linux. Ứng dụng giúp theo dõi toàn bộ vòng đời tài sản: tiếp nhận, cấu hình, cấp phát, bảo trì, kiểm kê, khấu hao và thanh lý — tất cả trong một giao diện tiếng Việt duy nhất.

Dữ liệu được lưu trong SQLite tại thư mục người dùng, không gửi lên máy chủ và không cần kết nối Internet.

---

## Tính năng chính

- **Bảng điều khiển** — KPI tài sản, giá trị còn lại, cảnh báo bảo hành/bảo trì, biểu đồ phân bố và hoạt động gần đây.
- **Quản lý thiết bị** — Danh sách, tìm kiếm không phân biệt dấu (kể cả cấu hình CPU/RAM/ổ cứng), lọc nâng cao, sắp xếp, thêm/sửa/xóa, nhập và xuất Excel.
- **Hồ sơ thiết bị** — Cấu hình chi tiết theo danh mục (CPU, RAM, GPU, dung lượng ổ cứng, hệ điều hành/Windows…), khấu hao, bảo hành, tệp đính kèm, lịch sử cấp phát/bảo trì/nhật ký.
- **Cấp phát & thu hồi** — Bàn giao thiết bị cho nhân viên, theo dõi hạn trả, tình trạng trước/sau khi thu hồi.
- **Bảo trì & sửa chữa** — Lập lịch, theo dõi tiến độ, chi phí, nhà cung cấp và lịch sử bảo dưỡng.
- **Kiểm kê** — Tạo phiên kiểm kê, quét QR bằng webcam hoặc đầu đọc mã vạch, đối chiếu vị trí/người sử dụng, xuất kết quả.
- **Danh mục** — Danh mục thiết bị với bộ thông số riêng, mẫu cấu hình dựng sẵn cho PC/Laptop/máy in/thiết bị mạng…, bộ phận, vị trí, nhà cung cấp, nhân viên.
- **Báo cáo** — Tổng hợp theo danh mục/bộ phận/trạng thái, giá trị và khấu hao, xuất Excel.
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

Tải `ManagerDevice-Setup-1.0.0.exe`, chạy và làm theo hướng dẫn cài đặt. Ứng dụng chạy hoàn toàn cục bộ, dữ liệu lưu trên máy người dùng.

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

Bộ cài sau khi build nằm trong thư mục `release/` với tên dạng `ManagerDevice-Setup-1.0.0.exe`.

> Nếu mạng npm không ổn định, có thể chạy `npm install --prefer-offline` hoặc cấu hình registry nội bộ. Không cần tải binary Electron riêng — npm sẽ tự tải khi cài đặt bình thường.

---

## Tài khoản dùng thử

Lần chạy đầu tiên, ứng dụng tự tạo dữ liệu mẫu và 4 tài khoản:

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

© 2026 Manager Device · Phiên bản 1.0.0
