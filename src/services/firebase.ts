import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../../constants/firebase.config';

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

// Firebase Auth uses in-memory persistence — the Zustand store backed by
// AsyncStorage handles cross-session auth state instead.
// initializeAuth must only be called once; try/catch guards hot-reload.
let _auth;
try {
  _auth = initializeAuth(app, { persistence: inMemoryPersistence });
} catch {
  _auth = getAuth(app);
}

export const firebaseAuth = _auth;
export const firestoreDB = getFirestore(app);
