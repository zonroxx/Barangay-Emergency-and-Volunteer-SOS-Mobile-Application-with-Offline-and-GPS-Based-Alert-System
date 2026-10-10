import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Surface, Button, ActivityIndicator, Snackbar, Divider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { adminService, computeStatistics } from '../../services/adminService';
import { DbAlert } from '../../db/types';
import { useColors } from '../../theme/ThemeContext';
import { ColorSet } from '../../../constants/colors';

export default function StatisticsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [alerts, setAlerts] = useState<DbAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      setAlerts(await adminService.getAllAlerts());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => computeStatistics(alerts), [alerts]);

  async function handleExport() {
    setExporting(true);
    try {
      const result = await adminService.exportAlertsCsv(alerts);
      setToast(result.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.tileRow}>
          <StatTile
            styles={styles}
            colors={colors}
            icon="alarm-light-outline"
            label="Total Alerts"
            value={String(stats.total)}
          />
          <StatTile
            styles={styles}
            colors={colors}
            icon="check-network-outline"
            label="Success Rate"
            value={`${stats.successRatePct.toFixed(1)}%`}
          />
        </View>

        <View style={styles.tileRow}>
          <StatTile
            styles={styles}
            colors={colors}
            icon="timer-outline"
            label="Avg Response"
            value={
              stats.avgResponseSeconds === null
                ? '—'
                : `${stats.avgResponseSeconds.toFixed(1)}s`
            }
          />
          <StatTile
            styles={styles}
            colors={colors}
            icon="account-check-outline"
            label="Responded"
            value={String(stats.respondedCount)}
          />
        </View>

        <Surface style={styles.card} elevation={1}>
          <Text variant="labelLarge" style={styles.cardTitle}>Alerts by Category</Text>
          <Divider style={styles.divider} />
          {stats.byCategory.length === 0 ? (
            <Text variant="bodySmall" style={styles.muted}>No data yet.</Text>
          ) : (
            stats.byCategory.map((row) => (
              <View key={row.key} style={styles.row}>
                <Text variant="bodyMedium" style={styles.rowLabel}>{row.key}</Text>
                <Text variant="bodyMedium" style={styles.rowValue}>{row.count}</Text>
              </View>
            ))
          )}
        </Surface>

        <Surface style={styles.card} elevation={1}>
          <Text variant="labelLarge" style={styles.cardTitle}>Transmission Path</Text>
          <Divider style={styles.divider} />
          <View style={styles.row}>
            <Text variant="bodyMedium" style={styles.rowLabel}>Online (Firestore)</Text>
            <Text variant="bodyMedium" style={styles.rowValue}>{stats.byPath.online}</Text>
          </View>
          <View style={styles.row}>
            <Text variant="bodyMedium" style={styles.rowLabel}>SMS (offline)</Text>
            <Text variant="bodyMedium" style={styles.rowValue}>{stats.byPath.sms}</Text>
          </View>
          <View style={styles.row}>
            <Text variant="bodyMedium" style={styles.rowLabel}>Not transmitted</Text>
            <Text variant="bodyMedium" style={styles.rowValue}>{stats.byPath.untransmitted}</Text>
          </View>
        </Surface>

        <Button
          mode="contained"
          icon="file-delimited-outline"
          onPress={handleExport}
          disabled={exporting}
          loading={exporting}
          buttonColor={colors.primary}
          style={styles.exportButton}
          contentStyle={styles.exportContent}
        >
          Export CSV
        </Button>
        <Text variant="bodySmall" style={styles.exportHint}>
          Exports all {stats.total} alert log(s) from the combined local + Firestore set.
        </Text>
      </ScrollView>

      <Snackbar
        visible={toast !== ''}
        onDismiss={() => setToast('')}
        duration={4000}
        style={styles.snackbar}
      >
        {toast}
      </Snackbar>
    </>
  );
}

function StatTile({
  styles, colors, icon, label, value,
}: {
  styles: any; colors: ColorSet; icon: string; label: string; value: string;
}) {
  return (
    <Surface style={styles.tile} elevation={1}>
      <MaterialCommunityIcons name={icon as any} size={22} color={colors.primary} />
      <Text variant="headlineSmall" style={styles.tileValue}>{value}</Text>
      <Text variant="bodySmall" style={styles.tileLabel}>{label}</Text>
    </Surface>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    container: { padding: 16, paddingBottom: 32, backgroundColor: colors.background, flexGrow: 1 },
    tileRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    tile: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 14, alignItems: 'center' },
    tileValue: { color: colors.text, fontWeight: 'bold', marginTop: 6 },
    tileLabel: { color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
    card: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginTop: 4, marginBottom: 12 },
    cardTitle: { color: colors.text },
    divider: { backgroundColor: colors.border, marginVertical: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { color: colors.textSecondary, textTransform: 'capitalize' },
    rowValue: { color: colors.text, fontWeight: 'bold' },
    muted: { color: colors.textSecondary },
    exportButton: { marginTop: 8, borderRadius: 8 },
    exportContent: { paddingVertical: 6 },
    exportHint: { color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
    snackbar: { marginBottom: 72 },
  });
}
