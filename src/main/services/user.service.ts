import { hashSync } from 'bcryptjs'
import type { AuthUser, UserAccount, UserInput } from '../../shared/types'
import { AppError, notFound } from '../lib/errors'
import { avatarColor, nowISO } from '../../shared/utils'
import { getDb } from '../db/database'
import { logActivity } from './log.service'

interface UserRow {
  id: number
  username: string
  password_hash: string
  full_name: string
  email: string | null
  phone: string | null
  role: UserAccount['role']
  is_active: number
  last_login_at: string | null
  created_at: string
  updated_at: string
}

function mapUser(row: UserRow): UserAccount {
  return {
    id: Number(row.id),
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    avatarColor: avatarColor(`${row.username}:${row.full_name}`)
  }
}

export function listUsers(): UserAccount[] {
  const rows = getDb()
    .prepare('SELECT * FROM users ORDER BY CASE role WHEN \'admin\' THEN 0 ELSE 1 END, full_name')
    .all() as unknown as UserRow[]
  return rows.map(mapUser)
}

function assertAdminSafety(targetId: number, nextRole?: string, nextActive?: boolean): void {
  const db = getDb()
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as UserRow | undefined
  if (!target) throw notFound('người dùng')
  if (target.role !== 'admin' || !Number(target.is_active)) return
  const willRemainAdmin = (nextRole ?? target.role) === 'admin' && (nextActive ?? Boolean(target.is_active))
  if (willRemainAdmin) return
  const otherAdmins = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?")
    .get(targetId) as { count: number }
  if (Number(otherAdmins.count) === 0) {
    throw new AppError('Hệ thống phải có ít nhất một quản trị viên đang hoạt động.', 'CONFLICT')
  }
}

export function createUser(data: UserInput, actor: AuthUser): UserAccount {
  const db = getDb()
  const username = data.username.trim()
  const exists = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username)
  if (exists) throw new AppError('Tên đăng nhập đã tồn tại.', 'CONFLICT')
  if (!data.password || data.password.length < 6) {
    throw new AppError('Mật khẩu phải có ít nhất 6 ký tự.', 'BAD_REQUEST')
  }
  const now = nowISO()
  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(
      username,
      hashSync(data.password, 10),
      data.fullName,
      data.email ?? null,
      data.phone ?? null,
      data.role,
      data.isActive === false ? 0 : 1,
      now,
      now
    )
  const id = Number(result.lastInsertRowid)
  logActivity(actor, 'Tạo người dùng', 'user', id, data.fullName, `Vai trò: ${data.role}`)
  return mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow)
}

export function updateUser(id: number, data: UserInput, actor: AuthUser): UserAccount {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!existing) throw notFound('người dùng')
  const username = data.username.trim()
  const duplicate = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ?')
    .get(username, id)
  if (duplicate) throw new AppError('Tên đăng nhập đã tồn tại.', 'CONFLICT')

  const nextActive = data.isActive ?? Boolean(existing.is_active)
  assertAdminSafety(id, data.role, nextActive)

  if (id === actor.id && (!nextActive || data.role !== 'admin')) {
    throw new AppError('Bạn không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập.', 'CONFLICT')
  }

  const now = nowISO()
  if (data.password && data.password.trim().length > 0) {
    if (data.password.length < 6) {
      throw new AppError('Mật khẩu phải có ít nhất 6 ký tự.', 'BAD_REQUEST')
    }
    db.prepare(
      `UPDATE users SET username = ?, password_hash = ?, full_name = ?, email = ?, phone = ?, role = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      username,
      hashSync(data.password, 10),
      data.fullName,
      data.email ?? null,
      data.phone ?? null,
      data.role,
      nextActive ? 1 : 0,
      now,
      id
    )
  } else {
    db.prepare(
      `UPDATE users SET username = ?, full_name = ?, email = ?, phone = ?, role = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      username,
      data.fullName,
      data.email ?? null,
      data.phone ?? null,
      data.role,
      nextActive ? 1 : 0,
      now,
      id
    )
  }
  logActivity(actor, 'Cập nhật người dùng', 'user', id, data.fullName)
  return mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow)
}

export function deleteUser(id: number, actor: AuthUser): void {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!existing) throw notFound('người dùng')
  if (id === actor.id) throw new AppError('Bạn không thể xóa tài khoản đang đăng nhập.', 'CONFLICT')
  assertAdminSafety(id, 'staff', false)
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  logActivity(actor, 'Xóa người dùng', 'user', id, existing.full_name)
}

export function resetPassword(id: number, newPassword: string, actor: AuthUser): void {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!existing) throw notFound('người dùng')
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashSync(newPassword, 10),
    nowISO(),
    id
  )
  logActivity(actor, 'Đặt lại mật khẩu', 'user', id, existing.full_name)
}
