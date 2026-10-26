import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Check,
  CircleAlert,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Database,
  Download,
  FolderOpen,
  FolderSync,
  HardDrive,
  Info,
  KeyRound,
  Link2,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Upload
} from 'lucide-react'
import type {
  AppInfo,
  AppSettings,
  BackupConfig,
  BackupEntry,
  BackupOverview,
  DriveStatus
} from '@shared/types'
import { hasPermission } from '@shared/constants'
import { formatDateTime, formatNumber } from '@shared/utils'
import { api, errorMessage } from '../../lib/api'
import { useCurrentUser } from '../../store/auth'
import { toast } from '../../store/toast'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Switch, Textarea } from '../../components/ui/Input'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { useConfirm } from '../../components/ui/Confirm'
import { cn } from '../../lib/cn'

type SettingsTab = 'company' | 'system' | 'data' | 'about'

const TABS: TabItem<SettingsTab>[] = [
  { value: 'company', label: 'Thông tin đơn vị', icon: <Building2 className="h-3.5 w-3.5" /> },
  { value: 'system', label: 'Thiết lập hệ thống', icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  { value: 'data', label: 'Dữ liệu & sao lưu', icon: <Database className="h-3.5 w-3.5" /> },
  { value: 'about', label: 'Thông tin ứng dụng', icon: <Info className="h-3.5 w-3.5" /> }
]

const BACKUP_TARGET_LABELS: Record<string, string> = {
  manual: 'Tệp thủ công',
  folder: 'Thư mục sao lưu',
  drive: 'Google Drive',
  'folder+drive': 'Thư mục + Google Drive'
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} KB`
  return `${formatNumber(bytes / (1024 * 1024), 2)} MB`
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 dark:border-slate-800">
      <span className="w-[150px] shrink-0 text-[12px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="break-all font-mono text-[11.5px] text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}

export function SettingsPage() {
  const user = useCurrentUser()
  const confirm = useConfirm()
  const [tab, setTab] = useState<SettingsTab>('company')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [backup, setBackup] = useState<BackupOverview | null>(null)
  const [backupDraft, setBackupDraft] = useState<BackupConfig | null>(null)
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null)
  const [folderBackups, setFolderBackups] = useState<BackupEntry[]>([])
  const [driveBackups, setDriveBackups] = useState<BackupEntry[]>([])
  const [driveForm, setDriveForm] = useState({ clientId: '', clientSecret: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<
    | 'backup'
    | 'restore'
    | 'clear'
    | 'folder-backup'
    | 'folder-restore'
    | 'folder-choose'
    | 'backup-config'
    | 'drive-save'
    | 'drive-connect'
    | 'drive-disconnect'
    | 'drive-backup'
    | 'drive-restore'
    | 'drive-remove'
    | null
  >(null)

  const canWrite = hasPermission(user.role, 'settings:write')
  const canBackup = hasPermission(user.role, 'backup')

  const refreshFolderBackups = useCallback(async () => {
    if (!canBackup) return
    try {
      setFolderBackups(await api.backup.listFolder())
    } catch {
      setFolderBackups([])
    }
  }, [canBackup])

  const refreshDriveBackups = useCallback(async () => {
    if (!canBackup) return
    try {
      setDriveBackups(await api.drive.list())
    } catch {
      setDriveBackups([])
    }
  }, [canBackup])

  const applyBackupOverview = useCallback(
    (overview: BackupOverview) => {
      setBackup(overview)
      setBackupDraft(overview.config)
      void refreshFolderBackups()
    },
    [refreshFolderBackups]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsResult, infoResult, backupResult, driveResult] = await Promise.all([
        api.settings.get(),
        api.app.info(),
        api.backup.overview(),
        api.drive.status()
      ])
      setSettings(settingsResult)
      setDraft(settingsResult)
      setAppInfo(infoResult)
      applyBackupOverview(backupResult)
      setDriveStatus(driveResult)
      setDriveForm({ clientId: driveResult.clientId, clientSecret: '' })
      if (driveResult.connected) void refreshDriveBackups()
      else setDriveBackups([])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [applyBackupOverview, refreshDriveBackups])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = Boolean(
    settings && draft && JSON.stringify(settings) !== JSON.stringify(draft)
  )
  const backupDirty = Boolean(
    backup && backupDraft && JSON.stringify(backup.config) !== JSON.stringify(backupDraft)
  )

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    if (!draft.companyName.trim()) {
      setError('Vui lòng nhập tên đơn vị.')
      setTab('company')
      return
    }
    if (draft.companyEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.companyEmail.trim())) {
      setError('Email đơn vị không hợp lệ.')
      setTab('company')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await api.settings.update(draft)
      setSettings(saved)
      setDraft(saved)
      toast.success('Đã lưu cài đặt', 'Thay đổi được áp dụng ngay trên toàn hệ thống.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const backupToFile = async (): Promise<void> => {
    setBusyAction('backup')
    try {
      const result = await api.settings.backup()
      if (!result.canceled) {
        toast.success('Đã sao lưu dữ liệu', result.path)
        void load()
      }
    } catch (err) {
      toast.error('Không thể sao lưu dữ liệu', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const restore = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Phục hồi từ tệp sao lưu?',
      description:
        'Toàn bộ dữ liệu hiện tại sẽ được thay thế bằng dữ liệu trong tệp sao lưu. Ứng dụng sẽ tự khởi động lại sau khi phục hồi.',
      confirmText: 'Chọn tệp phục hồi'
    })
    if (!ok) return
    setBusyAction('restore')
    try {
      const result = await api.settings.restore()
      if (result.restored) {
        toast.info('Đang phục hồi dữ liệu', 'Ứng dụng sẽ khởi động lại trong giây lát…')
      }
    } catch (err) {
      toast.error('Không thể phục hồi dữ liệu', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const clearData = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Xóa toàn bộ dữ liệu nghiệp vụ?',
      description:
        'Tất cả thiết bị, cấp phát, bảo trì, kiểm kê, tệp đính kèm và nhật ký hoạt động sẽ bị xóa vĩnh viễn.\n\nTài khoản người dùng, danh mục, nhân viên và cài đặt hệ thống vẫn được giữ lại. Hãy sao lưu dữ liệu trước khi tiếp tục.',
      confirmText: 'Xóa toàn bộ dữ liệu'
    })
    if (!ok) return
    setBusyAction('clear')
    try {
      const result = await api.settings.clearDemoData()
      toast.success('Đã xóa dữ liệu nghiệp vụ', `${formatNumber(result.removed)} thiết bị đã được xóa.`)
      void load()
    } catch (err) {
      toast.error('Không thể xóa dữ liệu', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const openDataFolder = async (): Promise<void> => {
    try {
      await api.settings.openDataFolder()
    } catch (err) {
      toast.error('Không thể mở thư mục dữ liệu', errorMessage(err))
    }
  }

  const copy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Đã sao chép đường dẫn')
    } catch {
      toast.error('Không thể sao chép', 'Vui lòng sao chép thủ công từ ô văn bản.')
    }
  }

  const updateBackup = <K extends keyof BackupConfig>(key: K, value: BackupConfig[K]): void => {
    setBackupDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const saveBackupConfig = async (): Promise<void> => {
    if (!backupDraft) return
    setBusyAction('backup-config')
    try {
      const overview = await api.backup.updateConfig(backupDraft)
      applyBackupOverview(overview)
      toast.success('Đã lưu thiết lập sao lưu')
    } catch (err) {
      toast.error('Không thể lưu thiết lập sao lưu', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const chooseFolder = async (): Promise<void> => {
    setBusyAction('folder-choose')
    try {
      const overview = await api.backup.chooseFolder(backupDraft ?? undefined)
      if (overview) {
        applyBackupOverview(overview)
        toast.success('Đã chọn thư mục sao lưu', overview.config.backupFolder)
      }
    } catch (err) {
      toast.error('Không thể chọn thư mục sao lưu', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const folderBackup = async (): Promise<void> => {
    setBusyAction('folder-backup')
    try {
      const result = await api.backup.folderNow()
      toast.success('Đã sao lưu vào thư mục', result.path)
      applyBackupOverview(await api.backup.overview())
    } catch (err) {
      toast.error('Không thể sao lưu vào thư mục', errorMessage(err))
      applyBackupOverview(await api.backup.overview())
    } finally {
      setBusyAction(null)
    }
  }

  const restoreFolder = async (entry: BackupEntry): Promise<void> => {
    const ok = await confirm({
      title: 'Phục hồi từ bản sao lưu này?',
      description: `Toàn bộ dữ liệu hiện tại sẽ được thay thế bằng bản sao lưu:\n${entry.name}\n\nỨng dụng sẽ tự khởi động lại sau khi phục hồi.`,
      confirmText: 'Phục hồi'
    })
    if (!ok) return
    setBusyAction('folder-restore')
    try {
      const result = await api.backup.restoreFolder(entry.name)
      if (result.restored) {
        toast.info('Đang phục hồi dữ liệu', 'Ứng dụng sẽ khởi động lại trong giây lát…')
      }
    } catch (err) {
      toast.error('Không thể phục hồi dữ liệu', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const saveDriveConfig = async (): Promise<void> => {
    if (!driveForm.clientId.trim()) {
      toast.error('Thiếu OAuth Client ID', 'Vui lòng nhập Client ID từ Google Cloud Console.')
      return
    }
    setBusyAction('drive-save')
    try {
      const status = await api.drive.saveConfig({
        clientId: driveForm.clientId,
        clientSecret: driveForm.clientSecret.trim() || undefined
      })
      setDriveStatus(status)
      setDriveForm({ clientId: status.clientId, clientSecret: '' })
      toast.success('Đã lưu cấu hình Google Drive')
    } catch (err) {
      toast.error('Không thể lưu cấu hình Google Drive', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const connectDrive = async (): Promise<void> => {
    if (!driveForm.clientId.trim()) {
      toast.error('Thiếu OAuth Client ID', 'Vui lòng nhập Client ID từ Google Cloud Console.')
      return
    }
    const configChanged =
      driveForm.clientId.trim() !== (driveStatus?.clientId ?? '') ||
      driveForm.clientSecret.trim().length > 0
    setBusyAction('drive-connect')
    try {
      if (configChanged) {
        const status = await api.drive.saveConfig({
          clientId: driveForm.clientId,
          clientSecret: driveForm.clientSecret.trim() || undefined
        })
        setDriveStatus(status)
        setDriveForm({ clientId: status.clientId, clientSecret: '' })
      }
      const result = await api.drive.connect()
      const status = await api.drive.status()
      setDriveStatus(status)
      setDriveForm({ clientId: status.clientId, clientSecret: '' })
      toast.success(
        'Đã kết nối Google Drive',
        result.accountEmail ? `Tài khoản: ${result.accountEmail}` : undefined
      )
      void refreshDriveBackups()
    } catch (err) {
      toast.error('Không thể kết nối Google Drive', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const disconnectDrive = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Ngắt kết nối Google Drive?',
      description:
        'Ứng dụng sẽ xóa token đăng nhập đã lưu. Các bản sao lưu trên Google Drive vẫn được giữ nguyên.',
      confirmText: 'Ngắt kết nối'
    })
    if (!ok) return
    setBusyAction('drive-disconnect')
    try {
      const status = await api.drive.disconnect()
      setDriveStatus(status)
      setDriveBackups([])
      toast.success('Đã ngắt kết nối Google Drive')
    } catch (err) {
      toast.error('Không thể ngắt kết nối Google Drive', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const driveBackup = async (): Promise<void> => {
    setBusyAction('drive-backup')
    try {
      const entry = await api.drive.backup()
      toast.success('Đã sao lưu lên Google Drive', entry.name)
      applyBackupOverview(await api.backup.overview())
      void refreshDriveBackups()
      setDriveStatus(await api.drive.status())
    } catch (err) {
      toast.error('Không thể sao lưu lên Google Drive', errorMessage(err))
      applyBackupOverview(await api.backup.overview())
    } finally {
      setBusyAction(null)
    }
  }

  const restoreDrive = async (entry: BackupEntry): Promise<void> => {
    if (!entry.id) return
    const ok = await confirm({
      title: 'Phục hồi từ Google Drive?',
      description: `Toàn bộ dữ liệu hiện tại sẽ được thay thế bằng bản sao lưu:\n${entry.name}\n\nỨng dụng sẽ tự khởi động lại sau khi phục hồi.`,
      confirmText: 'Phục hồi'
    })
    if (!ok) return
    setBusyAction('drive-restore')
    try {
      const result = await api.drive.restore(entry.id)
      if (result.restored) {
        toast.info('Đang phục hồi dữ liệu', 'Ứng dụng sẽ khởi động lại trong giây lát…')
      }
    } catch (err) {
      toast.error('Không thể phục hồi từ Google Drive', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const removeDrive = async (entry: BackupEntry): Promise<void> => {
    if (!entry.id) return
    const ok = await confirm({
      title: 'Xóa bản sao lưu trên Google Drive?',
      description: `Bản sao lưu "${entry.name}" sẽ bị xóa khỏi Google Drive. Thao tác không thể hoàn tác.`,
      confirmText: 'Xóa vĩnh viễn'
    })
    if (!ok) return
    setBusyAction('drive-remove')
    try {
      await api.drive.remove(entry.id)
      toast.success('Đã xóa bản sao lưu trên Google Drive')
      void refreshDriveBackups()
    } catch (err) {
      toast.error('Không thể xóa bản sao lưu', errorMessage(err))
    } finally {
      setBusyAction(null)
    }
  }

  const autoNeedsTarget = Boolean(
    backup?.config.autoBackupEnabled &&
      !backup.config.backupFolder &&
      !(backup.config.driveBackupEnabled && driveStatus?.connected)
  )
  const lastStatusTone =
    backup?.state.lastBackupStatus === 'success'
      ? 'success'
      : backup?.state.lastBackupStatus === 'failed'
        ? 'danger'
        : 'neutral'
  const backupBusy = busyAction !== null

  if (loading) {
    return <Spinner className="py-32" />
  }

  if (!settings || !draft) {
    return (
      <div className="table-wrap">
        <EmptyState
          icon={<CircleAlert className="h-6 w-6" />}
          title="Không thể tải cài đặt"
          description={error ?? 'Vui lòng thử lại sau.'}
          action={<Button onClick={() => void load()}>Thử lại</Button>}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Cài đặt hệ thống"
        description="Thông tin đơn vị, quy tắc cảnh báo, dữ liệu cục bộ và sao lưu phục hồi."
        icon={<SettingsIcon className="h-5 w-5" />}
        meta={
          <>
            <Badge tone="info">Phiên bản {appInfo?.version ?? '1.0.0'}</Badge>
            {canWrite ? (
              <Badge tone="success" dot>
                Bạn có quyền chỉnh sửa
              </Badge>
            ) : (
              <Badge tone="neutral">Chỉ xem</Badge>
            )}
            {dirty && <Badge tone="warning">Có thay đổi chưa lưu</Badge>}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />}
              onClick={() => void load()}
              disabled={saving}
            >
              Tải lại
            </Button>
            {canWrite && (
              <>
                {dirty && (
                  <Button
                    variant="ghost"
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => {
                      setDraft(settings)
                      setError(null)
                    }}
                    disabled={saving}
                  >
                    Hoàn tác
                  </Button>
                )}
                <Button
                  leftIcon={<Save className="h-4 w-4" />}
                  loading={saving}
                  onClick={() => void save()}
                  disabled={!dirty}
                >
                  Lưu thay đổi
                </Button>
              </>
            )}
          </>
        }
      />

      {!canWrite && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-[12.5px] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Vai trò của bạn chỉ được xem cài đặt. Liên hệ quản trị viên để thay đổi thông tin hệ thống.
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Tabs items={TABS} value={tab} onChange={setTab} variant="pill" className="mb-3" />

      {tab === 'company' && (
        <div className="grid gap-3 xl:grid-cols-3">
          <div className="card p-4 xl:col-span-2">
            <h2 className="section-title">Thông tin đơn vị</h2>
            <p className="mt-0.5 text-[11.5px] muted">
              Thông tin này hiển thị trên phiếu cấp phát, nhãn thiết bị và báo cáo xuất ra.
            </p>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <Field label="Tên đơn vị" required className="sm:col-span-2" htmlFor="set-company-name">
                <Input
                  id="set-company-name"
                  value={draft.companyName}
                  disabled={!canWrite}
                  placeholder="Ủy ban nhân dân xã An Bình"
                  onChange={(event) => update('companyName', event.target.value)}
                />
              </Field>
              <Field label="Mã số thuế" htmlFor="set-tax">
                <Input
                  id="set-tax"
                  value={draft.companyTaxCode}
                  disabled={!canWrite}
                  placeholder="5701234567"
                  onChange={(event) => update('companyTaxCode', event.target.value)}
                />
              </Field>
              <Field label="Số điện thoại" htmlFor="set-phone">
                <Input
                  id="set-phone"
                  value={draft.companyPhone}
                  disabled={!canWrite}
                  placeholder="0229 xxxx xxx"
                  onChange={(event) => update('companyPhone', event.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="set-email">
                <Input
                  id="set-email"
                  type="email"
                  value={draft.companyEmail}
                  disabled={!canWrite}
                  placeholder="ubnd@anbinh.gov.vn"
                  onChange={(event) => update('companyEmail', event.target.value)}
                />
              </Field>
              <Field label="Website" htmlFor="set-website">
                <Input
                  id="set-website"
                  value={draft.companyWebsite}
                  disabled={!canWrite}
                  placeholder="https://anbinh.gov.vn"
                  onChange={(event) => update('companyWebsite', event.target.value)}
                />
              </Field>
              <Field label="Địa chỉ" className="sm:col-span-2" htmlFor="set-address">
                <Textarea
                  id="set-address"
                  value={draft.companyAddress}
                  disabled={!canWrite}
                  placeholder="Số nhà, đường, thôn/xóm, xã, huyện, tỉnh/thành phố"
                  onChange={(event) => update('companyAddress', event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {draft.companyName || 'Chưa đặt tên đơn vị'}
                  </p>
                  <p className="text-[11px] text-slate-400">Thông tin hiển thị trên báo cáo</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                <p>{draft.companyAddress || 'Chưa có địa chỉ'}</p>
                <p>{draft.companyPhone || 'Chưa có số điện thoại'}</p>
                <p>{draft.companyEmail || 'Chưa có email'}</p>
                {draft.companyTaxCode && <p>MST: {draft.companyTaxCode}</p>}
                {draft.companyWebsite && <p>{draft.companyWebsite}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 p-4 text-[11.5px] leading-relaxed text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <Info className="h-3.5 w-3.5" /> Gợi ý
              </p>
              Điền đầy đủ thông tin đơn vị giúp phiếu bàn giao và báo cáo xuất Excel chuyên nghiệp hơn.
            </div>
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div className="grid gap-3 xl:grid-cols-3">
          <div className="card p-4 xl:col-span-2">
            <h2 className="section-title">Quy tắc cảnh báo & khấu hao</h2>
            <p className="mt-0.5 text-[11.5px] muted">
              Các ngưỡng này được dùng để tính cảnh báo trên bảng điều khiển và khi thêm thiết bị mới.
            </p>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <Field
                label="Cảnh báo bảo hành trước (ngày)"
                hint="Thiết bị có bảo hành hết hạn trong khoảng này sẽ được cảnh báo."
                htmlFor="set-warranty-days"
              >
                <Input
                  id="set-warranty-days"
                  type="number"
                  min={0}
                  max={3650}
                  value={draft.warrantyWarningDays}
                  disabled={!canWrite}
                  onChange={(event) => update('warrantyWarningDays', Number(event.target.value) || 0)}
                />
              </Field>
              <Field
                label="Cảnh báo bảo trì trước (ngày)"
                hint="Phiếu bảo trì đến hạn trong khoảng này sẽ được nhắc."
                htmlFor="set-maintenance-days"
              >
                <Input
                  id="set-maintenance-days"
                  type="number"
                  min={0}
                  max={3650}
                  value={draft.maintenanceWarningDays}
                  disabled={!canWrite}
                  onChange={(event) => update('maintenanceWarningDays', Number(event.target.value) || 0)}
                />
              </Field>
              <Field
                label="Khấu hao mặc định (tháng)"
                hint="Áp dụng cho thiết bị mới nếu danh mục chưa khai báo."
                htmlFor="set-dep-months"
              >
                <Input
                  id="set-dep-months"
                  type="number"
                  min={0}
                  max={1200}
                  value={draft.defaultDepreciationMonths}
                  disabled={!canWrite}
                  onChange={(event) => update('defaultDepreciationMonths', Number(event.target.value) || 0)}
                />
              </Field>
              <Field label="Định dạng ngày" htmlFor="set-date-format">
                <Select
                  id="set-date-format"
                  value={draft.dateFormat}
                  disabled={!canWrite}
                  onChange={(event) => update('dateFormat', event.target.value)}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </Select>
              </Field>
              <Field label="Đơn vị tiền tệ" htmlFor="set-currency">
                <Select
                  id="set-currency"
                  value={draft.currency}
                  disabled={!canWrite}
                  onChange={(event) => update('currency', event.target.value)}
                >
                  <option value="VND">VND — Việt Nam đồng</option>
                  <option value="USD">USD — Đô la Mỹ</option>
                </Select>
              </Field>
              <Field label="Thông báo khi đăng nhập" htmlFor="set-login-notice" className="sm:col-span-2">
                <Input
                  id="set-login-notice"
                  value={draft.loginNotice}
                  disabled={!canWrite}
                  placeholder="Hệ thống quản lý thiết bị nội bộ"
                  onChange={(event) => update('loginNotice', event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            <div className="card p-4">
              <h2 className="section-title">Xem trước cảnh báo</h2>
              <div className="mt-3 space-y-2.5 text-[12px]">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Bảo hành</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    trước {formatNumber(draft.warrantyWarningDays)} ngày
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Bảo trì</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    trước {formatNumber(draft.maintenanceWarningDays)} ngày
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Khấu hao</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {formatNumber(draft.defaultDepreciationMonths)} tháng
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-[11.5px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Lưu ý
              </p>
              Giá trị còn lại của thiết bị được tính tự động theo khấu hao đường thẳng, không thấp hơn giá
              trị thanh lý đã khai báo.
            </div>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="card p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <h2 className="section-title">Vị trí lưu trữ dữ liệu</h2>
            </div>
            <p className="mt-1 text-[11.5px] muted">
              Dữ liệu được lưu cục bộ trên máy tính. Chỉ khi bạn bật sao lưu Google Drive, bản
              snapshot mới được tải lên tài khoản Drive của bạn.
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/30">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                Thư mục dữ liệu
              </p>
              <div className="mt-1 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-slate-700 dark:text-slate-200">
                  {appInfo?.dataPath ?? '—'}
                </code>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => appInfo && void copy(appInfo.dataPath)}
                  aria-label="Sao chép đường dẫn dữ liệu"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3 w-3" /> CSDL: {formatBytes(appInfo?.dbSize ?? 0)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MonitorSmartphone className="h-3 w-3" /> {appInfo?.platform ?? '—'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                leftIcon={<FolderOpen className="h-4 w-4" />}
                onClick={() => void openDataFolder()}
              >
                Mở thư mục dữ liệu
              </Button>
              {canBackup && (
                <Button
                  leftIcon={<Download className="h-4 w-4" />}
                  loading={busyAction === 'backup'}
                  onClick={() => void backupToFile()}
                >
                  Sao lưu ngay
                </Button>
              )}
            </div>
            <div className="mt-3 space-y-1">
              <InfoRow label="Tệp cơ sở dữ liệu" value={appInfo?.dbPath ?? '—'} />
              <InfoRow label="Thư mục tệp đính kèm" value={appInfo?.uploadsPath ?? '—'} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="section-title">Sao lưu & phục hồi</h2>
              </div>
              <p className="mt-1 text-[11.5px] muted">
                Sao lưu tạo một tệp <code className="font-mono text-[11px]">.db</code> duy nhất. Phục hồi
                sẽ thay thế toàn bộ dữ liệu hiện tại và khởi động lại ứng dụng.
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center dark:border-slate-700">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                      Sao lưu dữ liệu
                    </p>
                    <p className="text-[11px] text-slate-400">Lưu bản sao để phòng mất dữ liệu.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Download className="h-3.5 w-3.5" />}
                    onClick={() => void backupToFile()}
                    loading={busyAction === 'backup'}
                    disabled={!canBackup || busyAction !== null}
                  >
                    Sao lưu
                  </Button>
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center dark:border-slate-700">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                      Phục hồi dữ liệu
                    </p>
                    <p className="text-[11px] text-slate-400">Chọn tệp .db đã sao lưu trước đó.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Upload className="h-3.5 w-3.5" />}
                    onClick={() => void restore()}
                    loading={busyAction === 'restore'}
                    disabled={!canWrite || busyAction !== null}
                  >
                    Phục hồi
                  </Button>
                </div>
              </div>
              {!canBackup && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <KeyRound className="h-3 w-3" /> Vai trò của bạn không có quyền sao lưu dữ liệu.
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/50 dark:border-rose-500/20 dark:bg-rose-500/5">
              <div className="flex items-center gap-2 border-b border-rose-200/70 px-4 py-3 dark:border-rose-500/20">
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <h2 className="text-[13.5px] font-semibold text-rose-700 dark:text-rose-300">
                  Vùng nguy hiểm
                </h2>
              </div>
              <div className="p-4">
                <p className="text-[12px] leading-relaxed text-rose-700/90 dark:text-rose-300/90">
                  Xóa toàn bộ dữ liệu nghiệp vụ để bắt đầu lại. Tài khoản, danh mục, nhân viên và cài đặt
                  được giữ nguyên.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-3"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => void clearData()}
                  loading={busyAction === 'clear'}
                  disabled={!canWrite || busyAction !== null}
                >
                  Xóa dữ liệu nghiệp vụ
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 xl:col-span-2">
            <div className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderSync className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h2 className="section-title">Sao lưu tự động</h2>
                </div>
                <Badge tone={backup?.config.autoBackupEnabled ? 'success' : 'neutral'} dot>
                  {backup?.config.autoBackupEnabled ? 'Đang bật' : 'Đang tắt'}
                </Badge>
              </div>
              <p className="mt-1 text-[11.5px] muted">
                Tự động tạo bản snapshot khi đóng ứng dụng và mỗi ngày một lần khi ứng dụng đang mở. Bản
                snapshot dùng <code className="font-mono text-[11px]">VACUUM INTO</code> nên an toàn với
                cơ sở dữ liệu đang chạy.
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  <Switch
                    checked={backupDraft?.autoBackupEnabled ?? false}
                    onChange={(checked) => updateBackup('autoBackupEnabled', checked)}
                    disabled={!canWrite || backupBusy}
                    label="Bật sao lưu tự động"
                    description="Khi đóng app và mỗi 24 giờ nếu app đang mở."
                  />

                  <Field
                    label="Thư mục sao lưu"
                    hint="Có thể chọn thư mục Google Drive for desktop (ví dụ G:\My Drive\Manager Device) hoặc thư mục bất kỳ."
                  >
                    <div className="flex min-w-0 gap-2">
                      <Input
                        readOnly
                        value={backupDraft?.backupFolder ?? ''}
                        placeholder="Chưa chọn thư mục sao lưu"
                        className="font-mono text-[11.5px]"
                      />
                      <Button
                        variant="outline"
                        leftIcon={<FolderOpen className="h-3.5 w-3.5" />}
                        onClick={() => void chooseFolder()}
                        loading={busyAction === 'folder-choose'}
                        disabled={!canWrite || backupBusy}
                      >
                        Chọn
                      </Button>
                    </div>
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Số bản sao lưu giữ lại"
                      hint="Bản cũ nhất sẽ tự động bị xóa."
                      htmlFor="backup-retention"
                    >
                      <Input
                        id="backup-retention"
                        type="number"
                        min={1}
                        max={100}
                        value={backupDraft?.retention ?? 7}
                        disabled={!canWrite || backupBusy}
                        onChange={(event) =>
                          updateBackup('retention', Math.max(1, Number(event.target.value) || 1))
                        }
                      />
                    </Field>
                    <div className="flex items-end pb-1">
                      <Switch
                        checked={backupDraft?.driveBackupEnabled ?? false}
                        onChange={(checked) => updateBackup('driveBackupEnabled', checked)}
                        disabled={!canWrite || backupBusy || !driveStatus?.connected}
                        label="Kèm Google Drive"
                        description={
                          driveStatus?.connected
                            ? 'Tải bản snapshot lên Drive khi sao lưu tự động.'
                            : 'Kết nối Google Drive bên dưới để bật.'
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      leftIcon={<Save className="h-3.5 w-3.5" />}
                      onClick={() => void saveBackupConfig()}
                      loading={busyAction === 'backup-config'}
                      disabled={!canWrite || !backupDirty || backupBusy}
                    >
                      Lưu thiết lập
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Download className="h-3.5 w-3.5" />}
                      onClick={() => void folderBackup()}
                      loading={busyAction === 'folder-backup'}
                      disabled={!canBackup || !backup?.config.backupFolder || backupBusy}
                    >
                      Sao lưu ngay
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                      onClick={() => void refreshFolderBackups()}
                      disabled={backupBusy}
                    >
                      Làm mới
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                      Lần sao lưu gần nhất
                    </p>
                    <Badge tone={lastStatusTone} dot>
                      {backup?.state.lastBackupStatus === 'success'
                        ? 'Thành công'
                        : backup?.state.lastBackupStatus === 'failed'
                          ? 'Thất bại'
                          : 'Chưa có'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {backup?.state.lastBackupAt ? formatDateTime(backup.state.lastBackupAt) : 'Chưa sao lưu'}
                  </p>
                  <div className="mt-1.5 space-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                    <p>
                      Đích:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {backup?.state.lastBackupTarget
                          ? (BACKUP_TARGET_LABELS[backup.state.lastBackupTarget] ??
                            backup.state.lastBackupTarget)
                          : '—'}
                      </span>
                    </p>
                    <p className="break-all">
                      Tệp:{' '}
                      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-200">
                        {backup?.state.lastBackupFile ?? '—'}
                      </span>
                    </p>
                    {backup?.lastAutoBackupAt && (
                      <p>Tự động gần nhất: {formatDateTime(backup.lastAutoBackupAt)}</p>
                    )}
                  </div>
                  {backup?.state.lastBackupMessage && (
                    <p
                      className={cn(
                        'mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed',
                        backup.state.lastBackupStatus === 'failed'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                          : 'bg-white text-slate-500 dark:bg-slate-900/50 dark:text-slate-400'
                      )}
                    >
                      {backup.state.lastBackupMessage}
                    </p>
                  )}
                  {autoNeedsTarget && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Sao lưu tự động đang bật nhưng chưa có đích. Hãy chọn thư mục hoặc kết nối Google
                      Drive.
                    </p>
                  )}
                  {backup?.config.backupFolder && !backup.folderAvailable && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Không truy cập được thư mục sao lưu. Nếu đây là thư mục Google Drive, hãy kiểm tra
                      Google Drive for desktop đang chạy.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                    Bản sao lưu trong thư mục ({formatNumber(folderBackups.length)})
                  </p>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void refreshFolderBackups()}
                    disabled={backupBusy || !backup?.config.backupFolder}
                    aria-label="Làm mới danh sách bản sao lưu"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {!backup?.config.backupFolder ? (
                  <p className="mt-2 text-[11.5px] text-slate-400">
                    Chọn thư mục sao lưu để xem danh sách bản sao lưu tại đây.
                  </p>
                ) : folderBackups.length === 0 ? (
                  <p className="mt-2 text-[11.5px] text-slate-400">
                    Chưa có bản sao lưu nào trong thư mục này.
                  </p>
                ) : (
                  <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    {folderBackups.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center dark:border-slate-800"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-all font-mono text-[11.5px] font-medium text-slate-800 dark:text-slate-100">
                            {entry.name}
                          </p>
                          <p className="mt-0.5 text-[10.5px] text-slate-400">
                            {formatDateTime(entry.createdAt)} · {formatBytes(entry.size)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<RotateCcw className="h-3 w-3" />}
                          onClick={() => void restoreFolder(entry)}
                          loading={busyAction === 'folder-restore'}
                          disabled={!canWrite || backupBusy}
                        >
                          Phục hồi
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <h2 className="section-title">Google Drive trực tiếp</h2>
                </div>
                <Badge
                  tone={driveStatus?.connected ? 'success' : driveStatus?.configured ? 'warning' : 'neutral'}
                  dot
                >
                  {driveStatus?.connected
                    ? 'Đã kết nối'
                    : driveStatus?.configured
                      ? 'Chưa kết nối'
                      : 'Chưa cấu hình'}
                </Badge>
              </div>
              <p className="mt-1 text-[11.5px] muted">
                Kết nối trực tiếp bằng Google Drive API để tải bản sao lưu lên Drive mà không cần cài
                Google Drive for desktop. Ứng dụng chỉ có quyền với các tệp do chính nó tạo ra
                (<code className="font-mono text-[10.5px]">drive.file</code>).
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Field
                    label="OAuth Client ID"
                    hint="Tạo OAuth client loại Desktop app trong Google Cloud Console."
                    htmlFor="drive-client-id"
                  >
                    <Input
                      id="drive-client-id"
                      value={driveForm.clientId}
                      disabled={!canWrite || backupBusy}
                      placeholder="xxxxxxxx.apps.googleusercontent.com"
                      className="font-mono text-[11.5px]"
                      onChange={(event) =>
                        setDriveForm((prev) => ({ ...prev, clientId: event.target.value }))
                      }
                    />
                  </Field>
                  <Field
                    label="OAuth Client Secret"
                    hint={
                      driveStatus?.secretConfigured
                        ? 'Client Secret đã được lưu. Để trống nếu không thay đổi.'
                        : 'Client Secret được lưu cục bộ và mã hóa bằng Windows safeStorage khi có thể.'
                    }
                    htmlFor="drive-client-secret"
                  >
                    <Input
                      id="drive-client-secret"
                      type="password"
                      value={driveForm.clientSecret}
                      disabled={!canWrite || backupBusy}
                      placeholder={driveStatus?.secretConfigured ? '•••••••••••• (đã lưu)' : 'Client Secret'}
                      autoComplete="off"
                      onChange={(event) =>
                        setDriveForm((prev) => ({ ...prev, clientSecret: event.target.value }))
                      }
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Save className="h-3.5 w-3.5" />}
                      onClick={() => void saveDriveConfig()}
                      loading={busyAction === 'drive-save'}
                      disabled={!canWrite || backupBusy}
                    >
                      Lưu cấu hình
                    </Button>
                    <Button
                      size="sm"
                      leftIcon={<Link2 className="h-3.5 w-3.5" />}
                      onClick={() => void connectDrive()}
                      loading={busyAction === 'drive-connect'}
                      disabled={!canWrite || backupBusy}
                    >
                      {driveStatus?.connected ? 'Kết nối lại' : 'Kết nối Google Drive'}
                    </Button>
                    {driveStatus?.connected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<LogOut className="h-3.5 w-3.5" />}
                        onClick={() => void disconnectDrive()}
                        loading={busyAction === 'drive-disconnect'}
                        disabled={!canWrite || backupBusy}
                      >
                        Ngắt kết nối
                      </Button>
                    )}
                  </div>
                  <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/30">
                    <summary className="cursor-pointer text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
                      Hướng dẫn tạo OAuth Client
                    </summary>
                    <ol className="mt-2 list-inside list-decimal space-y-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      <li>Mở Google Cloud Console, tạo hoặc chọn một project.</li>
                      <li>Bật Google Drive API trong mục APIs &amp; Services.</li>
                      <li>Cấu hình OAuth consent screen (Internal hoặc External).</li>
                      <li>
                        Vào Credentials → Create credentials → OAuth client ID → chọn Desktop app.
                      </li>
                      <li>Dán Client ID và Client Secret vào ô bên trên rồi bấm Kết nối.</li>
                    </ol>
                  </details>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                        Trạng thái Drive
                      </p>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => void refreshDriveBackups()}
                        disabled={!driveStatus?.connected || backupBusy}
                        aria-label="Làm mới danh sách Google Drive"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="mt-1.5 break-all text-[12.5px] font-medium text-slate-800 dark:text-slate-100">
                      {driveStatus?.accountEmail ?? 'Chưa có tài khoản Google'}
                    </p>
                    <div className="mt-1.5 space-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                      <p>Đồng bộ gần nhất: {driveStatus?.lastSyncAt ? formatDateTime(driveStatus.lastSyncAt) : '—'}</p>
                      <p className="break-all">
                        Thư mục Drive:{' '}
                        <span className="font-mono text-[10.5px]">
                          {driveStatus?.folderId ?? 'Manager Device Backups (tự tạo)'}
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        leftIcon={<CloudUpload className="h-3.5 w-3.5" />}
                        onClick={() => void driveBackup()}
                        loading={busyAction === 'drive-backup'}
                        disabled={!canBackup || !driveStatus?.connected || backupBusy}
                      >
                        Sao lưu lên Drive
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<CloudDownload className="h-3.5 w-3.5" />}
                        onClick={() => void refreshDriveBackups()}
                        disabled={!driveStatus?.connected || backupBusy}
                      >
                        Danh sách
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                      Bản sao lưu trên Google Drive ({formatNumber(driveBackups.length)})
                    </p>
                    {!driveStatus?.connected ? (
                      <p className="mt-1.5 text-[11.5px] text-slate-400">
                        Kết nối Google Drive để xem và phục hồi bản sao lưu trực tuyến.
                      </p>
                    ) : driveBackups.length === 0 ? (
                      <p className="mt-1.5 text-[11.5px] text-slate-400">
                        Chưa có bản sao lưu nào trên Google Drive.
                      </p>
                    ) : (
                      <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        {driveBackups.map((entry) => (
                          <div
                            key={entry.id ?? entry.name}
                            className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center dark:border-slate-800"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="break-all font-mono text-[11.5px] font-medium text-slate-800 dark:text-slate-100">
                                {entry.name}
                              </p>
                              <p className="mt-0.5 text-[10.5px] text-slate-400">
                                {formatDateTime(entry.createdAt)} · {formatBytes(entry.size)}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                leftIcon={<RotateCcw className="h-3 w-3" />}
                                onClick={() => void restoreDrive(entry)}
                                loading={busyAction === 'drive-restore'}
                                disabled={!canWrite || backupBusy}
                              >
                                Phục hồi
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => void removeDrive(entry)}
                                loading={busyAction === 'drive-remove'}
                                disabled={!canBackup || backupBusy}
                                aria-label={`Xóa ${entry.name}`}
                              >
                                <Trash2 className="h-3 w-3 text-rose-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'about' && (
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-600/25">
                <MonitorSmartphone className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">Manager Device</h2>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Phần mềm quản lý thiết bị và tài sản CNTT nội bộ
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="info">Phiên bản {appInfo?.version ?? '1.0.0'}</Badge>
                  <Badge tone="success" dot>
                    Dữ liệu cục bộ
                  </Badge>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-0">
              <InfoRow label="Phiên bản ứng dụng" value={appInfo?.version ?? '—'} />
              <InfoRow label="Electron" value={appInfo?.electronVersion ?? '—'} />
              <InfoRow label="Node.js" value={appInfo?.nodeVersion ?? '—'} />
              <InfoRow label="Nền tảng" value={appInfo?.platform ?? '—'} />
              <InfoRow label="Cơ sở dữ liệu" value={formatBytes(appInfo?.dbSize ?? 0)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="card p-4">
              <h2 className="section-title">Đường dẫn hệ thống</h2>
              <p className="mt-0.5 text-[11.5px] muted">
                Dữ liệu được lưu trong thư mục người dùng của Windows.
              </p>
              <div className="mt-2 space-y-0">
                <InfoRow label="Thư mục dữ liệu" value={appInfo?.dataPath ?? '—'} />
                <InfoRow label="Tệp CSDL" value={appInfo?.dbPath ?? '—'} />
                <InfoRow label="Tệp đính kèm" value={appInfo?.uploadsPath ?? '—'} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<FolderOpen className="h-3.5 w-3.5" />}
                  onClick={() => void openDataFolder()}
                >
                  Mở thư mục
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Copy className="h-3.5 w-3.5" />}
                  onClick={() => appInfo && void copy(appInfo.dbPath)}
                >
                  Sao chép đường dẫn CSDL
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-[11.5px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Bảo mật & dữ liệu
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>Mật khẩu được băm bằng bcrypt, không lưu dạng văn bản.</li>
                <li>Mọi thao tác đều được kiểm tra quyền ở tiến trình chính.</li>
                <li>Dữ liệu chỉ rời máy khi bạn chủ động bật sao lưu Google Drive.</li>
                <li>Nên sao lưu định kỳ và cất giữ tệp sao lưu ở nơi an toàn.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
