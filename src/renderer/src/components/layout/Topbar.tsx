import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  UserCog,
  KeyRound,
  MonitorSmartphone
} from 'lucide-react'
import { NAV_SECTIONS } from '../../lib/nav'
import { useCurrentUser, useAuthStore } from '../../store/auth'
import { useThemeStore, useUiStore } from '../../store/theme'
import { hasPermission, ROLE_LABELS } from '@shared/constants'
import { Avatar } from '../ui/Avatar'
import { Dropdown, DropdownMenu, type MenuItem } from '../ui/Dropdown'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import { AccountModals } from './AccountModals'

function usePageTitle(): string {
  const { pathname } = useLocation()
  const flat = NAV_SECTIONS.flatMap((section) => section.items)
  const exact = flat.find((item) => item.to === pathname)
  if (exact) return exact.label
  if (pathname.startsWith('/assets/')) return 'Chi tiết thiết bị'
  if (pathname.startsWith('/audits/')) return 'Chi tiết kiểm kê'
  return 'Manager Device'
}

export function Topbar() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const logout = useAuthStore((state) => state.logout)
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const setMobileOpen = useUiStore((state) => state.setMobileOpen)
  const [search, setSearch] = useState('')
  const [accountOpen, setAccountOpen] = useState<'profile' | 'password' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const title = usePageTitle()

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const submitSearch = (event: React.FormEvent): void => {
    event.preventDefault()
    const term = search.trim()
    if (!term) return
    navigate(`/assets?search=${encodeURIComponent(term)}`)
    setSearch('')
  }

  const menuItems: MenuItem[] = [
    {
      label: 'Hồ sơ cá nhân',
      icon: <UserCog className="h-4 w-4" />,
      onClick: () => setAccountOpen('profile')
    },
    {
      label: 'Đổi mật khẩu',
      icon: <KeyRound className="h-4 w-4" />,
      onClick: () => setAccountOpen('password')
    },
    ...(hasPermission(user.role, 'settings:write')
      ? [
          {
            label: 'Cài đặt hệ thống',
            icon: <Settings className="h-4 w-4" />,
            onClick: () => navigate('/settings'),
            dividerBefore: true
          }
        ]
      : []),
    {
      label: 'Đăng xuất',
      icon: <LogOut className="h-4 w-4" />,
      danger: true,
      dividerBefore: true,
      onClick: async () => {
        await logout()
        navigate('/login', { replace: true })
      }
    }
  ]

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl md:px-6 dark:border-slate-800/80 dark:bg-[#0b1220]/85">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="icon-btn lg:hidden"
          aria-label="Mở menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 items-center gap-2 text-[13px] sm:flex">
          <MonitorSmartphone className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          <span className="font-medium text-slate-400 dark:text-slate-500">Tổng quan</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        </div>

        <form onSubmit={submitSearch} className="relative ml-auto w-full max-w-[300px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm thiết bị, mã, serial…"
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-12 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:focus:bg-slate-800"
            aria-label="Tìm kiếm nhanh"
          />
          <span className="kbd absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">Ctrl K</span>
        </form>

        {hasPermission(user.role, 'asset:write') && (
          <Button
            size="md"
            className="hidden sm:inline-flex"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/assets?new=1')}
          >
            Thêm thiết bị
          </Button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn"
          aria-label={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
          title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <Dropdown
          align="right"
          width={240}
          triggerClassName="rounded-full"
          ariaLabel="Tài khoản"
          trigger={
            <span className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-slate-100 dark:hover:bg-slate-800">
              <Avatar name={user.fullName} size="sm" />
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-[120px] truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                  {user.fullName}
                </span>
                <span className="block text-[10.5px] text-slate-400 dark:text-slate-500">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </span>
          }
        >
          {(close) => (
            <>
              <div className="mb-1 flex items-center gap-3 rounded-xl px-2.5 py-2.5">
                <Avatar name={user.fullName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                    {user.fullName}
                  </p>
                  <p className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">@{user.username}</p>
                </div>
              </div>
              <div className={cn('my-1 border-t border-slate-100 dark:border-slate-800')} />
              <DropdownMenu items={menuItems} close={close} />
            </>
          )}
        </Dropdown>
      </header>

      <AccountModals open={accountOpen} onClose={() => setAccountOpen(null)} />
    </>
  )
}
