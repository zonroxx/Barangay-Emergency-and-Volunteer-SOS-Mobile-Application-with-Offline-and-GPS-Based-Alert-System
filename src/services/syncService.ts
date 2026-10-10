// Sync service — pushes locally created / modified records to Firestore.
// Foreground-only by design (no background-fetch libraries): triggered by the
// offline -> online transition, on app launch, and when the app is foregrounded.

import { getDatabase } from '../db/database';
import { getUnsyncedAlerts } from '../db/queries';
import { alertService } from './alertService';

export interface SyncResult {
  pushed: number;
  failed: number;
}

// Re-entrancy guard: overlapping callers share the running pass instead of
// starting a second one, so a row can never be uploaded twice.
let inFlight: Promise<SyncResult> | null = null;

export const syncService = {
  async syncPendingAlerts(): Promise<SyncResult> {
    if (inFlight) return inFlight;

    const run = (async (): Promise<SyncResult> => {
      const result: SyncResult = { pushed: 0, failed: 0 };
      try {
        const db = await getDatabase();
        const pending = await getUnsyncedAlerts(db);

        for (const alert of pending) {
          try {
            // sendToFirestore stamps transmitted_at / transmission_path and
            // flips synced = 1 itself. Its first-write-wins guard means an
            // alert originally delivered by SMS keeps transmission_path = 'sms'.
            await alertService.sendToFirestore(alert);
            result.pushed++;
          } catch {
            // Leave synced = 0 so the row is retried on the next pass,
            // and keep going — one bad row must not strand the others.
            result.failed++;
          }
        }
      } catch {
        // Database unavailable — nothing pushed, nothing lost.
      }
      return result;
    })();

    inFlight = run;
    try {
      return await run;
    } finally {
      if (inFlight === run) inFlight = null;
    }
  },

  async syncPendingUsers(): Promise<void> {
    // TODO: same pattern for users table
  },

  async runFullSync(): Promise<void> {
    await syncService.syncPendingUsers();
    await syncService.syncPendingAlerts();
  },
};
