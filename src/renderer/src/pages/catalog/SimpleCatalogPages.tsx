import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  CircleAlert,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Truck
} from 'lucide-react'
import type { Department, Location, Supplier } from '@shared/types'
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

type CatalogKind = 'departments' | 'locations' | 'suppliers'
type CatalogItem = Department | Location | Supplier

interface CatalogField {
  key: string
  label: string
  placeholder?: string
  hint?: string
  required?: boolean
  uppercase?: boolean
  type?: 'text' | 'email' | 'textarea' | 'switch' | 'select'
  options?: Array<{ value: string; label: string }>
  full?: boolean
}

interface CatalogColumn {
  header: string
  width?: string
  render: (item: CatalogItem) => ReactNode
}

interface SimpleCatalogConfig {
  title: string
  description: string
  icon: LucideIcon
  singular: string
  kind: CatalogKind
  searchPlaceholder: string
  searchText: (item: CatalogItem) => string
  columns: CatalogColumn[]
  fields: CatalogField[]
  deleteDescription: (item: CatalogItem) => string
  emptyDescription: string
  filter?: {
    key: string
    label: string
    options: Array<{ value: string; label: string }>
  }
}

type FormValues = Record<string, string | boolean>

async function listItems(kind: CatalogKind): Promise<CatalogItem[]> {
  if (kind === 'departments') return api.departments.list()
  if (kind === 'locations') return api.locations.list()
  return api.suppliers.list()
}

async function saveItem(
  kind: CatalogKind,
  payload: Record<string, unknown>
): Promise<unknown> {
  if (kind === 'departments') return api.departments.save(payload as never)
  if (kind === 'locations') return api.locations.save(payload as never)
  return api.suppliers.save(payload as never)
}

async function removeItem(kind: CatalogKind, id: number): Promise<void> {
  if (kind === 'departments') return api.departments.remove(id)
  if (kind === 'locations') return api.locations.remove(id)
  return api.suppliers.remove(id)
}

function buildDefaults(fields: CatalogField[]): FormValues {
  const values: FormValues = {}
  for (const field of fields) values[field.key] = field.type === 'switch' ? true : ''
  return values
}

function SimpleCatalogPage({ config }: { config: SimpleCatalogConfig }) {
  const user = useCurrentUser()
  const confirm = useConfirm()
  const Icon = config.icon
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [values, setValues] = useState<FormValues>(() => buildDefaults(config.fields))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canWrite = hasPermission(user.role, 'catalog:write')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listItems(config.kind))
    } catch (err) {
      toast.error(`Không thể tải ${config.singular.toLowerCase()}`, errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [config.kind, config.singular])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      if (config.filter && filterValue) {
        const value = (item as unknown as Record<string, unknown>)[config.filter.key]
        if (String(value) !== filterValue) return false
      }
      if (!term) return true
      return config.searchText(item).toLowerCase().includes(term)
    })
  }, [items, search, filterValue, config])

  const openCreate = (): void => {
    setEditing(null)
    setValues(buildDefaults(config.fields))
    setError(null)
    setFormOpen(true)
  }

  const openEdit = (item: CatalogItem): void => {
    const next = buildDefaults(config.fields)
    for (const field of config.fields) {
      const value = (item as unknown as Record<string, unknown>)[field.key]
      if (field.type === 'switch') next[field.key] = Boolean(value)
      else next[field.key] = value == null ? '' : String(value)
    }
    setEditing(item)
    setValues(next)
    setError(null)
    setFormOpen(true)
  }

  const submit = async (): Promise<void> => {
    for (const field of config.fields) {
      if (!field.required) continue
      const value = values[field.key]
      if (typeof value !== 'string' || !value.trim()) {
        setError(`Vui lòng nhập ${field.label.toLowerCase()}.`)
        return
      }
    }
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = { id: editing?.id }
    for (const field of config.fields) {
      if (field.type === 'switch') {
        payload[field.key] = Boolean(values[field.key])
      } else {
        const raw = String(values[field.key] ?? '').trim()
        payload[field.key] = raw ? (field.uppercase ? raw.toUpperCase() : raw) : null
      }
    }
    try {
      await saveItem(config.kind, payload)
      toast.success(
        editing ? `Đã cập nhật ${config.singular.toLowerCase()}` : `Đã thêm ${config.singular.toLowerCase()}`,
        String(values.name ?? values.fullName ?? '')
      )
      setFormOpen(false)
      void load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: CatalogItem): Promise<void> => {
    const ok = await confirm({
      title: `Xóa ${config.singular.toLowerCase()}?`,
      description: config.deleteDescription(item),
      confirmText: `Xóa ${config.singular.toLowerCase()}`
    })
    if (!ok) return
    try {
      await removeItem(config.kind, item.id)
      toast.success(`Đã xóa ${config.singular.toLowerCase()}`)
      void load()
    } catch (err) {
      toast.error(`Không thể xóa ${config.singular.toLowerCase()}`, errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        icon={<Icon className="h-5 w-5" />}
        meta={<Badge tone="info">{formatNumber(items.length)} bản ghi</Badge>}
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Thêm {config.singular.toLowerCase()}
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={config.searchPlaceholder}
            className="sm:w-[360px]"
          />
          {config.filter && (
            <Select
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              className="sm:w-[220px]"
              aria-label={config.filter.label}
            >
              <option value="">{config.filter.label}</option>
              {config.filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <Spinner className="py-24" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Icon className="h-6 w-6" />}
            title={search ? `Không tìm thấy ${config.singular.toLowerCase()}` : `Chưa có ${config.singular.toLowerCase()}`}
            description={search ? 'Thử từ khóa khác.' : config.emptyDescription}
            action={
              canWrite && !search ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Thêm {config.singular.toLowerCase()}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.header} style={column.width ? { width: column.width } : undefined}>
                    {column.header}
                  </th>
                ))}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  {config.columns.map((column) => (
                    <td key={column.header}>{column.render(item)}</td>
                  ))}
                  <td>
                    <Dropdown
                      width={190}
                      trigger={
                        <span className="icon-btn">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      }
                      ariaLabel={`Thao tác ${(item as unknown as Record<string, string>).name}`}
                    >
                      {(close) => (
                        <DropdownMenu
                          close={close}
                          items={[
                            {
                              label: 'Chỉnh sửa',
                              icon: <Pencil className="h-4 w-4" />,
                              onClick: () => openEdit(item),
                              disabled: !canWrite
                            },
                            {
                              label: 'Xóa',
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              dividerBefore: true,
                              onClick: () => void remove(item),
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
        title={
          editing
            ? `Chỉnh sửa ${config.singular.toLowerCase()}`
            : `Thêm ${config.singular.toLowerCase()}`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void submit()}>
              {editing ? 'Lưu thay đổi' : `Thêm ${config.singular.toLowerCase()}`}
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
            {config.fields.map((field) => {
              if (field.type === 'switch') {
                return (
                  <div key={field.key} className="sm:col-span-2">
                    <Switch
                      checked={Boolean(values[field.key])}
                      onChange={(checked) =>
                        setValues((prev) => ({ ...prev, [field.key]: checked }))
                      }
                      label={field.label}
                      description={field.hint}
                    />
                  </div>
                )
              }
              if (field.type === 'select') {
                return (
                  <Field
                    key={field.key}
                    label={field.label}
                    required={field.required}
                    hint={field.hint}
                    htmlFor={`catalog-${field.key}`}
                  >
                    <Select
                      id={`catalog-${field.key}`}
                      value={String(values[field.key] ?? '')}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                    >
                      <option value="">Chọn {field.label.toLowerCase()}</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )
              }
              return (
                <Field
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  hint={field.hint}
                  className={field.full || field.type === 'textarea' ? 'sm:col-span-2' : undefined}
                  htmlFor={`catalog-${field.key}`}
                >
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={`catalog-${field.key}`}
                      value={String(values[field.key] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      id={`catalog-${field.key}`}
                      type={field.type === 'email' ? 'email' : 'text'}
                      value={String(values[field.key] ?? '')}
                      placeholder={field.placeholder}
                      className={field.uppercase ? 'font-mono uppercase' : undefined}
                      onChange={(event) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.key]: field.uppercase
                            ? event.target.value.toUpperCase()
                            : event.target.value
                        }))
                      }
                    />
                  )}
                </Field>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

const DEPARTMENT_CONFIG: SimpleCatalogConfig = {
  title: 'Cơ cấu tổ chức',
  description: 'Quản lý phòng ban, đơn vị thuộc Khối Đảng và Khối Nhà nước của xã.',
  icon: Building2,
  singular: 'Đơn vị',
  kind: 'departments',
  searchPlaceholder: 'Tìm theo tên, mã, người quản lý…',
  searchText: (item) => {
    const department = item as Department
    return [
      department.name,
      department.code,
      department.managerName,
      department.phone,
      ORG_BLOCK_META[department.block]?.label
    ]
      .filter(Boolean)
      .join(' ')
  },
  filter: {
    key: 'block',
    label: 'Tất cả các khối',
    options: ORG_BLOCK_OPTIONS.map((block) => ({
      value: block,
      label: ORG_BLOCK_META[block].label
    }))
  },
  fields: [
    { key: 'code', label: 'Mã phòng ban', required: true, uppercase: true, placeholder: 'VP' },
    { key: 'name', label: 'Tên phòng ban, đơn vị', required: true, placeholder: 'Văn phòng HĐND và UBND' },
    {
      key: 'block',
      label: 'Khối cơ quan',
      type: 'select',
      required: true,
      hint: 'Khối Đảng hoặc Khối Nhà nước',
      options: ORG_BLOCK_OPTIONS.map((block) => ({
        value: block,
        label: ORG_BLOCK_META[block].label
      }))
    },
    { key: 'managerName', label: 'Người phụ trách', placeholder: 'Trưởng phòng' },
    { key: 'phone', label: 'Số điện thoại', placeholder: '0229 xxxx xxx' },
    { key: 'description', label: 'Mô tả', type: 'textarea', placeholder: 'Chức năng, nhiệm vụ của phòng ban, đơn vị…' },
    {
      key: 'isActive',
      label: 'Đang hoạt động',
      type: 'switch',
      hint: 'Đơn vị ngừng hoạt động sẽ không được chọn khi cấp phát thiết bị.'
    }
  ],
  columns: [
    {
      header: 'Phòng ban, đơn vị',
      render: (item) => {
        const department = item as Department
        return (
          <>
            <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{department.name}</p>
            <p className="font-mono text-[10.5px] text-slate-400">{department.code}</p>
          </>
        )
      }
    },
    {
      header: 'Khối',
      render: (item) => {
        const block = (item as Department).block
        const meta = ORG_BLOCK_META[block] ?? ORG_BLOCK_META.state
        return <Badge tone={meta.tone}>{meta.label}</Badge>
      }
    },
    {
      header: 'Người phụ trách',
      render: (item) => {
        const department = item as Department
        return (
          <>
            <p className="text-[12px] text-slate-600 dark:text-slate-300">{department.managerName ?? '—'}</p>
            <p className="text-[10.5px] text-slate-400">{department.phone ?? ''}</p>
          </>
        )
      }
    },
    {
      header: 'Nhân viên',
      render: (item) => (
        <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
          {(item as Department).employeeCount ?? 0}
        </span>
      )
    },
    {
      header: 'Thiết bị',
      render: (item) => (
        <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
          {(item as Department).assetCount ?? 0}
        </span>
      )
    },
    {
      header: 'Trạng thái',
      render: (item) => (
        <Badge tone={item.isActive ? 'success' : 'neutral'} dot>
          {item.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
        </Badge>
      )
    }
  ],
  deleteDescription: (item) =>
    `Đơn vị "${(item as Department).name}" sẽ bị xóa. Chỉ có thể xóa khi chưa có nhân viên hoặc thiết bị trực thuộc.`,
  emptyDescription: 'Thêm phòng ban, đơn vị để phân chia tài sản theo cơ cấu tổ chức.'
}

const LOCATION_CONFIG: SimpleCatalogConfig = {
  title: 'Vị trí',
  description: 'Quản lý địa điểm, phòng ban và khu vực đặt thiết bị.',
  icon: MapPin,
  singular: 'Vị trí',
  kind: 'locations',
  searchPlaceholder: 'Tìm theo tên, tòa nhà, phòng…',
  searchText: (item) => {
    const location = item as Location
    return [
      location.name,
      location.code,
      location.building,
      location.floor,
      location.room,
      location.address
    ]
      .filter(Boolean)
      .join(' ')
  },
  fields: [
    { key: 'code', label: 'Mã vị trí', required: true, uppercase: true, placeholder: 'P301' },
    { key: 'name', label: 'Tên vị trí', required: true, placeholder: 'Phòng 301 - Tầng 3' },
    { key: 'building', label: 'Tòa nhà', placeholder: 'Tòa A' },
    { key: 'floor', label: 'Tầng', placeholder: '3' },
    { key: 'room', label: 'Phòng', placeholder: '301' },
    { key: 'address', label: 'Địa chỉ', placeholder: 'Số 1, đường ABC, quận XYZ' },
    { key: 'note', label: 'Ghi chú', type: 'textarea', placeholder: 'Ghi chú về vị trí, cách tiếp cận…' },
    { key: 'isActive', label: 'Đang sử dụng', type: 'switch', hint: 'Vị trí ngừng sử dụng sẽ không xuất hiện khi thêm thiết bị.' }
  ],
  columns: [
    {
      header: 'Vị trí',
      render: (item) => {
        const location = item as Location
        return (
          <>
            <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{location.name}</p>
            <p className="font-mono text-[10.5px] text-slate-400">{location.code}</p>
          </>
        )
      }
    },
    {
      header: 'Tòa nhà / Tầng / Phòng',
      render: (item) => {
        const location = item as Location
        return (
          <>
            <p className="text-[12px] text-slate-600 dark:text-slate-300">
              {[location.building, location.floor ? `Tầng ${location.floor}` : null, location.room]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            <p className="max-w-[220px] truncate text-[10.5px] text-slate-400">{location.address ?? ''}</p>
          </>
        )
      }
    },
    {
      header: 'Thiết bị',
      render: (item) => (
        <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
          {(item as Location).assetCount ?? 0}
        </span>
      )
    },
    {
      header: 'Trạng thái',
      render: (item) => (
        <Badge tone={item.isActive ? 'success' : 'neutral'} dot>
          {item.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
        </Badge>
      )
    }
  ],
  deleteDescription: (item) =>
    `Vị trí "${(item as Location).name}" sẽ bị xóa. Chỉ có thể xóa khi chưa có thiết bị được đặt tại đây.`,
  emptyDescription: 'Thêm vị trí để theo dõi nơi đặt thiết bị.'
}

const SUPPLIER_CONFIG: SimpleCatalogConfig = {
  title: 'Nhà cung cấp',
  description: 'Quản lý đơn vị bán thiết bị, bảo hành và cung cấp dịch vụ.',
  icon: Truck,
  singular: 'Nhà cung cấp',
  kind: 'suppliers',
  searchPlaceholder: 'Tìm theo tên, người liên hệ, mã số thuế…',
  searchText: (item) => {
    const supplier = item as Supplier
    return [
      supplier.name,
      supplier.code,
      supplier.contactName,
      supplier.phone,
      supplier.email,
      supplier.taxCode
    ]
      .filter(Boolean)
      .join(' ')
  },
  fields: [
    { key: 'code', label: 'Mã nhà cung cấp', required: true, uppercase: true, placeholder: 'NCC001' },
    { key: 'name', label: 'Tên nhà cung cấp', required: true, placeholder: 'Công ty TNHH ABC' },
    { key: 'contactName', label: 'Người liên hệ', placeholder: 'Nguyễn Văn B' },
    { key: 'phone', label: 'Số điện thoại', placeholder: '09xx xxx xxx' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'lienhe@abc.vn' },
    { key: 'taxCode', label: 'Mã số thuế', placeholder: '0101234567' },
    { key: 'website', label: 'Website', placeholder: 'https://abc.vn' },
    { key: 'address', label: 'Địa chỉ', type: 'textarea', placeholder: 'Số nhà, đường, quận, thành phố…' },
    { key: 'note', label: 'Ghi chú', type: 'textarea', placeholder: 'Điều khoản bảo hành, thời gian phản hồi…' },
    { key: 'isActive', label: 'Đang hợp tác', type: 'switch', hint: 'Nhà cung cấp ngừng hợp tác sẽ không hiện khi thêm thiết bị.' }
  ],
  columns: [
    {
      header: 'Nhà cung cấp',
      render: (item) => {
        const supplier = item as Supplier
        return (
          <>
            <p className="max-w-[220px] truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
              {supplier.name}
            </p>
            <p className="font-mono text-[10.5px] text-slate-400">{supplier.code}</p>
          </>
        )
      }
    },
    {
      header: 'Liên hệ',
      render: (item) => {
        const supplier = item as Supplier
        return (
          <>
            <p className="text-[12px] text-slate-600 dark:text-slate-300">{supplier.contactName ?? '—'}</p>
            <p className="text-[10.5px] text-slate-400">{supplier.phone ?? supplier.email ?? ''}</p>
          </>
        )
      }
    },
    {
      header: 'Mã số thuế',
      render: (item) => (
        <span className="font-mono text-[11.5px] text-slate-600 dark:text-slate-300">
          {(item as Supplier).taxCode ?? '—'}
        </span>
      )
    },
    {
      header: 'Thiết bị',
      render: (item) => (
        <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
          {(item as Supplier).assetCount ?? 0}
        </span>
      )
    },
    {
      header: 'Trạng thái',
      render: (item) => (
        <Badge tone={item.isActive ? 'success' : 'neutral'} dot>
          {item.isActive ? 'Đang hợp tác' : 'Ngừng hợp tác'}
        </Badge>
      )
    }
  ],
  deleteDescription: (item) =>
    `Nhà cung cấp "${(item as Supplier).name}" sẽ bị xóa. Chỉ có thể xóa khi chưa có thiết bị nào tham chiếu.`,
  emptyDescription: 'Thêm nhà cung cấp để lưu thông tin bảo hành và mua sắm.'
}

export function DepartmentsPage() {
  return <SimpleCatalogPage config={DEPARTMENT_CONFIG} />
}

export function LocationsPage() {
  return <SimpleCatalogPage config={LOCATION_CONFIG} />
}

export function SuppliersPage() {
  return <SimpleCatalogPage config={SUPPLIER_CONFIG} />
}
