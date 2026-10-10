import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { DbAlert } from '../db/types';
import { haversineKm, formatDistance, timeAgo } from '../utils/geo';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

const CATEGORY_ICON: Record<string, string> = {
  medical: 'hospital-box', fire: 'fire', crime: 'shield-alert',
  accident: 'car-emergency', other: 'alert-circle',
};

interface AlertCardProps {
  alert: DbAlert;
  viewerLat?: number | null;
  viewerLng?: number | null;
  onAccept?: () => void;
  onDecline?: () => void;
}

export default function AlertCard({ alert, viewerLat, viewerLng, onAccept, onDecline }: AlertCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isActive = alert.status === 'active';

  const distanceLabel =
    viewerLat != null && viewerLng != null &&
    alert.latitude != null && alert.longitude != null
      ? formatDistance(haversineKm(viewerLat, viewerLng, alert.latitude, alert.longitude))
      : null;

  const iconName = (CATEGORY_ICON[alert.type] ?? 'alert-circle') as any;
  const categoryLabel = alert.type.charAt(0).toUpperCase() + alert.type.slice(1);

  const statusColor =
    alert.status === 'active' ? colors.danger :
    alert.status === 'responded' ? colors.warning :
    colors.success;

  return (
    <Card style={[styles.card, !isActive && styles.cardDimmed]}>
      <Card.Content>
        <View style={styles.topRow}>
          <View style={styles.categoryBadge}>
            <MaterialCommunityIcons name={iconName} size={20} color={colors.text} />
            <Text variant="titleSmall" style={styles.categoryLabel}>{categoryLabel}</Text>
          </View>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: statusColor + '22' }]}
            textStyle={[styles.statusChipText, { color: statusColor }]}
          >
            {alert.status}
          </Chip>
        </View>

        {alert.address && (
          <View style={styles.inlineRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.textSecondary} />
            <Text variant="bodySmall" style={styles.address} numberOfLines={2}>{alert.address}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <View style={styles.inlineRow}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textSecondary} />
            <Text variant="bodySmall" style={styles.meta}>{timeAgo(alert.created_at)}</Text>
          </View>
          {distanceLabel && (
            <View style={styles.inlineRow}>
              <MaterialCommunityIcons name="ruler" size={13} color={colors.textSecondary} />
              <Text variant="bodySmall" style={styles.meta}>{distanceLabel}</Text>
            </View>
          )}
        </View>

        {alert.description ? (
          <Text variant="bodySmall" style={styles.description} numberOfLines={2}>
            "{alert.description}"
          </Text>
        ) : null}

        {!alert.address && alert.latitude != null && (
          <Text variant="bodySmall" style={styles.gps}>
            {alert.latitude.toFixed(5)}, {alert.longitude?.toFixed(5)}
          </Text>
        )}

        {isActive && (onAccept || onDecline) && (
          <View style={styles.actions}>
            {onDecline && (
              <Button mode="outlined" compact textColor={colors.danger}
                style={styles.declineBtn} onPress={onDecline}>
                Decline
              </Button>
            )}
            {onAccept && (
              <Button mode="contained" compact buttonColor={colors.success}
                style={styles.acceptBtn} onPress={onAccept}>
                Accept
              </Button>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    card: { marginBottom: 12, backgroundColor: colors.surface, borderRadius: 12 },
    cardDimmed: { opacity: 0.55 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    categoryLabel: { fontWeight: 'bold', color: colors.text },
    statusChip: { borderRadius: 6 },
    statusChipText: { fontSize: 11, fontWeight: '600' },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    address: { color: colors.textSecondary, marginBottom: 6, flex: 1 },
    metaRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
    meta: { color: colors.textSecondary },
    description: { color: colors.text, fontStyle: 'italic', marginTop: 4 },
    gps: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11, marginTop: 2 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
    declineBtn: { borderColor: colors.danger, borderRadius: 8 },
    acceptBtn: { borderRadius: 8 },
  });
}
