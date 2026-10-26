import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Layers,
  Lock,
  MonitorSmartphone,
  QrCode,
  ShieldCheck,
  User
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { errorMessage } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Input'

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'Admin@123', role: 'Quản trị viên' },
  { username: 'manager', password: 'Manager@123', role: 'Quản lý' },
  { username: 'staff', password: 'Staff@123', role: 'Nhân viên' },
  { username: 'viewer', password: 'Viewer@123', role: 'Chỉ xem' }
]

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)
  const loggingIn = useAuthStore((state) => state.loggingIn)
  const user = useAuthStore((state) => state.user)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('Admin@123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, from, navigate])

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f4f6fb] dark:bg-[#080e1c]">
      <div className="relative hidden w-[46%] max-w-[640px] overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(56,189,248,0.4), transparent 45%)' }} />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <MonitorSmartphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[17px] font-semibold text-white">Manager Device</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-100/80">
                Quản lý tài sản nội bộ
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.03em] text-white xl:text-[40px]">
              Quản lý thiết bị gọn gàng, chính xác và minh bạch.
            </h1>
            <p className="mt-4 text-[14.5px] leading-relaxed text-blue-100/85">
              Theo dõi toàn bộ vòng đời tài sản CNTT: cấu hình, cấp phát, bảo trì, kiểm kê và khấu
              hao — tất cả trên một màn hình duy nhất, dữ liệu lưu ngay trên máy của bạn.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { icon: Layers, label: 'Danh mục & cấu hình linh hoạt' },
                { icon: QrCode, label: 'Quét QR khi kiểm kê' },
                { icon: BarChart3, label: 'Báo cáo & khấu hao tự động' },
                { icon: ShieldCheck, label: 'Phân quyền chặt chẽ' }
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/10 px-3.5 py-3 backdrop-blur-sm"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-blue-100" />
                  <span className="text-[12.5px] font-medium text-white/90">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11.5px] text-blue-100/60">
            © {new Date().getFullYear()} Manager Device · Phiên bản 1.0.0 · Dữ liệu lưu cục bộ
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="animate-modal-in w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-600/25">
              <MonitorSmartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-900 dark:text-white">Manager Device</p>
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-slate-400">Quản lý tài sản</p>
            </div>
          </div>

          <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-slate-900 dark:text-white">
            Đăng nhập hệ thống
          </h2>
          <p className="mt-1.5 text-[13.5px] muted">
            Chào mừng bạn trở lại. Vui lòng nhập thông tin tài khoản.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Tên đăng nhập" required htmlFor="username">
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  className="h-11 pl-10"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </Field>

            <Field label="Mật khẩu" required htmlFor="password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  className="h-11 pl-10 pr-10"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={loggingIn} className="w-full" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Đăng nhập
            </Button>
          </form>

          <div className="mt-7">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Tài khoản dùng thử
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => {
                    setUsername(account.username)
                    setPassword(account.password)
                    setError(null)
                  }}
                  className="group rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
                >
                  <p className="text-[12.5px] font-semibold text-slate-800 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
                    {account.username}
                  </p>
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500">{account.role}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
              Chọn tài khoản để tự động điền thông tin đăng nhập.
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Dữ liệu được mã hóa và lưu trên thiết bị của bạn
          </div>
        </div>
      </div>
    </div>
  )
}
