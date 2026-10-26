import type { Tone } from '@shared/constants'

export const TONE_BADGE: Record<Tone, string> = {
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  danger:
    'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20',
  neutral:
    'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/20',
  purple:
    'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/20'
}

export const TONE_SOFT: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
  purple: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400'
}

export const TONE_DOT: Record<Tone, string> = {
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  neutral: 'bg-slate-400',
  purple: 'bg-violet-500',
  teal: 'bg-teal-500'
}

export const CHART_COLORS = [
  '#2563eb',
  '#0d9488',
  '#7c3aed',
  '#d97706',
  '#e11d48',
  '#0891b2',
  '#65a30d',
  '#9333ea',
  '#f97316',
  '#64748b'
]

export const STATUS_CHART_COLORS: Record<string, string> = {
  available: '#10b981',
  in_use: '#2563eb',
  maintenance: '#f59e0b',
  reserved: '#8b5cf6',
  disposed: '#64748b',
  lost: '#e11d48'
}

export const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600'
]

export function gradientFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}
