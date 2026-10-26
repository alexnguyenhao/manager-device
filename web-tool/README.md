# Web tool thu thập cấu hình

Trang tĩnh (HTML/CSS/JS thuần, không build) giúp máy khác **không cần cài Manager Device** vẫn lấy được cấu hình và gom thành CSV để nhập vào phần mềm.

## Cách hoạt động

1. Người dùng mở trang, bấm **Sao chép lệnh**.
2. Dán lệnh vào PowerShell (Win + X → Terminal → Ctrl + V → Enter). Lệnh tải `scan.txt` từ chính trang này về bộ nhớ rồi chạy — **không tạo tệp `.bat`/`.ps1`** nên không bị Smart App Control chặn.
3. Script quét cấu hình, in ra mã `MD1:...`, copy vào clipboard và mở sẵn trang kèm kết quả.
4. Trang hiển thị bảng cấu hình, cho phép sửa tên/danh mục rồi thêm vào danh sách. Gom đủ máy thì **Xuất CSV**.

Dữ liệu chỉ nằm trong `localStorage` của trình duyệt. Không có máy chủ, không có analytics, không gửi dữ liệu đi đâu.

## Gom nhiều máy rồi xuất CSV một lần

Danh sách **không tự đồng bộ** giữa các máy: mỗi trình duyệt có `localStorage` riêng. Cách gom không cần máy chủ:

1. Trên từng máy: quét → **Thêm vào danh sách** → bấm **Sao chép mã** (copy toàn bộ mã `MD1:…` của máy đó).
2. Gửi các mã về máy tổng hợp (Zalo, email, USB…). Có thể gửi cả đoạn chat, không cần tách dòng.
3. Trên máy tổng hợp: dán tất cả vào ô **Dán kết quả** → **Phân tích** → **Thêm tất cả N máy**.
4. Bấm **Xuất CSV** — tệp chứa đủ các máy, nhập một lần vào Manager Device.

Mỗi dòng đã lưu vẫn giữ mã gốc, nên **Sao chép mã** ở máy tổng hợp cũng copy lại được toàn bộ. Nếu không muốn gửi mã qua chat, dùng **Sao lưu** để xuất tệp JSON rồi **Nạp** tệp đó ở máy tổng hợp.

## Giới hạn cần biết

Trình duyệt bị sandbox nên **không đọc được phần cứng**. Web page không thể tự lấy model CPU, loại RAM, ổ cứng, serial… Vì vậy bước chạy PowerShell là bắt buộc. Lệnh chỉ đọc thông tin qua CIM/WMI, không thay đổi gì trên máy và không cần Administrator.

## Tệp

| Tệp | Mô tả |
| --- | --- |
| `index.html` | Giao diện 3 bước, bảng kết quả, danh sách đã gom |
| `style.css` | Giao diện, responsive, không phụ thuộc mạng |
| `app.js` | Giải mã `MD1:`, ánh xạ thông số, lưu localStorage, xuất CSV/JSON |
| `scan.txt` | Script PowerShell 5.1 (ASCII) chạy trong bộ nhớ |

`scan.txt` phải giữ **ASCII thuần** vì Windows PowerShell 5.1 đọc nội dung theo bảng mã OEM. Kết quả được mã hóa base64url UTF-8 trước khi in ra nên tiếng Việt trong dữ liệu vẫn đúng.

## Định dạng CSV

Tên cột thông số dùng đúng **khóa** của danh mục (`cpu`, `ram (GB)`, `storage`, `monitor`, `screen (inch)`, `os`, `osLicense`…). Phần nhập của ứng dụng khớp cột theo khóa nên không phụ thuộc nhãn hiển thị. Không đổi tên cột nếu muốn nhập trực tiếp.

Các cột dùng chung: `Tên thiết bị (*)`, `Danh mục (*)`, `Serial`, `Model`, `Hãng sản xuất`, `Phòng ban`, `Người sử dụng`, `Ghi chú`.

- `Danh mục (*)` phải là `Máy tính để bàn` hoặc `Laptop` và danh mục đó phải đang hoạt động trong ứng dụng.
- `Phòng ban` / `Người sử dụng` để trống sẽ an toàn nhất; nếu điền phải khớp đúng mã hoặc tên đã có.
- `Trạng thái` không được xuất để tránh yêu cầu bắt buộc phải có người sử dụng.
- Loại RAM chỉ xuất khi nằm trong danh sách chọn của danh mục (PC: DDR3/DDR4/DDR5; Laptop: DDR4/DDR5/LPDDR4X/LPDDR5/LPDDR5X).

## Triển khai

Workflow `.github/workflows/pages.yml` tự deploy thư mục này lên GitHub Pages mỗi khi push thay đổi vào `web-tool/`.

Lần đầu cần bật Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Địa chỉ: <https://alexnguyenhao.github.io/manager-device/>

Chạy thử cục bộ (bắt buộc qua HTTP để lệnh tải được `scan.txt`):

```bash
cd web-tool
python3 -m http.server 5198
# mở http://127.0.0.1:5198/
```
