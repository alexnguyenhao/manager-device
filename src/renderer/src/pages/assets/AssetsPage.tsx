import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowUpDown,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FilterX,
  MonitorSmartphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  ShieldAlert,
  Tag,
  Trash2,
  Upload,
  Wrench
} from 'lucide-react'
import type {
  Asset,
  AssetStatus,
  Category,
  Department,
  Employee,
  ExportResult,
  ImportResult,
  Location,
  OrgBlock,
  PageResult,
  Supplier
} from '@shared/types'
import {
  ASSET_CONDITION_META,
  ASSET_STATUS_META,
  DEFAULT_PAGE_SIZE,
  ORG_BLOCK_META,
  ORG_BLOCK_OPTIONS,
  hasPermission
} from '@shared/constants'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber
} from '@shared/utils'
import {
  formatSpecValue,
  getEffectiveSpecFields
} from '@shared/spec-presets'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/common/SearchInput'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { EmptyState, Pagination, Spinner } from '../../components/ui/Feedback'
import { Dropdown, DropdownMenu, type MenuItem } from '../../components/ui/Dropdown'
import { useConfirm } from '../../components/ui/Confirm'
import { cn } from '../../lib/cn'
import { useDebounced } from '../../lib/useDebounced'
import { AssetFormDrawer } from './AssetFormDrawer'
import { AssetLabelModal } from './AssetLabelModal'
import { AssetImportResultModal } from './AssetImportResultModal'

interface Filters {
  search: string
  categoryId: string
  status: 'all' | AssetStatus
  departmentId: string
  block: string
  locationId: string
  warranty: boolean
}

const EMPTY_FILTERS: Filters = {
  search: '',
  categoryId: '',
  status: 'all',
  departmentId: '',
  block: '',
  locationId: '',
  warranty: false
}

export function AssetsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounced(searchInput, 350)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'purchasePrice' | 'code'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [data, setData] = useState<PageResult<Asset> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [autoScan, setAutoScan] = useState(false)
  const [labelAssets, setLabelAssets] = useState<Asset[]>([])
  const [labelOpen, setLabelOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const canWrite = hasPermission(user.role, 'asset:write')
  const canDelete = hasPermission(user.role, 'asset:delete')

  const loadCatalogs = useCallback(async () => {
    try {
      const [categoryList, departmentList, locationList, employeeList, supplierList] =
        await Promise.all([
          api.categories.list(),
          api.departments.list(),
          api.locations.list(),
          api.employees.list(),
          api.suppliers.list()
        ])
      setCategories(categoryList)
      setDepartments(departmentList)
      setLocations(locationList)
      setEmployees(employeeList)
      setSuppliers(supplierList)
    } catch (error) {
      toast.error('Không thể tải danh mục', errorMessage(error))
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.assets.list({
        page,
        pageSize,
        search: filters.search.trim() || undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : null,
        status: filters.status,
        departmentId: filters.departmentId ? Number(filters.departmentId) : null,
        block: filters.block ? (filters.block as OrgBlock) : null,
        locationId: filters.locationId ? Number(filters.locationId) : null,
        warrantyExpiringDays: filters.warranty ? 45 : null,
        sortBy,
        sortDir
      })
      setData(result)
    } catch (error) {
      toast.error('Không thể tải danh sách thiết bị', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters, sortBy, sortDir])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch }))
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const search = searchParams.get('search')
    const warranty = searchParams.get('warranty')
    const openNew = searchParams.get('new')
    if (search) setSearchInput(search)
    if (warranty === '1') setFilters((prev) => ({ ...prev, warranty: true }))
    if (openNew === '1') {
      setEditingId(null)
      setFormOpen(true)
    }
    if (search || warranty || openNew) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    setSelected(new Set())
  }, [page, pageSize, filters, sortBy, sortDir])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.search.trim()) count++
    if (filters.categoryId) count++
    if (filters.status !== 'all') count++
    if (filters.departmentId) count++
    if (filters.block) count++
    if (filters.locationId) count++
    if (filters.warranty) count++
    return count
  }, [filters])

  const items = data?.items ?? []
  const allSelected = items.length > 0 && items.every((asset) => selected.has(asset.id))
  const someSelected = items.some((asset) => selected.has(asset.id)) && !allSelected

  const toggleAll = (): void => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((asset) => asset.id)))
    }
  }

  const toggleOne = (id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resetFilters = (): void => {
    setFilters(EMPTY_FILTERS)
    setSearchInput('')
    setPage(1)
  }

  const openCreate = (): void => {
    setEditingId(null)
    setAutoScan(false)
    setFormOpen(true)
  }

  const openScanner = (): void => {
    setEditingId(null)
    setAutoScan(true)
    setFormOpen(true)
  }

  const openEdit = (asset: Asset): void => {
    setEditingId(asset.id)
    setAutoScan(false)
    setFormOpen(true)
  }

  const openLabel = async (ids: number[]): Promise<void> => {
    try {
      const assets = await api.assets.byIds(ids)
      setLabelAssets(assets)
      setLabelOpen(true)
    } catch (error) {
      toast.error('Không thể tải thiết bị', errorMessage(error))
    }
  }

  const removeAsset = async (asset: Asset): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa thiết bị?',
      description: `Thiết bị "${asset.code} · ${asset.name}" sẽ bị xóa vĩnh viễn khỏi hệ thống.\nHành động này không thể hoàn tác.`,
      confirmText: 'Xóa thiết bị'
    })
    if (!ok) return
    try {
      await api.assets.remove(asset.id)
      toast.success('Đã xóa thiết bị', `${asset.code} · ${asset.name}`)
      if (items.length === 1 && page > 1) setPage(page - 1)
      else void load()
    } catch (error) {
      toast.error('Không thể xóa thiết bị', errorMessage(error))
    }
  }

  const removeSelected = async (): Promise<void> => {
    const ids = [...selected]
    const ok = await confirm({
      title: `Xóa ${ids.length} thiết bị?`,
      description: 'Các thiết bị đã chọn sẽ bị xóa vĩnh viễn. Phiếu cấp phát và bảo trì liên quan cũng sẽ bị ảnh hưởng.',
      confirmText: `Xóa ${ids.length} thiết bị`
    })
    if (!ok) return
    try {
      const count = await api.assets.bulkRemove(ids)
      toast.success('Đã xóa thiết bị', `${count} thiết bị đã được xóa khỏi hệ thống.`)
      setSelected(new Set())
      void load()
    } catch (error) {
      toast.error('Không thể xóa thiết bị', errorMessage(error))
    }
  }

  const exportExcel = async (): Promise<void> => {
    try {
      const result: ExportResult = await api.assets.exportExcel({
        search: filters.search.trim() || undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : null,
        status: filters.status,
        departmentId: filters.departmentId ? Number(filters.departmentId) : null,
        block: filters.block ? (filters.block as OrgBlock) : null,
        locationId: filters.locationId ? Number(filters.locationId) : null,
        warrantyExpiringDays: filters.warranty ? 45 : null,
        sortBy,
        sortDir
      })
      if (!result.canceled && result.filePath) {
        toast.success('Đã xuất Excel', `Đã lưu ${result.count ?? 0} thiết bị vào tệp.`)
      }
    } catch (error) {
      toast.error('Không thể xuất Excel', errorMessage(error))
    }
  }

  const downloadTemplate = async (): Promise<void> => {
    try {
      const result = await api.assets.downloadTemplate()
      if (!result.canceled && result.filePath) toast.success('Đã tải tệp mẫu', result.filePath)
    } catch (error) {
      toast.error('Không thể tải tệp mẫu', errorMessage(error))
    }
  }

  const importExcel = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await api.assets.importExcel()
      if (!result.canceled) {
        setImportResult(result)
        setImportOpen(true)
        if (result.imported > 0) {
          setPage(1)
          void load()
          void loadCatalogs()
        }
      }
    } catch (error) {
      toast.error('Không thể nhập Excel', errorMessage(error))
    } finally {
      setImporting(false)
    }
  }

  const toggleSort = (column: typeof sortBy): void => {
    if (sortBy === column) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(column)
      setSortDir(column === 'name' ? 'asc' : 'desc')
    }
  }

  return (
    <div>
      <PageHeader
        title="Thiết bị"
        description="Quản lý toàn bộ tài sản CNTT: máy tính, máy in, máy scan và thiết bị ngoại vi."
        icon={<MonitorSmartphone className="h-5 w-5" />}
        meta={
          data ? (
            <>
              <Badge tone="info">{formatNumber(data.total)} thiết bị</Badge>
              <span className="text-[11.5px] text-slate-400">
                Trang {data.page}/{data.totalPages}
              </span>
            </>
          ) : undefined
        }
        actions={
          <>
            <Dropdown
              width={230}
              ariaLabel="Nhập xuất Excel"
              trigger={
                <Button variant="outline" rightIcon={<ChevronDown className="h-3.5 w-3.5" />}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              }
            >
              {(close) => (
                <DropdownMenu
                  close={close}
                  items={[
                    {
                      label: 'Nhập từ Excel',
                      icon: <Upload className="h-4 w-4" />,
                      onClick: () => void importExcel(),
                      disabled: !canWrite
                    },
                    {
                      label: 'Xuất danh sách',
                      icon: <Download className="h-4 w-4" />,
                      onClick: () => void exportExcel()
                    },
                    {
                      label: 'Tải tệp mẫu',
                      icon: <FileSpreadsheet className="h-4 w-4" />,
                      onClick: () => void downloadTemplate(),
                      dividerBefore: true
                    }
                  ]}
                />
              )}
            </Dropdown>
            {canWrite && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<ScanLine className="h-4 w-4" />}
                  onClick={openScanner}
                >
                  Quét máy này
                </Button>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Thêm thiết bị
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="card mb-3 p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm theo mã, tên, serial, người dùng…"
            className="w-full sm:w-[320px]"
          />
          <div className="order-last grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <Select
              value={filters.block}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, block: event.target.value, departmentId: '' }))
                setPage(1)
              }}
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
              value={filters.categoryId}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, categoryId: event.target.value }))
                setPage(1)
              }}
              aria-label="Lọc theo danh mục"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              value={filters.status}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, status: event.target.value as Filters['status'] }))
                setPage(1)
              }}
              aria-label="Lọc theo trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              {(Object.keys(ASSET_STATUS_META) as AssetStatus[]).map((status) => (
                <option key={status} value={status}>
                  {ASSET_STATUS_META[status].label}
                </option>
              ))}
            </Select>
            <Select
              value={filters.departmentId}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, departmentId: event.target.value }))
                setPage(1)
              }}
              aria-label="Lọc theo phòng ban"
            >
              <option value="">Tất cả phòng ban</option>
              {ORG_BLOCK_OPTIONS.filter((block) => !filters.block || block === filters.block).map(
                (block) => {
                  const items = departments.filter(
                    (department) => department.block === block
                  )
                  if (items.length === 0) return null
                  return (
                    <optgroup key={block} label={ORG_BLOCK_META[block].label}>
                      {items.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                }
              )}
            </Select>
            <Select
              value={filters.locationId}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, locationId: event.target.value }))
                setPage(1)
              }}
              aria-label="Lọc theo vị trí"
            >
              <option value="">Tất cả vị trí</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({ ...prev, warranty: !prev.warranty }))
                setPage(1)
              }}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-medium transition',
                filters.warranty
                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Sắp hết bảo hành
            </button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" leftIcon={<FilterX className="h-3.5 w-3.5" />} onClick={resetFilters}>
                Xóa lọc ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 dark:border-brand-500/25 dark:bg-brand-500/10">
          <span className="text-[12.5px] font-medium text-brand-800 dark:text-brand-300">
            Đã chọn {selected.size} thiết bị
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" leftIcon={<Printer className="h-3.5 w-3.5" />} onClick={() => void openLabel([...selected])}>
              In nhãn
            </Button>
            {canDelete && (
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => void removeSelected()}>
                Xóa đã chọn
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <Spinner className="py-24" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<MonitorSmartphone className="h-6 w-6" />}
            title={activeFilterCount ? 'Không tìm thấy thiết bị' : 'Chưa có thiết bị nào'}
            description={
              activeFilterCount
                ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                : 'Thêm thiết bị đầu tiên để bắt đầu quản lý tài sản.'
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              ) : canWrite ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Thêm thiết bị
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someSelected
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-600 dark:border-slate-600"
                      aria-label="Chọn tất cả"
                    />
                  </th>
                  <th>
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Thiết bị
                      <ArrowUpDown className={cn('h-3 w-3', sortBy === 'name' && 'text-brand-600')} />
                    </button>
                  </th>
                  <th>Danh mục</th>
                  <th>Trạng thái</th>
                  <th>Người sử dụng</th>
                  <th>Vị trí</th>
                  <th>
                    <button
                      type="button"
                      onClick={() => toggleSort('purchasePrice')}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Giá trị
                      <ArrowUpDown className={cn('h-3 w-3', sortBy === 'purchasePrice' && 'text-brand-600')} />
                    </button>
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {items.map((asset) => {
                  const statusMeta = ASSET_STATUS_META[asset.status]
                  const assetCategory = categories.find((category) => category.id === asset.categoryId)
                  const configSummary = getEffectiveSpecFields(assetCategory)
                    .filter((field) => ['cpu', 'ram', 'storage', 'os'].includes(field.key))
                    .map((field) =>
                      asset.specs[field.key] !== undefined
                        ? formatSpecValue(asset.specs[field.key], field)
                        : ''
                    )
                    .filter(Boolean)
                    .join(' · ')
                  const actions: MenuItem[] = [
                    {
                      label: 'Xem chi tiết',
                      icon: <MonitorSmartphone className="h-4 w-4" />,
                      onClick: () => navigate(`/assets/${asset.id}`)
                    },
                    {
                      label: 'Chỉnh sửa',
                      icon: <Pencil className="h-4 w-4" />,
                      onClick: () => openEdit(asset),
                      disabled: !canWrite
                    },
                    {
                      label: 'In nhãn QR',
                      icon: <QrCode className="h-4 w-4" />,
                      onClick: () => void openLabel([asset.id])
                    },
                    {
                      label: 'Cấp phát thiết bị',
                      icon: <ArrowLeftRight className="h-4 w-4" />,
                      onClick: () => navigate(`/assignments?new=1&assetId=${asset.id}`),
                      disabled: !hasPermission(user.role, 'assignment:write') || asset.status === 'disposed'
                    },
                    {
                      label: 'Tạo phiếu bảo trì',
                      icon: <Wrench className="h-4 w-4" />,
                      onClick: () => navigate(`/maintenance?new=1&assetId=${asset.id}`),
                      disabled: !hasPermission(user.role, 'maintenance:write')
                    },
                    ...(canDelete
                      ? [
                          {
                            label: 'Xóa thiết bị',
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                            dividerBefore: true,
                            onClick: () => void removeAsset(asset)
                          }
                        ]
                      : [])
                  ]

                  return (
                    <tr key={asset.id} className={selected.has(asset.id) ? 'bg-brand-50/40 dark:bg-brand-500/5' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(asset.id)}
                          onChange={() => toggleOne(asset.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-brand-600 dark:border-slate-600"
                          aria-label={`Chọn ${asset.code}`}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <MonitorSmartphone className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/assets/${asset.id}`}
                              className="block max-w-[260px] truncate text-[13px] font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400"
                            >
                              {asset.name}
                            </Link>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10.5px] text-slate-400">{asset.code}</span>
                              {asset.serialNumber && (
                                <span className="max-w-[110px] truncate text-[10.5px] text-slate-400">
                                  · {asset.serialNumber}
                                </span>
                              )}
                            </div>
                            {configSummary && (
                              <p
                                className="mt-0.5 max-w-[300px] truncate text-[10.5px] text-slate-400"
                                title={configSummary}
                              >
                                {configSummary}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-[12px] text-slate-600 dark:text-slate-300">{asset.categoryName}</span>
                        <p className="text-[10.5px] text-slate-400">{asset.manufacturer ?? asset.model ?? '—'}</p>
                      </td>
                      <td>
                        <Badge tone={statusMeta.tone} dot>
                          {statusMeta.label}
                        </Badge>
                        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-slate-400">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              asset.condition === 'new' || asset.condition === 'good'
                                ? 'bg-emerald-500'
                                : asset.condition === 'fair'
                                  ? 'bg-teal-500'
                                  : asset.condition === 'poor'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                            )}
                          />
                          {ASSET_CONDITION_META[asset.condition].label}
                        </p>
                      </td>
                      <td>
                        {asset.assignedEmployeeName ? (
                          <>
                            <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                              {asset.assignedEmployeeName}
                            </p>
                            <p className="text-[10.5px] text-slate-400">{asset.departmentName ?? '—'}</p>
                          </>
                        ) : (
                          <span className="text-[12px] text-slate-400">Chưa cấp phát</span>
                        )}
                      </td>
                      <td>
                        <span className="text-[12px] text-slate-600 dark:text-slate-300">
                          {asset.locationName ?? '—'}
                        </span>
                        {asset.warrantyDaysLeft !== null && asset.warrantyDaysLeft >= 0 && asset.warrantyDaysLeft <= 45 && (
                          <p className="text-[10.5px] font-medium text-amber-600 dark:text-amber-400">
                            BH còn {asset.warrantyDaysLeft} ngày
                          </p>
                        )}
                      </td>
                      <td>
                        <p className="text-[12.5px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          {formatCompactCurrency(asset.currentValue)}
                        </p>
                        <p className="text-[10.5px] text-slate-400">Mua {formatCompactCurrency(asset.purchasePrice)}</p>
                      </td>
                      <td>
                        <Dropdown
                          width={210}
                          trigger={
                            <span className="icon-btn">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          }
                          ariaLabel={`Thao tác ${asset.code}`}
                        >
                          {(close) => <DropdownMenu items={actions} close={close} />}
                        </Dropdown>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              total={data?.total ?? 0}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Tag className="h-3 w-3" />
          Tổng giá trị còn lại trên trang: {formatCurrency(items.reduce((sum, asset) => sum + asset.currentValue, 0))}
        </span>
        <span>Cập nhật gần nhất: {items[0] ? formatDate(items[0].updatedAt) : '—'}</span>
      </div>

      <AssetFormDrawer
        open={formOpen}
        assetId={editingId}
        categories={categories}
        departments={departments}
        locations={locations}
        employees={employees}
        suppliers={suppliers}
        autoScan={autoScan}
        onClose={() => {
          setFormOpen(false)
          setAutoScan(false)
        }}
        onSaved={() => {
          void load()
          void loadCatalogs()
        }}
      />

      <AssetLabelModal open={labelOpen} assets={labelAssets} onClose={() => setLabelOpen(false)} />

      <AssetImportResultModal
        open={importOpen}
        result={importResult}
        onClose={() => setImportOpen(false)}
        onImported={() => setPage(1)}
      />

      {importing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-xl dark:bg-slate-900">
            <Spinner className="py-0" />
            <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
              Đang nhập dữ liệu từ Excel…
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
