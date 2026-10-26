import { copyFileSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { dialog, shell } from 'electron'
import type { AssetAttachment, AuthUser } from '../../shared/types'
import { AppError, notFound } from '../lib/errors'
import { getDb } from '../db/database'
import { nowISO } from '../../shared/utils'
import { uploadsDir } from '../lib/paths'
import { logActivity } from './log.service'
import { listAttachments } from './asset.service'

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.zip': 'application/zip'
}

export async function uploadAttachment(assetId: number, user: AuthUser): Promise<AssetAttachment | null> {
  const asset = getDb().prepare('SELECT id, code FROM assets WHERE id = ?').get(assetId) as
    | { id: number; code: string }
    | undefined
  if (!asset) throw notFound('thiết bị')

  const result = await dialog.showOpenDialog({
    title: 'Chọn tệp đính kèm',
    properties: ['openFile'],
    filters: [
      { name: 'Tài liệu và hình ảnh', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip'] },
      { name: 'Tất cả tệp', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const source = result.filePaths[0]
  const ext = extname(source).toLowerCase()
  const storedName = `${randomUUID()}${ext}`
  const target = join(uploadsDir(), storedName)
  copyFileSync(source, target)
  const stats = statSync(target)

  const insert = getDb()
    .prepare(
      `INSERT INTO attachments (asset_id, filename, stored_name, mime_type, size, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      assetId,
      basename(source),
      storedName,
      MIME_MAP[ext] ?? 'application/octet-stream',
      stats.size,
      user.id,
      nowISO()
    )
  logActivity(user, 'Đính kèm tệp', 'asset', assetId, asset.code, basename(source))
  return listAttachments(assetId).find((a) => a.id === Number(insert.lastInsertRowid)) ?? null
}

export async function openAttachment(id: number): Promise<void> {
  const row = getDb().prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
    | { stored_name: string; filename: string }
    | undefined
  if (!row) throw notFound('tệp đính kèm')
  const path = join(uploadsDir(), basename(row.stored_name))
  if (!existsSync(path)) {
    throw new AppError('Tệp đính kèm không còn tồn tại trên máy.', 'NOT_FOUND')
  }
  const error = await shell.openPath(path)
  if (error) throw new AppError(`Không thể mở tệp: ${error}`, 'INTERNAL')
}

export function deleteAttachment(id: number, user: AuthUser): void {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT t.*, a.code AS asset_code FROM attachments t
       JOIN assets a ON a.id = t.asset_id WHERE t.id = ?`
    )
    .get(id) as
    | { stored_name: string; filename: string; asset_id: number; asset_code: string }
    | undefined
  if (!row) throw notFound('tệp đính kèm')
  db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
  const path = join(uploadsDir(), basename(row.stored_name))
  if (existsSync(path)) {
    try {
      unlinkSync(path)
    } catch {
      // bỏ qua
    }
  }
  logActivity(user, 'Xóa tệp đính kèm', 'asset', Number(row.asset_id), row.asset_code, row.filename)
}
