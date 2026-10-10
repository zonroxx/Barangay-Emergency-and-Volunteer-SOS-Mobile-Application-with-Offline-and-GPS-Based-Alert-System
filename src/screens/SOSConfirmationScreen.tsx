import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Surface, Chip } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StackScreenProps } from '@react-navigation/stack';
import { MainStackParamList } from '../navigation/AppNavigator';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

type Props = StackScreenProps<MainStackParamList, 'SOSConfirmation'>;

const CATEGORY_ICON: Record<string, string> = {
  medical: 'hospital-box', fire: 'fire', crime: 'shield-alert',
  accident: 'car-emergency', other: 'alert-circle',
};

export default function SOSConfirmationScreen({ route, navigation }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { alert, wasSentOnline, smsSent } = route.params;
  const sentAt = new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const categoryIconName = (CATEGORY_ICON[alert.type] ?? 'alert-circle') as any;
  const categoryLabel = alert.type.charAt(0).toUpperCase() + alert.type.slice(1);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface style={[styles.banner, wasSentOnline ? styles.bannerOnline : styles.bannerOffline]} elevation={0}>
        <MaterialCommunityIcons
          name={wasSentOnline ? 'check-circle-outline' : 'signal-off'}
          size={44}
          color={wasSentOnline ? colors.success : colors.warning}
          style={styles.bannerIcon}
        />
        <Text variant="titleMedium" style={styles.bannerTitle}>
          {wasSentOnline ? 'Alert Sent Successfully' : 'Saved Offline'}
        </Text>
        <Text variant="bodySmall" style={styles.bannerSub}>
          {wasSentOnline
            ? 'Volunteers and barangay officials have been notified.'
            : 'Alert saved locally. Will sync when connection is restored.'}
        </Text>
      </Surface>

      <Surface style={styles.card} elevation={2}>
        <Text variant="labelMedium" style={styles.sectionLabel}>Alert Details</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Category</Text>
          <Chip
            compact
            icon={() => <MaterialCommunityIcons name={categoryIconName} size={14} color={colors.text} />}
            style={styles.chip}
          >
            {categoryLabel}
          </Chip>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Time</Text>
          <Text style={styles.rowValue}>{sentAt}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Alert ID</Text>
          <Text style={[styles.rowValue, styles.mono]}>{alert.id.slice(0, 14)}…</Text>
        </View>

        {alert.latitude != null && alert.longitude != null && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>GPS</Text>
            <Text style={[styles.rowValue, styles.mono]}>
              {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
            </Text>
          </View>
        )}

        {alert.description ? (
          <View style={[styles.row, styles.rowColumn]}>
            <Text style={styles.rowLabel}>Message</Text>
            <Text style={styles.description}>{alert.description}</Text>
          </View>
        ) : null}
      </Surface>

      {!wasSentOnline && (
        <Surface style={styles.card} elevation={2}>
          <Text variant="labelMedium" style={styles.sectionLabel}>SMS Fallback</Text>
          <View style={styles.smsRow}>
            <MaterialCommunityIcons
              name={smsSent ? 'message-arrow-right-outline' : 'alert-outline'}
              size={18}
              color={smsSent ? colors.success : colors.warning}
            />
            <Text variant="bodyMedium" style={styles.smsStatus}>
              {smsSent
                ? 'SMS app opened with emergency message. Confirm send in your messaging app.'
                : 'Could not open SMS app. Share your location manually with emergency contacts.'}
            </Text>
          </View>
        </Surface>
      )}

      <Surface style={styles.card} elevation={2}>
        <Text variant="labelMedium" style={styles.sectionLabel}>What happens next?</Text>
        {[
          'Stay calm and move to a safe location if possible.',
          'Keep your phone nearby — a volunteer may call you.',
          'Check the Dashboard to monitor your alert status.',
        ].map((step) => (
          <View key={step} style={styles.stepRow}>
            <MaterialCommunityIcons name="circle-small" size={20} color={colors.textSecondary} />
            <Text variant="bodySmall" style={styles.nextStepText}>{step}</Text>
          </View>
        ))}
      </Surface>

      <Button
        mode="contained"
        style={styles.homeButton}
        buttonColor={colors.primary}
        onPress={() => navigation.navigate('MainTabs')}
      >
        Back to Home
      </Button>
    </ScrollView>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flexGrow: 1, padding: 16, paddingBottom: 40, backgroundColor: colors.background },
    banner: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
    bannerOnline:  { backgroundColor: colors.success + '18' },
    bannerOffline: { backgroundColor: colors.warning + '18' },
    bannerIcon: { marginBottom: 10 },
    bannerTitle: { fontWeight: 'bold', color: colors.text, textAlign: 'center' },
    bannerSub: { color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
    card: { borderRadius: 16, padding: 20, backgroundColor: colors.surface, marginBottom: 16 },
    sectionLabel: { color: colors.textSecondary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    rowColumn: { flexDirection: 'column', alignItems: 'flex-start' },
    rowLabel: { width: 80, fontSize: 13, color: colors.textSecondary },
    rowValue: { flex: 1, fontSize: 14, color: colors.text },
    mono: { fontFamily: 'monospace', fontSize: 12 },
    chip: { backgroundColor: colors.surfaceVariant },
    description: { fontSize: 14, color: colors.text, marginTop: 4 },
    smsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    smsStatus: { color: colors.text, flex: 1 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
    nextStepText: { color: colors.textSecondary, lineHeight: 20, flex: 1 },
    homeButton: { marginTop: 8, borderRadius: 8 },
  });
}
