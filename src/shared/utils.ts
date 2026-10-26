/* ==========================================================================
 * Tiện ích dùng chung
 * ========================================================================== */

export function nowISO(): string {
  return new Date().toISOString()
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isValidDate(value?: string | null): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time)
}

export function daysBetween(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null
  const start = new Date(`${from.slice(0, 10)}T00:00:00`)
  const end = new Date(`${to.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

export function addMonths(dateISO: string | null | undefined, months: number): string | null {
  if (!dateISO) return null
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function monthsElapsed(from?: string | null, to?: string | null): number {
  if (!from || !to) return 0
  const start = new Date(`${from.slice(0, 10)}T00:00:00`)
  const end = new Date(`${to.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

export interface DepreciationInput {
  purchaseDate: string | null
  purchasePrice: number
  depreciationMonths: number
  salvageValue: number
}

export interface DepreciationResult {
  currentValue: number
  accumulatedDepreciation: number
  monthlyDepreciation: number
  ageMonths: number
}

/**
 * Khấu hao đường thẳng theo tháng.
 * Giá trị còn lại không thấp hơn giá trị thanh lý.
 */
export function computeDepreciation(
  input: DepreciationInput,
  toDate: string = todayISO()
): DepreciationResult {
  const price = Math.max(0, Number(input.purchasePrice) || 0)
  const salvage = Math.min(Math.max(0, Number(input.salvageValue) || 0), price)
  const ageMonths = monthsElapsed(input.purchaseDate, toDate)
  const months = Math.max(0, Math.floor(Number(input.depreciationMonths) || 0))

  if (price <= 0 || months <= 0 || !input.purchaseDate) {
    return {
      currentValue: price,
      accumulatedDepreciation: 0,
      monthlyDepreciation: 0,
      ageMonths
    }
  }

  const depreciable = price - salvage
  const monthly = depreciable / months
  const elapsed = Math.min(ageMonths, months)
  const accumulated = Math.round(monthly * elapsed)
  const current = Math.round(Math.max(salvage, price - accumulated))

  return {
    currentValue: current,
    accumulatedDepreciation: Math.min(price, Math.round(accumulated)),
    monthlyDepreciation: Math.round(monthly),
    ageMonths
  }
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu */
export function removeDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function normalizeForSearch(value?: string | null): string {
  return removeDiacritics(String(value ?? ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(Number(value) || 0)
}

export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value) || 0)
}

export function formatCompactCurrency(value: number | null | undefined): string {
  const n = Number(value) || 0
  if (Math.abs(n) >= 1_000_000_000) return `${formatNumber(n / 1_000_000_000, 1)} tỷ`
  if (Math.abs(n) >= 1_000_000) return `${formatNumber(n / 1_000_000, 1)} tr`
  if (Math.abs(n) >= 1_000) return `${formatNumber(n / 1_000, 0)} nghìn`
  return formatNumber(n)
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return '—'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return formatDate(value)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '')
    const n = Number(cleaned)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function avatarColor(seed: string): string {
  const colors = [
    '#2563eb',
    '#0891b2',
    '#059669',
    '#d97706',
    '#dc2626',
    '#7c3aed',
    '#db2777',
    '#475569'
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return colors[hash % colors.length]
}

export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export function percent(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}
