/* ==========================================================================
 * Mẫu cấu hình thiết bị dùng chung cho danh mục và biểu mẫu tài sản
 * ========================================================================== */

import type { Category, SpecField } from './types'

export interface SpecPreset {
  id: string
  /** Tên hiển thị của mẫu trong giao diện */
  name: string
  /** Tên danh mục được điền khi áp dụng mẫu */
  categoryName: string
  description: string
  /** Mã danh mục gợi ý khi tạo nhanh */
  code: string
  /** Tiền tố mã thiết bị gợi ý khi tạo nhanh */
  prefix: string
  defaultDepreciationMonths: number
  defaultWarrantyMonths: number
  /** Mã danh mục được xem là khớp mẫu */
  codes: string[]
  /** Từ khóa trong tên danh mục (đã bỏ dấu, chữ thường) */
  keywords: string[]
  fields: SpecField[]
}

const OS_FIELDS: SpecField[] = [
  {
    key: 'os',
    label: 'Hệ điều hành',
    type: 'select',
    options: [
      'Windows 11 Pro',
      'Windows 11 Home',
      'Windows 10 Pro',
      'Windows 10 Home',
      'Ubuntu',
      'macOS',
      'Khác'
    ],
    required: true
  },
  {
    key: 'osLicense',
    label: 'Bản quyền Windows',
    type: 'select',
    options: ['Có bản quyền', 'Không', 'Không rõ']
  }
]

export const SPEC_PRESETS: SpecPreset[] = [
  {
    id: 'pc',
    name: 'Máy tính để bàn (PC)',
    categoryName: 'Máy tính để bàn',
    description: 'CPU, RAM, ổ cứng, GPU, hệ điều hành và màn hình.',
    code: 'PC',
    prefix: 'PC',
    defaultDepreciationMonths: 60,
    defaultWarrantyMonths: 36,
    codes: ['PC', 'DESKTOP', 'WORKSTATION'],
    keywords: ['may tinh de ban', 'desktop', 'workstation', 'may tram'],
    fields: [
      {
        key: 'cpu',
        label: 'CPU',
        type: 'text',
        placeholder: 'Intel Core i5-12400',
        required: true
      },
      { key: 'cpuCores', label: 'Số nhân CPU', type: 'number', unit: 'nhân' },
      { key: 'cpuThreads', label: 'Số luồng CPU', type: 'number', unit: 'luồng' },
      {
        key: 'ram',
        label: 'RAM',
        type: 'number',
        unit: 'GB',
        placeholder: '16',
        required: true
      },
      {
        key: 'ramType',
        label: 'Loại RAM',
        type: 'select',
        options: ['DDR3', 'DDR4', 'DDR5', 'LPDDR4', 'LPDDR5']
      },
      { key: 'ramBus', label: 'Bus RAM', type: 'number', unit: 'MHz' },
      {
        key: 'storage',
        label: 'Dung lượng ổ cứng',
        type: 'text',
        placeholder: 'SSD NVMe 512GB',
        required: true
      },
      {
        key: 'gpu',
        label: 'Card đồ họa (GPU)',
        type: 'text',
        placeholder: 'Intel UHD 730'
      },
      { key: 'gpuMemory', label: 'Bộ nhớ GPU', type: 'text', placeholder: '4GB hoặc Chia sẻ' },
      {
        key: 'monitor',
        label: 'Màn hình đi kèm',
        type: 'text',
        placeholder: 'Dell 24 inch'
      },
      ...OS_FIELDS
    ]
  },
  {
    id: 'laptop',
    name: 'Laptop',
    categoryName: 'Laptop',
    description: 'CPU, RAM, ổ cứng, GPU, màn hình và hệ điều hành.',
    code: 'LAPTOP',
    prefix: 'LAP',
    defaultDepreciationMonths: 48,
    defaultWarrantyMonths: 24,
    codes: ['LAPTOP', 'LAP', 'NOTEBOOK'],
    keywords: ['laptop', 'may tinh xach tay', 'notebook', 'macbook'],
    fields: [
      {
        key: 'cpu',
        label: 'CPU',
        type: 'text',
        placeholder: 'Intel Core i7-1355U',
        required: true
      },
      { key: 'cpuCores', label: 'Số nhân CPU', type: 'number', unit: 'nhân' },
      { key: 'cpuThreads', label: 'Số luồng CPU', type: 'number', unit: 'luồng' },
      {
        key: 'ram',
        label: 'RAM',
        type: 'number',
        unit: 'GB',
        placeholder: '16',
        required: true
      },
      {
        key: 'ramType',
        label: 'Loại RAM',
        type: 'select',
        options: ['DDR4', 'DDR5', 'LPDDR4X', 'LPDDR5', 'LPDDR5X']
      },
      { key: 'ramBus', label: 'Bus RAM', type: 'number', unit: 'MHz' },
      {
        key: 'storage',
        label: 'Dung lượng ổ cứng',
        type: 'text',
        placeholder: 'SSD NVMe 1TB',
        required: true
      },
      {
        key: 'gpu',
        label: 'Card đồ họa (GPU)',
        type: 'text',
        placeholder: 'Intel Iris Xe'
      },
      { key: 'gpuMemory', label: 'Bộ nhớ GPU', type: 'text', placeholder: '4GB hoặc Chia sẻ' },
      {
        key: 'screen',
        label: 'Kích thước màn hình',
        type: 'number',
        unit: 'inch',
        placeholder: '14'
      },
      {
        key: 'weight',
        label: 'Khối lượng',
        type: 'number',
        unit: 'kg',
        placeholder: '1.4'
      },
      ...OS_FIELDS
    ]
  },
  {
    id: 'monitor',
    name: 'Màn hình',
    categoryName: 'Màn hình',
    description: 'Kích thước, độ phân giải, tấm nền và cổng kết nối.',
    code: 'MONITOR',
    prefix: 'MON',
    defaultDepreciationMonths: 48,
    defaultWarrantyMonths: 36,
    codes: ['MONITOR', 'MON', 'SCREEN'],
    keywords: ['man hinh', 'monitor'],
    fields: [
      {
        key: 'size',
        label: 'Kích thước',
        type: 'number',
        unit: 'inch',
        placeholder: '24',
        required: true
      },
      {
        key: 'resolution',
        label: 'Độ phân giải',
        type: 'select',
        options: ['1366 x 768', '1920 x 1080', '2560 x 1440', '3840 x 2160']
      },
      {
        key: 'panel',
        label: 'Tấm nền',
        type: 'select',
        options: ['IPS', 'VA', 'TN', 'OLED']
      },
      {
        key: 'refreshRate',
        label: 'Tần số quét',
        type: 'number',
        unit: 'Hz',
        placeholder: '75'
      },
      {
        key: 'ports',
        label: 'Cổng kết nối',
        type: 'text',
        placeholder: 'HDMI, DisplayPort, USB-C'
      }
    ]
  },
  {
    id: 'printer',
    name: 'Máy in',
    categoryName: 'Máy in',
    description: 'Công nghệ in, tốc độ, khổ giấy và kết nối.',
    code: 'PRINTER',
    prefix: 'PRN',
    defaultDepreciationMonths: 60,
    defaultWarrantyMonths: 24,
    codes: ['PRINTER', 'PRN'],
    keywords: ['may in', 'printer'],
    fields: [
      {
        key: 'technology',
        label: 'Công nghệ in',
        type: 'select',
        options: ['Laser đen trắng', 'Laser màu', 'Phun màu', 'Đa chức năng']
      },
      {
        key: 'speed',
        label: 'Tốc độ in',
        type: 'number',
        unit: 'trang/phút',
        placeholder: '30'
      },
      {
        key: 'resolution',
        label: 'Độ phân giải',
        type: 'text',
        placeholder: '1200 x 1200 dpi'
      },
      {
        key: 'paper',
        label: 'Khổ giấy',
        type: 'select',
        options: ['A4', 'A3', 'A4/A3']
      },
      {
        key: 'connection',
        label: 'Kết nối',
        type: 'select',
        options: ['USB', 'LAN', 'Wi-Fi', 'USB + LAN', 'USB + LAN + Wi-Fi']
      },
      {
        key: 'color',
        label: 'In màu',
        type: 'select',
        options: ['Có', 'Không']
      }
    ]
  },
  {
    id: 'network',
    name: 'Thiết bị mạng',
    categoryName: 'Thiết bị mạng',
    description: 'Router, switch, access point, firewall.',
    code: 'NETWORK',
    prefix: 'NET',
    defaultDepreciationMonths: 60,
    defaultWarrantyMonths: 36,
    codes: ['NETWORK', 'NET'],
    keywords: ['thiet bi mang', 'router', 'switch', 'firewall', 'access point'],
    fields: [
      {
        key: 'deviceType',
        label: 'Loại thiết bị',
        type: 'select',
        options: ['Router', 'Switch', 'Access Point', 'Firewall', 'Modem']
      },
      {
        key: 'ports',
        label: 'Số cổng',
        type: 'number',
        unit: 'cổng',
        placeholder: '24'
      },
      {
        key: 'speed',
        label: 'Tốc độ',
        type: 'text',
        placeholder: '1 Gbps'
      },
      {
        key: 'management',
        label: 'Quản lý',
        type: 'select',
        options: ['Web UI', 'CLI', 'Cloud', 'Không']
      }
    ]
  },
  {
    id: 'projector',
    name: 'Máy chiếu',
    categoryName: 'Máy chiếu',
    description: 'Công nghệ, độ sáng, độ phân giải và kết nối.',
    code: 'PROJECTOR',
    prefix: 'PJ',
    defaultDepreciationMonths: 60,
    defaultWarrantyMonths: 24,
    codes: ['PROJECTOR', 'PJ'],
    keywords: ['may chieu', 'projector'],
    fields: [
      {
        key: 'technology',
        label: 'Công nghệ',
        type: 'select',
        options: ['LCD', 'DLP', 'LED']
      },
      {
        key: 'brightness',
        label: 'Độ sáng',
        type: 'number',
        unit: 'ANSI lumens',
        placeholder: '3500'
      },
      {
        key: 'resolution',
        label: 'Độ phân giải',
        type: 'select',
        options: ['XGA', 'HD', 'Full HD', '4K']
      },
      {
        key: 'connection',
        label: 'Kết nối',
        type: 'text',
        placeholder: 'HDMI, VGA, USB'
      }
    ]
  },
  {
    id: 'ups',
    name: 'Bộ lưu điện (UPS)',
    categoryName: 'Bộ lưu điện',
    description: 'Công suất, thời gian lưu điện và số ổ cắm.',
    code: 'UPS',
    prefix: 'UPS',
    defaultDepreciationMonths: 48,
    defaultWarrantyMonths: 24,
    codes: ['UPS'],
    keywords: ['bo luu dien', 'ups'],
    fields: [
      {
        key: 'capacity',
        label: 'Công suất',
        type: 'text',
        placeholder: '1500VA / 900W'
      },
      {
        key: 'backupTime',
        label: 'Thời gian lưu điện',
        type: 'number',
        unit: 'phút',
        placeholder: '15'
      },
      {
        key: 'outlets',
        label: 'Số ổ cắm',
        type: 'number',
        unit: 'ổ',
        placeholder: '8'
      }
    ]
  }
]

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
}

/** Tìm mẫu cấu hình phù hợp với mã hoặc tên danh mục. */
export function findSpecPreset(
  category: Pick<Category, 'code' | 'name'> | null | undefined
): SpecPreset | null {
  if (!category) return null
  const code = normalize(category.code)
  const name = normalize(category.name)

  for (const preset of SPEC_PRESETS) {
    if (preset.codes.some((item) => normalize(item) === code)) return preset
  }
  for (const preset of SPEC_PRESETS) {
    if (preset.keywords.some((keyword) => name.includes(keyword))) return preset
  }
  return null
}

/**
 * Trả về các trường thông số đang áp dụng cho danh mục.
 * Nếu danh mục chưa khai báo trường nào, dùng mẫu cấu hình mặc định
 * (ví dụ PC/Laptop luôn có CPU, RAM, GPU, ổ cứng, hệ điều hành).
 */
export function getEffectiveSpecFields(
  category: Pick<Category, 'code' | 'name' | 'specSchema'> | null | undefined
): SpecField[] {
  if (!category) return []
  if (category.specSchema.length > 0) return category.specSchema
  return findSpecPreset(category)?.fields ?? []
}

/** Danh mục máy tính (PC/Laptop) để hiển thị nhãn "Cấu hình thiết bị". */
export function getComputerPreset(
  category: Pick<Category, 'code' | 'name'> | null | undefined
): SpecPreset | null {
  const preset = findSpecPreset(category)
  return preset && (preset.id === 'pc' || preset.id === 'laptop') ? preset : null
}

/** Ghép đơn vị vào giá trị để hiển thị, tránh lặp đơn vị đã có sẵn. */
export function formatSpecValue(value: string | number, field?: SpecField): string {
  const text = String(value).trim()
  const unit = field?.unit?.trim()
  if (!unit) return text
  if (!text) return text
  if (text.toLowerCase().includes(unit.toLowerCase())) return text
  return `${text} ${unit}`
}
