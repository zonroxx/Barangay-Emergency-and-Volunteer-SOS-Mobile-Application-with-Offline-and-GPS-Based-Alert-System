import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { Text, ActivityIndicator, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MapView, { Marker, Polyline, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { LiveVolunteer } from '../services/volunteerService';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';
import { APP_CONFIG } from '../../constants/config';


export type MapMarkerKind = 'sos' | 'volunteer';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  kind: MapMarkerKind;
  label?: string;
  volunteer?: LiveVolunteer;
}


function SOSMarkerView() {
  return (
    <View style={markerStyles.sos}>
      <RNText style={markerStyles.sosText}>SOS</RNText>
    </View>
  );
}

function VolunteerMarkerView() {
  return <View style={markerStyles.volunteer} />;
}

const markerStyles = StyleSheet.create({
  sos: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF4D2D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#FF4D2D',
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  sosText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  volunteer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E65100',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#E65100',
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});


const DEFAULT_REGION: Region = {
  latitude: APP_CONFIG.defaultLatitude,
  longitude: APP_CONFIG.defaultLongitude,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

type PermissionState = 'checking' | 'granted' | 'denied';

interface AppMapViewProps {
  markers: MapMarker[];
  polyline?: Array<{ latitude: number; longitude: number }>;
  showOfflineBanner: boolean;
  initialCenter?: { latitude: number; longitude: number } | null;
  onMarkerPress?: (marker: MapMarker) => void;
}

export default function AppMapView({
  markers,
  polyline,
  showOfflineBanner,
  initialCenter,
  onMarkerPress,
}: AppMapViewProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const mapRef = useRef<MapView>(null);
  const [permission, setPermission] = useState<PermissionState>('checking');

  useEffect(() => {
    async function check() {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermission('granted');
        return;
      }
      const { status: requested } = await Location.requestForegroundPermissionsAsync();
      setPermission(requested === 'granted' ? 'granted' : 'denied');
    }
    check();
  }, []);

  useEffect(() => {
    if (initialCenter && mapRef.current) {
      mapRef.current.animateToRegion(
        { ...initialCenter, latitudeDelta: 0.015, longitudeDelta: 0.015 },
        800
      );
    }
  }, [initialCenter]);


  if (permission === 'checking') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="bodySmall" style={styles.centeredText}>Loading map...</Text>
      </View>
    );
  }


  if (permission === 'denied') {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={48} color={colors.textSecondary} style={styles.permIcon} />
        <Text variant="titleMedium" style={styles.permTitle}>Location Required</Text>
        <Text variant="bodySmall" style={styles.centeredText}>
          Enable location permission in your device settings to use the map.
        </Text>
        <Button
          mode="contained"
          buttonColor={colors.primary}
          style={styles.permButton}
          onPress={() => Location.requestForegroundPermissionsAsync().then(
            ({ status }) => setPermission(status === 'granted' ? 'granted' : 'denied')
          )}
        >
          Grant Permission
        </Button>
      </View>
    );
  }


  const initialRegion = initialCenter
    ? { ...initialCenter, latitudeDelta: 0.015, longitudeDelta: 0.015 }
    : DEFAULT_REGION;

  return (
    <View style={styles.fill}>
      {/* Offline banner */}
      {showOfflineBanner && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineContent}>
            <MaterialCommunityIcons name="signal-off" size={14} color={colors.white} />
            <RNText style={styles.offlineText}>Offline - showing last known location</RNText>
          </View>
        </View>
      )}

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        onPress={() => onMarkerPress?.(null as any)}
      >
        {/* Dynamic markers */}
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.label}
            onPress={() => onMarkerPress?.(m)}
            anchor={m.kind === 'sos' ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}
          >
            {m.kind === 'sos' ? <SOSMarkerView /> : <VolunteerMarkerView />}
          </Marker>
        ))}

        {/* Volunteer → user response polyline */}
        {polyline && polyline.length >= 2 && (
          <Polyline
            coordinates={polyline}
            strokeColor={colors.secondary}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>
    </View>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    fill: { flex: 1 },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: colors.background,
    },
    centeredText: { color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
    permIcon: { marginBottom: 12 },
    permTitle: { fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    permButton: { marginTop: 20, borderRadius: 8 },
    offlineBanner: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: colors.warning,
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    offlineContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    offlineText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  });
}
