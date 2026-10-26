import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import { join } from 'node:path'
import { initAppPaths } from './lib/paths'
import { closeDatabase, openDatabase } from './db/database'
import { registerIpcHandlers } from './ipc'

initAppPaths()

let mainWindow: BrowserWindow | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f6fb',
    title: 'Quản lý thiết bị UBND xã',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (url.startsWith('https://')) void shell.openExternal(url)
  })

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && !app.isPackaged) {
      mainWindow?.webContents.toggleDevTools()
    }
    if (input.control && input.shift && input.key.toLowerCase() === 'i' && !app.isPackaged) {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

}

app.whenReady().then(() => {
  try {
    openDatabase()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox(
      'Không thể khởi động cơ sở dữ liệu',
      `Đã xảy ra lỗi khi mở dữ liệu:\n${message}\n\nVui lòng kiểm tra quyền truy cập thư mục dữ liệu.`
    )
    app.quit()
    return
  }

  registerIpcHandlers()
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})
