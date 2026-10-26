import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleAlert,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users
} from 'lucide-react'
import type { Department, Employee, EmployeeInput } from '@shared/types'
import { ORG_BLOCK_META, ORG_BLOCK_OPTIONS, hasPermission } from '@shared/constants'
import { formatNumber } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/common/SearchInput'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Switch, Textarea } from '../../components/ui/Input'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { Dropdown, DropdownMenu } from '../../components/ui/Dropdown'
import { Modal } from '../../components/ui/Modal'
import { useConfirm } from '../../components/ui/Confirm'

interface EmployeeFormState {
  code: string
  fullName: string
  email: string
  phone: string
  position: string
  departmentId: string
  note: string
  isActive: boolean
}

const EMPTY: EmployeeFormState = {
  code: '',
  fullName: '',
  email: '',
  phone: '',
  position: '',
  departmentId: '',
  note: '',
  isActive: true
}

export function EmployeesPage() {
  const user = useCurrentUser()
  const confirm = useConfirm()
  const [items, setItems] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [blockFilter, setBlockFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeFormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canWrite = hasPermission(user.role, 'catalog:write')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [employeeList, departmentList] = await Promise.all([
        api.employees.list(),
        api.departments.list()
      ])
      setItems(employeeList)
      setDepartments(departmentList)
    } catch (err) {
      toast.error('Không thể tải danh sách nhân viên', errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      if (blockFilter && item.departmentBlock !== blockFilter) return false
      if (departmentFilter && String(item.departmentId) !== departmentFilter) return false
      if (!term) return true
      return (
        item.fullName.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        (item.email ?? '').toLowerCase().includes(term) ||
        (item.phone ?? '').toLowerCase().includes(term) ||
        (item.position ?? '').toLowerCase().includes(term)
      )
    })
  }, [items, search, departmentFilter, blockFilter])

  const departmentsByBlock = useMemo(
    () =>
      ORG_BLOCK_OPTIONS.map((block) => ({
        block,
        meta: ORG_BLOCK_META[block],
        items: departments.filter((department) => department.block === block)
      })).filter((group) => group.items.length > 0),
    [departments]
  )

  const openCreate = (): void => {
    setEditing(null)
    setForm(EMPTY)
    setError(null)
    setFormOpen(true)
  }

  const openEdit = (employee: Employee): void => {
    setEditing(employee)
    setForm({
      code: employee.code,
      fullName: employee.fullName,
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      position: employee.position ?? '',
      departmentId: employee.departmentId ? String(employee.departmentId) : '',
      note: employee.note ?? '',
      isActive: employee.isActive
    })
    setError(null)
    setFormOpen(true)
  }

  const update = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async (): Promise<void> => {
    if (!form.code.trim()) {
      setError('Vui lòng nhập mã nhân viên.')
      return
    }
    if (form.fullName.trim().length < 2) {
      setError('Vui lòng nhập họ tên nhân viên.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: EmployeeInput & { id?: number } = {
      id: editing?.id,
      code: form.code.trim().toUpperCase(),
      fullName: form.fullName.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      position: form.position.trim() || null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      note: form.note.trim() || null,
      isActive: form.isActive
    }
    try {
      await api.employees.save(payload)
      toast.success(editing ? 'Đã cập nhật nhân viên' : 'Đã thêm nhân viên', form.fullName.trim())
      setFormOpen(false)
      void load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (employee: Employee): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa nhân viên?',
      description: `Nhân viên "${employee.fullName}" sẽ bị xóa khỏi danh sách. Chỉ có thể xóa khi chưa có thiết bị hoặc lịch sử cấp phát liên quan.`,
      confirmText: 'Xóa nhân viên'
    })
    if (!ok) return
    try {
      await api.employees.remove(employee.id)
      toast.success('Đã xóa nhân viên', employee.fullName)
      void load()
    } catch (err) {
      toast.error('Không thể xóa nhân viên', errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Nhân viên"
        description="Danh sách người sử dụng thiết bị, phục vụ cấp phát và kiểm kê."
        icon={<Users className="h-5 w-5" />}
        meta={<Badge tone="info">{formatNumber(items.length)} nhân viên</Badge>}
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Thêm nhân viên
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm theo tên, mã, email, số điện thoại…"
            className="sm:w-[320px]"
          />
          <Select
            value={blockFilter}
            onChange={(event) => {
              setBlockFilter(event.target.value)
              setDepartmentFilter('')
            }}
            className="sm:w-[190px]"
            aria-label="Lọc theo khối"
          >
            <option value="">Tất cả các khối</option>
            {ORG_BLOCK_OPTIONS.map((block) => (
              <option key={block} value={block}>
                {ORG_BLOCK_META[block].label}
              </option>
            ))}
          </Select>
          <Select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="sm:w-[240px]"
            aria-label="Lọc theo phòng ban"
          >
            <option value="">Tất cả phòng ban</option>
            {departmentsByBlock
              .filter((group) => !blockFilter || group.block === blockFilter)
              .map((group) => (
                <optgroup key={group.block} label={group.meta.label}>
                  {group.items.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </Select>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <Spinner className="py-24" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={search || departmentFilter || blockFilter ? 'Không tìm thấy nhân viên' : 'Chưa có nhân viên'}
            description={
              search || departmentFilter || blockFilter
                ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                : 'Thêm nhân viên để bắt đầu cấp phát thiết bị.'
            }
            action={
              canWrite && !search && !departmentFilter && !blockFilter ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Thêm nhân viên
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Chức vụ</th>
                <th>Phòng ban</th>
                <th>Khối</th>
                <th>Liên hệ</th>
                <th>Thiết bị</th>
                <th>Trạng thái</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                          {employee.fullName}
                        </p>
                        <p className="font-mono text-[10.5px] text-slate-400">{employee.code}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-[12px] text-slate-600 dark:text-slate-300">
                      {employee.position ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className="text-[12px] text-slate-600 dark:text-slate-300">
                      {employee.departmentName ?? '—'}
                    </span>
                  </td>
                  <td>
                    {employee.departmentBlock ? (
                      <Badge tone={ORG_BLOCK_META[employee.departmentBlock].tone}>
                        {ORG_BLOCK_META[employee.departmentBlock].shortLabel}
                      </Badge>
                    ) : (
                      <span className="text-[12px] text-slate-400">—</span>
                    )}
                  </td>
                  <td>
                    {employee.email && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <Mail className="h-3 w-3 text-slate-400" /> {employee.email}
                      </p>
                    )}
                    {employee.phone && (
                      <p className="flex items-center gap-1 text-[10.5px] text-slate-400">
                        <Phone className="h-2.5 w-2.5" /> {employee.phone}
                      </p>
                    )}
                    {!employee.email && !employee.phone && <span className="text-[12px] text-slate-400">—</span>}
                  </td>
                  <td>
                    <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                      {employee.assetCount ?? 0}
                    </span>
                  </td>
                  <td>
                    <Badge tone={employee.isActive ? 'success' : 'neutral'} dot>
                      {employee.isActive ? 'Đang làm' : 'Đã nghỉ'}
                    </Badge>
                  </td>
                  <td>
                    <Dropdown
                      width={190}
                      trigger={
                        <span className="icon-btn">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      }
                      ariaLabel={`Thao tác ${employee.fullName}`}
                    >
                      {(close) => (
                        <DropdownMenu
                          close={close}
                          items={[
                            {
                              label: 'Chỉnh sửa',
                              icon: <Pencil className="h-4 w-4" />,
                              onClick: () => openEdit(employee),
                              disabled: !canWrite
                            },
                            {
                              label: 'Xóa nhân viên',
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              dividerBefore: true,
                              onClick: () => void remove(employee),
                              disabled: !canWrite
                            }
                          ]}
                        />
                      )}
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="lg"
        title={editing ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}
        description="Thông tin nhân viên dùng khi cấp phát và kiểm kê thiết bị."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void submit()}>
              {editing ? 'Lưu thay đổi' : 'Thêm nhân viên'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Mã nhân viên" required htmlFor="emp-code">
              <Input
                id="emp-code"
                value={form.code}
                placeholder="NV001"
                className="font-mono uppercase"
                onChange={(event) => update('code', event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Họ và tên" required htmlFor="emp-name">
              <Input
                id="emp-name"
                value={form.fullName}
                placeholder="Nguyễn Văn A"
                onChange={(event) => update('fullName', event.target.value)}
              />
            </Field>
            <Field label="Chức vụ" htmlFor="emp-position">
              <Input
                id="emp-position"
                value={form.position}
                placeholder="Chuyên viên CNTT"
                onChange={(event) => update('position', event.target.value)}
              />
            </Field>
            <Field label="Phòng ban" htmlFor="emp-department">
              <Select
                id="emp-department"
                value={form.departmentId}
                onChange={(event) => update('departmentId', event.target.value)}
              >
                <option value="">Chưa phân phòng ban</option>
                {departmentsByBlock.map((group) => (
                  <optgroup key={group.block} label={group.meta.label}>
                    {group.items.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Email" htmlFor="emp-email">
              <Input
                id="emp-email"
                type="email"
                value={form.email}
                placeholder="email@congty.vn"
                onChange={(event) => update('email', event.target.value)}
              />
            </Field>
            <Field label="Số điện thoại" htmlFor="emp-phone">
              <Input
                id="emp-phone"
                value={form.phone}
                placeholder="09xx xxx xxx"
                onChange={(event) => update('phone', event.target.value)}
              />
            </Field>
            <Field label="Ghi chú" className="sm:col-span-2" htmlFor="emp-note">
              <Textarea
                id="emp-note"
                value={form.note}
                placeholder="Ghi chú về nhân viên…"
                onChange={(event) => update('note', event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Switch
                checked={form.isActive}
                onChange={(checked) => update('isActive', checked)}
                label="Đang làm việc"
                description="Nhân viên đã nghỉ sẽ không thể nhận thiết bị mới."
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
