import { SQLiteDatabase } from 'expo-sqlite';
import {
  DbUser,
  DbAlert,
  DbVolunteer,
  DbContact,
  InsertContactInput,
  InsertAlertInput,
  UpsertVolunteerInput,
  TransmissionPath,
} from './types';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}


export async function upsertUser(
  db: SQLiteDatabase,
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    role: string;
    barangay?: string | null;
    address?: string | null;
    profile_photo?: string | null;
    is_volunteer?: boolean;
    is_admin?: boolean;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
    synced?: boolean;
  }
): Promise<void> {
  const ts = now();
  await db.runAsync(
    `INSERT OR REPLACE INTO users
      (id, name, phone, email, role, barangay, address, profile_photo,
       is_volunteer, is_admin, is_active, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.name,
      user.phone,
      user.email ?? null,
      user.role,
      user.barangay ?? null,
      user.address ?? null,
      user.profile_photo ?? null,
      user.is_volunteer ? 1 : 0,
      user.is_admin ? 1 : 0,
      user.is_active === false ? 0 : 1,
      user.created_at ?? ts,
      user.updated_at ?? ts,
      user.synced ? 1 : 0,
    ]
  );
}

export async function getUserById(
  db: SQLiteDatabase,
  id: string
): Promise<DbUser | null> {
  return db.getFirstAsync<DbUser>('SELECT * FROM users WHERE id = ?', [id]);
}

export async function getAllUsers(db: SQLiteDatabase): Promise<DbUser[]> {
  return db.getAllAsync<DbUser>('SELECT * FROM users ORDER BY name ASC');
}

// Admin deactivate / reactivate. Never a hard delete.
export async function setUserActive(
  db: SQLiteDatabase,
  id: string,
  active: boolean
): Promise<void> {
  await db.runAsync(
    'UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?',
    [active ? 1 : 0, now(), id]
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function insertAlert(
  db: SQLiteDatabase,
  input: InsertAlertInput
): Promise<DbAlert> {
  const id = generateId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO alerts
      (id, user_id, type, status, latitude, longitude, address, description,
       media_urls, responded_by, responded_at, resolved_at,
       transmitted_at, transmission_path, gps_source, created_at, updated_at, synced)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, 0)`,
    [
      id,
      input.userId,
      input.type,
      input.latitude ?? null,
      input.longitude ?? null,
      input.address ?? null,
      input.description ?? null,
      input.gpsSource ?? null,
      ts,
      ts,
    ]
  );
  return (await db.getFirstAsync<DbAlert>('SELECT * FROM alerts WHERE id = ?', [id]))!;
}

export async function getAlertById(
  db: SQLiteDatabase,
  id: string
): Promise<DbAlert | null> {
  return db.getFirstAsync<DbAlert>('SELECT * FROM alerts WHERE id = ?', [id]);
}

export async function getAlerts(
  db: SQLiteDatabase,
  userId?: string
): Promise<DbAlert[]> {
  if (userId) {
    return db.getAllAsync<DbAlert>(
      "SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
  }
  return db.getAllAsync<DbAlert>(
    "SELECT * FROM alerts ORDER BY created_at DESC"
  );
}

export async function getActiveAlerts(db: SQLiteDatabase): Promise<DbAlert[]> {
  return db.getAllAsync<DbAlert>(
    "SELECT * FROM alerts WHERE status = 'active' ORDER BY created_at DESC"
  );
}

// Rehydrates the map pin after an app restart. Reads from SQLite rather than a
// persisted store so a resolved alert can never leave a stale marker behind.
export async function getLatestActiveAlert(
  db: SQLiteDatabase,
  userId: string
): Promise<DbAlert | null> {
  return db.getFirstAsync<DbAlert>(
    `SELECT * FROM alerts
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
}

export async function updateAlertStatus(
  db: SQLiteDatabase,
  id: string,
  status: 'active' | 'responded' | 'resolved',
  responderId?: string,
  at?: string
): Promise<void> {
  // `at` lets the caller stamp SQLite and Firestore with the same instant.
  const ts = at ?? now();
  if (status === 'responded' && responderId) {
    await db.runAsync(
      `UPDATE alerts SET status = ?, responded_by = ?, responded_at = ?, updated_at = ?
       WHERE id = ?`,
      [status, responderId, ts, ts, id]
    );
  } else if (status === 'resolved') {
    await db.runAsync(
      `UPDATE alerts SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?`,
      [status, ts, ts, id]
    );
  } else {
    await db.runAsync(
      `UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?`,
      [status, ts, id]
    );
  }
}

export async function getUnsyncedAlerts(db: SQLiteDatabase): Promise<DbAlert[]> {
  return db.getAllAsync<DbAlert>('SELECT * FROM alerts WHERE synced = 0');
}

export async function deleteAlert(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM alerts WHERE id = ?', [id]);
}

export async function markAlertSynced(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('UPDATE alerts SET synced = 1 WHERE id = ?', [id]);
}

// First-write-wins: records the ORIGINAL delivery route. An alert sent by SMS
// while offline and pushed to Firestore later must keep transmission_path = 'sms',
// otherwise the sync sweep would silently relabel the offline sample set.
// Whether Firestore has the row is tracked separately by `synced`.
export async function markAlertTransmitted(
  db: SQLiteDatabase,
  id: string,
  path: TransmissionPath,
  at?: string
): Promise<void> {
  const ts = at ?? now();
  await db.runAsync(
    `UPDATE alerts SET transmitted_at = ?, transmission_path = ?, updated_at = ?
     WHERE id = ? AND transmitted_at IS NULL`,
    [ts, path, ts, id]
  );
}

// Materialises a Firestore-sourced alert as a real local row. Responders receive
// alerts through onSnapshot only, so without this their responded_at UPDATE
// would match zero rows.
export async function upsertAlertFromRemote(
  db: SQLiteDatabase,
  alert: DbAlert
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO alerts
      (id, user_id, type, status, latitude, longitude, address, description,
       media_urls, responded_by, responded_at, resolved_at,
       transmitted_at, transmission_path, gps_source, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      alert.id,
      alert.user_id,
      alert.type,
      alert.status,
      alert.latitude ?? null,
      alert.longitude ?? null,
      alert.address ?? null,
      alert.description ?? null,
      alert.media_urls ?? null,
      alert.responded_by ?? null,
      alert.responded_at ?? null,
      alert.resolved_at ?? null,
      alert.transmitted_at ?? null,
      alert.transmission_path ?? null,
      alert.gps_source ?? null,
      alert.created_at,
      alert.updated_at,
    ]
  );
}

// ─── Volunteers ───────────────────────────────────────────────────────────────

export async function upsertVolunteer(
  db: SQLiteDatabase,
  input: UpsertVolunteerInput
): Promise<void> {
  const ts = now();
  await db.runAsync(
    `INSERT OR REPLACE INTO volunteers
      (id, user_id, skills, availability, current_latitude, current_longitude,
       assigned_alert_id, last_seen, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      input.id,
      input.userId,
      input.skills ? JSON.stringify(input.skills) : null,
      input.availability,
      input.currentLatitude ?? null,
      input.currentLongitude ?? null,
      input.assignedAlertId ?? null,
      input.lastSeen ?? null,
      ts,
      ts,
    ]
  );
}

export async function getVolunteers(db: SQLiteDatabase): Promise<DbVolunteer[]> {
  return db.getAllAsync<DbVolunteer>(
    "SELECT * FROM volunteers ORDER BY availability ASC, last_seen DESC"
  );
}

export async function getAvailableVolunteers(
  db: SQLiteDatabase
): Promise<DbVolunteer[]> {
  return db.getAllAsync<DbVolunteer>(
    "SELECT * FROM volunteers WHERE availability = 'available'"
  );
}

export async function getUnsyncedVolunteers(
  db: SQLiteDatabase
): Promise<DbVolunteer[]> {
  return db.getAllAsync<DbVolunteer>('SELECT * FROM volunteers WHERE synced = 0');
}

export async function markVolunteerSynced(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('UPDATE volunteers SET synced = 1 WHERE id = ?', [id]);
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContacts(
  db: SQLiteDatabase,
  userId: string
): Promise<DbContact[]> {
  // System contacts always shown; user's own contacts shown after them.
  return db.getAllAsync<DbContact>(
    `SELECT * FROM contacts
     WHERE user_id = ? OR user_id = 'system'
     ORDER BY (CASE WHEN user_id = 'system' THEN 0 ELSE 1 END) ASC, name ASC`,
    [userId]
  );
}

export async function insertContact(
  db: SQLiteDatabase,
  input: InsertContactInput,
  overrideId?: string
): Promise<DbContact> {
  const id = overrideId ?? generateId();
  const ts = now();
  await db.runAsync(
    `INSERT OR IGNORE INTO contacts
      (id, user_id, name, phone, relationship, is_emergency_contact, is_primary,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.name,
      input.phone,
      input.relationship ?? null,
      input.isEmergencyContact ? 1 : 0,
      input.isPrimary ? 1 : 0,
      ts,
      ts,
    ]
  );
  return (await db.getFirstAsync<DbContact>(
    'SELECT * FROM contacts WHERE id = ?',
    [id]
  ))!;
}

export async function deleteContact(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  // Seeded contacts are removable too — a barangay may not use all three.
  await db.runAsync('DELETE FROM contacts WHERE id = ?', [id]);
}

// The contact the offline SOS SMS is addressed to. Exactly one at a time.
export async function getPrimaryContact(
  db: SQLiteDatabase,
  userId: string
): Promise<DbContact | null> {
  return db.getFirstAsync<DbContact>(
    `SELECT * FROM contacts
     WHERE is_primary = 1 AND (user_id = ? OR user_id = 'system')
     LIMIT 1`,
    [userId]
  );
}

export async function setPrimaryContact(
  db: SQLiteDatabase,
  userId: string,
  id: string
): Promise<void> {
  const ts = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE contacts SET is_primary = 0, updated_at = ?
       WHERE user_id = ? OR user_id = 'system'`,
      [ts, userId]
    );
    await db.runAsync(
      'UPDATE contacts SET is_primary = 1, updated_at = ? WHERE id = ?',
      [ts, id]
    );
  });
}
