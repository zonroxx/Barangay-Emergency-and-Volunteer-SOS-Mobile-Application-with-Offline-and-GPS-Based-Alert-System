import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { firestoreDB } from './firebase';

/**
 * Shape of a volunteer document in the Firestore `volunteers` collection.
 * Volunteers push their location here whenever they are on duty.
 */
export interface LiveVolunteer {
  userId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  availability: 'available' | 'busy';
  lastSeen: string;   // ISO timestamp
}

const VOLUNTEERS_COL = 'volunteers';
const PINGS_COL = 'pings';

export const volunteerService = {
  /**
   * Real-time listener for all volunteers whose availability === 'available'.
   * Returns an unsubscribe function.
   */
  subscribeToActiveVolunteers(
    onData: (volunteers: LiveVolunteer[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(firestoreDB, VOLUNTEERS_COL),
      where('availability', '==', 'available')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const volunteers: LiveVolunteer[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            // Skip documents that are missing required location fields
            if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
              return null;
            }
            return {
              userId: data.userId ?? d.id,
              displayName: data.displayName ?? 'Volunteer',
              latitude: data.latitude,
              longitude: data.longitude,
              availability: data.availability ?? 'available',
              lastSeen: data.lastSeen?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            } satisfies LiveVolunteer;
          })
          .filter((v): v is LiveVolunteer => v !== null);

        onData(volunteers);
      },
      (err) => onError?.(err)
    );
  },

  /**
   * Write a direct-request ping to a specific volunteer.
   * The volunteer's app can listen to the `pings` collection and notify them.
   */
  async requestVolunteer(
    fromUserId: string,
    volunteer: LiveVolunteer,
    userLatitude: number | null,
    userLongitude: number | null
  ): Promise<void> {
    await addDoc(collection(firestoreDB, PINGS_COL), {
      fromUserId,
      toVolunteerId: volunteer.userId,
      toVolunteerName: volunteer.displayName,
      userLatitude: userLatitude ?? null,
      userLongitude: userLongitude ?? null,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  },
};
