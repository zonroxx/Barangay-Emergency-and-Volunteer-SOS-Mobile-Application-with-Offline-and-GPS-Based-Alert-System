import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/useAuthStore';
import { useVolunteerStore } from '../store/useVolunteerStore';
import { alertService } from '../services/alertService';
import { gpsService, Coordinates } from '../services/gpsService';
import { DbAlert } from '../db/types';
import AlertCard from '../components/AlertCard';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

export default function VolunteerAlertScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user, isGuest } = useAuthStore();
  const { declinedAlertIds, declineAlert } = useVolunteerStore();

  const [alerts, setAlerts] = useState<DbAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerLocation, setViewerLocation] = useState<Coordinates | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    gpsService.getCurrentLocation().then(setViewerLocation).catch(() => {});
  }, []);

  function subscribe() {
    unsubscribeRef.current?.();
    unsubscribeRef.current = alertService.subscribeToAlerts(
      (incoming) => { setAlerts(incoming); setLoading(false); setRefreshing(false); },
      () => { setLoading(false); setRefreshing(false); }
    );
  }

  useEffect(() => {
    if (isGuest) { setLoading(false); return; }
    subscribe();
    return () => { unsubscribeRef.current?.(); };
  }, [isGuest]);

  async function handleAccept(alert: DbAlert) {
    if (!user) return;
    try {
      // Pass the snapshot row so the service can materialise it locally —
      // responders have no SQLite copy, so responded_at would otherwise be lost.
      await alertService.updateAlertStatus(alert.id, 'responded', user.uid, alert);
      navigation.navigate('VolunteerRespond', { alert });
    } catch {
      Alert.alert('Error', 'Could not accept alert. Check your connection.');
    }
  }

  const visibleAlerts = alerts.filter((a) => !declinedAlertIds.includes(a.id));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isGuest) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="account-lock-outline" size={48} color={colors.disabled} />
        <Text variant="bodyMedium" style={[styles.emptyText, { marginTop: 12 }]}>
          Log in to view alerts.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={visibleAlerts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); subscribe(); }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <Text variant="labelMedium" style={styles.listHeader}>
          Active Alerts Near You
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="check-circle-outline" size={48} color={colors.disabled} />
          <Text variant="bodyMedium" style={[styles.emptyText, { marginTop: 12 }]}>
            No active alerts right now.{'\n'}Pull to refresh.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <AlertCard
          alert={item}
          viewerLat={viewerLocation?.latitude}
          viewerLng={viewerLocation?.longitude}
          onAccept={() => handleAccept(item)}
          onDecline={() => declineAlert(item.id)}
        />
      )}
    />
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
    list: { padding: 16, paddingBottom: 32, backgroundColor: colors.background, flexGrow: 1 },
    listHeader: { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    emptyState: { alignItems: 'center', paddingTop: 48 },
    emptyText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });
}
