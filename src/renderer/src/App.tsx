import { useEffect, type ReactNode } from 'react'
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom'
import { Compass, MonitorSmartphone, ShieldAlert } from 'lucide-react'
import { useAuthStore } from './store/auth'
import { ConfirmProvider } from './components/ui/Confirm'
import { Toaster } from './components/ui/Toaster'
import { Button } from './components/ui/Button'
import { EmptyState } from './components/ui/Feedback'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AssetsPage } from './pages/assets/AssetsPage'
import { AssetDetailPage } from './pages/assets/AssetDetailPage'
import { AssignmentsPage } from './pages/assignments/AssignmentsPage'
import { MaintenancePage } from './pages/maintenance/MaintenancePage'
import { AuditsPage } from './pages/audits/AuditsPage'
import { AuditDetailPage } from './pages/audits/AuditDetailPage'
import { CategoriesPage } from './pages/catalog/CategoriesPage'
import { DepartmentsPage, LocationsPage, SuppliersPage } from './pages/catalog/SimpleCatalogPages'
import { EmployeesPage } from './pages/catalog/EmployeesPage'
import { SystemsPage } from './pages/systems/SystemsPage'
import { InfrastructurePage } from './pages/systems/InfrastructurePage'
import { ReportsPage } from './pages/ReportsPage'
import { UsersPage } from './pages/users/UsersPage'
import { ActivityPage } from './pages/activity/ActivityPage'
import { SettingsPage } from './pages/settings/SettingsPage'

function BootScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f4f6fb] dark:bg-[#080e1c]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-xl shadow-brand-600/25">
        <MonitorSmartphone className="h-7 w-7" />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Quản lý thiết bị UBND xã</p>
        <p className="mt-0.5 text-[12px] text-slate-400">Đang khởi động hệ thống…</p>
      </div>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-400" />
    </div>
  )
}

function ProtectedLayout() {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <AppLayout />
}

function AdminOnly({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  if (user?.role !== 'admin') {
    return (
      <div className="table-wrap">
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="Không có quyền truy cập"
          description="Chỉ quản trị viên mới có thể truy cập chức năng này."
          action={<Button onClick={() => navigate('/')}>Về bảng điều khiển</Button>}
        />
      </div>
    )
  }
  return <>{children}</>
}

function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Compass className="h-7 w-7" />
        </div>
        <p className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-slate-200 dark:text-slate-700">
          404
        </p>
        <h1 className="mt-2 text-[17px] font-semibold text-slate-900 dark:text-white">
          Không tìm thấy trang
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            Quay lại
          </Button>
          <Button leftIcon={<Compass className="h-4 w-4" />} onClick={() => navigate('/')}>
            Về bảng điều khiển
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const init = useAuthStore((state) => state.init)
  const initializing = useAuthStore((state) => state.initializing)

  useEffect(() => {
    void init()
  }, [init])

  if (initializing) return <BootScreen />

  return (
    <ConfirmProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/audits" element={<AuditsPage />} />
            <Route path="/audits/:id" element={<AuditDetailPage />} />
            <Route path="/systems" element={<SystemsPage />} />
            <Route path="/infrastructure" element={<InfrastructurePage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/users"
              element={
                <AdminOnly>
                  <UsersPage />
                </AdminOnly>
              }
            />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </ConfirmProvider>
  )
}
