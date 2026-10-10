import { Linking } from 'react-native';
import { Coordinates } from './gpsService';

export const smsService = {
  buildSOSBody(
    userName: string,
    category: string,
    coords: Coordinates | null,
    message?: string
  ): string {
    const gps = coords
      ? `GPS: ${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`
      : 'GPS: unavailable';
    const extra = message ? ` - ${message}` : '';
    return `SOS ALERT - ${category.toUpperCase()} - ${userName} needs help at ${gps}${extra}`;
  },

  async sendViaSMSLink(phone: string, body: string): Promise<boolean> {
    // Encode body for URL; iOS uses '&', Android uses '?'
    const encodedBody = encodeURIComponent(body);
    // Try Android format first; iOS accepts both
    const url = `sms:${phone}?body=${encodedBody}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};
