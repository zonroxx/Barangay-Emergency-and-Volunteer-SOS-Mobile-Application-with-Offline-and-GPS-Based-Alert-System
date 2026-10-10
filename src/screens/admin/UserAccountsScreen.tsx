import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Surface, Button, Chip, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../store/useAuthStore';
import { DbUser } from '../../db/types';
import { useColors } from '../../theme/ThemeContext';
import { ColorSet } from '../../../constants/colors';

export default function UserAccountsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();

  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await adminService.getAllUsers());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleToggle(target: DbUser) {
    const deactivating = target.is_active === 1;
    Alert.alert(
      deactivating ? 'Deactivate Account' : 'Reactivate Account',
      deactivating
        ? `${target.name} will be blocked from logging in. Their records are kept.`
        : `${target.name} will be able to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: deactivating ? 'Deactivate' : 'Reactivate',
          style: deactivating ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(target.id);
            try {
              await adminService.setUserActive(target.id, !deactivating);
              await load();
            } catch {
              Alert.alert('Error', 'Could not update this account. Check your connection.');
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
      data={users}
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
          Registered Accounts ({users.length})
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="account-off-outline" size={48} color={colors.disabled} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            No accounts found.{'\n'}Pull to refresh.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isSelf = item.id === user?.uid;
        const active = item.is_active === 1;
        return (
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardTop}>
              <MaterialCommunityIcons
                name={active ? 'account-outline' : 'account-cancel-outline'}
                size={22}
                color={active ? colors.primary : colors.disabled}
              />
              <Text variant="titleSmall" style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_admin === 1 && (
                <Chip compact textStyle={styles.chipText} style={[styles.chip, { backgroundColor: colors.secondary }]}>
                  admin
                </Chip>
              )}
              <Chip
                compact
                textStyle={styles.chipText}
                style={[styles.chip, { backgroundColor: active ? colors.success : colors.disabled }]}
              >
                {active ? 'active' : 'inactive'}
              </Chip>
            </View>

            {item.email ? (
              <Text variant="bodySmall" style={styles.meta}>{item.email}</Text>
            ) : null}
            {item.phone ? (
              <Text variant="bodySmall" style={styles.meta}>{item.phone}</Text>
            ) : null}
            {item.barangay ? (
              <Text variant="bodySmall" style={styles.meta}>Barangay {item.barangay}</Text>
            ) : null}

            <Button
              mode={active ? 'outlined' : 'contained-tonal'}
              compact
              // Guard against an admin locking themselves out
              disabled={busyId === item.id || isSelf}
              textColor={active ? colors.danger : undefined}
              onPress={() => handleToggle(item)}
              style={styles.actionButton}
            >
              {isSelf ? 'This is you' : active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </Surface>
        );
      }}
    />
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    list: { padding: 16, paddingBottom: 32, backgroundColor: colors.background, flexGrow: 1 },
    listHeader: { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    card: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 12 },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    cardTitle: { color: colors.text, marginLeft: 4, flex: 1, fontWeight: 'bold' },
    chip: { height: 26 },
    chipText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14 },
    meta: { color: colors.textSecondary, marginTop: 2 },
    actionButton: { marginTop: 12 },
    emptyState: { alignItems: 'center', paddingTop: 48 },
    emptyText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 12 },
  });
}
