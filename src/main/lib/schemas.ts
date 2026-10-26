import { z } from 'zod'

const optionalText = (max = 2000) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional()
  )

const dateString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (định dạng YYYY-MM-DD).')
    .nullable()
    .optional()
)

const optionalId = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : v),
  z.coerce.number().int().positive().nullable().optional()
)

const money = z.coerce.number().min(0, 'Giá trị không được âm.').optional()
const nonNegativeInt = z.coerce.number().int().min(0).optional()

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập.').max(50),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.').max(200)
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
  newPassword: z
    .string()
    .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự.')
    .max(100, 'Mật khẩu quá dài.')
})

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên.').max(100),
  email: optionalText(150),
  phone: optionalText(30)
})

const specFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Mã trường chỉ gồm chữ, số và dấu gạch dưới.'),
  label: z.string().trim().min(1, 'Vui lòng nhập nhãn trường.').max(100),
  type: z.enum(['text', 'number', 'select', 'date']),
  unit: optionalText(30),
  options: z.array(z.string().trim().min(1)).optional(),
  placeholder: optionalText(100),
  required: z.boolean().optional()
})

export const categorySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1, 'Vui lòng nhập mã danh mục.').max(30),
  name: z.string().trim().min(2, 'Vui lòng nhập tên danh mục.').max(120),
  prefix: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tiền tố mã thiết bị.')
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, 'Tiền tố chỉ gồm chữ và số.'),
  description: optionalText(),
  specSchema: z.array(specFieldSchema).max(50).optional(),
  defaultDepreciationMonths: nonNegativeInt,
  defaultWarrantyMonths: nonNegativeInt,
  isActive: z.boolean().optional()
})

const blockSchema = z.enum(['party', 'state'])

export const departmentSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1, 'Vui lòng nhập mã phòng ban.').max(30),
  name: z.string().trim().min(2, 'Vui lòng nhập tên phòng ban.').max(120),
  block: blockSchema.default('state'),
  managerName: optionalText(100),
  phone: optionalText(30),
  description: optionalText(),
  isActive: z.boolean().optional()
})

export const locationSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1, 'Vui lòng nhập mã vị trí.').max(30),
  name: z.string().trim().min(2, 'Vui lòng nhập tên vị trí.').max(150),
  address: optionalText(300),
  building: optionalText(100),
  floor: optionalText(30),
  room: optionalText(30),
  note: optionalText(),
  isActive: z.boolean().optional()
})

export const supplierSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1, 'Vui lòng nhập mã nhà cung cấp.').max(30),
  name: z.string().trim().min(2, 'Vui lòng nhập tên nhà cung cấp.').max(200),
  contactName: optionalText(100),
  phone: optionalText(30),
  email: optionalText(150),
  address: optionalText(300),
  taxCode: optionalText(30),
  website: optionalText(200),
  note: optionalText(),
  isActive: z.boolean().optional()
})

export const employeeSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1, 'Vui lòng nhập mã nhân viên.').max(30),
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên nhân viên.').max(100),
  email: optionalText(150),
  phone: optionalText(30),
  position: optionalText(100),
  departmentId: optionalId,
  isActive: z.boolean().optional(),
  note: optionalText()
})

export const assetSchema = z.object({
  code: z.string().trim().max(50).optional(),
  name: z.string().trim().min(2, 'Vui lòng nhập tên thiết bị.').max(200),
  categoryId: z.coerce.number().int().positive('Vui lòng chọn danh mục.'),
  serialNumber: optionalText(100),
  model: optionalText(120),
  manufacturer: optionalText(120),
  status: z
    .enum(['available', 'in_use', 'maintenance', 'reserved', 'disposed', 'lost'])
    .optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor', 'broken']).optional(),
  departmentId: optionalId,
  locationId: optionalId,
  assignedEmployeeId: optionalId,
  supplierId: optionalId,
  purchaseDate: dateString,
  purchasePrice: money,
  invoiceNumber: optionalText(60),
  warrantyStart: dateString,
  warrantyMonths: nonNegativeInt,
  depreciationMonths: nonNegativeInt,
  salvageValue: money,
  specs: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  note: optionalText(),
  imagePath: optionalText(500)
})

export const assetListSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().max(200).optional(),
  categoryId: optionalId,
  departmentId: optionalId,
  block: blockSchema.nullable().optional(),
  locationId: optionalId,
  status: z.string().optional(),
  condition: z.string().optional(),
  supplierId: optionalId,
  assignedEmployeeId: optionalId,
  warrantyExpiringDays: optionalId,
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  ids: z.array(z.coerce.number().int().positive()).optional()
})

export const assignmentSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
  departmentId: optionalId,
  assignedDate: dateString.refine((v) => !!v, 'Vui lòng chọn ngày cấp phát.'),
  expectedReturnDate: dateString,
  conditionBefore: z.enum(['new', 'good', 'fair', 'poor', 'broken']).nullable().optional(),
  note: optionalText()
})

export const returnSchema = z.object({
  assignmentId: z.coerce.number().int().positive(),
  returnedDate: dateString.refine((v) => !!v, 'Vui lòng chọn ngày thu hồi.'),
  conditionAfter: z.enum(['new', 'good', 'fair', 'poor', 'broken']).nullable().optional(),
  locationId: optionalId,
  note: optionalText()
})

export const maintenanceSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  type: z.enum(['preventive', 'corrective', 'inspection', 'upgrade']),
  title: z.string().trim().min(2, 'Vui lòng nhập nội dung bảo trì.').max(200),
  description: optionalText(),
  provider: optionalText(150),
  assignee: optionalText(100),
  scheduledDate: dateString,
  cost: money,
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  note: optionalText()
})

export const maintenanceUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  assetId: z.coerce.number().int().positive().optional(),
  type: z.enum(['preventive', 'corrective', 'inspection', 'upgrade']).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  description: optionalText(),
  provider: optionalText(150),
  assignee: optionalText(100),
  scheduledDate: dateString,
  cost: money,
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  result: optionalText(),
  completedDate: dateString,
  note: optionalText()
})

export const maintenanceCompleteSchema = z.object({
  result: z.string().trim().min(2, 'Vui lòng nhập kết quả bảo trì.').max(1000),
  cost: money,
  completedDate: dateString
})

export const auditCreateSchema = z.object({
  name: z.string().trim().min(2, 'Vui lòng nhập tên phiên kiểm kê.').max(200),
  departmentId: optionalId,
  locationId: optionalId,
  startDate: dateString.refine((v) => !!v, 'Vui lòng chọn ngày bắt đầu.'),
  endDate: dateString,
  note: optionalText()
})

export const auditScanSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  code: z.string().trim().min(1, 'Vui lòng nhập hoặc quét mã thiết bị.').max(100),
  actualLocationId: optionalId,
  actualEmployeeId: optionalId,
  result: z
    .enum(['pending', 'matched', 'missing', 'wrong_location', 'wrong_owner', 'damaged'])
    .optional(),
  note: optionalText()
})

export const auditItemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  result: z.enum(['pending', 'matched', 'missing', 'wrong_location', 'wrong_owner', 'damaged']),
  actualLocationId: optionalId,
  actualEmployeeId: optionalId,
  note: optionalText()
})

export const auditCompleteSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  applyActualLocation: z.boolean().optional(),
  markMissingAsLost: z.boolean().optional()
})

export const reportSchema = z.object({
  categoryId: optionalId,
  departmentId: optionalId,
  block: blockSchema.nullable().optional(),
  locationId: optionalId,
  status: z.string().optional(),
  fromDate: dateString,
  toDate: dateString
})

export const settingsSchema = z.object({
  companyName: z.string().trim().max(200).optional(),
  companyAddress: z.string().trim().max(300).optional(),
  companyPhone: z.string().trim().max(30).optional(),
  companyEmail: z.string().trim().max(150).optional(),
  companyTaxCode: z.string().trim().max(30).optional(),
  companyWebsite: z.string().trim().max(200).optional(),
  currency: z.string().trim().max(10).optional(),
  dateFormat: z.string().trim().max(20).optional(),
  warrantyWarningDays: z.coerce.number().int().min(0).max(3650).optional(),
  maintenanceWarningDays: z.coerce.number().int().min(0).max(3650).optional(),
  defaultDepreciationMonths: z.coerce.number().int().min(0).max(1200).optional(),
  loginNotice: z.string().trim().max(300).optional()
})

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự.')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang.'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.').max(100),
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên.').max(100),
  email: optionalText(150),
  phone: optionalText(30),
  role: z.enum(['admin', 'manager', 'staff', 'viewer']),
  isActive: z.boolean().optional()
})

export const userUpdateSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().max(100).optional(),
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên.').max(100),
  email: optionalText(150),
  phone: optionalText(30),
  role: z.enum(['admin', 'manager', 'staff', 'viewer']),
  isActive: z.boolean().optional()
})

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.').max(100)
})

export const logListSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().max(200).optional(),
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(50).optional(),
  userId: optionalId,
  fromDate: dateString,
  toDate: dateString
})

export const idSchema = z.coerce.number().int().positive()
export const idsSchema = z.array(z.coerce.number().int().positive()).min(1)
