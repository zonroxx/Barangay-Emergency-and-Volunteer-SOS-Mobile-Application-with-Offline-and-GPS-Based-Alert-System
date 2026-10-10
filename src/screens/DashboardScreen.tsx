import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { alertService } from '../services/alertService';
import { DbAlert } from '../db/types';
import AlertCard from '../components/AlertCard';
import { gpsService, Coordinates } from '../services/gpsService';

export default function DashboardScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user, isGuest } = useAuthStore();

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

  if (isGuest) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="account-lock-outline" size={52} color={colors.disabled} />
        <Text variant="titleMedium" style={styles.guestTitle}>Browsing as guest</Text>
        <Text variant="bodySmall" style={styles.guestSub}>
          Log in to view community alerts and use SOS features.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const recentAlerts = alerts.slice(0, 5);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); subscribe(); }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <Text variant="headlineSmall" style={styles.greeting}>
        Hello, {user?.displayName?.split(' ')[0] ?? 'there'}
      </Text>

      {/* Status summary */}
      <Surface
        style={[
          styles.statusCard,
          { backgroundColor: alerts.length > 0 ? colors.danger + '14' : colors.success + '14' },
        ]}
        elevation={0}
      >
        <MaterialCommunityIcons
          name={alerts.length > 0 ? 'alert-circle-outline' : 'check-circle-outline'}
          size={22}
          color={alerts.length > 0 ? colors.danger : colors.success}
        />
        <View style={styles.statusInfo}>
          <Text
            variant="titleSmall"
            style={[styles.statusTitle, { color: alerts.length > 0 ? colors.danger : colors.success }]}
          >
            {alerts.length > 0 ? `${alerts.length} Active Alert${alerts.length !== 1 ? 's' : ''}` : 'All Clear'}
          </Text>
          <Text variant="bodySmall" style={styles.statusSub}>
            {alerts.length > 0
              ? 'Emergencies reported in your area. You can respond to help.'
              : 'No active emergencies in your area right now.'}
          </Text>
        </View>
      </Surface>

      <Text variant="labelMedium" style={styles.sectionLabel}>
        Recent Community Alerts
      </Text>

      {recentAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="check-circle-outline" size={44} color={colors.disabled} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            No active alerts right now.
          </Text>
        </View>
      ) : (
        recentAlerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            viewerLat={viewerLocation?.latitude}
            viewerLng={viewerLocation?.longitude}
          />
        ))
      )}
    </ScrollView>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flexGrow: 1, padding: 16, paddingBottom: 40, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: colors.background },
    greeting: { fontWeight: 'bold', color: colors.text, marginBottom: 16 },
    guestTitle: { fontWeight: 'bold', color: colors.text, marginTop: 16, textAlign: 'center' },
    guestSub: { color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
      gap: 12,
    },
    statusInfo: { flex: 1 },
    statusTitle: { fontWeight: '700' },
    statusSub: { color: colors.textSecondary, marginTop: 2 },
    sectionLabel: {
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    emptyState: { alignItems: 'center', paddingTop: 40 },
    emptyText: { color: colors.textSecondary, marginTop: 12, textAlign: 'center' },
  });
}
