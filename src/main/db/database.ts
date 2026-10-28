import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { dbPath } from '../lib/paths'
import { seedDatabase } from './seed'

let database: DatabaseSync | null = null

const SCHEMA_V1 = /* sql */ `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','staff','viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  manager_name TEXT,
  phone TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  building TEXT,
  floor TEXT,
  room TEXT,
  note TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  description TEXT,
  spec_schema TEXT NOT NULL DEFAULT '[]',
  default_depreciation_months INTEGER NOT NULL DEFAULT 60,
  default_warranty_months INTEGER NOT NULL DEFAULT 12,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_code TEXT,
  website TEXT,
  note TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  serial_number TEXT,
  model TEXT,
  manufacturer TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','in_use','maintenance','reserved','disposed','lost')),
  condition TEXT NOT NULL DEFAULT 'good'
    CHECK (condition IN ('new','good','fair','poor','broken')),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  invoice_number TEXT,
  warranty_start TEXT,
  warranty_months INTEGER NOT NULL DEFAULT 0,
  warranty_expiry TEXT,
  depreciation_months INTEGER NOT NULL DEFAULT 0,
  salvage_value REAL NOT NULL DEFAULT 0,
  specs TEXT NOT NULL DEFAULT '{}',
  note TEXT,
  image_path TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  assigned_date TEXT NOT NULL,
  expected_return_date TEXT,
  returned_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned')),
  condition_before TEXT,
  condition_after TEXT,
  note TEXT,
  return_note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('preventive','corrective','inspection','upgrade')),
  title TEXT NOT NULL,
  description TEXT,
  provider TEXT,
  assignee TEXT,
  scheduled_date TEXT,
  completed_date TEXT,
  cost REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  result TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','cancelled')),
  note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  expected_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  expected_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  actual_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  actual_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending','matched','missing','wrong_location','wrong_owner','damaged')),
  note TEXT,
  scanned_at TEXT,
  scanned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (session_id, asset_id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  entity_label TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_employee ON assets(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_search ON assets(search_text);
CREATE INDEX IF NOT EXISTS idx_assets_purchase ON assets(purchase_date);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON asset_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON asset_assignments(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedule ON maintenance_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_audit_items_session ON audit_items(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_asset ON audit_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON activity_logs(entity_type, entity_id);
`

const SCHEMA_V2 = /* sql */ `
ALTER TABLE departments ADD COLUMN block TEXT NOT NULL DEFAULT 'state'
  CHECK (block IN ('party','state'));

CREATE INDEX IF NOT EXISTS idx_departments_block ON departments(block);
`

const SCHEMA_V3 = /* sql */ `
ALTER TABLE assets ADD COLUMN allocation_type TEXT NOT NULL DEFAULT 'none';
UPDATE assets SET allocation_type = 'employee' WHERE assigned_employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_allocation ON assets(allocation_type);

CREATE TABLE IF NOT EXISTS department_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  assigned_date TEXT NOT NULL,
  returned_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned')),
  note TEXT,
  return_note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dept_assignments_asset ON department_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_dept_assignments_department ON department_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_assignments_status ON department_assignments(status);

CREATE TABLE IF NOT EXISTS it_infrastructure (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  physical_servers INTEGER NOT NULL DEFAULT 0,
  virtual_servers INTEGER NOT NULL DEFAULT 0,
  switches INTEGER NOT NULL DEFAULT 0,
  firewalls INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO it_infrastructure
  (id, physical_servers, virtual_servers, switches, firewalls, note, updated_by, updated_at)
  VALUES (1, 0, 0, 0, 0, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'));

CREATE TABLE IF NOT EXISTS it_infrastructure_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  physical_servers INTEGER NOT NULL,
  virtual_servers INTEGER NOT NULL,
  switches INTEGER NOT NULL,
  firewalls INTEGER NOT NULL,
  note TEXT,
  changes TEXT NOT NULL DEFAULT '[]',
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_infra_history_changed ON it_infrastructure_history(changed_at);

CREATE TABLE IF NOT EXISTS information_systems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  managing_unit TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  level INTEGER CHECK (level IS NULL OR level BETWEEN 1 AND 5),
  decision_number TEXT,
  decision_date TEXT,
  decision_agency TEXT,
  status TEXT NOT NULL DEFAULT 'operating'
    CHECK (status IN ('operating','building','suspended')),
  hosting_type TEXT NOT NULL DEFAULT 'none'
    CHECK (hosting_type IN ('none','physical','virtual','cloud','hybrid')),
  hosting_detail TEXT,
  asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  search_text TEXT NOT NULL DEFAULT '',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_systems_level ON information_systems(level);
CREATE INDEX IF NOT EXISTS idx_systems_status ON information_systems(status);
CREATE INDEX IF NOT EXISTS idx_systems_department ON information_systems(department_id);
CREATE INDEX IF NOT EXISTS idx_systems_decision ON information_systems(decision_number);
CREATE INDEX IF NOT EXISTS idx_systems_deleted ON information_systems(is_deleted);
CREATE INDEX IF NOT EXISTS idx_systems_search ON information_systems(search_text);

CREATE TABLE IF NOT EXISTS information_system_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  system_id INTEGER NOT NULL REFERENCES information_systems(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  document_type TEXT NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('decision','profile','other')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_files_system ON information_system_files(system_id);
`

const MIGRATIONS: string[] = [SCHEMA_V1, SCHEMA_V2, SCHEMA_V3]

export function openDatabase(): DatabaseSync {
  if (database) return database
  const file = dbPath()
  mkdirSync(dirname(file), { recursive: true })
  if (!existsSync(file)) {
    // DatabaseSync tạo file mới
  }
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  migrate(db)
  seedDatabase(db)
  database = db
  return db
}

function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined
  const current = Number(row?.user_version ?? 0)
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[version])
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

export function getDb(): DatabaseSync {
  if (!database) return openDatabase()
  return database
}

export function closeDatabase(): void {
  if (database) {
    try {
      database.close()
    } catch {
      // ignore
    }
    database = null
  }
}

export function transaction<T>(fn: () => T): T {
  const db = getDb()
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // ignore
    }
    throw error
  }
}

export function lastId(result: { lastInsertRowid: number | bigint }): number {
  return Number(result.lastInsertRowid)
}
