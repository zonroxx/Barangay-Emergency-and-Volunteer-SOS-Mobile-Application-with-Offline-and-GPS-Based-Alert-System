import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GpsSource } from '../db/types';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: GpsSource;   // 'live' = fresh fix, 'cached' = AsyncStorage fallback
}

const LOCATION_KEY = 'last_known_location';

export const gpsService = {
  async requestLocationPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentLocation(): Promise<Coordinates | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await gpsService.requestLocationPermission();
        if (!granted) return gpsService.getLastKnownLocation();
      }

      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: Coordinates = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy ?? undefined,
        source: 'live',
      };

      await gpsService.saveLastKnownLocation(coords);
      return coords;
    } catch {
      return gpsService.getLastKnownLocation();
    }
  },

  async saveLastKnownLocation(coords: Coordinates): Promise<void> {
    // Drop `source` so a stored fix can never read back as 'live'
    const { latitude, longitude, accuracy } = coords;
    await AsyncStorage.setItem(
      LOCATION_KEY,
      JSON.stringify({ latitude, longitude, accuracy })
    );
  },

  async getLastKnownLocation(): Promise<Coordinates | null> {
    try {
      const raw = await AsyncStorage.getItem(LOCATION_KEY);
      if (!raw) return null;
      return { ...(JSON.parse(raw) as Coordinates), source: 'cached' };
    } catch {
      return null;
    }
  },

  async reverseGeocode(coords: Coordinates): Promise<string> {
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (!results.length) return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      const r = results[0];
      return [r.street, r.district, r.city, r.region]
        .filter(Boolean)
        .join(', ');
    } catch {
      return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    }
  },
};
