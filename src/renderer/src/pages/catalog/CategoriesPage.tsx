import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleAlert,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Tags,
  Trash2,
  X
} from 'lucide-react'
import type { Category, CategoryInput, SpecField, SpecFieldType } from '@shared/types'
import {
  SPEC_PRESETS,
  findSpecPreset,
  getEffectiveSpecFields,
  type SpecPreset
} from '@shared/spec-presets'
import { hasPermission } from '@shared/constants'
import { formatNumber } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/common/SearchInput'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select, Switch, Textarea } from '../../components/ui/Input'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { Dropdown, DropdownMenu } from '../../components/ui/Dropdown'
import { Modal } from '../../components/ui/Modal'
import { useConfirm } from '../../components/ui/Confirm'

const FIELD_TYPES: Array<{ value: SpecFieldType; label: string }> = [
  { value: 'text', label: 'Văn bản' },
  { value: 'number', label: 'Số' },
  { value: 'select', label: 'Danh sách chọn' },
  { value: 'date', label: 'Ngày' }
]

interface SpecEditorRow extends SpecField {
  optionsText: string
}

interface CategoryFormState {
  code: string
  name: string
  prefix: string
  description: string
  defaultDepreciationMonths: string
  defaultWarrantyMonths: string
  isActive: boolean
  specSchema: SpecEditorRow[]
}

function toForm(category?: Category | null): CategoryFormState {
  if (!category) {
    return {
      code: '',
      name: '',
      prefix: '',
      description: '',
      defaultDepreciationMonths: '60',
      defaultWarrantyMonths: '12',
      isActive: true,
      specSchema: []
    }
  }
  return {
    code: category.code,
    name: category.name,
    prefix: category.prefix,
    description: category.description ?? '',
    defaultDepreciationMonths: String(category.defaultDepreciationMonths),
    defaultWarrantyMonths: String(category.defaultWarrantyMonths),
    isActive: category.isActive,
    specSchema: category.specSchema.map((field) => ({ ...field, optionsText: (field.options ?? []).join(', ') }))
  }
}

function slugKey(label: string): string {
  const key = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return key.slice(0, 50)
}

function presetRows(preset: SpecPreset): SpecEditorRow[] {
  return preset.fields.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : [],
    optionsText: (field.options ?? []).join(', ')
  }))
}

/**
 * Điền mẫu cấu hình vào biểu mẫu danh mục. Khi chỉnh sửa danh mục đã có,
 * giữ nguyên mã/tên/tiền tố để tránh đổi nhầm thông tin nhận diện.
 */
function applyPresetToForm(
  base: CategoryFormState,
  preset: SpecPreset,
  preserveIdentity: boolean
): CategoryFormState {
  const isPresetValue = (value: string, values: string[]): boolean => {
    const term = value.trim().toLowerCase()
    return !term || values.some((item) => item.trim().toLowerCase() === term)
  }
  const codes = SPEC_PRESETS.map((item) => item.code)
  const names = SPEC_PRESETS.map((item) => item.categoryName)
  const prefixes = SPEC_PRESETS.map((item) => item.prefix)
  const descriptions = SPEC_PRESETS.map((item) => item.description)

  return {
    ...base,
    code: preserveIdentity || !isPresetValue(base.code, codes) ? base.code : preset.code,
    name: preserveIdentity || !isPresetValue(base.name, names) ? base.name : preset.categoryName,
    prefix: preserveIdentity || !isPresetValue(base.prefix, prefixes) ? base.prefix : preset.prefix,
    description:
      preserveIdentity || !isPresetValue(base.description, descriptions)
        ? base.description
        : preset.description,
    defaultDepreciationMonths: String(preset.defaultDepreciationMonths),
    defaultWarrantyMonths: String(preset.defaultWarrantyMonths),
    specSchema: presetRows(preset)
  }
}

export function CategoriesPage() {
  const user = useCurrentUser()
  const confirm = useConfirm()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<CategoryFormState>(toForm(null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canWrite = hasPermission(user.role, 'catalog:write')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await api.categories.list())
    } catch (err) {
      toast.error('Không thể tải danh mục thiết bị', errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        item.prefix.toLowerCase().includes(term)
    )
  }, [items, search])

  const openCreate = (): void => {
    setEditing(null)
    setForm(toForm(null))
    setError(null)
    setFormOpen(true)
  }

  const openCreateWithPreset = (preset: SpecPreset): void => {
    setEditing(null)
    setForm(applyPresetToForm(toForm(null), preset, false))
    setError(null)
    setFormOpen(true)
  }

  const openEdit = (category: Category): void => {
    setEditing(category)
    setForm(toForm(category))
    setError(null)
    setFormOpen(true)
  }

  const applyPreset = async (preset: SpecPreset): Promise<void> => {
    const alreadyApplied =
      form.specSchema.length === preset.fields.length &&
      preset.fields.every((field, index) => form.specSchema[index]?.key === field.key)
    if (!alreadyApplied && form.specSchema.length > 0) {
      const ok = await confirm({
        title: 'Áp dụng mẫu cấu hình?',
        description: `Các trường thông số hiện tại sẽ được thay bằng ${preset.fields.length} trường của mẫu "${preset.name}", đồng thời cập nhật thời gian khấu hao/bảo hành mặc định.`,
        confirmText: 'Áp dụng mẫu'
      })
      if (!ok) return
    }
    setForm((prev) => applyPresetToForm(prev, preset, Boolean(editing)))
    setError(null)
  }

  const update = <K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateSpec = (index: number, patch: Partial<SpecEditorRow>): void => {
    setForm((prev) => ({
      ...prev,
      specSchema: prev.specSchema.map((field, i) => (i === index ? { ...field, ...patch } : field))
    }))
  }

  const addSpec = (): void => {
    setForm((prev) => ({
      ...prev,
      specSchema: [
        ...prev.specSchema,
        {
          key: '',
          label: '',
          type: 'text',
          unit: '',
          options: [],
          optionsText: '',
          required: false
        }
      ]
    }))
  }

  const removeSpec = (index: number): void => {
    setForm((prev) => ({ ...prev, specSchema: prev.specSchema.filter((_, i) => i !== index) }))
  }

  const submit = async (): Promise<void> => {
    if (!form.code.trim()) {
      setError('Vui lòng nhập mã danh mục.')
      return
    }
    if (form.name.trim().length < 2) {
      setError('Vui lòng nhập tên danh mục.')
      return
    }
    if (!form.prefix.trim()) {
      setError('Vui lòng nhập tiền tố mã thiết bị.')
      return
    }
    const specSchema: SpecField[] = []
    for (const field of form.specSchema) {
      if (!field.label.trim()) continue
      if (!/^[a-zA-Z0-9_]+$/.test(field.key.trim())) {
        setError(`Mã trường "${field.label}" chỉ được gồm chữ, số và dấu gạch dưới.`)
        return
      }
      specSchema.push({
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        unit: field.unit?.trim() || null,
        options:
          field.type === 'select'
            ? field.optionsText
                .split(',')
                .map((option) => option.trim())
                .filter(Boolean)
            : undefined,
        placeholder: field.placeholder?.trim() || null,
        required: Boolean(field.required)
      })
    }
    if (new Set(specSchema.map((field) => field.key)).size !== specSchema.length) {
      setError('Mã trường thông số không được trùng nhau.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: CategoryInput & { id?: number } = {
      id: editing?.id,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      prefix: form.prefix.trim().toUpperCase(),
      description: form.description.trim() || null,
      specSchema,
      defaultDepreciationMonths: Number(form.defaultDepreciationMonths) || 0,
      defaultWarrantyMonths: Number(form.defaultWarrantyMonths) || 0,
      isActive: form.isActive
    }
    try {
      await api.categories.save(payload)
      toast.success(editing ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục', form.name.trim())
      setFormOpen(false)
      void load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (category: Category): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa danh mục thiết bị?',
      description: `Danh mục "${category.name}" sẽ bị xóa. Chỉ có thể xóa khi chưa có thiết bị nào thuộc danh mục.`,
      confirmText: 'Xóa danh mục'
    })
    if (!ok) return
    try {
      await api.categories.remove(category.id)
      toast.success('Đã xóa danh mục', category.name)
      void load()
    } catch (err) {
      toast.error('Không thể xóa danh mục', errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Danh mục thiết bị"
        description="Phân loại tài sản và khai báo bộ thông số kỹ thuật riêng cho từng loại."
        icon={<Tags className="h-5 w-5" />}
        meta={<Badge tone="info">{formatNumber(items.length)} danh mục</Badge>}
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Thêm danh mục
            </Button>
          ) : undefined
        }
      />

      <div className="card mb-3 p-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tìm theo tên, mã hoặc tiền tố…"
          className="sm:w-[360px]"
        />
      </div>

      <div className="table-wrap">
        {loading ? (
          <Spinner className="py-24" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-6 w-6" />}
            title={search ? 'Không tìm thấy danh mục' : 'Chưa có danh mục thiết bị'}
            description={search ? 'Thử từ khóa khác.' : 'Tạo danh mục để phân loại thiết bị và khai báo thông số.'}
            action={
              canWrite && !search ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                    Thêm danh mục
                  </Button>
                  {SPEC_PRESETS.slice(0, 2).map((preset) => (
                    <Button
                      key={preset.id}
                      variant="outline"
                      leftIcon={<Sparkles className="h-4 w-4" />}
                      onClick={() => openCreateWithPreset(preset)}
                    >
                      Tạo nhanh {preset.name}
                    </Button>
                  ))}
                </div>
              ) : undefined
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Danh mục</th>
                <th>Tiền tố</th>
                <th>Thông số</th>
                <th>Khấu hao / bảo hành</th>
                <th>Thiết bị</th>
                <th>Trạng thái</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((category) => {
                const specFields = getEffectiveSpecFields(category)
                const preset = findSpecPreset(category)
                const usingPreset = category.specSchema.length === 0 && preset !== null
                return (
                <tr key={category.id}>
                  <td>
                    <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{category.name}</p>
                    <p className="text-[10.5px] text-slate-400">
                      {category.code}
                      {category.description ? ` · ${category.description}` : ''}
                    </p>
                  </td>
                  <td>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {category.prefix}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-slate-600 dark:text-slate-300">
                        {specFields.length} trường
                      </span>
                      {usingPreset && <Badge tone="info">Mẫu mặc định</Badge>}
                    </div>
                    <p className="max-w-[180px] truncate text-[10.5px] text-slate-400">
                      {specFields.map((field) => field.label).join(', ') || 'Chưa khai báo'}
                    </p>
                  </td>
                  <td>
                    <p className="text-[12px] text-slate-600 dark:text-slate-300">
                      {category.defaultDepreciationMonths} tháng / {category.defaultWarrantyMonths} tháng
                    </p>
                    <p className="text-[10.5px] text-slate-400">Khấu hao / bảo hành mặc định</p>
                  </td>
                  <td>
                    <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                      {category.assetCount ?? 0}
                    </span>
                  </td>
                  <td>
                    <Badge tone={category.isActive ? 'success' : 'neutral'} dot>
                      {category.isActive ? 'Đang dùng' : 'Ngừng dùng'}
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
                      ariaLabel={`Thao tác ${category.name}`}
                    >
                      {(close) => (
                        <DropdownMenu
                          close={close}
                          items={[
                            {
                              label: 'Chỉnh sửa',
                              icon: <Pencil className="h-4 w-4" />,
                              onClick: () => openEdit(category),
                              disabled: !canWrite
                            },
                            {
                              label: 'Xóa danh mục',
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              dividerBefore: true,
                              onClick: () => void remove(category),
                              disabled: !canWrite
                            }
                          ]}
                        />
                      )}
                    </Dropdown>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="2xl"
        title={editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục thiết bị'}
        description="Khai báo thông tin phân loại và các trường thông số kỹ thuật."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void submit()}>
              {editing ? 'Lưu thay đổi' : 'Thêm danh mục'}
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

          <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3.5 dark:border-brand-500/20 dark:bg-brand-500/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                Tạo nhanh từ mẫu cấu hình
              </p>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Chọn mẫu để điền sẵn mã, tên và các trường như CPU, RAM, GPU, dung lượng ổ cứng,
              hệ điều hành/Windows.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {SPEC_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void applyPreset(preset)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Mã danh mục" required htmlFor="cat-code">
              <Input
                id="cat-code"
                value={form.code}
                placeholder="LAPTOP"
                className="font-mono uppercase"
                onChange={(event) => update('code', event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Tiền tố mã thiết bị" required hint="Dùng để sinh mã tự động, ví dụ LAP-0001." htmlFor="cat-prefix">
              <Input
                id="cat-prefix"
                value={form.prefix}
                placeholder="LAP"
                className="font-mono uppercase"
                onChange={(event) => update('prefix', event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Tên danh mục" required className="sm:col-span-2" htmlFor="cat-name">
              <Input
                id="cat-name"
                value={form.name}
                placeholder="Máy tính xách tay"
                onChange={(event) => update('name', event.target.value)}
              />
            </Field>
            <Field label="Khấu hao mặc định (tháng)" htmlFor="cat-dep-months">
              <Input
                id="cat-dep-months"
                type="number"
                min={0}
                value={form.defaultDepreciationMonths}
                onChange={(event) => update('defaultDepreciationMonths', event.target.value)}
              />
            </Field>
            <Field label="Bảo hành mặc định (tháng)" htmlFor="cat-warranty-months">
              <Input
                id="cat-warranty-months"
                type="number"
                min={0}
                value={form.defaultWarrantyMonths}
                onChange={(event) => update('defaultWarrantyMonths', event.target.value)}
              />
            </Field>
            <Field label="Mô tả" className="sm:col-span-2" htmlFor="cat-description">
              <Textarea
                id="cat-description"
                value={form.description}
                placeholder="Mô tả nhóm thiết bị…"
                onChange={(event) => update('description', event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Switch
                checked={form.isActive}
                onChange={(checked) => update('isActive', checked)}
                label="Đang sử dụng danh mục"
                description="Danh mục ngừng sử dụng sẽ không hiển thị khi thêm thiết bị mới."
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  Trường thông số kỹ thuật
                </h3>
                <p className="text-[11px] text-slate-400">
                  Các trường này hiển thị trong biểu mẫu thiết bị của danh mục.
                </p>
              </div>
              <Button size="sm" variant="outline" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addSpec}>
                Thêm trường
              </Button>
            </div>

            {form.specSchema.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] text-slate-400 dark:border-slate-700">
                Chưa có trường thông số. Nhấn "Thêm trường" để khai báo CPU, RAM, dung lượng…
              </div>
            ) : (
              <div className="space-y-2">
                {form.specSchema.map((field, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/30"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-slate-300" />
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Trường {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSpec(index)}
                        className="ml-auto rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        aria-label="Xóa trường"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Nhãn hiển thị">
                        <Input
                          value={field.label}
                          placeholder="CPU"
                          onChange={(event) => {
                            const label = event.target.value
                            updateSpec(index, {
                              label,
                              key: field.key || slugKey(label)
                            })
                          }}
                        />
                      </Field>
                      <Field label="Mã trường">
                        <Input
                          value={field.key}
                          placeholder="cpu"
                          className="font-mono"
                          onChange={(event) => updateSpec(index, { key: event.target.value })}
                        />
                      </Field>
                      <Field label="Kiểu dữ liệu">
                        <Select
                          value={field.type}
                          onChange={(event) => updateSpec(index, { type: event.target.value as SpecFieldType })}
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Đơn vị">
                        <Input
                          value={field.unit ?? ''}
                          placeholder="GB, inch…"
                          onChange={(event) => updateSpec(index, { unit: event.target.value })}
                        />
                      </Field>
                      {field.type === 'select' && (
                        <Field label="Các lựa chọn (phân cách bằng dấu phẩy)" className="sm:col-span-2 lg:col-span-3">
                          <Input
                            value={field.optionsText}
                            placeholder="Mới, Tốt, Cũ"
                            onChange={(event) => updateSpec(index, { optionsText: event.target.value })}
                          />
                        </Field>
                      )}
                      <div className="flex items-end pb-2">
                        <Checkbox
                          checked={Boolean(field.required)}
                          onChange={(event) => updateSpec(index, { required: event.target.checked })}
                          label="Bắt buộc nhập"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
