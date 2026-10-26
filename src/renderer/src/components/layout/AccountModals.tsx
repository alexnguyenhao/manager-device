import { useEffect, useState } from 'react'
import { KeyRound, UserCog } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'
import { api, errorMessage } from '../../lib/api'
import { useAuthStore, useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { ROLE_LABELS } from '@shared/constants'
import { Avatar } from '../ui/Avatar'

interface AccountModalsProps {
  open: 'profile' | 'password' | null
  onClose: () => void
}

export function AccountModals({ open, onClose }: AccountModalsProps) {
  const user = useCurrentUser()
  const setUser = useAuthStore((state) => state.setUser)
  const [fullName, setFullName] = useState(user.fullName)
  const [email, setEmail] = useState(user.email ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setFullName(user.fullName)
    setEmail(user.email ?? '')
    setPhone(user.phone ?? '')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
  }, [open, user])

  const saveProfile = async (): Promise<void> => {
    if (fullName.trim().length < 2) {
      setError('Vui lòng nhập họ tên.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await api.auth.updateProfile({
        fullName: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null
      })
      setUser(updated)
      toast.success('Đã cập nhật hồ sơ', 'Thông tin cá nhân của bạn đã được lưu.')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (): Promise<void> => {
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      toast.success('Đã đổi mật khẩu', 'Hãy dùng mật khẩu mới cho lần đăng nhập sau.')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open === 'profile'}
        onClose={onClose}
        title="Hồ sơ cá nhân"
        description="Cập nhật thông tin liên hệ của bạn."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button loading={saving} onClick={saveProfile}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <Avatar name={user.fullName} size="xl" />
          <div>
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {user.username}
            </p>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="ml-auto rounded-xl bg-white px-3 py-2 text-center shadow-sm dark:bg-slate-900">
            <UserCog className="mx-auto h-4 w-4 text-brand-600 dark:text-brand-400" />
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Họ và tên" required htmlFor="profile-name">
            <Input
              id="profile-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="profile-email">
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@congty.vn"
              />
            </Field>
            <Field label="Số điện thoại" htmlFor="profile-phone">
              <Input
                id="profile-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="09xx xxx xxx"
              />
            </Field>
          </div>
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={open === 'password'}
        onClose={onClose}
        title="Đổi mật khẩu"
        description="Mật khẩu mới cần tối thiểu 6 ký tự."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button loading={saving} onClick={savePassword}>
              Đổi mật khẩu
            </Button>
          </>
        }
      >
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-blue-50/70 px-3.5 py-3 text-[12.5px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          <KeyRound className="h-4 w-4 shrink-0" />
          Nên sử dụng mật khẩu mạnh, không dùng lại mật khẩu cũ.
        </div>
        <div className="space-y-4">
          <Field label="Mật khẩu hiện tại" required htmlFor="current-password">
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Mật khẩu mới" required htmlFor="new-password">
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Field label="Xác nhận mật khẩu mới" required htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
