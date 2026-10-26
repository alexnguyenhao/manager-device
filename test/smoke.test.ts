import { existsSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'

const dataDir = process.env.MD_TEST_DATA
if (!dataDir) throw new Error('Missing MD_TEST_DATA')

async function main(): Promise<void> {
  const { openDatabase, getDb, closeDatabase } = await import('../src/main/db/database')
  const { login } = await import('../src/main/services/auth.service')
  const { listAssets, createAsset, getAssetDetail } = await import('../src/main/services/asset.service')
  const { listCategories, listEmployees, saveCategory } = await import(
    '../src/main/services/catalog.service'
  )
  const { createAssignment, returnAssignment } = await import(
    '../src/main/services/assignment.service'
  )
  const { createMaintenance, completeMaintenance, updateMaintenance } = await import(
    '../src/main/services/maintenance.service'
  )
  const { createAudit, scanAuditItem, completeAudit, getAuditDetail } = await import(
    '../src/main/services/audit.service'
  )
  const { getDashboard } = await import('../src/main/services/dashboard.service')
  const { buildReport } = await import('../src/main/services/report.service')
  const { getSettings, updateSettings, createBackup, restoreBackup, getAppInfo } = await import(
    '../src/main/services/settings.service'
  )
  const { listUsers, createUser, updateUser, deleteUser, resetPassword } = await import(
    '../src/main/services/user.service'
  )
  const { listLogs } = await import('../src/main/services/log-list.service')
  const { exportAssetsExcel, exportReportExcel, downloadImportTemplate, importAssetsExcel } = await import(
    '../src/main/services/excel.service'
  )
  const { findSpecPreset, getEffectiveSpecFields } = await import('../src/shared/spec-presets')

  openDatabase()
  const db = getDb()

  const pcPreset = findSpecPreset({ code: 'PC', name: 'Máy tính để bàn' })
  if (!pcPreset) throw new Error('Missing PC spec preset')
  if (pcPreset.categoryName !== 'Máy tính để bàn') {
    throw new Error(`PC preset category name mismatch: ${pcPreset.categoryName}`)
  }
  for (const key of ['cpu', 'ram', 'gpu', 'storage', 'os']) {
    if (!pcPreset.fields.some((field) => field.key === key)) {
      throw new Error(`PC preset missing field: ${key}`)
    }
  }
  const laptopFallback = getEffectiveSpecFields({ code: 'LAPTOP', name: 'Laptop', specSchema: [] })
  if (laptopFallback.length === 0) throw new Error('Laptop preset fallback failed')
  for (const key of ['cpu', 'ram', 'gpu', 'storage', 'os']) {
    if (!laptopFallback.some((field) => field.key === key)) {
      throw new Error(`Laptop fallback missing field: ${key}`)
    }
  }
  const customFields = getEffectiveSpecFields({
    code: 'PC',
    name: 'Máy tính để bàn',
    specSchema: [{ key: 'custom', label: 'Tùy chỉnh', type: 'text' }]
  })
  if (customFields.length !== 1 || customFields[0].key !== 'custom') {
    throw new Error('Custom spec schema should take precedence over preset')
  }

  const assetCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM assets').get() as { count: number }).count
  )
  if (assetCount < 20) throw new Error(`Seed assets failed: ${assetCount}`)
  const userCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count
  )
  if (userCount !== 4) throw new Error(`Seed users failed: ${userCount}`)

  const admin = login('admin', 'Admin@123')
  if (admin.role !== 'admin') throw new Error('Login failed')

  const settings = getSettings()
  if (!settings.companyName) throw new Error('Settings failed')
  const changedSettings = updateSettings({ warrantyWarningDays: 45, maintenanceWarningDays: 10 }, admin)
  if (changedSettings.warrantyWarningDays !== 45) throw new Error('Settings update failed')

  const tester = createUser(
    {
      username: 'tester',
      password: 'Tester@123',
      fullName: 'Người dùng kiểm thử',
      role: 'staff',
      isActive: true
    },
    admin
  )
  if (tester.role !== 'staff' || !tester.isActive) throw new Error('User create failed')
  const changedUser = updateUser(
    tester.id,
    { username: 'tester', fullName: 'Người dùng kiểm thử 2', role: 'viewer', isActive: false },
    admin
  )
  if (changedUser.role !== 'viewer' || changedUser.isActive) throw new Error('User update failed')
  resetPassword(tester.id, 'NewPass@123', admin)
  deleteUser(tester.id, admin)
  if (listUsers().some((item) => item.id === tester.id)) throw new Error('User delete failed')

  const logs = listLogs({ page: 1, pageSize: 20 })
  if (logs.total < 1) throw new Error('Activity log query failed')

  const search = listAssets({ search: 'may in', pageSize: 50 })
  if (search.total < 3) throw new Error(`Accent-insensitive search failed: ${search.total}`)

  const categories = listCategories()
  const employees = listEmployees()
  const pcCategory = categories.find((c) => c.code === 'PC')
  if (!pcCategory) throw new Error('Missing PC category')
  const employee = employees[0]

  let rejectedInUse = false
  try {
    createAsset(
      { name: 'Thiết bị thiếu người sử dụng', categoryId: pcCategory.id, status: 'in_use' },
      admin
    )
  } catch {
    rejectedInUse = true
  }
  if (!rejectedInUse) throw new Error('in_use without employee should be rejected')

  let rejectedCategoryName = false
  try {
    saveCategory({ code: 'PC2', name: pcCategory.name, prefix: 'PC2' }, admin)
  } catch {
    rejectedCategoryName = true
  }
  if (!rejectedCategoryName) throw new Error('Duplicate category name should be rejected')

  const created = createAsset(
    {
      name: 'Máy tính kiểm thử',
      categoryId: pcCategory.id,
      serialNumber: 'TEST-SERIAL-001',
      status: 'available',
      condition: 'new',
      purchasePrice: 15000000,
      purchaseDate: new Date().toISOString().slice(0, 10),
      warrantyMonths: 24,
      depreciationMonths: 60,
      specs: {
        cpu: 'Intel Core i5-12400',
        ram: 16,
        storage: 'SSD NVMe 512GB',
        gpu: 'Intel UHD 730',
        os: 'Windows 11 Pro'
      }
    },
    admin
  )
  if (!created.code.startsWith('PC-')) throw new Error(`Bad code: ${created.code}`)
  if (
    created.specs.cpu !== 'Intel Core i5-12400' ||
    Number(created.specs.ram) !== 16 ||
    created.specs.storage !== 'SSD NVMe 512GB' ||
    created.specs.gpu !== 'Intel UHD 730' ||
    created.specs.os !== 'Windows 11 Pro'
  ) {
    throw new Error(`Spec persistence failed: ${JSON.stringify(created.specs)}`)
  }
  const specSearch = listAssets({ search: 'Intel Core i5-12400', pageSize: 50 })
  if (!specSearch.items.some((item) => item.id === created.id)) {
    throw new Error('Search by device configuration failed')
  }

  const assignment = createAssignment(
    {
      assetId: created.id,
      employeeId: employee.id,
      assignedDate: new Date().toISOString().slice(0, 10),
      conditionBefore: 'new',
      note: 'Kiểm thử cấp phát'
    },
    admin
  )
  if (assignment.status !== 'active') throw new Error('Assignment failed')

  const returned = returnAssignment(
    {
      assignmentId: assignment.id,
      returnedDate: new Date().toISOString().slice(0, 10),
      conditionAfter: 'good',
      note: 'Kiểm thử thu hồi'
    },
    admin
  )
  if (returned.status !== 'returned') throw new Error('Return failed')

  const maintenance = createMaintenance(
    {
      assetId: created.id,
      type: 'inspection',
      title: 'Kiểm tra máy kiểm thử',
      scheduledDate: new Date().toISOString().slice(0, 10),
      priority: 'normal'
    },
    admin
  )
  const inProgress = updateMaintenance(
    { id: maintenance.id, status: 'in_progress', assetId: created.id },
    admin
  )
  if (inProgress.status !== 'in_progress') throw new Error('Maintenance start failed')
  const otherAsset = listAssets({ pageSize: 5 }).items.find((item) => item.id !== created.id)
  if (!otherAsset) throw new Error('Missing second asset for maintenance guard test')
  let rejectedAssetChange = false
  try {
    updateMaintenance({ id: maintenance.id, assetId: otherAsset.id }, admin)
  } catch {
    rejectedAssetChange = true
  }
  if (!rejectedAssetChange) throw new Error('Changing asset on in-progress maintenance should fail')

  const completed = completeMaintenance(
    maintenance.id,
    { result: 'Hoạt động tốt', cost: 100000 },
    admin
  )
  if (completed.status !== 'completed') throw new Error('Maintenance completion failed')

  const parallelOne = createMaintenance(
    { assetId: created.id, type: 'inspection', title: 'Bảo trì song song 1' },
    admin
  )
  const parallelTwo = createMaintenance(
    { assetId: created.id, type: 'inspection', title: 'Bảo trì song song 2' },
    admin
  )
  updateMaintenance({ id: parallelOne.id, status: 'in_progress' }, admin)
  updateMaintenance({ id: parallelTwo.id, status: 'in_progress' }, admin)
  completeMaintenance(parallelOne.id, { result: 'Hoàn thành phiếu 1' }, admin)
  if (getAssetDetail(created.id).asset.status !== 'maintenance') {
    throw new Error('Asset should stay in maintenance while another record is in progress')
  }
  completeMaintenance(parallelTwo.id, { result: 'Hoàn thành phiếu 2' }, admin)
  if (getAssetDetail(created.id).asset.status === 'maintenance') {
    throw new Error('Asset should leave maintenance after all records complete')
  }

  const audit = createAudit(
    {
      name: 'Phiên kiểm kê kiểm thử',
      startDate: new Date().toISOString().slice(0, 10)
    },
    admin
  )
  if (audit.totalItems < 1) throw new Error('Audit creation failed')
  const scanned = await Promise.resolve(scanAuditItem({ sessionId: audit.id, code: created.code }, admin))
  const scannedItem = scanned.items.find((i) => i.assetId === created.id)
  if (!scannedItem || scannedItem.result === 'pending') throw new Error('Audit scan failed')
  const completedAudit = completeAudit({ sessionId: audit.id }, admin)
  if (completedAudit.status !== 'completed') throw new Error('Audit complete failed')

  const dashboard = getDashboard()
  if (dashboard.kpis.totalAssets !== assetCount + 1) {
    throw new Error(`Dashboard count mismatch: ${dashboard.kpis.totalAssets}`)
  }
  if (!dashboard.maintenanceCost.length) throw new Error('Dashboard chart data failed')

  const report = buildReport({ status: 'all' })
  if (report.summary.total !== assetCount + 1) throw new Error('Report failed')

  const savePath = process.env.MD_TEST_SAVE
  if (savePath) {
    const exported = await exportAssetsExcel({ search: '' }, admin)
    if (exported.canceled || !existsSync(savePath)) throw new Error('Excel export failed')
    const templatePath = `${savePath}.template.xlsx`
    process.env.MD_TEST_SAVE = templatePath
    const template = await downloadImportTemplate(admin)
    if (template.canceled || !existsSync(templatePath)) throw new Error('Template failed')

    const reportPath = `${savePath}.report.xlsx`
    process.env.MD_TEST_SAVE = reportPath
    const reportExport = await exportReportExcel({ status: 'all' }, admin)
    if (reportExport.canceled || !existsSync(reportPath)) {
      throw new Error('Report export failed')
    }

    const importFile = join(dataDir, 'import.xlsx')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Nhập thiết bị')
    sheet.addRow([
      'Mã thiết bị',
      'Tên thiết bị',
      'Danh mục',
      'Serial',
      'Trạng thái',
      'Tình trạng',
      'Bộ phận',
      'Vị trí',
      'Người sử dụng',
      'Ngày mua',
      'Giá mua',
      'Tháng bảo hành',
      'Tháng khấu hao'
    ])
    sheet.addRow([
      '',
      'Máy in nhập từ Excel',
      'Máy in',
      'IMPORT-SN-001',
      'Sẵn sàng',
      'Tốt',
      'Phòng Kinh tế',
      'Kho thiết bị',
      '',
      '01/10/2026',
      '5.500.000',
      12,
      48
    ])
    await workbook.xlsx.writeFile(importFile)
    process.env.MD_TEST_IMPORT = importFile
    const imported = await importAssetsExcel(admin)
    if (imported.imported !== 1) {
      throw new Error(`Excel import failed: ${JSON.stringify(imported.errors)}`)
    }
  }

  const detail = getAssetDetail(created.id)
  if (detail.logs.length === 0) throw new Error('Asset logs missing')

  const previousSave = process.env.MD_TEST_SAVE
  const previousImport = process.env.MD_TEST_IMPORT
  const backupFile = join(dataDir, 'smoke-backup.db')

  process.env.MD_TEST_SAVE = getAppInfo().dbPath
  let rejectedLiveBackup = false
  try {
    await createBackup(admin)
  } catch {
    rejectedLiveBackup = true
  }
  if (!rejectedLiveBackup) throw new Error('Backup over the live database should be rejected')

  process.env.MD_TEST_SAVE = backupFile
  const backup = await createBackup(admin)
  if (backup.canceled || !existsSync(backupFile)) throw new Error('Backup creation failed')

  const countBeforeRestore = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM assets').get() as { count: number }).count
  )
  createAsset(
    { name: 'Thiết bị sau sao lưu', categoryId: pcCategory.id, status: 'available' },
    admin
  )

  process.env.MD_TEST_IMPORT = getAppInfo().dbPath
  let rejectedLiveRestore = false
  try {
    await restoreBackup(admin)
  } catch {
    rejectedLiveRestore = true
  }
  if (!rejectedLiveRestore) throw new Error('Restore from the live database should be rejected')

  process.env.MD_TEST_IMPORT = backupFile
  const restored = await restoreBackup(admin)
  if (!restored.restored) throw new Error('Restore failed')
  const countAfterRestore = Number(
    (getDb().prepare('SELECT COUNT(*) AS count FROM assets').get() as { count: number }).count
  )
  if (countAfterRestore !== countBeforeRestore) {
    throw new Error(`Restore count mismatch: ${countAfterRestore} != ${countBeforeRestore}`)
  }

  if (previousSave === undefined) delete process.env.MD_TEST_SAVE
  else process.env.MD_TEST_SAVE = previousSave
  if (previousImport === undefined) delete process.env.MD_TEST_IMPORT
  else process.env.MD_TEST_IMPORT = previousImport

  console.log('SMOKE TEST PASSED')
  console.log(
    JSON.stringify(
      {
        assets: dashboard.kpis.totalAssets,
        categories: categories.length,
        employees: employees.length,
        reportTotal: report.summary.total,
        createdAsset: created.code
      },
      null,
      2
    )
  )
  closeDatabase()
}

main().catch((error) => {
  console.error('SMOKE TEST FAILED')
  console.error(error)
  process.exit(1)
})
