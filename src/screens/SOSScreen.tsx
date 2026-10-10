import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/useAuthStore';
import { useAlertStore } from '../store/useAlertStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useDatabase } from '../hooks/useDatabase';
import { gpsService } from '../services/gpsService';
import { alertService } from '../services/alertService';
import { smsService } from '../services/smsService';
import { insertAlert, getContacts, getPrimaryContact, markAlertTransmitted, getAlertById } from '../db/queries';
import SOSButton from '../components/SOSButton';
import CategoryGuideModal from '../components/CategoryGuideModal';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

type Category = 'medical' | 'fire' | 'crime' | 'accident' | 'other';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'medical',  label: 'Medical',  icon: 'hospital-box' },
  { key: 'fire',     label: 'Fire',     icon: 'fire' },
  { key: 'crime',    label: 'Crime',    icon: 'shield-alert' },
  { key: 'accident', label: 'Accident', icon: 'car-emergency' },
  { key: 'other',    label: 'Other',    icon: 'alert-circle' },
];

export default function SOSScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user, isGuest } = useAuthStore();
  const { setActiveAlert } = useAlertStore();
  const { isOnline } = useNetworkStatus();
  const db = useDatabase();

  const [category, setCategory] = useState<Category>('medical');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);

  async function handleSOSActivate() {
    if (!db) {
      Alert.alert('Not ready', 'Database is initializing. Please try again.');
      return;
    }
    if (isSending) return;

    setIsSending(true);
    try {
      const coords = await gpsService.getCurrentLocation();
      const address = coords ? await gpsService.reverseGeocode(coords) : null;
      const userId = user?.uid ?? 'guest';

      const savedAlert = await insertAlert(db, {
        userId,
        type: category,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        address,
        description: message.trim() || null,
        gpsSource: coords?.source ?? null,
      });

      // Pin the marker on the map immediately
      setActiveAlert(savedAlert);

      let wasSentOnline = false;
      let smsSent = false;

      if (isOnline) {
        try {
          await alertService.sendToFirestore(savedAlert);
          wasSentOnline = true;
        } catch {
          wasSentOnline = false;
        }
      }

      if (!wasSentOnline) {
        const userName = user?.displayName ?? 'A resident';
        const smsBody = smsService.buildSOSBody(userName, category, coords, message.trim() || undefined);
        try {
          // The contact the user marked as priority wins; otherwise fall back
          // to the first flagged emergency contact.
          let recipient = await getPrimaryContact(db, userId);
          if (!recipient) {
            const contacts = await getContacts(db, userId);
            recipient =
              contacts.find(
                (c) => c.relationship === 'emergency' || c.is_emergency_contact === 1
              ) ?? null;
          }
          const phone = recipient?.phone ?? '';
          if (phone) smsSent = await smsService.sendViaSMSLink(phone, smsBody);
        } catch { }

        // Only stamp when the composer actually opened — a false stamp here
        // would inflate the Alert Success Rate metric.
        if (smsSent) await markAlertTransmitted(db, savedAlert.id, 'sms');
      }

      // Re-read so the confirmation screen and map marker carry the stamps
      const freshAlert = (await getAlertById(db, savedAlert.id)) ?? savedAlert;
      setActiveAlert(freshAlert);

      navigation.navigate('SOSConfirmation', { alert: freshAlert, wasSentOnline, smsSent });
      setMessage('');
      setCategory('medical');
    } catch {
      Alert.alert('SOS Failed', 'Could not send alert. Please call emergency services directly.', [{ text: 'OK' }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={[styles.netBadge, isOnline ? styles.netOnline : styles.netOffline]}>
        <MaterialCommunityIcons
          name={isOnline ? 'wifi' : 'wifi-off'}
          size={13}
          color={colors.text}
        />
        <Text style={styles.netText}>
          {isOnline ? 'Online' : 'Offline — SMS fallback will be used'}
        </Text>
      </View>

      <View style={styles.buttonArea}>
        {isSending ? (
          <View style={styles.sendingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text variant="bodyMedium" style={styles.sendingText}>Sending alert…</Text>
          </View>
        ) : (
          <SOSButton onActivate={handleSOSActivate} isGuest={isGuest} disabled={isSending} />
        )}
      </View>

      {!isGuest && (
        <>
          <View style={styles.sectionLabelRow}>
            <Text variant="labelLarge" style={styles.sectionLabelInline}>Emergency Type</Text>
            <TouchableOpacity
              style={styles.guideButton}
              onPress={() => setGuideVisible(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Open emergency category guide"
            >
              <MaterialCommunityIcons name="help-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.guideText}>Guide</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryChip, category === cat.key && styles.categoryChipActive]}
                onPress={() => setCategory(cat.key)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={18}
                  color={category === cat.key ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.categoryLabel, category === cat.key && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text variant="labelLarge" style={styles.sectionLabel}>
            Additional Info <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. person unconscious, 2nd floor"
            value={message}
            onChangeText={setMessage}
            maxLength={100}
            multiline
            numberOfLines={2}
            style={styles.messageInput}
            right={<TextInput.Affix text={`${message.length}/100`} />}
          />
        </>
      )}

      {isGuest && (
        <View style={styles.guestNotice}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.textSecondary} />
          <Text variant="bodyMedium" style={styles.guestText}>
            You are in guest mode. Log in to send SOS alerts and access the full app.
          </Text>
        </View>
      )}
    </ScrollView>

    <CategoryGuideModal visible={guideVisible} onDismiss={() => setGuideVisible(false)} />
    </>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    netBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    netOnline:  { backgroundColor: colors.success + '18' },
    netOffline: { backgroundColor: colors.warning + '22' },
    netText: { fontSize: 12, color: colors.text },
    buttonArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
    sendingContainer: { alignItems: 'center', gap: 16 },
    sendingText: { color: colors.textSecondary },
    sectionLabel: { color: colors.textSecondary, marginBottom: 10 },
    sectionLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionLabelInline: { color: colors.textSecondary },
    guideButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    guideText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    optional: { color: colors.disabled, fontWeight: 'normal' },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: colors.primary + '12',
      borderColor: colors.primary,
    },
    categoryLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    categoryLabelActive: { color: colors.primary, fontWeight: '700' },
    messageInput: { marginBottom: 24, backgroundColor: colors.surface },
    guestNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
    },
    guestText: { color: colors.text, flex: 1 },
  });
}
