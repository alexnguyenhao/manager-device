import type {
  AssetStatus,
  ReportData,
  ReportGroup,
  ReportParams,
  ReportRow
} from '../../shared/types'
import { listAllAssets } from './asset.service'
import { ASSET_STATUS_META, ORG_BLOCK_META } from '../../shared/constants'
import { todayISO } from '../../shared/utils'

export function buildReport(params: ReportParams): ReportData {
  let assets = listAllAssets({
    categoryId: params.categoryId,
    departmentId: params.departmentId,
    block: params.block,
    locationId: params.locationId,
    status: (params.status as AssetStatus) ?? 'all',
    pageSize: 500
  })

  if (params.fromDate) {
    assets = assets.filter((a) => a.purchaseDate && a.purchaseDate >= params.fromDate!)
  }
  if (params.toDate) {
    assets = assets.filter((a) => a.purchaseDate && a.purchaseDate <= params.toDate!)
  }

  const rows: ReportRow[] = assets.map((asset) => ({
    id: asset.id,
    code: asset.code,
    name: asset.name,
    categoryName: asset.categoryName,
    departmentName: asset.departmentName,
    locationName: asset.locationName,
    employeeName: asset.assignedEmployeeName,
    purchaseDate: asset.purchaseDate,
    purchasePrice: asset.purchasePrice,
    currentValue: asset.currentValue,
    accumulatedDepreciation: asset.accumulatedDepreciation,
    status: asset.status,
    warrantyExpiry: asset.warrantyExpiry
  }))

  const purchaseValue = rows.reduce((sum, row) => sum + row.purchasePrice, 0)
  const currentValue = rows.reduce((sum, row) => sum + row.currentValue, 0)
  const accumulatedDepreciation = rows.reduce((sum, row) => sum + row.accumulatedDepreciation, 0)

  const categoryMap = new Map<string, ReportGroup>()
  const blockMap = new Map<string, ReportGroup>()
  const departmentMap = new Map<string, ReportGroup>()
  const statusMap = new Map<string, ReportGroup>()

  for (const asset of assets) {
    const category = categoryMap.get(asset.categoryName) ?? {
      key: asset.categoryName,
      label: asset.categoryName,
      count: 0,
      purchaseValue: 0,
      currentValue: 0
    }
    category.count += 1
    category.purchaseValue += asset.purchasePrice
    category.currentValue += asset.currentValue
    categoryMap.set(asset.categoryName, category)

    const deptKey = asset.departmentName ?? 'Chưa phân phòng ban'
    const department = departmentMap.get(deptKey) ?? {
      key: deptKey,
      label: deptKey,
      count: 0,
      purchaseValue: 0,
      currentValue: 0
    }
    department.count += 1
    department.purchaseValue += asset.purchasePrice
    department.currentValue += asset.currentValue
    departmentMap.set(deptKey, department)

    if (asset.departmentBlock) {
      const blockMeta = ORG_BLOCK_META[asset.departmentBlock]
      const block = blockMap.get(asset.departmentBlock) ?? {
        key: asset.departmentBlock,
        label: blockMeta.label,
        count: 0,
        purchaseValue: 0,
        currentValue: 0
      }
      block.count += 1
      block.purchaseValue += asset.purchasePrice
      block.currentValue += asset.currentValue
      blockMap.set(asset.departmentBlock, block)
    }

    const status = statusMap.get(asset.status) ?? {
      key: asset.status,
      label: ASSET_STATUS_META[asset.status].label,
      count: 0,
      purchaseValue: 0,
      currentValue: 0
    }
    status.count += 1
    status.purchaseValue += asset.purchasePrice
    status.currentValue += asset.currentValue
    statusMap.set(asset.status, status)
  }

  const sortGroups = (map: Map<string, ReportGroup>): ReportGroup[] =>
    [...map.values()].sort((a, b) => b.count - a.count)

  return {
    rows,
    summary: {
      total: rows.length,
      purchaseValue,
      currentValue,
      accumulatedDepreciation,
      depreciationRate: purchaseValue > 0 ? Math.round((accumulatedDepreciation / purchaseValue) * 1000) / 10 : 0
    },
    byCategory: sortGroups(categoryMap),
    byBlock: [...blockMap.values()].sort((a, b) => b.count - a.count),
    byDepartment: sortGroups(departmentMap),
    byStatus: sortGroups(statusMap),
    generatedAt: `${todayISO()}T${new Date().toTimeString().slice(0, 5)}:00`
  }
}
