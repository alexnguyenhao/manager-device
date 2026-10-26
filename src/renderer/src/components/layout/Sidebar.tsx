import { NavLink, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MonitorSmartphone, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_SECTIONS } from '../../lib/nav'
import { useCurrentUser } from '../../store/auth'
import { useUiStore } from '../../store/theme'
import { hasPermission } from '@shared/constants'
import { cn } from '../../lib/cn'

export function Sidebar() {
  const user = useCurrentUser()
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const mobileOpen = useUiStore((state) => state.mobileOpen)
  const setMobileOpen = useUiStore((state) => state.setMobileOpen)
  const location = useLocation()

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.adminOnly) return user.role === 'admin'
      if (item.permission) return hasPermission(user.role, item.permission)
      return true
    })
  })).filter((section) => section.items.length > 0)

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center gap-3 px-4', collapsed && 'justify-center px-0')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-md shadow-brand-600/25">
          <MonitorSmartphone className="h-[19px] w-[19px]" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
              Quản lý thiết bị
            </p>
            <p className="truncate text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              UBND xã
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden dark:hover:bg-slate-800"
          aria-label="Đóng menu"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3">
        {sections.map((section) => (
          <div key={section.label}>
            {collapsed ? (
              <div className="mx-2 my-3 border-t border-slate-200 first:mt-1 dark:border-slate-800" />
            ) : (
              <p className="sidebar-section">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'sidebar-link',
                      active && 'sidebar-link-active',
                      collapsed && 'justify-center px-0'
                    )}
                  >
                    <Icon className={cn('h-[17px] w-[17px] shrink-0', active && 'text-brand-600 dark:text-brand-400')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-slate-200/80 p-2.5 dark:border-slate-800/80', collapsed && 'px-1.5')}>
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Thu gọn menu</span>}
          {!collapsed && <ChevronLeft className="ml-auto h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 border-r border-slate-200/80 bg-white/80 backdrop-blur transition-[width] duration-200 lg:block dark:border-slate-800/80 dark:bg-[#0b1220]/90',
          collapsed ? 'w-[72px]' : 'w-[248px]'
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-slide-in-right absolute inset-y-0 left-0 w-[264px] border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}

export function SidebarCollapseHint() {
  return (
    <span className="hidden items-center gap-1 text-[11px] text-slate-400 lg:flex">
      <ChevronRight className="h-3 w-3" /> Thu gọn
    </span>
  )
}
