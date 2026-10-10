import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Surface, Button, Chip, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { adminService } from '../../services/adminService';
import { DbAlert } from '../../db/types';
import { useColors } from '../../theme/ThemeContext';
import { ColorSet } from '../../../constants/colors';

const CATEGORY_ICONS: Record<string, string> = {
  medical: 'medical-bag',
  fire: 'fire',
  crime: 'police-badge-outline',
  accident: 'car-emergency',
  other: 'alert-circle',
};

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function AlertHistoryScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [alerts, setAlerts] = useState<DbAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAlerts(await adminService.getAllAlerts());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function statusColor(status: string): string {
    if (status === 'resolved') return colors.success;
    if (status === 'responded') return colors.secondary;
    return colors.danger;
  }

  async function handleResolve(alert: DbAlert) {
    setBusyId(alert.id);
    try {
      await adminService.resolveAlert(alert.id);
      await load();
    } catch {
      Alert.alert('Error', 'Could not resolve this alert. Check your connection.');
    } finally {
      setBusyId(null);
    }
  }

  function handleDelete(alert: DbAlert) {
    Alert.alert(
      'Delete Alert',
      'This permanently removes the alert from both the device and Firestore. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(alert.id);
            try {
              await adminService.deleteAlert(alert.id);
              await load();
            } catch {
              Alert.alert('Error', 'Could not delete this alert.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={alerts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <Text variant="labelMedium" style={styles.listHeader}>
          All Alerts ({alerts.length})
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="database-off-outline" size={48} color={colors.disabled} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            No alerts recorded yet.{'\n'}Pull to refresh.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Surface style={styles.card} elevation={1}>
          <View style={styles.cardTop}>
            <MaterialCommunityIcons
              name={(CATEGORY_ICONS[item.type] ?? 'alert-circle') as any}
              size={22}
              color={colors.primary}
            />
            <Text variant="titleSmall" style={styles.cardTitle}>
              {item.type.toUpperCase()}
            </Text>
            <Chip
              compact
              textStyle={styles.chipText}
              style={[styles.chip, { backgroundColor: statusColor(item.status) }]}
            >
              {item.status}
            </Chip>
          </View>

          <Text variant="bodySmall" style={styles.meta}>
            Created: {formatStamp(item.created_at)}
          </Text>
          <Text variant="bodySmall" style={styles.meta}>
            Transmitted: {formatStamp(item.transmitted_at)}
            {item.transmission_path ? ` (${item.transmission_path})` : ''}
          </Text>
          <Text variant="bodySmall" style={styles.meta}>
            Responded: {formatStamp(item.responded_at)}
          </Text>
          {item.address ? (
            <Text variant="bodySmall" style={styles.meta} numberOfLines={2}>
              {item.address}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {item.status !== 'resolved' && (
              <Button
                mode="contained-tonal"
                compact
                disabled={busyId === item.id}
                onPress={() => handleResolve(item)}
                style={styles.actionButton}
              >
                Mark Resolved
              </Button>
            )}
            <Button
              mode="outlined"
              compact
              disabled={busyId === item.id}
              textColor={colors.danger}
              onPress={() => handleDelete(item)}
              style={styles.actionButton}
            >
              Delete
            </Button>
          </View>
        </Surface>
      )}
    />
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    list: { padding: 16, paddingBottom: 32, backgroundColor: colors.background, flexGrow: 1 },
    listHeader: { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    card: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 12 },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    cardTitle: { color: colors.text, marginLeft: 8, flex: 1, fontWeight: 'bold' },
    chip: { height: 26 },
    chipText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14 },
    meta: { color: colors.textSecondary, marginTop: 2 },
    actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
    actionButton: { flex: 1 },
    emptyState: { alignItems: 'center', paddingTop: 48 },
    emptyText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 12 },
  });
}
