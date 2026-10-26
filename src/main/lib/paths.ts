import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export const APP_NAME = 'Manager Device'

export function initAppPaths(): void {
  app.setName(APP_NAME)
  const userData = join(app.getPath('appData'), APP_NAME)
  app.setPath('userData', userData)
}

export function dataDir(): string {
  return app.getPath('userData')
}

export function dbPath(): string {
  return join(dataDir(), 'data', 'manager-device.db')
}

export function uploadsDir(): string {
  const dir = join(dataDir(), 'uploads')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function avatarsDir(): string {
  const dir = join(dataDir(), 'avatars')
  mkdirSync(dir, { recursive: true })
  return dir
}
