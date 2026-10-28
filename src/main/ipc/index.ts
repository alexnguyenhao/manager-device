import { ipcMain } from 'electron'
import type { ZodType } from 'zod'
import type {
  AssetInput,
  AssetListParams,
  AssetStatus,
  AssignmentInput,
  AuditCompleteInput,
  AuditCreateInput,
  AuditItemUpdateInput,
  AuditScanInput,
  AuthUser,
  CatalogKind,
  MaintenanceInput,
  MaintenanceUpdateInput,
  ReportParams,
  ReturnInput,
  SettingsInput,
  InformationSystemInput,
  InformationSystemListParams,
  ItInfrastructureInput,
  SystemDocumentType,
  SystemLevel
} from '../../shared/types'
import { AppError, messageOf } from '../lib/errors'
import { hasPermission, type Permission } from '../../shared/constants'
import {
  changePassword,
  login,
  logout,
  me,
  requireUser,
  updateProfile
} from '../services/auth.service'
import { getDashboard } from '../services/dashboard.service'
import {
  bulkDeleteAssets,
  createAsset,
  deleteAsset,
  getAssetDetail,
  getAssetsByIds,
  listAssets,
  suggestAssetCode,
  updateAsset,
  updateAssetStatus
} from '../services/asset.service'
import {
  deleteCategory,
  deleteDepartment,
  deleteEmployee,
  deleteLocation,
  deleteSupplier,
  listCatalog,
  saveCategory,
  saveDepartment,
  saveEmployee,
  saveLocation,
  saveSupplier
} from '../services/catalog.service'
import {
  createAssignment,
  deleteAssignment,
  listAssignments,
  returnAssignment
} from '../services/assignment.service'
import {
  cancelMaintenance,
  completeMaintenance,
  createMaintenance,
  deleteMaintenance,
  listMaintenance,
  updateMaintenance
} from '../services/maintenance.service'
import {
  completeAudit,
  createAudit,
  deleteAudit,
  getAuditDetail,
  listAudits,
  scanAuditItem,
  updateAuditItem
} from '../services/audit.service'
import { buildReport } from '../services/report.service'
import {
  clearBusinessData,
  getAppInfo,
  getSettings,
  openDataFolder,
  updateSettings
} from '../services/settings.service'
import {
  backupToDriveNow,
  backupToFolderNow,
  chooseBackupFolder,
  createManualBackup as createBackup,
  getBackupOverview,
  listDriveBackups,
  listFolderBackups,
  removeDriveBackup,
  restoreDriveBackup,
  restoreFolderBackup,
  restoreManualBackup as restoreBackup,
  updateBackupConfig
} from '../services/backup.service'
import {
  connectDrive,
  disconnectDrive,
  getDriveStatus,
  saveDriveConfig
} from '../services/drive.service'
import {
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  updateUser
} from '../services/user.service'
import { listLogs } from '../services/log-list.service'
import { scanHardware } from '../services/hardware.service'
import {
  getInfrastructureOverview,
  updateInfrastructure
} from '../services/infrastructure.service'
import {
  deleteSystem,
  deleteSystemFile,
  getSystemDashboard,
  getSystemDetail,
  getSystemSummary,
  listSystems,
  openSystemFile,
  saveSystem,
  systemCodeSuggestion,
  uploadSystemFile
} from '../services/system.service'
import {
  downloadSystemImportTemplate,
  exportSystemsExcel,
  exportSystemsPdf,
  importSystemsExcel
} from '../services/system-report.service'
import {
  deleteAttachment,
  openAttachment,
  uploadAttachment
} from '../services/files.service'
import { listAttachments } from '../services/asset.service'
import {
  downloadImportTemplate,
  exportAssetConfigExcel,
  exportAssetsExcel,
  exportAuditExcel,
  exportReportExcel,
  importAssetsExcel
} from '../services/excel.service'
import {
  assetListSchema,
  assetSchema,
  assignmentSchema,
  auditCompleteSchema,
  backupConfigSchema,
  backupNameSchema,
  auditCreateSchema,
  auditItemSchema,
  auditScanSchema,
  categorySchema,
  changePasswordSchema,
  departmentSchema,
  driveConfigSchema,
  driveFileIdSchema,
  employeeSchema,
  idSchema,
  idsSchema,
  locationSchema,
  loginSchema,
  logListSchema,
  maintenanceCompleteSchema,
  maintenanceSchema,
  maintenanceUpdateSchema,
  profileSchema,
  reportSchema,
  resetPasswordSchema,
  returnSchema,
  settingsSchema,
  supplierSchema,
  systemFileIdSchema,
  systemFileSchema,
  systemListSchema,
  systemSchema,
  infrastructureSchema,
  userCreateSchema,
  userUpdateSchema
} from '../lib/schemas'

type IpcFailure = { ok: false; error: { message: string; code: string } }
type IpcSuccess<T> = { ok: true; data: T }
type IpcResult<T> = IpcSuccess<T> | IpcFailure

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      })
      .join('\n')
    throw new AppError(message || 'Dữ liệu không hợp lệ.', 'BAD_REQUEST')
  }
  return result.data
}

function fail(error: unknown): IpcFailure {
  const code = error instanceof AppError ? error.code : 'INTERNAL'
  if (!(error instanceof AppError)) {
    console.error('[IPC]', error)
  }
  return { ok: false, error: { message: messageOf(error), code } }
}

interface HandlerOptions {
  public?: boolean
  permission?: Permission
  roles?: AuthUser['role'][]
}

type Handler = (user: AuthUser | null, ...args: unknown[]) => unknown | Promise<unknown>

function handle(channel: string, handler: Handler, options: HandlerOptions = {}): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<IpcResult<unknown>> => {
    try {
      let user: AuthUser | null = null
      if (!options.public) {
        user = requireUser()
        if (options.permission && !hasPermission(user.role, options.permission)) {
          throw new AppError('Bạn không có quyền thực hiện thao tác này.', 'FORBIDDEN')
        }
        if (options.roles && !options.roles.includes(user.role)) {
          throw new AppError('Bạn không có quyền thực hiện thao tác này.', 'FORBIDDEN')
        }
      }
      const data = await handler(user, ...args)
      return { ok: true, data }
    } catch (error) {
      return fail(error)
    }
  })
}

const CATALOG_KINDS: CatalogKind[] = [
  'categories',
  'departments',
  'locations',
  'suppliers',
  'employees'
]

function assertCatalogKind(value: unknown): CatalogKind {
  if (typeof value !== 'string' || !CATALOG_KINDS.includes(value as CatalogKind)) {
    throw new AppError('Loại danh mục không hợp lệ.', 'BAD_REQUEST')
  }
  return value as CatalogKind
}

export function registerIpcHandlers(): void {
  /* --------------------------------- Auth -------------------------------- */
  handle(
    'auth:login',
    (_user, username, password) => {
      const data = parse(loginSchema, { username, password })
      return login(data.username, data.password)
    },
    { public: true }
  )
  handle(
    'auth:logout',
    () => {
      logout()
      return null
    },
    { public: true }
  )
  handle('auth:me', () => me(), { public: true })
  handle('auth:changePassword', (user, currentPassword, newPassword) => {
    const data = parse(changePasswordSchema, { currentPassword, newPassword })
    changePassword(data.currentPassword, data.newPassword)
    return null
  })
  handle('auth:updateProfile', (user, payload) => {
    const data = parse(profileSchema, payload)
    return updateProfile(data)
  })

  /* ------------------------------- Dashboard ----------------------------- */
  handle('dashboard:get', () => getDashboard())

  /* -------------------------------- Assets ------------------------------- */
  handle(
    'assets:list',
    (_user, params) => listAssets(parse(assetListSchema, params ?? {}) as AssetListParams),
    { permission: 'report:read' }
  )
  handle('assets:get', (_user, id) => getAssetDetail(parse(idSchema, id)), {
    permission: 'report:read'
  })
  handle(
    'assets:create',
    (user, payload) => createAsset(parse(assetSchema, payload) as AssetInput, user!),
    { permission: 'asset:write' }
  )
  handle(
    'assets:update',
    (user, id, payload) =>
      updateAsset(parse(idSchema, id), parse(assetSchema, payload) as AssetInput, user!),
    { permission: 'asset:write' }
  )
  handle('assets:remove', (user, id) => {
    deleteAsset(parse(idSchema, id), user!)
    return null
  }, { permission: 'asset:delete' })
  handle(
    'assets:bulkRemove',
    (user, ids) => bulkDeleteAssets(parse(idsSchema, ids), user!),
    { permission: 'asset:delete' }
  )
  handle(
    'assets:nextCode',
    (_user, categoryId) =>
      suggestAssetCode(categoryId ? parse(idSchema, categoryId) : undefined),
    { permission: 'asset:write' }
  )
  handle('assets:byIds', (_user, ids) => getAssetsByIds(parse(idsSchema, ids)), {
    permission: 'report:read'
  })
  handle(
    'assets:updateStatus',
    (user, id, status, note) =>
      updateAssetStatus(
        parse(idSchema, id),
        status as AssetStatus,
        user!,
        typeof note === 'string' ? note : undefined
      ),
    { permission: 'asset:write' }
  )
  handle(
    'assets:exportExcel',
    (user, params) =>
      exportAssetsExcel(parse(assetListSchema, params ?? {}) as AssetListParams, user!),
    { permission: 'report:read' }
  )
  handle(
    'assets:exportConfigExcel',
    (user, params) =>
      exportAssetConfigExcel(parse(assetListSchema, params ?? {}) as AssetListParams, user!),
    { permission: 'report:read' }
  )
  handle('assets:importExcel', (user) => importAssetsExcel(user!), {
    permission: 'asset:write'
  })
  handle('assets:downloadTemplate', (user) => downloadImportTemplate(user!), {
    permission: 'report:read'
  })

  /* -------------------------------- Catalog ------------------------------ */
  handle('catalog:list', (_user, kind) => listCatalog(assertCatalogKind(kind)), {
    permission: 'report:read'
  })
  handle(
    'catalog:save',
    (user, kindValue, payload) => {
      const kind = assertCatalogKind(kindValue)
      switch (kind) {
        case 'categories':
          return saveCategory(parse(categorySchema, payload), user!)
        case 'departments':
          return saveDepartment(parse(departmentSchema, payload), user!)
        case 'locations':
          return saveLocation(parse(locationSchema, payload), user!)
        case 'suppliers':
          return saveSupplier(parse(supplierSchema, payload), user!)
        case 'employees':
          return saveEmployee(parse(employeeSchema, payload), user!)
      }
    },
    { permission: 'catalog:write' }
  )
  handle(
    'catalog:remove',
    (user, kindValue, idValue) => {
      const kind = assertCatalogKind(kindValue)
      const id = parse(idSchema, idValue)
      switch (kind) {
        case 'categories':
          deleteCategory(id, user!)
          break
        case 'departments':
          deleteDepartment(id, user!)
          break
        case 'locations':
          deleteLocation(id, user!)
          break
        case 'suppliers':
          deleteSupplier(id, user!)
          break
        case 'employees':
          deleteEmployee(id, user!)
          break
      }
      return null
    },
    { permission: 'catalog:write' }
  )

  /* ------------------------------ Assignments ---------------------------- */
  handle(
    'assignments:list',
    (_user, params) => listAssignments(params as never),
    { permission: 'report:read' }
  )
  handle(
    'assignments:create',
    (user, payload) => createAssignment(parse(assignmentSchema, payload) as AssignmentInput, user!),
    { permission: 'assignment:write' }
  )
  handle(
    'assignments:return',
    (user, payload) => returnAssignment(parse(returnSchema, payload) as ReturnInput, user!),
    { permission: 'assignment:write' }
  )
  handle('assignments:remove', (user, id) => {
    deleteAssignment(parse(idSchema, id), user!)
    return null
  }, { permission: 'assignment:write' })

  /* ------------------------------ Maintenance ---------------------------- */
  handle(
    'maintenance:list',
    (_user, params) => listMaintenance(params as never),
    { permission: 'report:read' }
  )
  handle(
    'maintenance:create',
    (user, payload) =>
      createMaintenance(parse(maintenanceSchema, payload) as MaintenanceInput, user!),
    { permission: 'maintenance:write' }
  )
  handle(
    'maintenance:update',
    (user, payload) =>
      updateMaintenance(parse(maintenanceUpdateSchema, payload) as MaintenanceUpdateInput, user!),
    { permission: 'maintenance:write' }
  )
  handle('maintenance:complete', (user, id, payload) => {
    const data = parse(maintenanceCompleteSchema, payload)
    return completeMaintenance(parse(idSchema, id), data, user!)
  }, { permission: 'maintenance:write' })
  handle(
    'maintenance:cancel',
    (user, id) => cancelMaintenance(parse(idSchema, id), user!),
    { permission: 'maintenance:write' }
  )
  handle('maintenance:remove', (user, id) => {
    deleteMaintenance(parse(idSchema, id), user!)
    return null
  }, { permission: 'maintenance:write' })

  /* -------------------------------- Audits ------------------------------- */
  handle(
    'audits:list',
    (_user, params) => listAudits(params as never),
    { permission: 'report:read' }
  )
  handle('audits:get', (_user, id) => getAuditDetail(parse(idSchema, id)), {
    permission: 'report:read'
  })
  handle(
    'audits:create',
    (user, payload) => createAudit(parse(auditCreateSchema, payload) as AuditCreateInput, user!),
    { permission: 'audit:write' }
  )
  handle(
    'audits:scan',
    (user, payload) => scanAuditItem(parse(auditScanSchema, payload) as AuditScanInput, user!),
    { permission: 'audit:write' }
  )
  handle(
    'audits:updateItem',
    (user, payload) =>
      updateAuditItem(parse(auditItemSchema, payload) as AuditItemUpdateInput, user!),
    { permission: 'audit:write' }
  )
  handle(
    'audits:complete',
    (user, payload) =>
      completeAudit(parse(auditCompleteSchema, payload) as AuditCompleteInput, user!),
    { permission: 'audit:write' }
  )
  handle('audits:remove', (user, id) => {
    deleteAudit(parse(idSchema, id), user!)
    return null
  }, { permission: 'audit:write' })
  handle('audits:exportExcel', (user, id) => exportAuditExcel(parse(idSchema, id), user!), {
    permission: 'report:read'
  })

  /* -------------------------------- Reports ------------------------------ */
  handle('reports:get', (_user, params) => buildReport(parse(reportSchema, params ?? {}) as ReportParams), {
    permission: 'report:read'
  })
  handle(
    'reports:export',
    (user, params) => exportReportExcel(parse(reportSchema, params ?? {}) as ReportParams, user!),
    { permission: 'report:read' }
  )

  /* --------------------------- Hạ tầng & HTTT --------------------------- */
  handle('infrastructure:get', () => getInfrastructureOverview(), { permission: 'report:read' })
  handle(
    'infrastructure:update',
    (user, payload) =>
      updateInfrastructure(parse(infrastructureSchema, payload) as ItInfrastructureInput, user!),
    { permission: 'infrastructure:write' }
  )

  const parseSystemList = (value: unknown): InformationSystemListParams => {
    const data = parse(systemListSchema, value ?? {})
    let level: InformationSystemListParams['level'] = 'all'
    if (data.level === 'unset') {
      level = 'unset'
    } else if (data.level && data.level !== 'all') {
      level = Number(data.level) as SystemLevel
    }
    return { ...data, level } as InformationSystemListParams
  }

  handle('systems:list', (_user, params) => listSystems(parseSystemList(params)), {
    permission: 'report:read'
  })
  handle('systems:get', (_user, id) => getSystemDetail(parse(idSchema, id)), {
    permission: 'report:read'
  })
  handle('systems:nextCode', () => systemCodeSuggestion(), { permission: 'system:write' })
  handle(
    'systems:save',
    (user, payload) =>
      saveSystem(parse(systemSchema, payload) as InformationSystemInput & { id?: number }, user!),
    { permission: 'system:write' }
  )
  handle(
    'systems:remove',
    (user, id) => {
      deleteSystem(parse(idSchema, id), user!)
      return null
    },
    { permission: 'system:delete' }
  )
  handle('systems:dashboard', () => getSystemDashboard(), { permission: 'report:read' })
  handle('systems:summary', () => getSystemSummary(), { permission: 'report:read' })
  handle(
    'systems:uploadFile',
    (user, systemId, documentType) => {
      const data = parse(systemFileSchema, { systemId, documentType })
      return uploadSystemFile(
        data.systemId,
        (data.documentType ?? 'other') as SystemDocumentType,
        user!
      )
    },
    { permission: 'system:write' }
  )
  handle('systems:openFile', (_user, id) => openSystemFile(parse(systemFileIdSchema, id)), {
    permission: 'report:read'
  })
  handle(
    'systems:removeFile',
    (user, id) => {
      deleteSystemFile(parse(systemFileIdSchema, id), user!)
      return null
    },
    { permission: 'system:write' }
  )
  handle(
    'systems:exportExcel',
    (user, params) => exportSystemsExcel(parseSystemList(params), user!),
    { permission: 'report:read' }
  )
  handle(
    'systems:exportPdf',
    (user, params) => exportSystemsPdf(parseSystemList(params), user!),
    { permission: 'report:read' }
  )
  handle('systems:importExcel', (user) => importSystemsExcel(user!), {
    permission: 'system:write'
  })
  handle('systems:downloadTemplate', (user) => downloadSystemImportTemplate(user!), {
    permission: 'report:read'
  })

  /* -------------------------------- Users -------------------------------- */
  handle('users:list', () => listUsers(), { roles: ['admin'] })
  handle(
    'users:create',
    (user, payload) => createUser(parse(userCreateSchema, payload), user!),
    { roles: ['admin'] }
  )
  handle(
    'users:update',
    (user, id, payload) =>
      updateUser(parse(idSchema, id), parse(userUpdateSchema, payload), user!),
    { roles: ['admin'] }
  )
  handle('users:remove', (user, id) => {
    deleteUser(parse(idSchema, id), user!)
    return null
  }, { roles: ['admin'] })
  handle('users:resetPassword', (user, id, newPassword) => {
    const data = parse(resetPasswordSchema, { newPassword })
    resetPassword(parse(idSchema, id), data.newPassword, user!)
    return null
  }, { roles: ['admin'] })

  /* ------------------------------- Settings ------------------------------ */
  handle('settings:get', () => getSettings())
  handle(
    'settings:update',
    (user, payload) =>
      updateSettings(parse(settingsSchema, payload) as SettingsInput, user!),
    { permission: 'settings:write' }
  )
  handle('settings:backup', (user) => createBackup(user!), { permission: 'backup' })
  handle('settings:restore', (user) => restoreBackup(user!), { permission: 'settings:write' })
  handle('settings:openDataFolder', () => openDataFolder())
  handle('settings:clearDemoData', (user) => clearBusinessData(user!), {
    permission: 'settings:write'
  })
  handle('app:info', () => getAppInfo())

  /* ------------------------------- Hardware ------------------------------ */
  handle('hardware:scan', () => scanHardware(), { permission: 'asset:write' })

  /* -------------------------------- Backup ------------------------------- */
  handle('backup:overview', () => getBackupOverview())
  handle(
    'backup:updateConfig',
    (user, payload) => updateBackupConfig(parse(backupConfigSchema, payload), user!),
    { permission: 'settings:write' }
  )
  handle(
    'backup:chooseFolder',
    (user, payload) =>
      chooseBackupFolder(
        user!,
        payload === undefined ? {} : parse(backupConfigSchema, payload)
      ),
    { permission: 'settings:write' }
  )
  handle('backup:folderNow', (user) => backupToFolderNow(user!), { permission: 'backup' })
  handle('backup:listFolder', () => listFolderBackups(), { permission: 'backup' })
  handle(
    'backup:restoreFolder',
    (user, name) => restoreFolderBackup(parse(backupNameSchema, name), user!),
    { permission: 'settings:write' }
  )

  /* ----------------------------- Google Drive ---------------------------- */
  handle('drive:status', () => getDriveStatus())
  handle('drive:saveConfig', (_user, payload) => saveDriveConfig(parse(driveConfigSchema, payload)), {
    permission: 'settings:write'
  })
  handle('drive:connect', () => connectDrive(), { permission: 'settings:write' })
  handle('drive:disconnect', () => disconnectDrive(), { permission: 'settings:write' })
  handle('drive:backup', (user) => backupToDriveNow(user!), { permission: 'backup' })
  handle('drive:list', () => listDriveBackups(), { permission: 'backup' })
  handle(
    'drive:restore',
    (user, id) => restoreDriveBackup(parse(driveFileIdSchema, id), user!),
    { permission: 'settings:write' }
  )
  handle('drive:remove', (_user, id) => removeDriveBackup(parse(driveFileIdSchema, id)), {
    permission: 'backup'
  })

  /* --------------------------------- Logs -------------------------------- */
  handle('logs:list', (_user, params) => listLogs(parse(logListSchema, params ?? {})), {
    permission: 'log:read'
  })

  /* -------------------------------- Files -------------------------------- */
  handle('files:list', (_user, assetId) => listAttachments(parse(idSchema, assetId)), {
    permission: 'report:read'
  })
  handle('files:upload', (user, assetId) => uploadAttachment(parse(idSchema, assetId), user!), {
    permission: 'asset:write'
  })
  handle('files:open', (_user, id) => openAttachment(parse(idSchema, id)))
  handle('files:remove', (user, id) => {
    deleteAttachment(parse(idSchema, id), user!)
    return null
  }, { permission: 'asset:write' })
}
