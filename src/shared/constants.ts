import type {
  AssetCondition,
  AssetStatus,
  AssignmentStatus,
  AuditResult,
  AuditStatus,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
  OrgBlock,
  Role
} from './types'

/* ------------------------------- Tổ chức ------------------------------- */

export interface OrgBlockMeta {
  label: string
  shortLabel: string
  tone: Tone
  description: string
}

export const ORG_BLOCK_META: Record<OrgBlock, OrgBlockMeta> = {
  party: {
    label: 'Khối Đảng',
    shortLabel: 'Đảng',
    tone: 'danger',
    description: 'Các cơ quan, đơn vị thuộc Khối Đảng'
  },
  state: {
    label: 'Khối Nhà nước',
    shortLabel: 'Nhà nước',
    tone: 'info',
    description: 'Các phòng ban, đơn vị thuộc Khối Nhà nước'
  }
}

export const ORG_BLOCK_OPTIONS: OrgBlock[] = ['party', 'state']

/* ------------------------------- Roles --------------------------------- */

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  staff: 'Nhân viên',
  viewer: 'Chỉ xem'
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Toàn quyền hệ thống, người dùng và dữ liệu',
  manager: 'Quản lý thiết bị, danh mục, cấp phát, bảo trì và báo cáo',
  staff: 'Thêm/sửa thiết bị, cấp phát, bảo trì và kiểm kê',
  viewer: 'Chỉ xem dữ liệu và báo cáo'
}

export type Permission =
  | 'asset:write'
  | 'asset:delete'
  | 'catalog:write'
  | 'assignment:write'
  | 'maintenance:write'
  | 'audit:write'
  | 'report:read'
  | 'log:read'
  | 'settings:write'
  | 'user:manage'
  | 'backup'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'asset:write',
    'asset:delete',
    'catalog:write',
    'assignment:write',
    'maintenance:write',
    'audit:write',
    'report:read',
    'log:read',
    'settings:write',
    'user:manage',
    'backup'
  ],
  manager: [
    'asset:write',
    'asset:delete',
    'catalog:write',
    'assignment:write',
    'maintenance:write',
    'audit:write',
    'report:read',
    'log:read',
    'backup'
  ],
  staff: ['asset:write', 'assignment:write', 'maintenance:write', 'audit:write', 'report:read'],
  viewer: ['report:read']
}

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}

/* ----------------------------- Asset status ---------------------------- */

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'purple' | 'teal'

export interface StatusMeta {
  label: string
  tone: Tone
  description: string
}

export const ASSET_STATUS_META: Record<AssetStatus, StatusMeta> = {
  available: { label: 'Sẵn sàng', tone: 'success', description: 'Thiết bị trong kho, có thể cấp phát' },
  in_use: { label: 'Đang sử dụng', tone: 'info', description: 'Đã cấp phát cho nhân viên' },
  maintenance: { label: 'Bảo trì', tone: 'warning', description: 'Đang sửa chữa hoặc bảo dưỡng' },
  reserved: { label: 'Đã đặt trước', tone: 'purple', description: 'Giữ cho kế hoạch sử dụng' },
  disposed: { label: 'Đã thanh lý', tone: 'neutral', description: 'Đã thanh lý, không còn sử dụng' },
  lost: { label: 'Thất lạc', tone: 'danger', description: 'Mất hoặc không xác định được vị trí' }
}

export const ASSET_CONDITION_META: Record<AssetCondition, StatusMeta> = {
  new: { label: 'Mới', tone: 'success', description: 'Thiết bị mới, chưa qua sử dụng' },
  good: { label: 'Tốt', tone: 'info', description: 'Hoạt động tốt' },
  fair: { label: 'Khá', tone: 'teal', description: 'Còn sử dụng được, có hao mòn' },
  poor: { label: 'Kém', tone: 'warning', description: 'Xuống cấp, cần sửa chữa' },
  broken: { label: 'Hỏng', tone: 'danger', description: 'Không hoạt động' }
}

/* --------------------------- Maintenance ------------------------------- */

export const MAINTENANCE_TYPE_META: Record<MaintenanceType, StatusMeta> = {
  preventive: { label: 'Bảo dưỡng định kỳ', tone: 'info', description: 'Bảo trì theo kế hoạch' },
  corrective: { label: 'Sửa chữa', tone: 'warning', description: 'Khắc phục sự cố' },
  inspection: { label: 'Kiểm tra', tone: 'teal', description: 'Kiểm tra tình trạng thiết bị' },
  upgrade: { label: 'Nâng cấp', tone: 'purple', description: 'Nâng cấp phần cứng/phần mềm' }
}

export const MAINTENANCE_STATUS_META: Record<MaintenanceStatus, StatusMeta> = {
  scheduled: { label: 'Đã lên lịch', tone: 'info', description: 'Chờ thực hiện' },
  in_progress: { label: 'Đang thực hiện', tone: 'warning', description: 'Đang sửa chữa/bảo dưỡng' },
  completed: { label: 'Hoàn thành', tone: 'success', description: 'Đã hoàn tất' },
  cancelled: { label: 'Đã hủy', tone: 'neutral', description: 'Không thực hiện' }
}

export const MAINTENANCE_PRIORITY_META: Record<MaintenancePriority, StatusMeta> = {
  low: { label: 'Thấp', tone: 'neutral', description: 'Không gấp' },
  normal: { label: 'Bình thường', tone: 'info', description: 'Ưu tiên thường' },
  high: { label: 'Cao', tone: 'warning', description: 'Cần xử lý sớm' },
  urgent: { label: 'Khẩn cấp', tone: 'danger', description: 'Xử lý ngay' }
}

/* ----------------------------- Assignment ------------------------------ */

export const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, StatusMeta> = {
  active: { label: 'Đang cấp phát', tone: 'info', description: 'Thiết bị đang được sử dụng' },
  returned: { label: 'Đã thu hồi', tone: 'neutral', description: 'Đã trả lại kho' }
}

/* -------------------------------- Audit -------------------------------- */

export const AUDIT_STATUS_META: Record<AuditStatus, StatusMeta> = {
  in_progress: { label: 'Đang kiểm kê', tone: 'warning', description: 'Đang thực hiện kiểm kê' },
  completed: { label: 'Hoàn thành', tone: 'success', description: 'Đã chốt kết quả' },
  cancelled: { label: 'Đã hủy', tone: 'neutral', description: 'Phiên kiểm kê bị hủy' }
}

export const AUDIT_RESULT_META: Record<AuditResult, StatusMeta> = {
  pending: { label: 'Chưa kiểm', tone: 'neutral', description: 'Chưa quét thiết bị' },
  matched: { label: 'Đúng vị trí', tone: 'success', description: 'Thiết bị đúng vị trí và người sử dụng' },
  missing: { label: 'Không tìm thấy', tone: 'danger', description: 'Không có thiết bị khi kiểm kê' },
  wrong_location: { label: 'Sai vị trí', tone: 'warning', description: 'Thiết bị không đúng vị trí' },
  wrong_owner: { label: 'Sai người dùng', tone: 'purple', description: 'Người sử dụng không đúng' },
  damaged: { label: 'Hỏng', tone: 'danger', description: 'Thiết bị hư hỏng' }
}

export const AUDIT_RESULT_OPTIONS: AuditResult[] = [
  'pending',
  'matched',
  'wrong_location',
  'wrong_owner',
  'damaged',
  'missing'
]

/* ------------------------------ Defaults ------------------------------- */

export const DEFAULT_PAGE_SIZE = 15
export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100]
export const DEFAULT_SPEC_FIELDS = [
  { key: 'cpu', label: 'CPU', type: 'text' as const },
  { key: 'ram', label: 'RAM', type: 'text' as const, unit: 'GB' },
  { key: 'storage', label: 'Lưu trữ', type: 'text' as const },
  { key: 'os', label: 'Hệ điều hành', type: 'text' as const }
]

export const ENTITY_LABELS: Record<string, string> = {
  asset: 'Thiết bị',
  assignment: 'Cấp phát',
  maintenance: 'Bảo trì',
  audit: 'Kiểm kê',
  category: 'Danh mục',
  department: 'Phòng ban, đơn vị',
  location: 'Vị trí',
  supplier: 'Nhà cung cấp',
  employee: 'Nhân viên',
  user: 'Người dùng',
  settings: 'Cài đặt',
  report: 'Báo cáo',
  system: 'Hệ thống'
}

export const SORT_SPECS = ['code', 'name', 'purchaseDate', 'purchasePrice', 'createdAt', 'status']
