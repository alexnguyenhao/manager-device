import { getDb } from '../db/database'
import { normalizeForSearch } from '../../shared/utils'

interface SearchRow {
  code: string
  name: string
  serial_number: string | null
  model: string | null
  manufacturer: string | null
  employee_name: string | null
  department_name: string | null
  location_name: string | null
  category_name: string | null
  specs: string | null
}

export function refreshAssetSearch(assetId: number): void {
  const row = getDb()
    .prepare(
      `SELECT a.code, a.name, a.serial_number, a.model, a.manufacturer, a.specs,
              e.full_name AS employee_name, d.name AS department_name,
              l.name AS location_name, c.name AS category_name
       FROM assets a
       LEFT JOIN employees e ON e.id = a.assigned_employee_id
       LEFT JOIN departments d ON d.id = a.department_id
       LEFT JOIN locations l ON l.id = a.location_id
       LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.id = ?`
    )
    .get(assetId) as unknown as SearchRow | undefined
  if (!row) return
  let specText = ''
  try {
    const specs = JSON.parse(row.specs ?? '{}') as Record<string, unknown>
    specText = Object.values(specs)
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value))
      .join(' ')
  } catch {
    specText = ''
  }
  const text = normalizeForSearch(
    [
      row.code,
      row.name,
      row.serial_number,
      row.model,
      row.manufacturer,
      row.employee_name,
      row.department_name,
      row.location_name,
      row.category_name,
      specText
    ]
      .filter(Boolean)
      .join(' ')
  )
  getDb().prepare('UPDATE assets SET search_text = ? WHERE id = ?').run(text, assetId)
}

export function refreshAllAssetSearch(): void {
  const rows = getDb().prepare('SELECT id FROM assets').all() as Array<{ id: number }>
  for (const row of rows) refreshAssetSearch(Number(row.id))
}
