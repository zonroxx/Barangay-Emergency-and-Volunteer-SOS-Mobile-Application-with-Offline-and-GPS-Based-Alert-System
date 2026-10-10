import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Text, Surface, Button, Chip, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StackScreenProps } from '@react-navigation/stack';
import { doc, getDoc } from 'firebase/firestore';
import { firestoreDB } from '../services/firebase';
import { alertService } from '../services/alertService';
import { useAuthStore } from '../store/useAuthStore';
import { useAlertStore } from '../store/useAlertStore';
import { MainStackParamList } from '../navigation/AppNavigator';
import { timeAgo } from '../utils/geo';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

type Props = StackScreenProps<MainStackParamList, 'VolunteerRespond'>;

const CATEGORY_ICON: Record<string, string> = {
  medical: 'hospital-box', fire: 'fire', crime: 'shield-alert',
  accident: 'car-emergency', other: 'alert-circle',
};

export default function VolunteerRespondScreen({ route, navigation }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { alert } = route.params;
  const { user } = useAuthStore();
  const { activeAlert, setActiveAlert } = useAlertStore();

  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [fetchingPhone, setFetchingPhone] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!alert.user_id) { setFetchingPhone(false); return; }
    getDoc(doc(firestoreDB, 'users', alert.user_id))
      .then((snap) => { if (snap.exists()) setUserPhone(snap.data()?.phone ?? null); })
      .catch(() => {})
      .finally(() => setFetchingPhone(false));
  }, [alert.user_id]);

  async function handleOpenMaps() {
    if (alert.latitude == null || alert.longitude == null) {
      Alert.alert('No GPS', 'This alert has no location data.');
      return;
    }
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${alert.latitude},${alert.longitude}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) { await Linking.openURL(url); }
      else { Alert.alert('Cannot open Maps', 'Google Maps is not available on this device.'); }
    } catch {
      Alert.alert('Cannot open Maps', 'Failed to launch navigation.');
    }
  }

  async function handleMarkResolved() {
    Alert.alert('Mark as Resolved', 'Confirm that the emergency has been handled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolved',
        onPress: async () => {
          setResolving(true);
          try {
            await alertService.updateAlertStatus(alert.id, 'resolved', user?.uid);
            setResolved(true);
            // Remove the map marker if this was the sender's own active alert
            if (activeAlert?.id === alert.id) setActiveAlert(null);
          } catch {
            Alert.alert('Error', 'Could not update alert. Check your connection.');
          } finally {
            setResolving(false);
          }
        },
      },
    ]);
  }

  async function handleContactUser() {
    if (!userPhone) return;
    try {
      const url = `tel:${userPhone}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) { await Linking.openURL(url); }
      else { Alert.alert('Cannot call', `Phone calls not supported.\nDial: ${userPhone}`); }
    } catch {
      Alert.alert('Cannot call', `Could not open dialer.\nDial: ${userPhone}`);
    }
  }

  const iconName = (CATEGORY_ICON[alert.type] ?? 'alert-circle') as any;
  const categoryLabel = alert.type.charAt(0).toUpperCase() + alert.type.slice(1);
  const hasLocation = alert.latitude != null && alert.longitude != null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {resolved && (
        <Surface style={styles.resolvedBanner} elevation={0}>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} />
          <Text style={styles.resolvedText}>Alert marked as resolved</Text>
        </Surface>
      )}

      <Surface style={styles.card} elevation={2}>
        <View style={styles.categoryRow}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name={iconName} size={28} color={colors.primary} />
          </View>
          <View style={styles.categoryInfo}>
            <Text variant="titleLarge" style={styles.categoryLabel}>{categoryLabel} Emergency</Text>
            <Text variant="bodySmall" style={styles.timeAgo}>{timeAgo(alert.created_at)}</Text>
          </View>
          <Chip
            compact
            style={[styles.statusChip, resolved && styles.statusChipResolved]}
            textStyle={styles.statusChipText}
          >
            {resolved ? 'resolved' : alert.status}
          </Chip>
        </View>

        {alert.address ? (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.textSecondary} style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{alert.address}</Text>
          </View>
        ) : null}

        {hasLocation && (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="crosshairs-gps" size={15} color={colors.textSecondary} style={styles.infoIcon} />
            <Text style={styles.infoLabel}>GPS</Text>
            <Text style={[styles.infoValue, styles.mono]}>
              {alert.latitude!.toFixed(6)}, {alert.longitude!.toFixed(6)}
            </Text>
          </View>
        )}

        {alert.description ? (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="message-text-outline" size={15} color={colors.textSecondary} style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Message</Text>
            <Text style={styles.infoValue}>"{alert.description}"</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="identifier" size={15} color={colors.textSecondary} style={styles.infoIcon} />
          <Text style={styles.infoLabel}>Alert ID</Text>
          <Text style={[styles.infoValue, styles.mono]}>{alert.id.slice(0, 16)}…</Text>
        </View>
      </Surface>

      <Surface style={styles.card} elevation={2}>
        <Text variant="labelMedium" style={styles.sectionLabel}>Navigation</Text>
        {hasLocation ? (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapCoords}>
              {alert.latitude!.toFixed(5)}, {alert.longitude!.toFixed(5)}
            </Text>
            <Text variant="bodySmall" style={styles.mapHint}>
              Tap "Open in Google Maps" to navigate to this location.
            </Text>
          </View>
        ) : (
          <Text variant="bodySmall" style={styles.noLocation}>
            No GPS coordinates available for this alert.
          </Text>
        )}
        <Button
          mode="contained"
          icon="map-marker-radius"
          style={styles.mapsButton}
          buttonColor={colors.secondary}
          onPress={handleOpenMaps}
          disabled={!hasLocation}
        >
          Open in Google Maps
        </Button>
      </Surface>

      <Surface style={styles.card} elevation={2}>
        <Text variant="labelMedium" style={styles.sectionLabel}>Actions</Text>
        {fetchingPhone ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.phoneLoader} />
        ) : (
          <Button
            mode="outlined"
            icon="phone"
            style={styles.actionButton}
            textColor={colors.secondary}
            onPress={handleContactUser}
            disabled={!userPhone}
          >
            {userPhone ? `Call ${userPhone}` : 'Phone number unavailable'}
          </Button>
        )}
        <Button
          mode="contained"
          icon="check-circle"
          style={styles.actionButton}
          buttonColor={colors.success}
          onPress={handleMarkResolved}
          disabled={resolving || resolved}
          loading={resolving}
        >
          {resolved ? 'Resolved' : 'Mark as Resolved'}
        </Button>
      </Surface>

      <Button
        mode="text"
        style={styles.backButton}
        textColor={colors.textSecondary}
        onPress={() => navigation.navigate('MainTabs')}
      >
        Back to Alerts List
      </Button>
    </ScrollView>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flexGrow: 1, padding: 16, paddingBottom: 40, backgroundColor: colors.background },
    resolvedBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.success + '18', borderRadius: 12,
      padding: 12, marginBottom: 16, justifyContent: 'center',
    },
    resolvedText: { color: colors.success, fontWeight: '600' },
    card: { borderRadius: 16, padding: 20, backgroundColor: colors.surface, marginBottom: 16 },
    sectionLabel: { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
    categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconBadge: {
      width: 52, height: 52, borderRadius: 12,
      backgroundColor: colors.primary + '14',
      justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    categoryInfo: { flex: 1 },
    categoryLabel: { fontWeight: 'bold', color: colors.text },
    timeAgo: { color: colors.textSecondary, marginTop: 2 },
    statusChip: { backgroundColor: colors.warning + '22' },
    statusChipResolved: { backgroundColor: colors.success + '22' },
    statusChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
    infoRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' },
    infoIcon: { marginRight: 6, marginTop: 1 },
    infoLabel: { width: 72, fontSize: 13, color: colors.textSecondary },
    infoValue: { flex: 1, fontSize: 13, color: colors.text },
    mono: { fontFamily: 'monospace', fontSize: 11 },
    mapPlaceholder: {
      backgroundColor: colors.surfaceVariant, borderRadius: 12,
      padding: 16, alignItems: 'center', marginBottom: 12,
    },
    mapCoords: { fontFamily: 'monospace', fontSize: 14, color: colors.text, marginBottom: 6 },
    mapHint: { color: colors.textSecondary, textAlign: 'center' },
    noLocation: { color: colors.textSecondary, marginBottom: 12 },
    mapsButton: { borderRadius: 8 },
    phoneLoader: { marginVertical: 12 },
    actionButton: { borderRadius: 8, marginBottom: 10 },
    backButton: { marginTop: 4 },
  });
}
