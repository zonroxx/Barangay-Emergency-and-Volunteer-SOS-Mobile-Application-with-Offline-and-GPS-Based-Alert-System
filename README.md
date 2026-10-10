# Barangay Emergency and Volunteer SOS Mobile Application

An Android emergency alert application for barangay communities, built as an undergraduate thesis prototype (BS Information Technology, Mapúa University Makati).

Any registered resident can both **send** SOS alerts and **respond** to alerts raised by others. The application is designed to keep working when connectivity fails: every alert is written to the device's local database before any network attempt, and falls back to SMS when there is no internet connection.

---

## Features

**Emergency alerts**
- Two-and-a-half second long-press activation, to prevent accidental triggering
- Five categories (Medical, Fire, Crime, Accident, Other), each mapped to a primary responding agency
- GPS coordinates captured with each alert, with a cached-location fallback when a live fix is unavailable
- In-app category guide describing when to use each category

**Offline operation**
- Alerts are written to local SQLite storage before any network call
- With no connection, the app composes an SMS containing the category, sender name and GPS coordinates, and opens the native messaging app addressed to a user-chosen priority contact
- Unsent alerts are automatically uploaded when connectivity returns — on reconnection, app launch, or when the app is brought back to the foreground
- The original delivery route (online or SMS) is preserved when a record syncs later

**Community response**
- Active alerts appear in real time on every user's alert list and map
- Responders can accept an alert, get directions to the location, call the sender, and mark the incident resolved
- Shared map showing active alerts and available responders

**Emergency contacts**
- Pre-seeded barangay contacts, plus user-added contacts
- Any contact can be set as the SMS priority contact that receives offline alerts

**Administration**
- Admin-only tab, enabled by a flag set manually in the Firebase console
- Alert history across the whole barangay, with resolve and delete
- User account list with deactivation (accounts are never deleted)
- Summary statistics and CSV export of alert logs

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Native via Expo SDK 56, TypeScript |
| Local storage | expo-sqlite (primary write target), AsyncStorage (session, cached GPS) |
| Backend | Firebase Authentication and Cloud Firestore |
| State | Zustand, persisted via AsyncStorage |
| UI | React Native Paper, React Navigation 7 |
| Maps | react-native-maps with Google Maps |
| Location | expo-location (balanced accuracy, reverse geocoding) |
| Distribution | APK via EAS Build |

---

## Setup

Two configuration files are **not included in this repository** because they contain API keys. You need to supply your own before the app will run.

### 1. Install dependencies

```bash
npm install
```

### 2. Firebase configuration

Create a Firebase project, enable **Authentication** (Email/Password) and **Cloud Firestore**, then:

```bash
cp constants/firebase.config.example.ts constants/firebase.config.ts
```

Fill in the values from your Firebase console under **Project settings → Your apps → SDK setup and configuration**:

```ts
export const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};
```

> **Note:** this project uses the Firebase **JavaScript** SDK. Do not apply Android application restrictions to this API key — the JS SDK does not send the Android package headers those restrictions check for, and authentication will fail. Use API restrictions instead if you want to limit it.

### 3. Google Maps API key

```bash
cp app.example.json app.json
```

Then replace `YOUR_GOOGLE_MAPS_ANDROID_API_KEY` with a key from the Google Cloud console with **Maps SDK for Android** enabled. Restricting this key to your Android package name and signing certificate fingerprint is recommended.

### 4. Firestore collections

The app expects four collections: `alerts`, `users`, `volunteers`, and `pings`. They are created on first write — no manual setup is required.

To grant an account administrator access, set `isAdmin: true` on its document in the `users` collection. The flag is read at login, so the user must sign out and back in.

### 5. Run

```bash
npx expo start
```

This project uses native modules, so it requires a development build rather than Expo Go:

```bash
eas build --profile development --platform android
```

To produce an installable standalone APK:

```bash
eas build --profile preview --platform android
```

---

## Project structure

```
src/
  screens/      Login, Register, Dashboard, SOS, SOSConfirmation, Map,
                VolunteerAlert, VolunteerRespond, Profile, Admin
  screens/admin/  AlertHistory, UserAccounts, Statistics
  components/   SOSButton, AlertCard, ContactCard, MapView,
                CategoryGuideModal, SyncSnackbar
  services/     firebase, gpsService, alertService, smsService,
                syncService, volunteerService, adminService
  db/           schema.ts, queries.ts, types.ts, seed.ts, database.ts
  store/        useAuthStore, useAlertStore, useVolunteerStore
  hooks/        useDatabase, useNetworkStatus, useAutoSync
  navigation/   AppNavigator.tsx
constants/      config.ts, colors.ts
```

Screens never write raw SQL. All database access goes through the typed helpers in `src/db/queries.ts`.

---

## Scope and limitations

This is a prototype built for academic evaluation, and these constraints are deliberate:

- **Android only.** No iOS or web build.
- **SMS requires user confirmation.** Android does not permit applications to send SMS silently, so the app opens the native messaging app with the message pre-composed and the user presses send.
- **Synchronization runs in the foreground only.** No background-fetch or headless task libraries are used.
- **No mesh networking.** Offline delivery relies on the cellular SMS network.
- **Prototype-level security.** Firebase Authentication uses in-memory persistence, since `getReactNativePersistence` is incompatible with React Native in Firebase v12. The authoritative session is held by Zustand and AsyncStorage. As a result there is no Firebase ID token after an app restart, so Firestore rules are left open in development mode. This is an acknowledged limitation and the application is not intended for production deployment in its current form.

---

## License

See [LICENSE](LICENSE).
