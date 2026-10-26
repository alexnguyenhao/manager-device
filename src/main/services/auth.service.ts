import { compareSync, hashSync } from 'bcryptjs'
import type { AuthUser, Role } from '../../shared/types'
import { AppError, unauthorized } from '../lib/errors'
import { avatarColor, nowISO } from '../../shared/utils'
import { getDb } from '../db/database'
import { logActivity } from './log.service'

let session: AuthUser | null = null

interface UserRow {
  id: number
  username: string
  password_hash: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  is_active: number
  last_login_at: string | null
  created_at: string
  updated_at: string
}

function mapAuthUser(row: UserRow): AuthUser {
  return {
    id: Number(row.id),
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarColor: avatarColor(`${row.username}:${row.full_name}`)
  }
}

export function getSession(): AuthUser | null {
  return session
}

export function setSession(user: AuthUser | null): void {
  session = user
}

export function requireUser(): AuthUser {
  if (!session) throw unauthorized()
  return session
}

export function requireRole(...roles: Role[]): AuthUser {
  const user = requireUser()
  if (!roles.includes(user.role)) {
    throw new AppError('Bạn không có quyền thực hiện thao tác này.', 'FORBIDDEN')
  }
  return user
}

export function login(username: string, password: string): AuthUser {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
    .get(username.trim()) as UserRow | undefined

  if (!row) throw new AppError('Tên đăng nhập hoặc mật khẩu không đúng.', 'UNAUTHORIZED')
  if (!Number(row.is_active)) {
    throw new AppError('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.', 'FORBIDDEN')
  }
  if (!compareSync(password, row.password_hash)) {
    throw new AppError('Tên đăng nhập hoặc mật khẩu không đúng.', 'UNAUTHORIZED')
  }

  const user = mapAuthUser(row)
  const now = nowISO()
  db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    user.id
  )
  session = user
  logActivity(user, 'Đăng nhập hệ thống', 'system', user.id, user.fullName)
  return user
}

export function logout(): void {
  if (session) {
    logActivity(session, 'Đăng xuất hệ thống', 'system', session.id, session.fullName)
  }
  session = null
}

export function me(): AuthUser | null {
  if (!session) return null
  const row = getDb()
    .prepare('SELECT * FROM users WHERE id = ? AND is_active = 1')
    .get(session.id) as UserRow | undefined
  if (!row) {
    session = null
    return null
  }
  session = mapAuthUser(row)
  return session
}

export function changePassword(currentPassword: string, newPassword: string): void {
  const user = requireUser()
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow | undefined
  if (!row) throw unauthorized()
  if (!compareSync(currentPassword, row.password_hash)) {
    throw new AppError('Mật khẩu hiện tại không đúng.', 'BAD_REQUEST')
  }
  if (currentPassword === newPassword) {
    throw new AppError('Mật khẩu mới phải khác mật khẩu hiện tại.', 'BAD_REQUEST')
  }
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashSync(newPassword, 10),
    nowISO(),
    user.id
  )
  logActivity(user, 'Đổi mật khẩu', 'user', user.id, user.fullName)
}

export function updateProfile(data: {
  fullName: string
  email?: string | null
  phone?: string | null
}): AuthUser {
  const user = requireUser()
  const db = getDb()
  db.prepare('UPDATE users SET full_name = ?, email = ?, phone = ?, updated_at = ? WHERE id = ?').run(
    data.fullName,
    data.email ?? null,
    data.phone ?? null,
    nowISO(),
    user.id
  )
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as unknown as UserRow | undefined
  if (!row) throw unauthorized()
  session = mapAuthUser(row)
  logActivity(session, 'Cập nhật hồ sơ cá nhân', 'user', user.id, user.fullName)
  return session
}
