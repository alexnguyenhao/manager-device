import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeDollarSign,
  Boxes,
  CircleAlert,
  Cpu,
  MapPin,
  RefreshCw,
  Save,
  ShoppingCart,
  Sparkles,
  UserRound,
  Wrench
} from 'lucide-react'
import type {
  Asset,
  AssetCondition,
  AssetInput,
  AssetStatus,
  Category,
  Department,
  Employee,
  Location,
  Supplier
} from '@shared/types'
import {
  ASSET_CONDITION_META,
  ASSET_STATUS_META
} from '@shared/constants'
import {
  findSpecPreset,
  getComputerPreset,
  getEffectiveSpecFields
} from '@shared/spec-presets'
import {
  addMonths,
  computeDepreciation,
  formatCurrency,
  todayISO
} from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { Drawer } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Feedback'
import { toast } from '../../store/toast'

interface AssetFormDrawerProps {
  open: boolean
  assetId: number | null
  categories: Category[]
  departments: Department[]
  locations: Location[]
  employees: Employee[]
  suppliers: Supplier[]
  onClose: () => void
  onSaved: (asset: Asset) => void
}

interface FormState {
  code: string
  name: string
  categoryId: string
  serialNumber: string
  model: string
  manufacturer: string
  status: AssetStatus
  condition: AssetCondition
  departmentId: string
  locationId: string
  assignedEmployeeId: string
  supplierId: string
  purchaseDate: string
  purchasePrice: string
  invoiceNumber: string
  warrantyStart: string
  warrantyMonths: string
  depreciationMonths: string
  salvageValue: string
  note: string
  specs: Record<string, string>
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  categoryId: '',
  serialNumber: '',
  model: '',
  manufacturer: '',
  status: 'available',
  condition: 'new',
  departmentId: '',
  locationId: '',
  assignedEmployeeId: '',
  supplierId: '',
  purchaseDate: '',
  purchasePrice: '',
  invoiceNumber: '',
  warrantyStart: '',
  warrantyMonths: '',
  depreciationMonths: '',
  salvageValue: '',
  note: '',
  specs: {}
}

function toForm(asset: Asset): FormState {
  const specs: Record<string, string> = {}
  for (const [key, value] of Object.entries(asset.specs ?? {})) specs[key] = String(value)
  return {
    code: asset.code,
    name: asset.name,
    categoryId: String(asset.categoryId),
    serialNumber: asset.serialNumber ?? '',
    model: asset.model ?? '',
    manufacturer: asset.manufacturer ?? '',
    status: asset.status,
    condition: asset.condition,
    departmentId: asset.departmentId ? String(asset.departmentId) : '',
    locationId: asset.locationId ? String(asset.locationId) : '',
    assignedEmployeeId: asset.assignedEmployeeId ? String(asset.assignedEmployeeId) : '',
    supplierId: asset.supplierId ? String(asset.supplierId) : '',
    purchaseDate: asset.purchaseDate ?? '',
    purchasePrice: asset.purchasePrice ? String(asset.purchasePrice) : '',
    invoiceNumber: asset.invoiceNumber ?? '',
    warrantyStart: asset.warrantyStart ?? '',
    warrantyMonths: asset.warrantyMonths ? String(asset.warrantyMonths) : '',
    depreciationMonths: asset.depreciationMonths ? String(asset.depreciationMonths) : '',
    salvageValue: asset.salvageValue ? String(asset.salvageValue) : '',
    note: asset.note ?? '',
    specs
  }
}

function SectionTitle({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </span>
      <div>
        <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {description && <p className="text-[11px] text-slate-400">{description}</p>}
      </div>
    </div>
  )
}

export function AssetFormDrawer({
  open,
  assetId,
  categories,
  departments,
  locations,
  employees,
  suppliers,
  onClose,
  onSaved
}: AssetFormDrawerProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const codeTouched = useRef(false)
  const loadedId = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      loadedId.current = null
      return
    }
    setError(null)
    codeTouched.current = Boolean(assetId)
    if (!assetId) {
      setForm(EMPTY_FORM)
      return
    }
    if (loadedId.current === assetId) return
    loadedId.current = assetId
    setLoading(true)
    api.assets
      .get(assetId)
      .then((detail) => setForm(toForm(detail.asset)))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [open, assetId])

  const selectedCategory = categories.find((c) => String(c.id) === form.categoryId)
  const selectedEmployee = employees.find((e) => String(e.id) === form.assignedEmployeeId)
  const selectedPreset = findSpecPreset(selectedCategory)
  const computerPreset = getComputerPreset(selectedCategory)
  const specFields = getEffectiveSpecFields(selectedCategory)
  const usingDefaultPreset =
    Boolean(selectedCategory) &&
    Boolean(selectedPreset) &&
    (selectedCategory?.specSchema.length ?? 0) === 0

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onCategoryChange = async (value: string): Promise<void> => {
    const category = categories.find((c) => String(c.id) === value)
    setForm((prev) => ({
      ...prev,
      categoryId: value,
      warrantyMonths:
        !assetId && category ? String(category.defaultWarrantyMonths || '') : prev.warrantyMonths,
      depreciationMonths:
        !assetId && category
          ? String(category.defaultDepreciationMonths || '')
          : prev.depreciationMonths
    }))
    if (!assetId && value && !codeTouched.current) {
      setCodeLoading(true)
      try {
        const code = await api.assets.nextCode(Number(value))
        setForm((prev) => (prev.categoryId === value ? { ...prev, code } : prev))
      } catch {
        // im lặng, người dùng vẫn có thể tự nhập mã
      } finally {
        setCodeLoading(false)
      }
    }
  }

  const onEmployeeChange = (value: string): void => {
    const employee = employees.find((e) => String(e.id) === value)
    setForm((prev) => ({
      ...prev,
      assignedEmployeeId: value,
      departmentId: employee?.departmentId ? String(employee.departmentId) : prev.departmentId,
      status: value ? 'in_use' : prev.status === 'in_use' ? 'available' : prev.status
    }))
  }

  const onStatusChange = (value: AssetStatus): void => {
    setForm((prev) => ({
      ...prev,
      status: value,
      assignedEmployeeId:
        value === 'in_use' || value === 'maintenance' ? prev.assignedEmployeeId : ''
    }))
  }

  const warrantyExpiry = useMemo(() => {
    const start = form.warrantyStart || form.purchaseDate
    const months = Number(form.warrantyMonths) || 0
    if (!start || months <= 0) return null
    return addMonths(start, months)
  }, [form.warrantyStart, form.purchaseDate, form.warrantyMonths])

  const depreciation = useMemo(
    () =>
      computeDepreciation({
        purchaseDate: form.purchaseDate || null,
        purchasePrice: Number(form.purchasePrice) || 0,
        depreciationMonths: Number(form.depreciationMonths) || 0,
        salvageValue: Number(form.salvageValue) || 0
      }),
    [form.purchaseDate, form.purchasePrice, form.depreciationMonths, form.salvageValue]
  )

  const submit = async (): Promise<void> => {
    if (form.name.trim().length < 2) {
      setError('Vui lòng nhập tên thiết bị (tối thiểu 2 ký tự).')
      return
    }
    if (!form.categoryId) {
      setError('Vui lòng chọn danh mục thiết bị.')
      return
    }
    if (form.status === 'in_use' && !form.assignedEmployeeId) {
      setError('Vui lòng chọn người sử dụng khi thiết bị ở trạng thái "Đang sử dụng".')
      return
    }
    if (Number(form.salvageValue) > Number(form.purchasePrice) && Number(form.purchasePrice) > 0) {
      setError('Giá trị thanh lý không được lớn hơn giá mua.')
      return
    }
    for (const field of specFields) {
      if (!field.required) continue
      const value = form.specs[field.key]
      if (value === undefined || value.trim() === '') {
        setError(`Vui lòng nhập ${field.label}${field.unit ? ` (${field.unit})` : ''}.`)
        return
      }
    }
    setSaving(true)
    setError(null)
    const specs: Record<string, string | number> = {}
    for (const field of specFields) {
      const value = form.specs[field.key]
      if (value === undefined || value.trim() === '') continue
      specs[field.key] = field.type === 'number' ? Number(value) : value.trim()
    }
    const payload: AssetInput = {
      code: form.code.trim() || undefined,
      name: form.name.trim(),
      categoryId: Number(form.categoryId),
      serialNumber: form.serialNumber.trim() || null,
      model: form.model.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      status: form.status,
      condition: form.condition,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      locationId: form.locationId ? Number(form.locationId) : null,
      assignedEmployeeId: form.assignedEmployeeId ? Number(form.assignedEmployeeId) : null,
      supplierId: form.supplierId ? Number(form.supplierId) : null,
      purchaseDate: form.purchaseDate || null,
      purchasePrice: Number(form.purchasePrice) || 0,
      invoiceNumber: form.invoiceNumber.trim() || null,
      warrantyStart: form.warrantyStart || null,
      warrantyMonths: Number(form.warrantyMonths) || 0,
      depreciationMonths: Number(form.depreciationMonths) || 0,
      salvageValue: Number(form.salvageValue) || 0,
      specs,
      note: form.note.trim() || null
    }
    try {
      const asset = assetId
        ? await api.assets.update(assetId, payload)
        : await api.assets.create(payload)
      toast.success(assetId ? 'Đã cập nhật thiết bị' : 'Đã thêm thiết bị', `${asset.code} · ${asset.name}`)
      onSaved(asset)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      widthClassName="max-w-[760px]"
      title={assetId ? 'Chỉnh sửa thiết bị' : 'Thêm thiết bị mới'}
      description={
        assetId
          ? 'Cập nhật thông tin tài sản, cấu hình và tình trạng sử dụng.'
          : 'Ghi nhận một tài sản mới vào hệ thống quản lý.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            loading={saving}
            disabled={loading}
            leftIcon={<Save className="h-4 w-4" />}
            onClick={() => void submit()}
          >
            {assetId ? 'Lưu thay đổi' : 'Thêm thiết bị'}
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner className="py-20" />
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}

          <section>
            <SectionTitle icon={<Boxes className="h-4 w-4" />} title="Thông tin cơ bản" />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Mã thiết bị" hint="Để trống để hệ thống tự sinh mã theo danh mục." htmlFor="asset-code">
                <div className="relative">
                  <Input
                    id="asset-code"
                    value={form.code}
                    placeholder="VD: LAP-0001"
                    className="pr-9 font-mono uppercase"
                    onChange={(event) => {
                      codeTouched.current = true
                      update('code', event.target.value.toUpperCase())
                    }}
                  />
                  {codeLoading && (
                    <RefreshCw className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                </div>
              </Field>
              <Field label="Danh mục" required htmlFor="asset-category">
                <Select
                  id="asset-category"
                  value={form.categoryId}
                  onChange={(event) => void onCategoryChange(event.target.value)}
                >
                  <option value="">Chọn danh mục…</option>
                  {categories
                    .filter(
                      (category) =>
                        category.isActive || String(category.id) === form.categoryId
                    )
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {category.isActive ? '' : ' (ngừng dùng)'}
                      </option>
                    ))}
                </Select>
                {categories.length === 0 && (
                  <p className="mt-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">
                    Chưa có danh mục thiết bị. Vào mục Danh mục thiết bị để tạo nhanh PC/Laptop
                    kèm cấu hình CPU, RAM, GPU, ổ cứng.
                  </p>
                )}
              </Field>
              <Field label="Tên thiết bị" required className="sm:col-span-2" htmlFor="asset-name">
                <Input
                  id="asset-name"
                  value={form.name}
                  placeholder="VD: Laptop Dell Latitude 5450"
                  onChange={(event) => update('name', event.target.value)}
                />
              </Field>
              <Field label="Số serial" htmlFor="asset-serial">
                <Input
                  id="asset-serial"
                  value={form.serialNumber}
                  placeholder="Serial / Service tag"
                  className="font-mono"
                  onChange={(event) => update('serialNumber', event.target.value)}
                />
              </Field>
              <Field label="Model" htmlFor="asset-model">
                <Input
                  id="asset-model"
                  value={form.model}
                  placeholder="Latitude 5450"
                  onChange={(event) => update('model', event.target.value)}
                />
              </Field>
              <Field label="Hãng sản xuất" htmlFor="asset-manufacturer">
                <Input
                  id="asset-manufacturer"
                  value={form.manufacturer}
                  placeholder="Dell, HP, Canon…"
                  onChange={(event) => update('manufacturer', event.target.value)}
                />
              </Field>
              <Field label="Tình trạng" htmlFor="asset-condition">
                <Select
                  id="asset-condition"
                  value={form.condition}
                  onChange={(event) => update('condition', event.target.value as AssetCondition)}
                >
                  {(Object.keys(ASSET_CONDITION_META) as AssetCondition[]).map((value) => (
                    <option key={value} value={value}>
                      {ASSET_CONDITION_META[value].label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <SectionTitle
              icon={<UserRound className="h-4 w-4" />}
              title="Phân bổ & sử dụng"
              description="Gán thiết bị cho nhân viên, bộ phận và vị trí."
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Trạng thái" htmlFor="asset-status">
                <Select
                  id="asset-status"
                  value={form.status}
                  onChange={(event) => onStatusChange(event.target.value as AssetStatus)}
                >
                  {(Object.keys(ASSET_STATUS_META) as AssetStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {ASSET_STATUS_META[value].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Người sử dụng"
                hint={
                  form.status !== 'in_use' && form.status !== 'maintenance'
                    ? 'Chọn nhân viên để tự động chuyển trạng thái sang "Đang sử dụng".'
                    : selectedEmployee?.position ?? undefined
                }
                htmlFor="asset-employee"
              >
                <Select
                  id="asset-employee"
                  value={form.assignedEmployeeId}
                  onChange={(event) => onEmployeeChange(event.target.value)}
                  disabled={form.status === 'disposed' || form.status === 'lost' || form.status === 'available' || form.status === 'reserved'}
                >
                  <option value="">Chưa cấp phát</option>
                  {employees
                    .filter(
                      (employee) =>
                        employee.isActive || String(employee.id) === form.assignedEmployeeId
                    )
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName}
                        {employee.code ? ` (${employee.code})` : ''}
                        {employee.isActive ? '' : ' - đã nghỉ'}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Bộ phận" htmlFor="asset-department">
                <Select
                  id="asset-department"
                  value={form.departmentId}
                  onChange={(event) => update('departmentId', event.target.value)}
                >
                  <option value="">Chưa phân bộ phận</option>
                  {departments
                    .filter(
                      (department) =>
                        department.isActive || String(department.id) === form.departmentId
                    )
                    .map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                        {department.isActive ? '' : ' (ngừng dùng)'}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Vị trí" htmlFor="asset-location">
                <Select
                  id="asset-location"
                  value={form.locationId}
                  onChange={(event) => update('locationId', event.target.value)}
                >
                  <option value="">Chưa xác định vị trí</option>
                  {locations
                    .filter(
                      (location) =>
                        location.isActive || String(location.id) === form.locationId
                    )
                    .map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                        {location.isActive ? '' : ' (ngừng sử dụng)'}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Nhà cung cấp" htmlFor="asset-supplier" className="sm:col-span-2">
                <Select
                  id="asset-supplier"
                  value={form.supplierId}
                  onChange={(event) => update('supplierId', event.target.value)}
                >
                  <option value="">Chưa xác định</option>
                  {suppliers
                    .filter(
                      (supplier) =>
                        supplier.isActive || String(supplier.id) === form.supplierId
                    )
                    .map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                        {supplier.isActive ? '' : ' (ngừng hợp tác)'}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            {form.status === 'maintenance' && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/80 px-3 py-2 text-[11.5px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                Thiết bị đang bảo trì. Hãy tạo phiếu bảo trì để theo dõi chi tiết.
              </div>
            )}
          </section>

          <section>
            <SectionTitle
              icon={<ShoppingCart className="h-4 w-4" />}
              title="Mua sắm, bảo hành & khấu hao"
              description="Thông tin tài chính phục vụ tính giá trị còn lại."
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Ngày mua" htmlFor="asset-purchase-date">
                <Input
                  id="asset-purchase-date"
                  type="date"
                  max={todayISO()}
                  value={form.purchaseDate}
                  onChange={(event) => update('purchaseDate', event.target.value)}
                />
              </Field>
              <Field label="Giá mua (VNĐ)" htmlFor="asset-price">
                <Input
                  id="asset-price"
                  type="number"
                  min={0}
                  step={100000}
                  value={form.purchasePrice}
                  placeholder="0"
                  onChange={(event) => update('purchasePrice', event.target.value)}
                />
              </Field>
              <Field label="Số hóa đơn" htmlFor="asset-invoice">
                <Input
                  id="asset-invoice"
                  value={form.invoiceNumber}
                  placeholder="HD-2026-001"
                  onChange={(event) => update('invoiceNumber', event.target.value)}
                />
              </Field>
              <Field label="Ngày bắt đầu bảo hành" htmlFor="asset-warranty-start">
                <Input
                  id="asset-warranty-start"
                  type="date"
                  value={form.warrantyStart}
                  onChange={(event) => update('warrantyStart', event.target.value)}
                />
              </Field>
              <Field
                label="Thời hạn bảo hành (tháng)"
                hint={warrantyExpiry ? `Hết hạn ngày ${warrantyExpiry.slice(8, 10)}/${warrantyExpiry.slice(5, 7)}/${warrantyExpiry.slice(0, 4)}` : undefined}
                htmlFor="asset-warranty-months"
              >
                <Input
                  id="asset-warranty-months"
                  type="number"
                  min={0}
                  value={form.warrantyMonths}
                  placeholder="12"
                  onChange={(event) => update('warrantyMonths', event.target.value)}
                />
              </Field>
              <Field label="Thời gian khấu hao (tháng)" htmlFor="asset-dep-months">
                <Input
                  id="asset-dep-months"
                  type="number"
                  min={0}
                  value={form.depreciationMonths}
                  placeholder="60"
                  onChange={(event) => update('depreciationMonths', event.target.value)}
                />
              </Field>
              <Field label="Giá trị thanh lý (VNĐ)" htmlFor="asset-salvage">
                <Input
                  id="asset-salvage"
                  type="number"
                  min={0}
                  step={100000}
                  value={form.salvageValue}
                  placeholder="0"
                  onChange={(event) => update('salvageValue', event.target.value)}
                />
              </Field>
            </div>

            {(Number(form.purchasePrice) > 0 || Number(form.salvageValue) > 0) && (
              <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3.5 text-[12px] sm:grid-cols-3 dark:bg-slate-800/50">
                <div>
                  <p className="text-[10.5px] uppercase tracking-wide text-slate-400">Giá trị còn lại</p>
                  <p className="mt-0.5 font-semibold text-slate-800 tabular-nums dark:text-slate-100">
                    {formatCurrency(depreciation.currentValue)}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] uppercase tracking-wide text-slate-400">Khấu hao / tháng</p>
                  <p className="mt-0.5 font-semibold text-slate-800 tabular-nums dark:text-slate-100">
                    {formatCurrency(depreciation.monthlyDepreciation)}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] uppercase tracking-wide text-slate-400">Đã sử dụng</p>
                  <p className="mt-0.5 font-semibold text-slate-800 tabular-nums dark:text-slate-100">
                    {depreciation.ageMonths} tháng
                  </p>
                </div>
              </div>
            )}
          </section>

          <section>
            <SectionTitle
              icon={<Cpu className="h-4 w-4" />}
              title={computerPreset ? 'Cấu hình thiết bị' : 'Thông số kỹ thuật'}
              description={
                selectedCategory
                  ? usingDefaultPreset
                    ? `Đang dùng mẫu ${selectedPreset?.name}: CPU, RAM, GPU, ổ cứng và hệ điều hành. Có thể chỉnh sửa trong Danh mục thiết bị.`
                    : `Cấu hình theo danh mục ${selectedCategory.name}.`
                  : 'Chọn danh mục để hiển thị các trường cấu hình.'
              }
            />
            {usingDefaultPreset && specFields.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-[11.5px] text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Danh mục chưa khai báo trường riêng nên đang dùng mẫu cấu hình mặc định của{' '}
                  {selectedPreset?.name}. Các giá trị vẫn được lưu vào thiết bị.
                </span>
              </div>
            )}
            {specFields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-[12px] text-slate-400 dark:border-slate-700">
                {selectedCategory
                  ? 'Danh mục này chưa khai báo trường thông số. Bạn có thể bổ sung trong Danh mục thiết bị.'
                  : 'Chưa chọn danh mục thiết bị.'}
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {specFields.map((field) => (
                  <Field
                    key={field.key}
                    label={`${field.label}${field.unit ? ` (${field.unit})` : ''}`}
                    required={field.required}
                    htmlFor={`spec-${field.key}`}
                  >
                    {field.type === 'select' ? (
                      <Select
                        id={`spec-${field.key}`}
                        value={form.specs[field.key] ?? ''}
                        onChange={(event) =>
                          update('specs', { ...form.specs, [field.key]: event.target.value })
                        }
                      >
                        <option value="">Chọn…</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        id={`spec-${field.key}`}
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        step={field.type === 'number' ? 'any' : undefined}
                        value={form.specs[field.key] ?? ''}
                        placeholder={field.placeholder ?? undefined}
                        onChange={(event) =>
                          update('specs', { ...form.specs, [field.key]: event.target.value })
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle icon={<MapPin className="h-4 w-4" />} title="Ghi chú" />
            <Textarea
              value={form.note}
              placeholder="Ghi chú thêm về thiết bị, tình trạng, phụ kiện đi kèm…"
              onChange={(event) => update('note', event.target.value)}
            />
          </section>

          {assetId && (
            <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-[11.5px] text-slate-400 dark:border-slate-800">
              <BadgeDollarSign className="h-3.5 w-3.5" />
              Giá trị tài sản được tính tự động theo phương pháp khấu hao đường thẳng.
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
