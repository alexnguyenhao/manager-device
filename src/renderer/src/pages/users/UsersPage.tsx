import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCog,
  Users
} from 'lucide-react'
import type { Role, UserAccount, UserInput } from '@shared/types'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Tone } from '@shared/constants'
import { formatDateTime, formatNumber, relativeTime } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useAuthStore, useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/common/SearchInput'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Switch } from '../../components/ui/Input'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { Dropdown, DropdownMenu, type MenuItem } from '../../components/ui/Dropdown'
import { Modal } from '../../components/ui/Modal'
import { useConfirm } from '../../components/ui/Confirm'

const ROLE_TONE: Record<Role, Tone> = {
  admin: 'purple',
  manager: 'info',
  staff: 'teal',
  viewer: 'neutral'
}

const ROLE_ORDER: Role[] = ['admin', 'manager', 'staff', 'viewer']

interface UserFormState {
  username: string
  fullName: string
  email: string
  phone: string
  role: Role
  password: string
  isActive: boolean
}

function emptyForm(): UserFormState {
  return {
    username: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'staff',
    password: '',
    isActive: true
  }
}

function toForm(user: UserAccount): UserFormState {
  return {
    username: user.username,
    fullName: user.fullName,
    email: user.email ?? '',
    phone: user.phone ?? '',
    role: user.role,
    password: '',
    isActive: user.isActive
  }
}

export function UsersPage() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const setUser = useAuthStore((state) => state.setUser)
  const confirm = useConfirm()

  const [items, setItems] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [form, setForm] = useState<UserFormState>(emptyForm)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [resetting, setResetting] = useState<UserAccount | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSaving, setResetSaving] = useState(false)

  const isAdmin = currentUser.role === 'admin'

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setItems(await api.users.list())
    } catch (error) {
      toast.error('Không thể tải danh sách người dùng', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      if (roleFilter !== 'all' && item.role !== roleFilter) return false
      if (!term) return true
      return [item.username, item.fullName, item.email, item.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [items, roleFilter, search])

  const counts = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((item) => item.isActive).length,
      admin: items.filter((item) => item.role === 'admin').length,
      manager: items.filter((item) => item.role === 'manager').length
    }
  }, [items])

  const openCreate = (): void => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setShowPassword(false)
    setFormOpen(true)
  }

  const openEdit = (user: UserAccount): void => {
    setEditing(user)
    setForm(toForm(user))
    setFormError(null)
    setShowPassword(false)
    setFormOpen(true)
  }

  const update = <K extends keyof UserFormState>(key: K, value: UserFormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async (): Promise<void> => {
    const username = form.username.trim()
    const fullName = form.fullName.trim()
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
      setFormError('Tên đăng nhập phải từ 3 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.')
      return
    }
    if (fullName.length < 2) {
      setFormError('Vui lòng nhập họ tên người dùng.')
      return
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Địa chỉ email không hợp lệ.')
      return
    }
    if (!editing && form.password.length < 6) {
      setFormError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (editing && form.password.length > 0 && form.password.length < 6) {
      setFormError('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }

    const payload: UserInput = {
      username,
      fullName,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      isActive: form.isActive,
      ...(form.password ? { password: form.password } : {})
    }

    setSaving(true)
    setFormError(null)
    try {
      const saved = editing
        ? await api.users.update(editing.id, payload)
        : await api.users.create(payload)
      if (saved.id === currentUser.id) setUser(saved)
      toast.success(
        editing ? 'Đã cập nhật người dùng' : 'Đã tạo người dùng',
        `${saved.fullName} · ${ROLE_LABELS[saved.role]}`
      )
      setFormOpen(false)
      void load()
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const openReset = (user: UserAccount): void => {
    setResetting(user)
    setNewPassword('')
    setConfirmPassword('')
    setResetError(null)
  }

  const submitReset = async (): Promise<void> => {
    if (!resetting) return
    if (newPassword.length < 6) {
      setResetError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('Mật khẩu nhập lại không khớp.')
      return
    }
    setResetSaving(true)
    setResetError(null)
    try {
      await api.users.resetPassword(resetting.id, newPassword)
      toast.success('Đã đặt lại mật khẩu', `${resetting.fullName} (@${resetting.username})`)
      setResetting(null)
    } catch (error) {
      setResetError(errorMessage(error))
    } finally {
      setResetSaving(false)
    }
  }

  const remove = async (user: UserAccount): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa người dùng?',
      description: `Tài khoản "${user.fullName}" (@${user.username}) sẽ bị xóa vĩnh viễn. Lịch sử hoạt động của người dùng vẫn được giữ lại.`,
      confirmText: 'Xóa người dùng'
    })
    if (!ok) return
    try {
      await api.users.remove(user.id)
      toast.success('Đã xóa người dùng', user.fullName)
      void load()
    } catch (error) {
      toast.error('Không thể xóa người dùng', errorMessage(error))
    }
  }

  const toggleActive = async (user: UserAccount): Promise<void> => {
    const nextActive = !user.isActive
    const ok = await confirm({
      title: nextActive ? 'Kích hoạt tài khoản?' : 'Khóa tài khoản?',
      description: nextActive
        ? `${user.fullName} sẽ có thể đăng nhập và sử dụng hệ thống với vai trò ${ROLE_LABELS[user.role]}.`
        : `${user.fullName} sẽ không thể đăng nhập cho đến khi được kích hoạt lại.`,
      confirmText: nextActive ? 'Kích hoạt' : 'Khóa tài khoản',
      variant: nextActive ? 'primary' : 'danger'
    })
    if (!ok) return
    try {
      const saved = await api.users.update(user.id, {
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: nextActive
      })
      if (saved.id === currentUser.id) setUser(saved)
      toast.success(nextActive ? 'Đã kích hoạt tài khoản' : 'Đã khóa tài khoản', user.fullName)
      void load()
    } catch (error) {
      toast.error('Không thể cập nhật tài khoản', errorMessage(error))
    }
  }

  if (!isAdmin) {
    return (
      <div className="table-wrap">
        <EmptyState
          icon={<ShieldOff className="h-6 w-6" />}
          title="Không có quyền truy cập"
          description="Chỉ quản trị viên mới có thể quản lý người dùng và phân quyền hệ thống."
          action={<Button onClick={() => navigate('/')}>Về bảng điều khiển</Button>}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Người dùng & phân quyền"
        description="Quản lý tài khoản đăng nhập, vai trò và trạng thái hoạt động của từng người dùng."
        icon={<ShieldCheck className="h-5 w-5" />}
        meta={
          <>
            <Badge tone="info">{formatNumber(counts.total)} tài khoản</Badge>
            <Badge tone="success">{formatNumber(counts.active)} đang hoạt động</Badge>
            <Badge tone="purple">{formatNumber(counts.admin)} quản trị viên</Badge>
          </>
        }
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Thêm người dùng
          </Button>
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm theo tên, tên đăng nhập, email…"
            className="sm:w-[360px]"
          />
          <Select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as 'all' | Role)}
            aria-label="Lọc theo vai trò"
            className="sm:w-[200px]"
          >
            <option value="all">Tất cả vai trò</option>
            {ROLE_ORDER.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
          <p className="text-[11.5px] text-slate-400 sm:ml-auto">
            <Search className="mr-1 inline h-3 w-3" />
            {formatNumber(filtered.length)} / {formatNumber(items.length)} người dùng
          </p>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <Spinner className="py-24" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={items.length === 0 ? 'Chưa có người dùng' : 'Không tìm thấy người dùng'}
            description={
              items.length === 0
                ? 'Tạo tài khoản đầu tiên để cấp quyền sử dụng hệ thống.'
                : 'Thử thay đổi từ khóa hoặc bộ lọc vai trò.'
            }
            action={
              items.length === 0 ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Thêm người dùng
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Liên hệ</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Đăng nhập gần nhất</th>
                <th>Ngày tạo</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isSelf = item.id === currentUser.id
                const actions: MenuItem[] = [
                  {
                    label: 'Chỉnh sửa tài khoản',
                    icon: <Pencil className="h-4 w-4" />,
                    onClick: () => openEdit(item)
                  },
                  {
                    label: 'Đặt lại mật khẩu',
                    icon: <KeyRound className="h-4 w-4" />,
                    onClick: () => openReset(item)
                  },
                  {
                    label: item.isActive ? 'Khóa tài khoản' : 'Kích hoạt tài khoản',
                    icon: item.isActive ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />,
                    onClick: () => void toggleActive(item),
                    disabled: isSelf
                  },
                  {
                    label: 'Xóa tài khoản',
                    icon: <Trash2 className="h-4 w-4" />,
                    danger: true,
                    dividerBefore: true,
                    onClick: () => void remove(item),
                    disabled: isSelf
                  }
                ]

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={item.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                            {item.fullName}
                            {isSelf && (
                              <span className="rounded bg-brand-50 px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                                Bạn
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[10.5px] text-slate-400">@{item.username}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="max-w-[200px] truncate text-[12px] text-slate-600 dark:text-slate-300">
                        {item.email ?? '—'}
                      </p>
                      <p className="text-[10.5px] text-slate-400">{item.phone ?? ''}</p>
                    </td>
                    <td>
                      <Badge tone={ROLE_TONE[item.role]}>{ROLE_LABELS[item.role]}</Badge>
                      <p className="mt-0.5 max-w-[170px] truncate text-[10.5px] text-slate-400">
                        {ROLE_DESCRIPTIONS[item.role]}
                      </p>
                    </td>
                    <td>
                      <Badge tone={item.isActive ? 'success' : 'neutral'} dot>
                        {item.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                      </Badge>
                    </td>
                    <td>
                      <p className="text-[12px] text-slate-600 dark:text-slate-300">
                        {item.lastLoginAt ? relativeTime(item.lastLoginAt) : 'Chưa đăng nhập'}
                      </p>
                      <p className="text-[10.5px] text-slate-400">
                        {item.lastLoginAt ? formatDateTime(item.lastLoginAt) : ''}
                      </p>
                    </td>
                    <td>
                      <span className="text-[12px] text-slate-600 dark:text-slate-300">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </td>
                    <td>
                      <Dropdown
                        width={225}
                        trigger={
                          <span className="icon-btn">
                            <MoreHorizontal className="h-4 w-4" />
                          </span>
                        }
                        ariaLabel={`Thao tác ${item.fullName}`}
                      >
                        {(close) => <DropdownMenu items={actions} close={close} />}
                      </Dropdown>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 text-[11.5px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
          Hệ thống luôn phải có ít nhất một quản trị viên đang hoạt động. Bạn không thể tự khóa, hạ quyền
          hoặc xóa tài khoản đang đăng nhập.
        </span>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="lg"
        title={editing ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'}
        description={
          editing
            ? 'Cập nhật thông tin, vai trò và trạng thái tài khoản.'
            : 'Tạo tài khoản mới và cấp quyền truy cập hệ thống.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void submit()}>
              {editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Tên đăng nhập" required htmlFor="user-username">
              <Input
                id="user-username"
                value={form.username}
                placeholder="nguyen.van.a"
                autoComplete="off"
                className="font-mono"
                onChange={(event) => update('username', event.target.value.toLowerCase())}
              />
            </Field>
            <Field label="Họ và tên" required htmlFor="user-fullname">
              <Input
                id="user-fullname"
                value={form.fullName}
                placeholder="Nguyễn Văn A"
                onChange={(event) => update('fullName', event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="user-email">
              <Input
                id="user-email"
                type="email"
                value={form.email}
                placeholder="a.nguyen@congty.vn"
                onChange={(event) => update('email', event.target.value)}
              />
            </Field>
            <Field label="Số điện thoại" htmlFor="user-phone">
              <Input
                id="user-phone"
                value={form.phone}
                placeholder="09xx xxx xxx"
                onChange={(event) => update('phone', event.target.value)}
              />
            </Field>
            <Field
              label={editing ? 'Mật khẩu mới (không bắt buộc)' : 'Mật khẩu'}
              required={!editing}
              hint={editing ? 'Để trống nếu không muốn thay đổi mật khẩu.' : 'Tối thiểu 6 ký tự.'}
              htmlFor="user-password"
            >
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  placeholder={editing ? '••••••••' : 'Tối thiểu 6 ký tự'}
                  autoComplete="new-password"
                  className="pr-10"
                  onChange={(event) => update('password', event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field
              label="Vai trò"
              required
              hint={ROLE_DESCRIPTIONS[form.role]}
              htmlFor="user-role"
            >
              <Select
                id="user-role"
                value={form.role}
                onChange={(event) => update('role', event.target.value as Role)}
              >
                {ROLE_ORDER.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Switch
                checked={form.isActive}
                onChange={(checked) => update('isActive', checked)}
                label="Tài khoản đang hoạt động"
                description="Tài khoản bị khóa sẽ không thể đăng nhập vào hệ thống."
                disabled={editing?.id === currentUser.id}
              />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/30">
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              <UserCog className="h-3.5 w-3.5" /> Quyền hạn theo vai trò
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              {ROLE_DESCRIPTIONS[form.role]}
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetting)}
        onClose={() => setResetting(null)}
        size="sm"
        title="Đặt lại mật khẩu"
        description={
          resetting
            ? `Tạo mật khẩu mới cho ${resetting.fullName} (@${resetting.username}).`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setResetting(null)} disabled={resetSaving}>
              Hủy
            </Button>
            <Button
              leftIcon={<KeyRound className="h-4 w-4" />}
              loading={resetSaving}
              onClick={() => void submitReset()}
            >
              Đặt lại mật khẩu
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          {resetError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {resetError}
            </div>
          )}
          <Field label="Mật khẩu mới" required htmlFor="reset-password" hint="Tối thiểu 6 ký tự.">
            <Input
              id="reset-password"
              type="password"
              value={newPassword}
              autoFocus
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Field label="Nhập lại mật khẩu" required htmlFor="reset-confirm">
            <Input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
          <p className="text-[11.5px] leading-relaxed text-slate-400">
            Người dùng sẽ cần sử dụng mật khẩu mới ở lần đăng nhập tiếp theo. Hãy thông báo mật khẩu
            cho họ qua kênh an toàn.
          </p>
        </div>
      </Modal>
    </div>
  )
}
