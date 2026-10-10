// Alerts and users are pulled from BOTH SQLite and Firestore and merged, so no
// record is missed: locally created rows that never synced exist only on the
// device, while responder-side timestamps exist only in Firestore.

import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { firestoreDB } from './firebase';
import { alertService } from './alertService';
import { getDatabase } from '../db/database';
import {
  getAlerts,
  getAllUsers as sqlGetAllUsers,
  setUserActive as sqlSetUserActive,
  upsertUser,
} from '../db/queries';
import { DbAlert, DbUser } from '../db/types';

const USERS_COLLECTION = 'users';

function mergeAlert(local: DbAlert, remote: DbAlert): DbAlert {
  return {
    ...local,
    status: remote.status ?? local.status,
    responded_by: remote.responded_by ?? local.responded_by,
    responded_at: remote.responded_at ?? local.responded_at,
    resolved_at: remote.resolved_at ?? local.resolved_at,
    transmitted_at: local.transmitted_at ?? remote.transmitted_at,
    transmission_path: local.transmission_path ?? remote.transmission_path,
    gps_source: local.gps_source ?? remote.gps_source,
    latitude: local.latitude ?? remote.latitude,
    longitude: local.longitude ?? remote.longitude,
    address: local.address ?? remote.address,
    description: local.description ?? remote.description,
  };
}

function mapDocToUser(id: string, data: any): DbUser {
  return {
    id,
    name: data.displayName ?? data.name ?? '(unnamed)',
    phone: data.phone ?? '',
    email: data.email ?? null,
    role: data.role ?? 'user',
    barangay: data.barangay ?? null,
    address: data.address ?? null,
    profile_photo: data.profilePhoto ?? null,
    is_volunteer: data.isVolunteer ? 1 : 0,
    is_admin: data.isAdmin === true ? 1 : 0,
    is_active: data.isActive === false ? 0 : 1,
    created_at: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    updated_at: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    synced: 1,
  };
}

export interface AlertStatistics {
  total: number;
  transmitted: number;
  successRatePct: number;
  respondedCount: number;
  avgResponseSeconds: number | null;
  byCategory: Array<{ key: string; count: number }>;
  byPath: { online: number; sms: number; untransmitted: number };
}

export function computeStatistics(alerts: DbAlert[]): AlertStatistics {
  const total = alerts.length;
  const transmitted = alerts.filter((a) => !!a.transmitted_at).length;

  // Response Time is SYSTEM latency: responded_at - created_at, both device clock.
  const latencies = alerts
    .filter((a) => a.responded_at && a.created_at)
    .map((a) => (Date.parse(a.responded_at as string) - Date.parse(a.created_at)) / 1000)
    .filter((s) => Number.isFinite(s) && s >= 0);

  const categories = new Map<string, number>();
  for (const a of alerts) {
    categories.set(a.type, (categories.get(a.type) ?? 0) + 1);
  }

  return {
    total,
    transmitted,
    successRatePct: total === 0 ? 0 : (transmitted / total) * 100,
    respondedCount: latencies.length,
    avgResponseSeconds:
      latencies.length === 0
        ? null
        : latencies.reduce((sum, s) => sum + s, 0) / latencies.length,
    byCategory: [...categories.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    byPath: {
      online: alerts.filter((a) => a.transmission_path === 'online').length,
      sms: alerts.filter((a) => a.transmission_path === 'sms').length,
      untransmitted: alerts.filter((a) => !a.transmission_path).length,
    },
  };
}

// The first eight columns are the Chapter 4 data source; the rest support the
// GPS Accuracy metric and manual cross-checking.
const CSV_HEADERS = [
  'id',
  'type',
  'status',
  'created_at',
  'transmitted_at',
  'responded_at',
  'transmission_path',
  'gps_source',
  'response_time_seconds',
  'resolved_at',
  'latitude',
  'longitude',
  'address',
  'user_id',
  'responded_by',
  'synced',
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function responseSeconds(alert: DbAlert): string {
  if (!alert.responded_at || !alert.created_at) return '';
  const seconds = (Date.parse(alert.responded_at) - Date.parse(alert.created_at)) / 1000;
  return Number.isFinite(seconds) ? seconds.toFixed(3) : '';
}

export function buildAlertsCsv(alerts: DbAlert[]): string {
  const rows = alerts.map((a) =>
    [
      a.id,
      a.type,
      a.status,
      a.created_at,
      a.transmitted_at,
      a.responded_at,
      a.transmission_path,
      a.gps_source,
      responseSeconds(a),
      a.resolved_at,
      a.latitude,
      a.longitude,
      a.address,
      a.user_id,
      a.responded_by,
      a.synced,
    ]
      .map(csvEscape)
      .join(',')
  );
  // CRLF keeps Excel happy on Windows
  return [CSV_HEADERS.join(','), ...rows].join('\r\n');
}

export interface ExportResult {
  ok: boolean;
  message: string;
}

export const adminService = {
  // Union of local + Firestore, newest first.
  async getAllAlerts(): Promise<DbAlert[]> {
    let local: DbAlert[] = [];
    try {
      const db = await getDatabase();
      local = await getAlerts(db);
    } catch { }

    let remote: DbAlert[] = [];
    try {
      remote = await alertService.fetchAllFromFirestore();
    } catch {
      // Offline — the local set alone still renders.
    }

    const byId = new Map<string, DbAlert>();
    for (const a of local) byId.set(a.id, a);
    for (const r of remote) {
      const existing = byId.get(r.id);
      byId.set(r.id, existing ? mergeAlert(existing, r) : r);
    }

    return [...byId.values()].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
  },

  // Firestore is the cross-device source of truth; local rows fill gaps offline.
  async getAllUsers(): Promise<DbUser[]> {
    let local: DbUser[] = [];
    try {
      const db = await getDatabase();
      local = await sqlGetAllUsers(db);
    } catch { }

    let remote: DbUser[] = [];
    try {
      const snapshot = await getDocs(collection(firestoreDB, USERS_COLLECTION));
      remote = snapshot.docs.map((d) => mapDocToUser(d.id, d.data()));
    } catch { }

    const byId = new Map<string, DbUser>();
    for (const u of local) byId.set(u.id, u);
    for (const r of remote) byId.set(r.id, r); // remote wins on the flags

    // Mirror what we learned so the list survives going offline
    try {
      const db = await getDatabase();
      for (const u of remote) {
        await upsertUser(db, {
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email,
          role: u.role,
          barangay: u.barangay,
          address: u.address,
          profile_photo: u.profile_photo,
          is_volunteer: u.is_volunteer === 1,
          is_admin: u.is_admin === 1,
          is_active: u.is_active === 1,
          created_at: u.created_at,
          updated_at: u.updated_at,
          synced: true,
        });
      }
    } catch { }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  // Deactivate / reactivate. No hard delete, by design.
  async setUserActive(userId: string, active: boolean): Promise<void> {
    await updateDoc(doc(firestoreDB, USERS_COLLECTION, userId), {
      isActive: active,
      updatedAt: new Date().toISOString(),
    });
    const db = await getDatabase();
    await sqlSetUserActive(db, userId, active);
  },

  async resolveAlert(alertId: string): Promise<void> {
    await alertService.updateAlertStatus(alertId, 'resolved');
  },

  async deleteAlert(alertId: string): Promise<void> {
    await alertService.deleteAlert(alertId);
  },

  async exportAlertsCsv(alerts: DbAlert[]): Promise<ExportResult> {
    if (alerts.length === 0) {
      return { ok: false, message: 'No alerts to export yet.' };
    }

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File(Paths.cache, `barangay-sos-alerts-${stamp}.csv`);

      if (file.exists) file.delete();
      file.create();
      file.write(buildAlertsCsv(alerts));

      if (!(await Sharing.isAvailableAsync())) {
        return { ok: false, message: `Sharing unavailable. Saved to ${file.uri}` };
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export alert logs',
        UTI: 'public.comma-separated-values-text',
      });

      return { ok: true, message: `Exported ${alerts.length} alert(s).` };
    } catch {
      return { ok: false, message: 'Export failed. Please try again.' };
    }
  },
};
