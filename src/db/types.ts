export interface DbUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  barangay: string | null;
  address: string | null;
  profile_photo: string | null;
  is_volunteer: number;   // 0 | 1
  is_admin: number;       // 0 | 1 - set manually in the Firestore console
  is_active: number;      // 0 | 1 - 0 blocks the account at login
  created_at: string;
  updated_at: string;
  synced: number;         // 0 | 1
}

// How the alert actually left the device (evaluation metric: Alert Success Rate)
export type TransmissionPath = 'online' | 'sms';

// Whether the coordinates came from a fresh fix or the AsyncStorage fallback
export type GpsSource = 'live' | 'cached';

export interface DbAlert {
  id: string;
  user_id: string;
  type: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  description: string | null;
  media_urls: string | null;
  responded_by: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  transmitted_at: string | null;     
  transmission_path: string | null;
  gps_source: string | null;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface DbVolunteer {
  id: string;
  user_id: string;
  skills: string | null;
  availability: string;
  current_latitude: number | null;
  current_longitude: number | null;
  assigned_alert_id: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface DbContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string | null;
  is_emergency_contact: number;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

export interface InsertContactInput {
  name: string;
  phone: string;
  userId: string;
  relationship?: string | null;
  isEmergencyContact?: boolean;
  isPrimary?: boolean;
}

export interface InsertAlertInput {
  userId: string;
  type: DbAlert['type'];
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  description?: string | null;
  gpsSource?: GpsSource | null;
}

export interface UpsertVolunteerInput {
  id: string;
  userId: string;
  skills?: string[] | null;
  availability: DbVolunteer['availability'];
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  assignedAlertId?: string | null;
  lastSeen?: string | null;
}
