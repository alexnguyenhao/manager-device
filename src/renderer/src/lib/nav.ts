import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  History,
  LayoutDashboard,
  MapPin,
  MonitorSmartphone,
  Network,
  ServerCog,
  Settings,
  ShieldCheck,
  Tags,
  Truck,
  Users,
  Wrench
} from 'lucide-react'
import type { Permission } from '@shared/constants'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  permission?: Permission
  adminOnly?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Tổng quan',
    items: [{ label: 'Bảng điều khiển', to: '/', icon: LayoutDashboard }]
  },
  {
    label: 'Quản lý tài sản',
    items: [
      { label: 'Thiết bị', to: '/assets', icon: MonitorSmartphone },
      { label: 'Cấp phát', to: '/assignments', icon: ArrowLeftRight },
      { label: 'Bảo trì & sửa chữa', to: '/maintenance', icon: Wrench },
      { label: 'Kiểm kê', to: '/audits', icon: ClipboardCheck }
    ]
  },
  {
    label: 'Hạ tầng & HTTT',
    items: [
      { label: 'Hệ thống thông tin', to: '/systems', icon: ServerCog, permission: 'report:read' },
      { label: 'Hạ tầng CNTT', to: '/infrastructure', icon: Network, permission: 'report:read' }
    ]
  },
  {
    label: 'Danh mục',
    items: [
      { label: 'Danh mục thiết bị', to: '/categories', icon: Tags },
      { label: 'Cơ cấu tổ chức', to: '/departments', icon: Building2 },
      { label: 'Vị trí', to: '/locations', icon: MapPin },
      { label: 'Nhà cung cấp', to: '/suppliers', icon: Truck },
      { label: 'Nhân viên', to: '/employees', icon: Users }
    ]
  },
  {
    label: 'Hệ thống',
    items: [
      { label: 'Báo cáo', to: '/reports', icon: BarChart3, permission: 'report:read' },
      { label: 'Người dùng', to: '/users', icon: ShieldCheck, adminOnly: true },
      { label: 'Nhật ký hoạt động', to: '/activity', icon: History, permission: 'log:read' },
      { label: 'Cài đặt', to: '/settings', icon: Settings }
    ]
  }
]
