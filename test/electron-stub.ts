/* Stub Electron cho kiểm thử tự động ngoài môi trường Electron */
const root = process.env.MD_TEST_DATA || '/tmp/opencode/manager-device-test'

export const app = {
  setName: (): void => undefined,
  setPath: (): void => undefined,
  getPath: (_name: string): string => root,
  getVersion: (): string => '1.0.0-test',
  isPackaged: false,
  relaunch: (): void => undefined,
  exit: (): void => undefined
}

export const dialog = {
  showOpenDialog: async (options?: {
    properties?: string[]
  }): Promise<{ canceled: boolean; filePaths: string[] }> => {
    if (options?.properties?.includes('openDirectory')) {
      const folder = process.env.MD_TEST_FOLDER
      if (folder) return { canceled: false, filePaths: [folder] }
      return { canceled: true, filePaths: [] }
    }
    const importPath = process.env.MD_TEST_IMPORT
    if (importPath) return { canceled: false, filePaths: [importPath] }
    return { canceled: true, filePaths: [] }
  },
  showSaveDialog: async (): Promise<{ canceled: boolean; filePath?: string }> => {
    const savePath = process.env.MD_TEST_SAVE
    if (savePath) return { canceled: false, filePath: savePath }
    return { canceled: true }
  },
  showMessageBox: async (): Promise<{ response: number }> => ({ response: 0 })
}

export const shell = {
  openPath: async (): Promise<string> => '',
  openExternal: async (): Promise<void> => undefined
}

/** Stub cho lưu token Google Drive khi chạy ngoài Electron. */
export const safeStorage = {
  isEncryptionAvailable: (): boolean => false,
  encryptString: (value: string): Buffer => Buffer.from(value, 'utf8'),
  decryptString: (value: Buffer): string => value.toString('utf8')
}

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown

/** Cho phép bộ kiểm thử UI gọi trực tiếp các IPC handler đã đăng ký. */
export const ipcHandlers = new Map<string, IpcHandler>()

export const ipcMain = {
  handle: (channel: string, handler: IpcHandler): void => {
    ipcHandlers.set(channel, handler)
  }
}

export const BrowserWindow = class {}
export const Menu = { setApplicationMenu: (): void => undefined }
