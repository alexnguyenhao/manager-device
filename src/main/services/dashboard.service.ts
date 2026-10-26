import type { AssetStatus, DashboardData } from '../../shared/types'
import { listAllAssets } from './asset.service'
import { listAssignments } from './assignment.service'
import { listMaintenance } from './maintenance.service'
import { listLogs } from './log-list.service'
import { getSettings } from './settings.service'
import { getDb } from '../db/database'
import { addMonths, todayISO } from '../../shared/utils'

function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00`)
  date.setDate(date.getDate() + days)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getDashboard(): DashboardData {
  const settings = getSettings()
  const assets = listAllAssets({ pageSize: 500 })
  const today = todayISO()

  const counts = new Map<AssetStatus, number>()
  let totalPurchaseValue = 0
  let totalCurrentValue = 0
  const categoryMap = new Map<string, { name: string; count: number; value: number }>()
  const departmentMap = new Map<string, { name: string; count: number; value: number }>()

  for (const asset of assets) {
    counts.set(asset.status, (counts.get(asset.status) ?? 0) + 1)
    totalPurchaseValue += asset.purchasePrice
    totalCurrentValue += asset.currentValue

    const category = categoryMap.get(asset.categoryName) ?? {
      name: asset.categoryName,
      count: 0,
      value: 0
    }
    category.count += 1
    category.value += asset.currentValue
    categoryMap.set(asset.categoryName, category)

    const deptName = asset.departmentName ?? 'Chưa phân bộ phận'
    const department = departmentMap.get(deptName) ?? { name: deptName, count: 0, value: 0 }
    department.count += 1
    department.value += asset.currentValue
    departmentMap.set(deptName, department)
  }

  const warrantyLimit = addDays(today, settings.warrantyWarningDays)
  const warrantyExpiring = assets
    .filter(
      (asset) =>
        asset.warrantyExpiry &&
        asset.warrantyExpiry >= today &&
        asset.warrantyExpiry <= warrantyLimit
    )
    .sort((a, b) => String(a.warrantyExpiry).localeCompare(String(b.warrantyExpiry)))

  const maintenanceLimit = addDays(today, settings.maintenanceWarningDays)
  const allMaintenance = listMaintenance({ pageSize: 200 }).items
  const maintenanceDue = allMaintenance
    .filter(
      (record) =>
        (record.status === 'scheduled' || record.status === 'in_progress') &&
        record.scheduledDate &&
        record.scheduledDate <= maintenanceLimit
    )
    .sort((a, b) => String(a.scheduledDate).localeCompare(String(b.scheduledDate)))

  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    monthKeys.push((addMonths(today, -i) ?? today).slice(0, 7))
  }
  const costRows = getDb()
    .prepare(
      `SELECT substr(completed_date, 1, 7) AS month, SUM(cost) AS cost, COUNT(*) AS count
       FROM maintenance_records
       WHERE status = 'completed' AND completed_date >= ?
       GROUP BY month ORDER BY month`
    )
    .all(`${monthKeys[0]}-01`) as Array<{ month: string; cost: number; count: number }>
  const costByMonth = new Map(costRows.map((row) => [row.month, row]))
  const maintenanceCost = monthKeys.map((month) => {
    const row = costByMonth.get(month)
    return { month, cost: Number(row?.cost) || 0, count: Number(row?.count) || 0 }
  })

  const statuses: AssetStatus[] = [
    'available',
    'in_use',
    'maintenance',
    'reserved',
    'disposed',
    'lost'
  ]

  return {
    kpis: {
      totalAssets: assets.length,
      totalPurchaseValue,
      totalCurrentValue,
      totalDepreciation: Math.max(0, totalPurchaseValue - totalCurrentValue),
      inUse: counts.get('in_use') ?? 0,
      available: counts.get('available') ?? 0,
      maintenance: counts.get('maintenance') ?? 0,
      disposed: counts.get('disposed') ?? 0,
      warrantyExpiring: warrantyExpiring.length,
      maintenanceDue: maintenanceDue.length,
      activeAssignments: listAssignments({ status: 'active', pageSize: 5 }).total
    },
    byCategory: [...categoryMap.values()].sort((a, b) => b.count - a.count),
    byStatus: statuses
      .map((status) => ({ status, count: counts.get(status) ?? 0 }))
      .filter((item) => item.count > 0),
    byDepartment: [...departmentMap.values()].sort((a, b) => b.count - a.count),
    maintenanceCost,
    warrantyExpiring: warrantyExpiring.slice(0, 6),
    maintenanceDue: maintenanceDue.slice(0, 6),
    recentAssignments: listAssignments({ pageSize: 5 }).items,
    recentLogs: listLogs({ pageSize: 8 }).items
  }
}
