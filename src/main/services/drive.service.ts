import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { safeStorage, shell } from 'electron'
import type {
  BackupEntry,
  DriveConfigInput,
  DriveConnectResult,
  DriveStatus
} from '../../shared/types'
import { AppError } from '../lib/errors'
import { dataDir } from '../lib/paths'

/** Chỉ quản lý các tệp do ứng dụng tạo ra trên Google Drive. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_FOLDER_NAME = 'Manager Device Backups'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const CONNECT_TIMEOUT_MS = 5 * 60_000
const REQUEST_TIMEOUT_MS = 30_000

interface DriveSecrets {
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  accessToken?: string
  accessTokenExpiresAt?: number
  accountEmail?: string
  folderId?: string
  lastSyncAt?: string
}

interface StoredEnvelope {
  v: 1
  encrypted: boolean
  data: string
}

function secretsPath(): string {
  return join(dataDir(), 'drive-auth.json')
}

function readSecrets(): DriveSecrets {
  const file = secretsPath()
  if (!existsSync(file)) return {}
  try {
    const envelope = JSON.parse(readFileSync(file, 'utf8')) as StoredEnvelope
    if (!envelope || typeof envelope.data !== 'string') return {}
    const raw = envelope.encrypted && safeStorage?.isEncryptionAvailable?.()
      ? safeStorage.decryptString(Buffer.from(envelope.data, 'base64'))
      : Buffer.from(envelope.data, 'base64').toString('utf8')
    return JSON.parse(raw) as DriveSecrets
  } catch {
    return {}
  }
}

function writeSecrets(secrets: DriveSecrets): void {
  const raw = JSON.stringify(secrets)
  const encrypted = Boolean(safeStorage?.isEncryptionAvailable?.())
  const data = encrypted
    ? safeStorage.encryptString(raw).toString('base64')
    : Buffer.from(raw, 'utf8').toString('base64')
  writeFileSync(secretsPath(), JSON.stringify({ v: 1, encrypted, data } satisfies StoredEnvelope), {
    mode: 0o600
  })
}

function clearSecrets(): void {
  const file = secretsPath()
  if (existsSync(file)) unlinkSync(file)
}

function normalizeClient(input: DriveConfigInput): Required<DriveConfigInput> {
  return {
    clientId: input.clientId.trim(),
    clientSecret: (input.clientSecret ?? '').trim()
  }
}

export function saveDriveConfig(input: DriveConfigInput): DriveStatus {
  const { clientId, clientSecret } = normalizeClient(input)
  if (!clientId) throw new AppError('Vui lòng nhập OAuth Client ID của Google Cloud.', 'BAD_REQUEST')
  if (!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    throw new AppError(
      'OAuth Client ID không hợp lệ. Client ID thường có dạng xxxxx.apps.googleusercontent.com.',
      'BAD_REQUEST'
    )
  }

  const current = readSecrets()
  const sameClient = current.clientId === clientId
  if (!clientSecret && !(sameClient && current.clientSecret)) {
    throw new AppError('Vui lòng nhập OAuth Client Secret của Google Cloud.', 'BAD_REQUEST')
  }

  const next: DriveSecrets = {
    ...current,
    clientId,
    clientSecret: clientSecret || current.clientSecret
  }
  if (!sameClient) {
    // Đổi OAuth Client thì phải đăng nhập lại.
    delete next.refreshToken
    delete next.accessToken
    delete next.accessTokenExpiresAt
    delete next.accountEmail
    delete next.folderId
    delete next.lastSyncAt
  }
  writeSecrets(next)
  return getDriveStatus()
}

export function getDriveStatus(): DriveStatus {
  const secrets = readSecrets()
  const configured = Boolean(secrets.clientId && secrets.clientSecret)
  return {
    configured,
    connected: Boolean(secrets.clientId && secrets.clientSecret && secrets.refreshToken),
    accountEmail: secrets.accountEmail ?? null,
    folderId: secrets.folderId ?? null,
    lastSyncAt: secrets.lastSyncAt ?? null,
    scope: DRIVE_SCOPE,
    clientId: secrets.clientId ?? '',
    secretConfigured: Boolean(secrets.clientSecret)
  }
}

function buildAuthUrl(clientId: string, redirectUri: string, state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `openid email profile ${DRIVE_SCOPE}`,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
    state
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

function htmlPage(title: string, message: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f4f6fb;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border-radius:18px;box-shadow:0 18px 45px rgba(15,23,42,.12);padding:34px 38px;max-width:430px;text-align:center}
h1{font-size:19px;margin:0 0 10px}p{font-size:14px;line-height:1.6;color:#475569;margin:0}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`
}

function decodeIdTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string }
    return json.email ?? null
  } catch {
    return null
  }
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const json = JSON.parse(text) as {
      error?: string | { message?: string }
      error_description?: string
    }
    if (typeof json.error === 'string') return json.error_description ?? json.error
    if (json.error?.message) return json.error.message
  } catch {
    // không phải JSON
  }
  return text.slice(0, 300) || `HTTP ${response.status}`
}

async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  verifier: string
): Promise<DriveSecrets> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  })
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new AppError(`Không thể kết nối Google Drive: ${await parseError(response)}`, 'INTERNAL')
  }
  const token = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    id_token?: string
  }
  if (!token.refresh_token) {
    throw new AppError(
      'Google không trả về refresh token. Hãy xóa quyền truy cập cũ của ứng dụng trong tài khoản Google rồi thử lại.',
      'INTERNAL'
    )
  }
  const secrets: DriveSecrets = {
    clientId,
    clientSecret,
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    accessTokenExpiresAt: Date.now() + (token.expires_in ?? 3600) * 1000
  }
  secrets.accountEmail = decodeIdTokenEmail(token.id_token) ?? undefined

  try {
    const responseInfo = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (responseInfo.ok) {
      const info = (await responseInfo.json()) as { email?: string }
      if (info.email) secrets.accountEmail = info.email
    }
  } catch {
    // Không lấy được email cũng không ảnh hưởng đến việc sao lưu.
  }
  return secrets
}

async function listen(server: Server, port = 0): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  return (server.address() as AddressInfo).port
}

export async function connectDrive(): Promise<DriveConnectResult> {
  const secrets = readSecrets()
  if (!secrets.clientId || !secrets.clientSecret) {
    throw new AppError('Vui lòng lưu OAuth Client ID và Client Secret trước khi kết nối.', 'BAD_REQUEST')
  }

  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const state = randomBytes(24).toString('base64url')

  let resolveCode!: (code: string) => void
  let rejectCode!: (error: Error) => void
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  let server: Server | null = null
  let timer: NodeJS.Timeout | null = null
  let settled = false
  const finish = (): void => {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    server?.close()
  }

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    // Loopback OAuth của Google dùng địa chỉ gốc, không kèm đường dẫn.
    if (url.pathname !== '/' && url.pathname !== '') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    const error = url.searchParams.get('error')
    const returnedState = url.searchParams.get('state')
    const code = url.searchParams.get('code')

    let title = 'Không thể kết nối Google Drive'
    let message = 'Bạn có thể đóng cửa sổ này và thử lại trong ứng dụng.'
    if (error) {
      message = `Google trả về lỗi: ${error}. Bạn có thể đóng cửa sổ này và thử lại.`
    } else if (returnedState !== state) {
      message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.'
    } else if (!code) {
      message = 'Không nhận được mã xác thực từ Google. Vui lòng thử lại.'
    } else {
      title = 'Kết nối Google Drive thành công'
      message = 'Bạn có thể đóng cửa sổ này và quay lại ứng dụng Manager Device.'
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(htmlPage(title, message))

    if (error) {
      finish()
      rejectCode(new AppError(`Google từ chối kết nối: ${error}`, 'BAD_REQUEST'))
    } else if (returnedState !== state) {
      finish()
      rejectCode(new AppError('Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.', 'BAD_REQUEST'))
    } else if (code) {
      finish()
      resolveCode(code)
    }
  }

  server = createServer(handler)
  const port = await listen(server)
  const redirectUri = `http://127.0.0.1:${port}`

  try {
    const openExternal = (shell as { openExternal?: (url: string) => Promise<void> }).openExternal
    if (typeof openExternal !== 'function') {
      throw new AppError('Không thể mở trình duyệt để đăng nhập Google.', 'INTERNAL')
    }
    await openExternal(buildAuthUrl(secrets.clientId, redirectUri, state, challenge))

    const code = await Promise.race([
      codePromise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          finish()
          reject(
            new AppError(
              'Hết thời gian chờ đăng nhập Google (5 phút). Vui lòng thử lại.',
              'BAD_REQUEST'
            )
          )
        }, CONNECT_TIMEOUT_MS)
      })
    ])

    const updated = await exchangeCode(
      secrets.clientId,
      secrets.clientSecret,
      code,
      redirectUri,
      verifier
    )
    writeSecrets({ ...updated, folderId: secrets.folderId })
    return { connected: true, accountEmail: updated.accountEmail ?? null }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(
      `Không thể kết nối Google Drive: ${error instanceof Error ? error.message : String(error)}`,
      'INTERNAL'
    )
  } finally {
    finish()
  }
}

export async function disconnectDrive(): Promise<DriveStatus> {
  const secrets = readSecrets()
  if (secrets.refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(secrets.refreshToken)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10_000)
      })
    } catch {
      // Thu hồi token là best-effort; vẫn xóa token cục bộ.
    }
  }
  if (secrets.clientId) {
    writeSecrets({ clientId: secrets.clientId, clientSecret: secrets.clientSecret })
  } else {
    clearSecrets()
  }
  return getDriveStatus()
}

async function accessToken(secrets: DriveSecrets): Promise<string> {
  if (
    secrets.accessToken &&
    secrets.accessTokenExpiresAt &&
    secrets.accessTokenExpiresAt > Date.now() + 60_000
  ) {
    return secrets.accessToken
  }
  if (!secrets.clientId || !secrets.clientSecret || !secrets.refreshToken) {
    throw new AppError('Chưa kết nối Google Drive. Vui lòng kết nối trong phần Cài đặt.', 'BAD_REQUEST')
  }
  const body = new URLSearchParams({
    client_id: secrets.clientId,
    client_secret: secrets.clientSecret,
    refresh_token: secrets.refreshToken,
    grant_type: 'refresh_token'
  })
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new AppError(
      `Phiên Google Drive đã hết hạn hoặc bị thu hồi (${await parseError(response)}). Hãy kết nối lại.`,
      'UNAUTHORIZED'
    )
  }
  const token = (await response.json()) as { access_token: string; expires_in?: number }
  const updated: DriveSecrets = {
    ...secrets,
    accessToken: token.access_token,
    accessTokenExpiresAt: Date.now() + (token.expires_in ?? 3600) * 1000
  }
  writeSecrets(updated)
  return token.access_token
}

async function driveFetch(
  url: string,
  init: RequestInit,
  secrets: DriveSecrets
): Promise<Response> {
  const token = await accessToken(secrets)
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  const response = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    const message = await parseError(response)
    throw new AppError(`Google Drive API lỗi: ${message}`, 'INTERNAL')
  }
  return response
}

async function findOrCreateFolder(secrets: DriveSecrets): Promise<string> {
  if (secrets.folderId) {
    try {
      await driveFetch(
        `${DRIVE_API}/files/${encodeURIComponent(secrets.folderId)}?fields=id,trashed`,
        { method: 'GET' },
        secrets
      )
      return secrets.folderId
    } catch {
      // Thư mục đã bị xóa hoặc không còn quyền truy cập; tạo lại bên dưới.
      delete secrets.folderId
    }
  }

  const query = `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: '10'
  })
  const found = (await (
    await driveFetch(`${DRIVE_API}/files?${params.toString()}`, { method: 'GET' }, secrets)
  ).json()) as { files?: Array<{ id: string }> }
  if (found.files && found.files.length > 0) {
    secrets.folderId = found.files[0].id
    writeSecrets(secrets)
    return secrets.folderId
  }

  const created = (await (
    await driveFetch(
      `${DRIVE_API}/files?fields=id,name`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: DRIVE_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      },
      secrets
    )
  ).json()) as { id: string }
  secrets.folderId = created.id
  writeSecrets(secrets)
  return created.id
}

function multipartBody(metadata: Record<string, unknown>, content: Buffer): {
  body: Buffer
  contentType: string
} {
  const boundary = `manager-device-${randomBytes(12).toString('hex')}`
  const head = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/x-sqlite3\r\n\r\n',
    'utf8'
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  return {
    body: Buffer.concat([head, content, tail]),
    contentType: `multipart/related; boundary=${boundary}`
  }
}

interface DriveFile {
  id: string
  name: string
  size?: string
  createdTime?: string
  modifiedTime?: string
}

export async function uploadBackupFile(
  filePath: string,
  name: string,
  retention = 0
): Promise<BackupEntry> {
  const secrets = readSecrets()
  if (!secrets.refreshToken) {
    throw new AppError('Chưa kết nối Google Drive. Vui lòng kết nối trong phần Cài đặt.', 'BAD_REQUEST')
  }
  const folderId = await findOrCreateFolder(secrets)
  const content = readFileSync(filePath)
  const { body, contentType } = multipartBody(
    { name, parents: [folderId], mimeType: 'application/x-sqlite3' },
    content
  )
  const uploaded = (await (
    await driveFetch(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,createdTime`,
      {
        method: 'POST',
        headers: { 'content-type': contentType },
        body
      },
      secrets
    )
  ).json()) as DriveFile

  secrets.lastSyncAt = new Date().toISOString()
  writeSecrets(secrets)

  const entry: BackupEntry = {
    id: uploaded.id,
    name: uploaded.name ?? name,
    size: Number(uploaded.size ?? content.length),
    createdAt: uploaded.createdTime ?? new Date().toISOString(),
    target: 'drive'
  }
  if (retention > 0) {
    try {
      await pruneDriveBackups(retention)
    } catch {
      // Dọn bản cũ thất bại không ảnh hưởng đến bản vừa tải lên.
    }
  }
  return entry
}

export async function listDriveBackups(): Promise<BackupEntry[]> {
  const secrets = readSecrets()
  if (!secrets.refreshToken) return []
  const folderId = await findOrCreateFolder(secrets)
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and name contains 'manager-device-backup-'`,
    spaces: 'drive',
    fields: 'files(id,name,size,createdTime,modifiedTime)',
    orderBy: 'createdTime desc',
    pageSize: '200'
  })
  const payload = (await (
    await driveFetch(`${DRIVE_API}/files?${params.toString()}`, { method: 'GET' }, secrets)
  ).json()) as { files?: DriveFile[] }
  return (payload.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    size: Number(file.size ?? 0),
    createdAt: file.createdTime ?? file.modifiedTime ?? new Date().toISOString(),
    target: 'drive' as const
  }))
}

export async function deleteDriveBackup(id: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new AppError('Mã tệp Google Drive không hợp lệ.', 'BAD_REQUEST')
  const secrets = readSecrets()
  if (!secrets.refreshToken) {
    throw new AppError('Chưa kết nối Google Drive. Vui lòng kết nối trong phần Cài đặt.', 'BAD_REQUEST')
  }
  await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    secrets
  )
}

export async function downloadDriveBackup(id: string, targetPath: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new AppError('Mã tệp Google Drive không hợp lệ.', 'BAD_REQUEST')
  const secrets = readSecrets()
  if (!secrets.refreshToken) {
    throw new AppError('Chưa kết nối Google Drive. Vui lòng kết nối trong phần Cài đặt.', 'BAD_REQUEST')
  }
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`,
    { method: 'GET' },
    secrets
  )
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(targetPath, buffer)
}

export async function pruneDriveBackups(retention: number): Promise<void> {
  if (retention < 1) return
  const entries = await listDriveBackups()
  for (const entry of entries.slice(retention)) {
    if (entry.id) {
      try {
        await deleteDriveBackup(entry.id)
      } catch {
        // Bỏ qua tệp không xóa được để không chặn bản sao lưu mới.
      }
    }
  }
}
