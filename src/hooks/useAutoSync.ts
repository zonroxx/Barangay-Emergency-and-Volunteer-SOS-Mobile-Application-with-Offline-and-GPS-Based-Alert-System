import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from './useNetworkStatus';
import { syncService } from '../services/syncService';

// Drives automatic sync of unsynced alerts. Mount ONCE (see AppNavigator) —
// useNetworkStatus is consumed by several screens, so triggering the sweep
// inside that hook would fire it once per mounted screen.
export function useAutoSync() {
  const { isOnline } = useNetworkStatus();
  const wasOnline = useRef<boolean | null>(null);
  const [pushedCount, setPushedCount] = useState(0);
  const [visible, setVisible] = useState(false);

  const run = useCallback(async () => {
    const { pushed } = await syncService.syncPendingAlerts();
    if (pushed > 0) {
      setPushedCount(pushed);
      setVisible(true);
    }
  }, []);

  // App launch, when the device is already online.
  // Checked against NetInfo directly rather than the hook's optimistic
  // `true` default, so we don't attempt a doomed push while offline.
  useEffect(() => {
    NetInfo.fetch().then((state) => {
      if (state.isConnected) run();
    });
  }, [run]);

  // Offline -> online transition.
  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = isOnline;
    if (previous === false && isOnline) run();
  }, [isOnline, run]);

  // Returning to the foreground (AppState only — no background task libraries).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      NetInfo.fetch().then((net) => {
        if (net.isConnected) run();
      });
    });
    return () => sub.remove();
  }, [run]);

  const dismiss = useCallback(() => setVisible(false), []);

  return { pushedCount, visible, dismiss };
}
