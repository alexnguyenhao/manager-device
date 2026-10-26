/* ==========================================================================
 * Shared domain types — dùng chung cho main process, preload và renderer
 * ========================================================================== */

export type Role = 'admin' | 'manager' | 'staff' | 'viewer'

export type AssetStatus = 'available' | 'in_use' | 'maintenance' | 'reserved' | 'disposed' | 'lost'
export type AssetCondition = 'new' | 'good' | 'fair' | 'poor' | 'broken'

export type AssignmentStatus = 'active' | 'returned'

export type MaintenanceType = 'preventive' | 'corrective' | 'inspection' | 'upgrade'
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type MaintenancePriority = 'low' | 'normal' | 'high' | 'urgent'

export type AuditStatus = 'in_progress' | 'completed' | 'cancelled'
export type AuditResult =
  | 'pending'
  | 'matched'
  | 'missing'
  | 'wrong_location'
  | 'wrong_owner'
  | 'damaged'

export type CatalogKind = 'categories' | 'departments' | 'locations' | 'suppliers' | 'employees'

/* ------------------------------- Auth ---------------------------------- */

export interface AuthUser {
  id: number
  username: string
  fullName: string
  email: string | null
  phone: string | null
  role: Role
  avatarColor: string
}

export interface UserAccount extends AuthUser {
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UserInput {
  username: string
  password?: string
  fullName: string
  email?: string | null
  phone?: string | null
  role: Role
  isActive?: boolean
}

/* ------------------------------ Catalog -------------------------------- */

export interface Category {
  id: number
  code: string
  name: string
  prefix: string
  description: string | null
  specSchema: SpecField[]
  defaultDepreciationMonths: number
  defaultWarrantyMonths: number
  isActive: boolean
  assetCount?: number
  createdAt: string
  updatedAt: string
}

export interface CategoryInput {
  code: string
  name: string
  prefix: string
  description?: string | null
  specSchema?: SpecField[]
  defaultDepreciationMonths?: number
  defaultWarrantyMonths?: number
  isActive?: boolean
}

export type SpecFieldType = 'text' | 'number' | 'select' | 'date'

export interface SpecField {
  key: string
  label: string
  type: SpecFieldType
  unit?: string | null
  options?: string[]
  placeholder?: string | null
  required?: boolean
}

export interface Department {
  id: number
  code: string
  name: string
  managerName: string | null
  phone: string | null
  description: string | null
  isActive: boolean
  assetCount?: number
  employeeCount?: number
  createdAt: string
  updatedAt: string
}

export interface DepartmentInput {
  code: string
  name: string
  managerName?: string | null
  phone?: string | null
  description?: string | null
  isActive?: boolean
}

export interface Location {
  id: number
  code: string
  name: string
  address: string | null
  building: string | null
  floor: string | null
  room: string | null
  note: string | null
  isActive: boolean
  assetCount?: number
  createdAt: string
  updatedAt: string
}

export interface LocationInput {
  code: string
  name: string
  address?: string | null
  building?: string | null
  floor?: string | null
  room?: string | null
  note?: string | null
  isActive?: boolean
}

export interface Supplier {
  id: number
  code: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxCode: string | null
  website: string | null
  note: string | null
  isActive: boolean
  assetCount?: number
  createdAt: string
  updatedAt: string
}

export interface SupplierInput {
  code: string
  name: string
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  taxCode?: string | null
  website?: string | null
  note?: string | null
  isActive?: boolean
}

export interface Employee {
  id: number
  code: string
  fullName: string
  email: string | null
  phone: string | null
  position: string | null
  departmentId: number | null
  departmentName: string | null
  isActive: boolean
  note: string | null
  assetCount?: number
  createdAt: string
  updatedAt: string
}

export interface EmployeeInput {
  code: string
  fullName: string
  email?: string | null
  phone?: string | null
  position?: string | null
  departmentId?: number | null
  isActive?: boolean
  note?: string | null
}

/* ------------------------------- Assets -------------------------------- */

export interface Asset {
  id: number
  code: string
  name: string
  categoryId: number
  categoryName: string
  categoryPrefix: string
  serialNumber: string | null
  model: string | null
  manufacturer: string | null
  status: AssetStatus
  condition: AssetCondition
  departmentId: number | null
  departmentName: string | null
  locationId: number | null
  locationName: string | null
  assignedEmployeeId: number | null
  assignedEmployeeName: string | null
  supplierId: number | null
  supplierName: string | null
  purchaseDate: string | null
  purchasePrice: number
  invoiceNumber: string | null
  warrantyStart: string | null
  warrantyMonths: number
  warrantyExpiry: string | null
  depreciationMonths: number
  salvageValue: number
  specs: Record<string, string | number>
  note: string | null
  imagePath: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
  /* Giá trị tính toán */
  currentValue: number
  accumulatedDepreciation: number
  monthlyDepreciation: number
  ageMonths: number
  warrantyDaysLeft: number | null
}

export interface AssetInput {
  code?: string
  name: string
  categoryId: number
  serialNumber?: string | null
  model?: string | null
  manufacturer?: string | null
  status?: AssetStatus
  condition?: AssetCondition
  departmentId?: number | null
  locationId?: number | null
  assignedEmployeeId?: number | null
  supplierId?: number | null
  purchaseDate?: string | null
  purchasePrice?: number
  invoiceNumber?: string | null
  warrantyStart?: string | null
  warrantyMonths?: number
  depreciationMonths?: number
  salvageValue?: number
  specs?: Record<string, string | number>
  note?: string | null
  imagePath?: string | null
}

export interface AssetListParams {
  page?: number
  pageSize?: number
  search?: string
  categoryId?: number | null
  departmentId?: number | null
  locationId?: number | null
  status?: AssetStatus | 'all'
  condition?: AssetCondition | 'all'
  supplierId?: number | null
  assignedEmployeeId?: number | null
  warrantyExpiringDays?: number | null
  ids?: number[]
  sortBy?: 'code' | 'name' | 'purchaseDate' | 'purchasePrice' | 'createdAt' | 'status'
  sortDir?: 'asc' | 'desc'
}

export interface AssetAttachment {
  id: number
  assetId: number
  filename: string
  storedName: string
  mimeType: string | null
  size: number
  createdAt: string
  createdByName: string | null
}

export interface AssetDetail {
  asset: Asset
  attachments: AssetAttachment[]
  assignments: Assignment[]
  maintenance: MaintenanceRecord[]
  logs: ActivityLog[]
}

/* ----------------------------- Assignments ----------------------------- */

export interface Assignment {
  id: number
  code: string
  assetId: number
  assetCode: string
  assetName: string
  categoryName: string | null
  employeeId: number
  employeeName: string
  employeeCode: string | null
  departmentId: number | null
  departmentName: string | null
  assignedDate: string
  expectedReturnDate: string | null
  returnedDate: string | null
  status: AssignmentStatus
  conditionBefore: AssetCondition | null
  conditionAfter: AssetCondition | null
  note: string | null
  returnNote: string | null
  createdByName: string | null
  createdAt: string
  isOverdue: boolean
}

export interface AssignmentListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: AssignmentStatus | 'all' | 'overdue'
  employeeId?: number | null
  assetId?: number | null
  departmentId?: number | null
  fromDate?: string | null
  toDate?: string | null
}

export interface AssignmentInput {
  assetId: number
  employeeId: number
  departmentId?: number | null
  assignedDate: string
  expectedReturnDate?: string | null
  conditionBefore?: AssetCondition | null
  note?: string | null
}

export interface ReturnInput {
  assignmentId: number
  returnedDate: string
  conditionAfter?: AssetCondition | null
  locationId?: number | null
  note?: string | null
}

/* ----------------------------- Maintenance ----------------------------- */

export interface MaintenanceRecord {
  id: number
  code: string
  assetId: number
  assetCode: string
  assetName: string
  categoryName: string | null
  departmentName: string | null
  locationName: string | null
  type: MaintenanceType
  title: string
  description: string | null
  provider: string | null
  assignee: string | null
  scheduledDate: string | null
  completedDate: string | null
  cost: number
  status: MaintenanceStatus
  priority: MaintenancePriority
  result: string | null
  note: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
  isOverdue: boolean
}

export interface MaintenanceListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: MaintenanceStatus | 'all' | 'overdue'
  type?: MaintenanceType | 'all'
  assetId?: number | null
  fromDate?: string | null
  toDate?: string | null
}

export interface MaintenanceInput {
  assetId: number
  type: MaintenanceType
  title: string
  description?: string | null
  provider?: string | null
  assignee?: string | null
  scheduledDate?: string | null
  cost?: number
  priority?: MaintenancePriority
  note?: string | null
}

export interface MaintenanceUpdateInput extends Partial<MaintenanceInput> {
  id: number
  status?: MaintenanceStatus
  result?: string | null
  completedDate?: string | null
}

/* -------------------------------- Audit -------------------------------- */

export interface AuditSession {
  id: number
  code: string
  name: string
  departmentId: number | null
  departmentName: string | null
  locationId: number | null
  locationName: string | null
  startDate: string
  endDate: string | null
  status: AuditStatus
  note: string | null
  createdByName: string | null
  createdAt: string
  completedAt: string | null
  totalItems: number
  scannedItems: number
  matchedItems: number
  missingItems: number
  wrongItems: number
  damagedItems: number
}

export interface AuditItem {
  id: number
  sessionId: number
  assetId: number
  assetCode: string
  assetName: string
  categoryName: string | null
  serialNumber: string | null
  expectedLocationId: number | null
  expectedLocationName: string | null
  expectedEmployeeId: number | null
  expectedEmployeeName: string | null
  actualLocationId: number | null
  actualLocationName: string | null
  actualEmployeeId: number | null
  actualEmployeeName: string | null
  result: AuditResult
  note: string | null
  scannedAt: string | null
  scannedByName: string | null
}

export interface AuditDetail {
  session: AuditSession
  items: AuditItem[]
}

export interface AuditListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: AuditStatus | 'all'
}

export interface AuditCreateInput {
  name: string
  departmentId?: number | null
  locationId?: number | null
  startDate: string
  endDate?: string | null
  note?: string | null
}

export interface AuditScanInput {
  sessionId: number
  code: string
  actualLocationId?: number | null
  actualEmployeeId?: number | null
  result?: AuditResult
  note?: string | null
}

export interface AuditItemUpdateInput {
  itemId: number
  result: AuditResult
  actualLocationId?: number | null
  actualEmployeeId?: number | null
  note?: string | null
}

export interface AuditCompleteInput {
  sessionId: number
  applyActualLocation?: boolean
  markMissingAsLost?: boolean
}

/* ------------------------------- Reports ------------------------------- */

export interface ReportParams {
  categoryId?: number | null
  departmentId?: number | null
  locationId?: number | null
  status?: AssetStatus | 'all'
  fromDate?: string | null
  toDate?: string | null
}

export interface ReportRow {
  id: number
  code: string
  name: string
  categoryName: string
  departmentName: string | null
  locationName: string | null
  employeeName: string | null
  purchaseDate: string | null
  purchasePrice: number
  currentValue: number
  accumulatedDepreciation: number
  status: AssetStatus
  warrantyExpiry: string | null
}

export interface ReportGroup {
  key: string
  label: string
  count: number
  purchaseValue: number
  currentValue: number
}

export interface ReportData {
  rows: ReportRow[]
  summary: {
    total: number
    purchaseValue: number
    currentValue: number
    accumulatedDepreciation: number
    depreciationRate: number
  }
  byCategory: ReportGroup[]
  byDepartment: ReportGroup[]
  byStatus: ReportGroup[]
  generatedAt: string
}

/* ------------------------------ Dashboard ------------------------------ */

export interface DashboardKpis {
  totalAssets: number
  totalPurchaseValue: number
  totalCurrentValue: number
  totalDepreciation: number
  inUse: number
  available: number
  maintenance: number
  disposed: number
  warrantyExpiring: number
  maintenanceDue: number
  activeAssignments: number
}

export interface DashboardData {
  kpis: DashboardKpis
  byCategory: Array<{ name: string; count: number; value: number }>
  byStatus: Array<{ status: AssetStatus; count: number }>
  byDepartment: Array<{ name: string; count: number; value: number }>
  maintenanceCost: Array<{ month: string; cost: number; count: number }>
  warrantyExpiring: Asset[]
  maintenanceDue: MaintenanceRecord[]
  recentAssignments: Assignment[]
  recentLogs: ActivityLog[]
}

/* ------------------------------ Activity ------------------------------- */

export interface ActivityLog {
  id: number
  userId: number | null
  username: string | null
  action: string
  entityType: string
  entityId: number | null
  entityLabel: string | null
  details: string | null
  createdAt: string
}

export interface LogListParams {
  page?: number
  pageSize?: number
  search?: string
  action?: string
  entityType?: string
  userId?: number | null
  fromDate?: string | null
  toDate?: string | null
}

/* ------------------------------- Settings ------------------------------ */

export interface AppSettings {
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  companyTaxCode: string
  companyWebsite: string
  currency: string
  dateFormat: string
  warrantyWarningDays: number
  maintenanceWarningDays: number
  defaultDepreciationMonths: number
  loginNotice: string
}

export type SettingsInput = Partial<AppSettings>

export interface CompanyProfile {
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  companyTaxCode: string
  companyWebsite: string
}

export interface AppInfo {
  version: string
  electronVersion: string
  nodeVersion: string
  platform: string
  dataPath: string
  dbPath: string
  uploadsPath: string
  dbSize: number
}

export interface BackupResult {
  canceled: boolean
  path?: string
  files?: number
}

/* ------------------------------- Common -------------------------------- */

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ExportResult {
  canceled: boolean
  filePath?: string
  count?: number
}

export interface ImportError {
  row: number
  message: string
}

export interface ImportResult {
  canceled?: boolean
  imported: number
  failed: number
  errors: ImportError[]
  filePath?: string
}

export interface SelectOption {
  value: string | number
  label: string
  description?: string
}

export interface GlobalSearchResult {
  assets: Array<Pick<Asset, 'id' | 'code' | 'name' | 'status' | 'categoryName'>>
}
