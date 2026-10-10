import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { firestoreDB } from './firebase';
import { getDatabase } from '../db/database';
import {
  updateAlertStatus as sqlUpdateAlertStatus,
  markAlertSynced,
  markAlertTransmitted,
  upsertAlertFromRemote,
  deleteAlert as sqlDeleteAlert,
} from '../db/queries';
import { DbAlert, TransmissionPath } from '../db/types';

const ALERTS_COLLECTION = 'alerts';

// Firestore timestamps arrive as Timestamp objects, but we now write our own
// ISO strings — accept either shape.
function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value?.toDate?.()?.toISOString() ?? null;
}

// Firestore doc -> DbAlert. Shared by the live subscription and the admin
// bulk reads so the two can never drift apart.
export function mapDocToAlert(id: string, data: any): DbAlert {
  return {
    id,
    user_id: data.userId ?? '',
    type: data.type ?? 'other',
    status: data.status ?? 'active',
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    address: data.address ?? null,
    description: data.description ?? null,
    media_urls: null,
    responded_by: data.respondedBy ?? null,
    responded_at: toIso(data.respondedAt),
    resolved_at: toIso(data.resolvedAt),
    transmitted_at: toIso(data.transmittedAt),
    transmission_path: data.transmissionPath ?? null,
    gps_source: data.gpsSource ?? null,
    created_at: toIso(data.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(data.updatedAt) ?? new Date().toISOString(),
    synced: 1,
  };
}

export const alertService = {
  async sendToFirestore(alert: DbAlert): Promise<void> {
    const ts = new Date().toISOString();
    // Preserve the original route: an SMS alert pushed later is still 'sms'.
    const transmittedAt = alert.transmitted_at ?? ts;
    const path = (alert.transmission_path ?? 'online') as TransmissionPath;

    await setDoc(doc(firestoreDB, ALERTS_COLLECTION, alert.id), {
      id: alert.id,
      userId: alert.user_id,
      type: alert.type,
      status: alert.status,
      latitude: alert.latitude,
      longitude: alert.longitude,
      address: alert.address,
      description: alert.description,
      respondedBy: alert.responded_by,
      respondedAt: alert.responded_at,
      resolvedAt: alert.resolved_at,
      transmittedAt,
      transmissionPath: path,
      gpsSource: alert.gps_source,
      // Device clock, matching SQLite's created_at — Response Time is computed
      // as respondedAt - createdAt, so both must come from the same clock.
      createdAt: alert.created_at,
      updatedAt: ts,
      serverCreatedAt: serverTimestamp(),
    });

    // Mark as transmitted + synced in SQLite
    const db = await getDatabase();
    await markAlertTransmitted(db, alert.id, path, transmittedAt);
    await markAlertSynced(db, alert.id);
  },

  subscribeToAlerts(
    onAlert: (alerts: DbAlert[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(firestoreDB, ALERTS_COLLECTION),
      where('status', '==', 'active')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const alerts = snapshot.docs.map((d) => mapDocToAlert(d.id, d.data()));
        onAlert(alerts);
      },
      (err) => onError?.(err)
    );
  },

  async updateAlertStatus(
    alertId: string,
    status: 'active' | 'responded' | 'resolved',
    responderId?: string,
    // Snapshot row supplied by responders, whose device has no local copy yet
    remoteAlert?: DbAlert
  ): Promise<void> {
    const ts = new Date().toISOString();

    // Update Firestore
    const alertRef = doc(firestoreDB, ALERTS_COLLECTION, alertId);
    await updateDoc(alertRef, {
      status,
      ...(responderId ? { respondedBy: responderId } : {}),
      ...(status === 'responded' ? { respondedAt: ts } : {}),
      ...(status === 'resolved' ? { resolvedAt: ts } : {}),
      updatedAt: ts,
    });

    // Mirror in SQLite, stamped with the same instant
    const db = await getDatabase();
    if (remoteAlert) await upsertAlertFromRemote(db, remoteAlert);
    await sqlUpdateAlertStatus(db, alertId, status, responderId, ts);
  },

  // Every alert regardless of status — the live subscription filters to
  // status == 'active', which is not what the admin screens need.
  async fetchAllFromFirestore(): Promise<DbAlert[]> {
    const snapshot = await getDocs(collection(firestoreDB, ALERTS_COLLECTION));
    return snapshot.docs.map((d) => mapDocToAlert(d.id, d.data()));
  },

  async deleteAlert(alertId: string): Promise<void> {
    try {
      await deleteDoc(doc(firestoreDB, ALERTS_COLLECTION, alertId));
    } catch {
      // Offline or already gone — still remove the local copy below.
    }
    const db = await getDatabase();
    await sqlDeleteAlert(db, alertId);
  },
};
