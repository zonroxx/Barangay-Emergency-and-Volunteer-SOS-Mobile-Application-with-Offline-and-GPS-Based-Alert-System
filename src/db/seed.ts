import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';
import { insertContact, getPrimaryContact, setPrimaryContact } from './queries';

const SEED_KEY = 'db_seeded';
const PRIMARY_KEY = 'primary_contact_initialized';

// Deterministic IDs so INSERT OR IGNORE is idempotent if called twice
const SYSTEM_CONTACTS = [
  {
    id: 'system-police',
    name: 'Police',
    phone: '911',
    relationship: 'emergency',
    isEmergencyContact: true,
    isPrimary: true,   // default recipient of the offline SOS SMS
  },
  {
    id: 'system-barangay-hall',
    name: 'Barangay Hall',
    phone: '8888',
    relationship: 'barangay',
    isEmergencyContact: true,
  },
  {
    id: 'system-health-center',
    name: 'Health Center',
    phone: '0917-000-0000',
    relationship: 'medical',
    isEmergencyContact: true,
  },
] as const;

export async function seedDatabaseIfNeeded(): Promise<void> {
  const already = await AsyncStorage.getItem(SEED_KEY);
  if (already === 'true') return;

  const db = await getDatabase();

  for (const contact of SYSTEM_CONTACTS) {
    await insertContact(
      db,
      {
        name: contact.name,
        phone: contact.phone,
        userId: 'system',
        relationship: contact.relationship,
        isEmergencyContact: contact.isEmergencyContact,
        isPrimary: 'isPrimary' in contact ? contact.isPrimary : false,
      },
      contact.id
    );
  }

  await AsyncStorage.setItem(SEED_KEY, 'true');
}

export async function backfillPrimaryContactIfNeeded(): Promise<void> {
  const already = await AsyncStorage.getItem(PRIMARY_KEY);
  if (already === 'true') return;

  const db = await getDatabase();
  const existing = await getPrimaryContact(db, 'system');
  if (!existing) {
    await setPrimaryContact(db, 'system', 'system-police');
  }

  await AsyncStorage.setItem(PRIMARY_KEY, 'true');
}
