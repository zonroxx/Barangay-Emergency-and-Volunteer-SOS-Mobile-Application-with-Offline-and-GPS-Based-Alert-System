import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  Alert,
} from 'react-native';
import { Text, Button, Chip, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/useAuthStore';
import { useAlertStore } from '../store/useAlertStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useDatabase } from '../hooks/useDatabase';
import { getLatestActiveAlert } from '../db/queries';
import { gpsService, Coordinates } from '../services/gpsService';
import { volunteerService, LiveVolunteer } from '../services/volunteerService';
import { alertService } from '../services/alertService';
import { DbAlert } from '../db/types';
import { formatDistance, haversineKm, timeAgo } from '../utils/geo';
import AppMapView, { MapMarker } from '../components/MapView';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = 300;

// ─── Volunteer bottom sheet ────────────────────────────────────────────────────

interface VolunteerSheetProps {
  volunteer: LiveVolunteer;
  userLocation: Coordinates | null;
  translateY: Animated.Value;
  colors: ColorSet;
  styles: ReturnType<typeof createStyles>;
  onClose: () => void;
  onRequest: () => Promise<void>;
}

function VolunteerSheet({
  volunteer,
  userLocation,
  translateY,
  colors,
  styles,
  onClose,
  onRequest,
}: VolunteerSheetProps) {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const distanceLabel =
    userLocation
      ? formatDistance(
          haversineKm(
            userLocation.latitude,
            userLocation.longitude,
            volunteer.latitude,
            volunteer.longitude
          )
        )
      : null;

  async function handleRequest() {
    setRequesting(true);
    try {
      await onRequest();
      setRequested(true);
    } catch {
      Alert.alert('Error', 'Could not send request. Check your connection.');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Animated.View
      style={[styles.sheet, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      {/* Handle */}
      <View style={styles.sheetHandle} />

      {/* Volunteer info */}
      <View style={styles.sheetHeader}>
        <View style={styles.volunteerAvatar}>
          <Text style={styles.volunteerInitial}>
            {volunteer.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.volunteerInfo}>
          <Text variant="titleMedium" style={styles.volunteerName}>
            {volunteer.displayName}
          </Text>
          <Text variant="bodySmall" style={styles.lastSeen}>
            Last active {timeAgo(volunteer.lastSeen)}
          </Text>
        </View>
      </View>

      <View style={styles.sheetMeta}>
        <Chip
          compact
          style={styles.availChip}
          textStyle={styles.availChipText}
          icon={() => <View style={styles.availDot} />}
        >
          Available
        </Chip>
        {distanceLabel && (
          <Chip
            compact
            style={styles.distChip}
            textStyle={styles.distChipText}
            icon={() => (
              <MaterialCommunityIcons name="ruler" size={12} color={colors.secondary} />
            )}
          >
            {distanceLabel} away
          </Chip>
        )}
      </View>

      {requested ? (
        <View style={styles.requestedBanner}>
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.success} />
          <Text style={styles.requestedText}>
            Request sent - {volunteer.displayName} has been notified.
          </Text>
        </View>
      ) : (
        <Button
          mode="contained"
          buttonColor={colors.secondary}
          style={styles.requestBtn}
          onPress={handleRequest}
          disabled={requesting}
          loading={requesting}
        >
          Request This Volunteer
        </Button>
      )}

      <Button mode="text" textColor={colors.textSecondary} onPress={onClose} compact>
        Dismiss
      </Button>
    </Animated.View>
  );
}

// ─── MapScreen ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user, isGuest } = useAuthStore();
  const { activeAlert, setActiveAlert } = useAlertStore();
  const { isOnline } = useNetworkStatus();
  const db = useDatabase();

  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<DbAlert[]>([]);
  const [liveVolunteers, setLiveVolunteers] = useState<LiveVolunteer[]>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState<LiveVolunteer | null>(null);

  const sheetY = useRef(new Animated.Value(SHEET_H)).current;
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const alertsUnsubRef = useRef<(() => void) | null>(null);

  // ── Restore the SOS pin after an app restart ─────────────────────────────────
  // useAlertStore is in-memory only, so activeAlert is null on every launch.
  // SQLite is authoritative: it also clears the pin if the alert was resolved
  // while the app was closed.
  useEffect(() => {
    if (!db || isGuest) return;
    const userId = user?.uid;
    if (!userId) return;
    let cancelled = false;
    getLatestActiveAlert(db, userId)
      .then((row) => { if (!cancelled) setActiveAlert(row); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [db, isGuest, user?.uid, setActiveAlert]);

  // ── Live alert subscription (cross-device) ───────────────────────────────────
  // The same Firestore listener the Alerts tab uses, so every device plots every
  // active alert instead of only the one it created. Guests are excluded, matching
  // VolunteerAlertScreen.
  useEffect(() => {
    if (isGuest) {
      setLiveAlerts([]);
      return;
    }
    alertsUnsubRef.current = alertService.subscribeToAlerts(
      setLiveAlerts,
      () => setLiveAlerts([])
    );
    return () => {
      alertsUnsubRef.current?.();
      alertsUnsubRef.current = null;
    };
  }, [isGuest]);

  // ── Location ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchLocation() {
      const loc = isOnline
        ? await gpsService.getCurrentLocation()
        : await gpsService.getLastKnownLocation();
      setUserLocation(loc);
    }
    fetchLocation();
  }, [isOnline]);

  // ── Volunteer subscription (online only) ─────────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      setLiveVolunteers([]);
      unsubscribeRef.current?.();
      return;
    }
    unsubscribeRef.current = volunteerService.subscribeToActiveVolunteers(
      setLiveVolunteers,
      () => setLiveVolunteers([])
    );
    return () => { unsubscribeRef.current?.(); };
  }, [isOnline]);

  // ── Bottom sheet open / close ────────────────────────────────────────────────
  const openSheet = useCallback((volunteer: LiveVolunteer) => {
    setSelectedVolunteer(volunteer);
    Animated.spring(sheetY, {
      toValue: 0,
      damping: 22,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, [sheetY]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: SHEET_H,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSelectedVolunteer(null));
  }, [sheetY]);

  // ── Marker tap handler ───────────────────────────────────────────────────────
  function handleMarkerPress(marker: MapMarker | null) {
    if (!marker) { closeSheet(); return; }
    if (marker.kind === 'volunteer' && marker.volunteer) {
      openSheet(marker.volunteer);
    } else {
      closeSheet();
    }
  }

  // ── Build marker array ───────────────────────────────────────────────────────
  const markers: MapMarker[] = [];

  // SOS alert markers (red) — every active alert, from any device.
  // Firestore is the cross-device source; activeAlert is merged in so the sender
  // still sees their own pin while offline or before it syncs. Keyed by id so the
  // sender's own alert never plots twice.
  const alertsById = new Map<string, DbAlert>();
  for (const a of liveAlerts) alertsById.set(a.id, a);
  if (activeAlert && !alertsById.has(activeAlert.id)) {
    alertsById.set(activeAlert.id, activeAlert);
  }

  for (const a of alertsById.values()) {
    // Firestore documents are untyped — skip anything without real coordinates
    if (typeof a.latitude !== 'number' || typeof a.longitude !== 'number') continue;
    markers.push({
      id: `sos-${a.id}`,
      latitude: a.latitude,
      longitude: a.longitude,
      kind: 'sos',
      label: `SOS - ${a.type}`,
    });
  }

  // Volunteer markers (orange) — online only
  if (isOnline) {
    for (const v of liveVolunteers) {
      markers.push({
        id: `vol-${v.userId}`,
        latitude: v.latitude,
        longitude: v.longitude,
        kind: 'volunteer',
        label: v.displayName,
        volunteer: v,
      });
    }
  }

  // ── Polyline: responding volunteer → user ────────────────────────────────────
  let polyline: Array<{ latitude: number; longitude: number }> | undefined;
  if (activeAlert?.responded_by && userLocation) {
    const respondingVol = liveVolunteers.find((v) => v.userId === activeAlert.responded_by);
    if (respondingVol) {
      polyline = [
        { latitude: respondingVol.latitude, longitude: respondingVol.longitude },
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
      ];
    }
  }

  // ── Request volunteer ────────────────────────────────────────────────────────
  async function handleRequestVolunteer() {
    if (!selectedVolunteer || !user) return;
    await volunteerService.requestVolunteer(
      user.uid,
      selectedVolunteer,
      userLocation?.latitude ?? null,
      userLocation?.longitude ?? null
    );
  }

  // ── Legend ───────────────────────────────────────────────────────────────────
  function MapLegend() {
    return (
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: colors.sosRed }]} />
          <Text style={styles.legendLabel}>SOS Alert</Text>
        </View>
        {isOnline && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.legendLabel}>Volunteer</Text>
          </View>
        )}
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
          <Text style={styles.legendLabel}>You</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppMapView
        markers={markers}
        polyline={polyline}
        showOfflineBanner={!isOnline}
        initialCenter={userLocation}
        onMarkerPress={handleMarkerPress}
      />

      <MapLegend />

      {/* Backdrop — visible only when sheet is open */}
      {selectedVolunteer && (
        <TouchableWithoutFeedback onPress={closeSheet}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: sheetY.interpolate({
                  inputRange: [0, SHEET_H],
                  outputRange: [0.4, 0],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>
      )}

      {/* Volunteer bottom sheet */}
      {selectedVolunteer && (
        <VolunteerSheet
          volunteer={selectedVolunteer}
          userLocation={userLocation}
          translateY={sheetY}
          colors={colors}
          styles={styles}
          onClose={closeSheet}
          onRequest={handleRequestVolunteer}
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1 },

    // Legend
    legend: {
      position: 'absolute',
      bottom: 16,
      right: 12,
      backgroundColor: colors.surface + 'EE',
      borderRadius: 10,
      padding: 10,
      gap: 6,
      elevation: 4,
      shadowColor: colors.black,
      shadowOpacity: 0.12,
      shadowRadius: 6,
    },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 12, height: 12, borderRadius: 6 },
    legendLabel: { fontSize: 11, color: colors.text },

    // Backdrop
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.black,
    },

    // Bottom sheet
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: SHEET_H,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingTop: 12,
      elevation: 16,
      shadowColor: colors.black,
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -4 },
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    volunteerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    volunteerInitial: { color: colors.white, fontSize: 22, fontWeight: 'bold' },
    volunteerInfo: { flex: 1 },
    volunteerName: { fontWeight: 'bold', color: colors.text },
    lastSeen: { color: colors.textSecondary, marginTop: 2 },
    sheetMeta: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    availChip: { backgroundColor: colors.success + '22' },
    availChipText: { color: colors.success, fontSize: 11 },
    distChip: { backgroundColor: colors.secondary + '18' },
    distChipText: { color: colors.secondary, fontSize: 11 },
    requestedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.success + '18',
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      justifyContent: 'center',
    },
    requestedText: { color: colors.success, fontSize: 13 },
    availDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    requestBtn: { borderRadius: 10, marginBottom: 10 },
  });
}
