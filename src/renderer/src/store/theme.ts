import { create } from 'zustand'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'manager-device-theme'

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  localStorage.setItem(STORAGE_KEY, theme)
}

const initial = initialTheme()
applyTheme(initial)

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  }
}))

interface UiState {
  sidebarCollapsed: boolean
  mobileOpen: boolean
  toggleSidebar: () => void
  setMobileOpen: (open: boolean) => void
}

const collapsed = localStorage.getItem('manager-device-sidebar') === '1'

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: collapsed,
  mobileOpen: false,
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    localStorage.setItem('manager-device-sidebar', next ? '1' : '0')
    set({ sidebarCollapsed: next })
  },
  setMobileOpen: (open) => set({ mobileOpen: open })
}))
