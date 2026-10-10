import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'barangay_sos.db';

export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'resident',
    barangay TEXT,
    address TEXT,
    profile_photo TEXT,
    is_volunteer INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );
`;

export const CREATE_ALERTS_TABLE = `
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    latitude REAL,
    longitude REAL,
    address TEXT,
    description TEXT,
    media_urls TEXT,
    responded_by TEXT,
    responded_at TEXT,
    resolved_at TEXT,
    transmitted_at TEXT,
    transmission_path TEXT,
    gps_source TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`;

export const CREATE_VOLUNTEERS_TABLE = `
  CREATE TABLE IF NOT EXISTS volunteers (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    skills TEXT,
    availability TEXT NOT NULL DEFAULT 'available',
    current_latitude REAL,
    current_longitude REAL,
    assigned_alert_id TEXT,
    last_seen TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`;

export const CREATE_CONTACTS_TABLE = `
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT,
    is_emergency_contact INTEGER NOT NULL DEFAULT 0,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`;

export const ALL_SCHEMAS = [
  CREATE_USERS_TABLE,
  CREATE_ALERTS_TABLE,
  CREATE_VOLUNTEERS_TABLE,
  CREATE_CONTACTS_TABLE,
];


export const ALERT_MIGRATION_COLUMNS: Record<string, string> = {
  transmitted_at: 'TEXT',
  transmission_path: 'TEXT',
  gps_source: 'TEXT',
  responded_at: 'TEXT',
};


export const USER_MIGRATION_COLUMNS: Record<string, string> = {
  is_admin: 'INTEGER NOT NULL DEFAULT 0',
  is_active: 'INTEGER NOT NULL DEFAULT 1',
};


export const CONTACT_MIGRATION_COLUMNS: Record<string, string> = {
  is_primary: 'INTEGER NOT NULL DEFAULT 0',
};


async function addMissingColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
  columns: Record<string, string>
): Promise<void> {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const have = new Set(info.map((c) => c.name));
  for (const [name, ddl] of Object.entries(columns)) {
    if (!have.has(name)) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    }
  }
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(ALL_SCHEMAS.join('\n'));
  await addMissingColumns(db, 'alerts', ALERT_MIGRATION_COLUMNS);
  await addMissingColumns(db, 'users', USER_MIGRATION_COLUMNS);
  await addMissingColumns(db, 'contacts', CONTACT_MIGRATION_COLUMNS);
  return db;
}
