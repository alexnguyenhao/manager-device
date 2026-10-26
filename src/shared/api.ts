import type {
  AppInfo,
  AppSettings,
  Asset,
  AssetAttachment,
  AssetDetail,
  AssetInput,
  AssetListParams,
  Assignment,
  AssignmentInput,
  AssignmentListParams,
  AuditCompleteInput,
  AuditCreateInput,
  AuditDetail,
  AuditListParams,
  AuditScanInput,
  AuditSession,
  AuditItemUpdateInput,
  AuthUser,
  BackupResult,
  Category,
  CategoryInput,
  DashboardData,
  Department,
  DepartmentInput,
  Employee,
  EmployeeInput,
  ExportResult,
  ImportResult,
  Location,
  LocationInput,
  LogListParams,
  MaintenanceInput,
  MaintenanceListParams,
  MaintenanceRecord,
  MaintenanceUpdateInput,
  PageResult,
  ReportData,
  ReportParams,
  ReturnInput,
  SettingsInput,
  Supplier,
  SupplierInput,
  UserAccount,
  UserInput,
  ActivityLog,
  AssetStatus
} from './types'

export type AssetExportParams = AssetListParams

export interface CatalogApi<T, TInput> {
  list: () => Promise<T[]>
  save: (data: TInput & { id?: number }) => Promise<T>
  remove: (id: number) => Promise<void>
}

export interface WindowApi {
  auth: {
    login: (username: string, password: string) => Promise<AuthUser>
    logout: () => Promise<void>
    me: () => Promise<AuthUser | null>
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>
    updateProfile: (data: {
      fullName: string
      email?: string | null
      phone?: string | null
    }) => Promise<AuthUser>
  }
  dashboard: {
    get: () => Promise<DashboardData>
  }
  assets: {
    list: (params: AssetListParams) => Promise<PageResult<Asset>>
    get: (id: number) => Promise<AssetDetail>
    create: (data: AssetInput) => Promise<Asset>
    update: (id: number, data: AssetInput) => Promise<Asset>
    remove: (id: number) => Promise<void>
    bulkRemove: (ids: number[]) => Promise<number>
    nextCode: (categoryId?: number) => Promise<string>
    byIds: (ids: number[]) => Promise<Asset[]>
    updateStatus: (id: number, status: AssetStatus, note?: string) => Promise<Asset>
    exportExcel: (params: AssetExportParams) => Promise<ExportResult>
    importExcel: () => Promise<ImportResult>
    downloadTemplate: () => Promise<ExportResult>
  }
  categories: CatalogApi<Category, CategoryInput>
  departments: CatalogApi<Department, DepartmentInput>
  locations: CatalogApi<Location, LocationInput>
  suppliers: CatalogApi<Supplier, SupplierInput>
  employees: CatalogApi<Employee, EmployeeInput>
  assignments: {
    list: (params: AssignmentListParams) => Promise<PageResult<Assignment>>
    create: (data: AssignmentInput) => Promise<Assignment>
    returnAsset: (data: ReturnInput) => Promise<Assignment>
    remove: (id: number) => Promise<void>
  }
  maintenance: {
    list: (params: MaintenanceListParams) => Promise<PageResult<MaintenanceRecord>>
    create: (data: MaintenanceInput) => Promise<MaintenanceRecord>
    update: (data: MaintenanceUpdateInput) => Promise<MaintenanceRecord>
    complete: (id: number, data: { result: string; cost?: number; completedDate?: string }) => Promise<MaintenanceRecord>
    cancel: (id: number) => Promise<MaintenanceRecord>
    remove: (id: number) => Promise<void>
  }
  audits: {
    list: (params: AuditListParams) => Promise<PageResult<AuditSession>>
    get: (id: number) => Promise<AuditDetail>
    create: (data: AuditCreateInput) => Promise<AuditSession>
    scan: (data: AuditScanInput) => Promise<AuditDetail>
    updateItem: (data: AuditItemUpdateInput) => Promise<AuditDetail>
    complete: (data: AuditCompleteInput) => Promise<AuditSession>
    remove: (id: number) => Promise<void>
    exportExcel: (id: number) => Promise<ExportResult>
  }
  reports: {
    get: (params: ReportParams) => Promise<ReportData>
    export: (params: ReportParams) => Promise<ExportResult>
  }
  users: {
    list: () => Promise<UserAccount[]>
    create: (data: UserInput) => Promise<UserAccount>
    update: (id: number, data: UserInput) => Promise<UserAccount>
    remove: (id: number) => Promise<void>
    resetPassword: (id: number, newPassword: string) => Promise<void>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (data: SettingsInput) => Promise<AppSettings>
    backup: () => Promise<BackupResult>
    restore: () => Promise<{ restored: boolean; path?: string }>
    openDataFolder: () => Promise<void>
    clearDemoData: () => Promise<{ removed: number }>
  }
  logs: {
    list: (params: LogListParams) => Promise<PageResult<ActivityLog>>
  }
  files: {
    list: (assetId: number) => Promise<AssetAttachment[]>
    upload: (assetId: number) => Promise<AssetAttachment | null>
    open: (id: number) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  app: {
    info: () => Promise<AppInfo>
  }
}
