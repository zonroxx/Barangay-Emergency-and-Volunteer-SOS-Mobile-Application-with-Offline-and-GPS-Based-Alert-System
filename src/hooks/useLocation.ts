import { useState, useEffect } from 'react';
import { gpsService, Coordinates } from '../services/gpsService';

export function useLocation() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: request permissions then start tracking
    // gpsService.requestPermissions().then(granted => {
    //   setHasPermission(granted);
    //   if (granted) gpsService.startTracking(setLocation);
    // });
    // return () => { gpsService.stopTracking(); };
  }, []);

  return { location, hasPermission, error };
}
