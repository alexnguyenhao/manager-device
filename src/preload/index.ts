import { contextBridge, ipcRenderer } from 'electron'
import type { WindowApi, CatalogApi } from '../shared/api'
import type { CatalogKind } from '../shared/types'

interface IpcError {
  message: string
  code: string
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as
    | { ok: true; data: T }
    | { ok: false; error: IpcError }
  if (!result || !result.ok) {
    const error = new Error(result?.error?.message ?? 'Không thể kết nối với ứng dụng.')
    Object.assign(error, { code: result?.error?.code ?? 'INTERNAL' })
    throw error
  }
  return result.data
}

function catalogApi<T, TInput>(kind: CatalogKind): CatalogApi<T, TInput> {
  return {
    list: () => invoke('catalog:list', kind),
    save: (data) => invoke('catalog:save', kind, data),
    remove: (id) => invoke('catalog:remove', kind, id)
  }
}

const api: WindowApi = {
  auth: {
    login: (username, password) => invoke('auth:login', username, password),
    logout: () => invoke('auth:logout'),
    me: () => invoke('auth:me'),
    changePassword: (currentPassword, newPassword) =>
      invoke('auth:changePassword', currentPassword, newPassword),
    updateProfile: (data) => invoke('auth:updateProfile', data)
  },
  dashboard: {
    get: () => invoke('dashboard:get')
  },
  assets: {
    list: (params) => invoke('assets:list', params),
    get: (id) => invoke('assets:get', id),
    create: (data) => invoke('assets:create', data),
    update: (id, data) => invoke('assets:update', id, data),
    remove: (id) => invoke('assets:remove', id),
    bulkRemove: (ids) => invoke('assets:bulkRemove', ids),
    nextCode: (categoryId) => invoke('assets:nextCode', categoryId),
    byIds: (ids) => invoke('assets:byIds', ids),
    updateStatus: (id, status, note) => invoke('assets:updateStatus', id, status, note),
    exportExcel: (params) => invoke('assets:exportExcel', params),
    importExcel: () => invoke('assets:importExcel'),
    downloadTemplate: () => invoke('assets:downloadTemplate')
  },
  categories: catalogApi('categories'),
  departments: catalogApi('departments'),
  locations: catalogApi('locations'),
  suppliers: catalogApi('suppliers'),
  employees: catalogApi('employees'),
  assignments: {
    list: (params) => invoke('assignments:list', params),
    create: (data) => invoke('assignments:create', data),
    returnAsset: (data) => invoke('assignments:return', data),
    remove: (id) => invoke('assignments:remove', id)
  },
  maintenance: {
    list: (params) => invoke('maintenance:list', params),
    create: (data) => invoke('maintenance:create', data),
    update: (data) => invoke('maintenance:update', data),
    complete: (id, data) => invoke('maintenance:complete', id, data),
    cancel: (id) => invoke('maintenance:cancel', id),
    remove: (id) => invoke('maintenance:remove', id)
  },
  audits: {
    list: (params) => invoke('audits:list', params),
    get: (id) => invoke('audits:get', id),
    create: (data) => invoke('audits:create', data),
    scan: (data) => invoke('audits:scan', data),
    updateItem: (data) => invoke('audits:updateItem', data),
    complete: (data) => invoke('audits:complete', data),
    remove: (id) => invoke('audits:remove', id),
    exportExcel: (id) => invoke('audits:exportExcel', id)
  },
  reports: {
    get: (params) => invoke('reports:get', params),
    export: (params) => invoke('reports:export', params)
  },
  users: {
    list: () => invoke('users:list'),
    create: (data) => invoke('users:create', data),
    update: (id, data) => invoke('users:update', id, data),
    remove: (id) => invoke('users:remove', id),
    resetPassword: (id, newPassword) => invoke('users:resetPassword', id, newPassword)
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (data) => invoke('settings:update', data),
    backup: () => invoke('settings:backup'),
    restore: () => invoke('settings:restore'),
    openDataFolder: () => invoke('settings:openDataFolder'),
    clearDemoData: () => invoke('settings:clearDemoData')
  },
  backup: {
    overview: () => invoke('backup:overview'),
    updateConfig: (data) => invoke('backup:updateConfig', data),
    chooseFolder: (data) => invoke('backup:chooseFolder', data),
    folderNow: () => invoke('backup:folderNow'),
    listFolder: () => invoke('backup:listFolder'),
    restoreFolder: (name) => invoke('backup:restoreFolder', name)
  },
  drive: {
    status: () => invoke('drive:status'),
    saveConfig: (data) => invoke('drive:saveConfig', data),
    connect: () => invoke('drive:connect'),
    disconnect: () => invoke('drive:disconnect'),
    backup: () => invoke('drive:backup'),
    list: () => invoke('drive:list'),
    restore: (id) => invoke('drive:restore', id),
    remove: (id) => invoke('drive:remove', id)
  },
  logs: {
    list: (params) => invoke('logs:list', params)
  },
  files: {
    list: (assetId) => invoke('files:list', assetId),
    upload: (assetId) => invoke('files:upload', assetId),
    open: (id) => invoke('files:open', id),
    remove: (id) => invoke('files:remove', id)
  },
  app: {
    info: () => invoke('app:info')
  },
  hardware: {
    scan: () => invoke('hardware:scan')
  }
}

contextBridge.exposeInMainWorld('api', api)
