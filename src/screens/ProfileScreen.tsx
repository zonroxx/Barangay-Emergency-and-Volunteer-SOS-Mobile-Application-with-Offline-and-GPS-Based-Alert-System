import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import {
  Text, Button, Surface, Chip, Divider, Portal, Modal,
  TextInput, ActivityIndicator, IconButton, Switch,
} from 'react-native-paper';
import { useAuthStore } from '../store/useAuthStore';
import { useDatabase } from '../hooks/useDatabase';
import { useColors } from '../theme/ThemeContext';
import { useTheme } from '../theme/ThemeContext';
import { getContacts, insertContact, deleteContact, setPrimaryContact } from '../db/queries';
import { DbContact } from '../db/types';
import ContactCard from '../components/ContactCard';
import { ColorSet } from '../../constants/colors';

export default function ProfileScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isDark, toggleTheme } = useTheme();

  const { user, isGuest, logout } = useAuthStore();
  const db = useDatabase();

  const [contacts, setContacts] = useState<DbContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const userId = user?.uid ?? 'guest';

  const loadContacts = useCallback(async () => {
    if (!db) return;
    try {
      const rows = await getContacts(db, userId);
      setContacts(rows);
    } catch { } finally {
      setLoadingContacts(false);
    }
  }, [db, userId]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  async function handleCall(phone: string) {
    try {
      const url = `tel:${phone}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) { await Linking.openURL(url); }
      else { Alert.alert('Cannot call', `Calling is not supported on this device.\nDial: ${phone}`); }
    } catch {
      Alert.alert('Cannot call', `Could not open dialer.\nDial: ${phone}`);
    }
  }

  async function handleSetPrimary(contact: DbContact) {
    if (!db) return;
    try {
      await setPrimaryContact(db, userId, contact.id);
      await loadContacts();
    } catch {
      Alert.alert('Error', 'Could not set the priority contact. Please try again.');
    }
  }

  async function handleDelete(contact: DbContact) {
    const warning =
      contact.is_primary === 1
        ? `"${contact.name}" is your SMS priority contact. Offline alerts will have no recipient until you set another.`
        : `Remove "${contact.name}" from your contacts?`;
    Alert.alert('Delete Contact', warning, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await deleteContact(db, contact.id);
            await loadContacts();
          } catch {
            Alert.alert('Error', 'Could not delete contact. Please try again.');
          }
        },
      },
    ]);
  }

  async function handleAddContact() {
    if (!newName.trim()) { setFieldError('Name is required.'); return; }
    if (!newPhone.trim()) { setFieldError('Phone number is required.'); return; }
    if (!db) return;
    setAdding(true);
    try {
      await insertContact(db, { name: newName.trim(), phone: newPhone.trim(), userId, isEmergencyContact: false });
      setModalVisible(false);
      await loadContacts();
    } catch {
      setFieldError('Failed to save contact. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  const roleLabel = isGuest ? 'Guest' : 'Member';

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* User info card */}
        <Surface style={styles.profileCard} elevation={2}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {isGuest ? 'G' : (user?.displayName?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text variant="titleLarge" style={styles.displayName}>
                {isGuest ? 'Guest User' : (user?.displayName ?? 'Unknown')}
              </Text>
              <Chip compact style={[styles.roleChip, isGuest && styles.guestChip]} textStyle={styles.roleChipText}>
                {roleLabel}
              </Chip>
            </View>
          </View>

          {!isGuest && (
            <>
              <Divider style={styles.divider} />
              {user?.email && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Email</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>{user.email}</Text>
                </View>
              )}
              {user?.phone && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Phone</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>{user.phone}</Text>
                </View>
              )}
              {user?.barangay && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Barangay</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>{user.barangay}</Text>
                </View>
              )}
              {user?.address && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Address</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>{user.address}</Text>
                </View>
              )}
            </>
          )}

          {isGuest && (
            <Text variant="bodySmall" style={styles.guestNote}>
              You are browsing offline. Log in to save alerts and contacts.
            </Text>
          )}
        </Surface>

        {/* Contacts section */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Contacts</Text>
          <Button
            mode="contained-tonal"
            compact
            icon="plus"
            onPress={() => { setNewName(''); setNewPhone(''); setFieldError(''); setModalVisible(true); }}
            style={styles.addButton}
          >
            Add
          </Button>
        </View>

        {loadingContacts ? (
          <ActivityIndicator style={styles.loadingSpinner} color={colors.primary} />
        ) : contacts.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No contacts yet. Tap Add to create one.
          </Text>
        ) : (
          contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onCall={() => handleCall(contact.phone)}
              onDelete={() => handleDelete(contact)}
              onSetPrimary={isGuest ? undefined : () => handleSetPrimary(contact)}
            />
          ))
        )}

        {/* Appearance */}
        <Surface style={styles.settingsCard} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Appearance</Text>
          <Divider style={styles.divider} />
          <View style={styles.settingRow}>
            <Text variant="bodyMedium" style={styles.settingLabel}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.disabled, true: colors.primary + '88' }}
              thumbColor={isDark ? colors.primary : colors.textSecondary}
            />
          </View>
        </Surface>

        {/* Log out */}
        <Button
          mode="outlined"
          style={styles.logoutButton}
          textColor={colors.danger}
          onPress={logout}
        >
          Log Out
        </Button>
      </ScrollView>

      {/* Add Contact modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={styles.modalTitle}>Add Contact</Text>
            <IconButton icon="close" onPress={() => setModalVisible(false)} />
          </View>

          <TextInput
            label="Name" mode="outlined" style={styles.modalInput}
            value={newName} onChangeText={(t) => { setNewName(t); setFieldError(''); }}
            autoCapitalize="words" returnKeyType="next"
            left={<TextInput.Icon icon="account-outline" />}
          />

          <TextInput
            label="Phone Number" mode="outlined" style={styles.modalInput}
            value={newPhone} onChangeText={(t) => { setNewPhone(t); setFieldError(''); }}
            keyboardType="phone-pad" returnKeyType="done"
            onSubmitEditing={handleAddContact}
            left={<TextInput.Icon icon="phone-outline" />}
          />

          {fieldError !== '' && <Text style={styles.fieldError}>{fieldError}</Text>}

          <Button
            mode="contained"
            style={styles.modalSaveButton}
            buttonColor={colors.primary}
            onPress={handleAddContact}
            disabled={adding}
          >
            {adding ? <ActivityIndicator size="small" color={colors.white} /> : 'Save Contact'}
          </Button>
        </Modal>
      </Portal>
    </>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flexGrow: 1, padding: 16, paddingBottom: 40, backgroundColor: colors.background },
    profileCard: { borderRadius: 16, padding: 20, backgroundColor: colors.surface, marginBottom: 20 },
    profileHeader: { flexDirection: 'row', alignItems: 'center' },
    avatarCircle: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    avatarInitial: { color: colors.white, fontSize: 24, fontWeight: 'bold' },
    profileInfo: { flex: 1 },
    displayName: { fontWeight: 'bold', color: colors.text },
    roleChip: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.primary + '18' },
    guestChip: { backgroundColor: colors.warning + '22' },
    roleChipText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
    divider: { marginVertical: 14 },
    infoRow: { flexDirection: 'row', marginBottom: 6 },
    infoLabel: { width: 80, color: colors.textSecondary },
    infoValue: { flex: 1, color: colors.text },
    guestNote: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontWeight: '600', color: colors.text },
    addButton: { borderRadius: 8 },
    loadingSpinner: { marginTop: 20 },
    emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: 16 },
    settingsCard: { borderRadius: 16, padding: 20, backgroundColor: colors.surface, marginTop: 16, marginBottom: 4 },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    settingLabel: { color: colors.text },
    logoutButton: { marginTop: 16, borderRadius: 8, borderColor: colors.danger },
    modal: { margin: 24, backgroundColor: colors.surface, borderRadius: 16, padding: 24 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    modalTitle: { fontWeight: 'bold', color: colors.text },
    modalInput: { marginBottom: 14, backgroundColor: colors.surface },
    fieldError: { color: colors.danger, fontSize: 13, marginBottom: 8 },
    modalSaveButton: { marginTop: 4, borderRadius: 8 },
  });
}
