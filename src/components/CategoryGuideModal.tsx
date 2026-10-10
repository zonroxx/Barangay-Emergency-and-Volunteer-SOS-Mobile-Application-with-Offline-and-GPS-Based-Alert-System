import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, Modal, Text, IconButton, Divider, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

const CATEGORY_GUIDE: {
  key: string;
  label: string;
  icon: string;
  description: string;
  agency: string;
}[] = [
  {
    key: 'medical',
    label: 'Medical',
    icon: 'hospital-box',
    description:
      'Injuries, sudden illness, unconscious person, cardiac arrest, poisoning, and any situation needing immediate medical attention.',
    agency: 'DOH / Barangay Health Emergency Response Team',
  },
  {
    key: 'fire',
    label: 'Fire',
    icon: 'fire',
    description:
      'Fires, explosions, smoke, gas leaks, and other fire-related incidents.',
    agency: 'Bureau of Fire Protection (BFP)',
  },
  {
    key: 'crime',
    label: 'Crime',
    icon: 'shield-alert',
    description:
      'Robbery, theft, assault, domestic violence, suspicious persons, and other crimes needing police response.',
    agency: 'Philippine National Police (PNP)',
  },
  {
    key: 'accident',
    label: 'Accident',
    icon: 'car-emergency',
    description:
      'Vehicular collisions, falls, workplace accidents, and other accidental injury or property damage.',
    agency: 'Emergency Medical Services (EMS) / PNP',
  },
  {
    key: 'other',
    label: 'Other',
    icon: 'alert-circle',
    description:
      'Emergencies that do not fit the categories above but still need immediate assistance.',
    agency: 'Appropriate Barangay Response Team',
  },
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function CategoryGuideModal({ visible, onDismiss }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            Emergency Category Guide
          </Text>
          <IconButton icon="close" onPress={onDismiss} />
        </View>

        <Text variant="bodySmall" style={styles.subtitle}>
          Choose the category that best matches the situation so the right
          responders are alerted.
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          {CATEGORY_GUIDE.map((item, index) => (
            <View key={item.key}>
              {index > 0 && <Divider style={styles.divider} />}
              <View style={styles.entry}>
                <View style={styles.entryHeader}>
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={20}
                    color={colors.primary}
                  />
                  <Text variant="titleSmall" style={styles.entryLabel}>
                    {item.label}
                  </Text>
                </View>

                <Text variant="bodySmall" style={styles.description}>
                  {item.description}
                </Text>

                <View style={styles.agencyRow}>
                  <MaterialCommunityIcons
                    name="arrow-right-thin"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text variant="bodySmall" style={styles.agency}>
                    {item.agency}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <Button mode="contained" onPress={onDismiss} buttonColor={colors.primary} style={styles.closeButton}>
          Got it
        </Button>
      </Modal>
    </Portal>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    modal: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 12,
      paddingTop: 4,
      paddingBottom: 16,
      paddingHorizontal: 16,
      maxHeight: '80%',
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: colors.text, fontWeight: 'bold', flex: 1 },
    subtitle: { color: colors.textSecondary, marginBottom: 8, lineHeight: 18 },
    scroll: { flexGrow: 0 },
    scrollContent: { paddingBottom: 8 },
    divider: { backgroundColor: colors.border },
    entry: { paddingVertical: 12 },
    entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    entryLabel: { color: colors.text, fontWeight: 'bold' },
    description: { color: colors.textSecondary, lineHeight: 19 },
    agencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    agency: { color: colors.primary, fontWeight: '600', flex: 1 },
    closeButton: { marginTop: 12, borderRadius: 8 },
  });
}
