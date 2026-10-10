import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firestoreDB } from '../services/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { getDatabase } from '../db/database';
import { upsertUser } from '../db/queries';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';
import { APP_CONFIG } from '../../constants/config';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Registration failed. Please try again.';
  }
}

export default function RegisterScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();

  function validate(): string {
    if (!fullName.trim()) return 'Full name is required.';
    if (!phone.trim()) return 'Phone number is required.';
    if (!email.trim()) return 'Email is required.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!address.trim()) return 'Address is required.';
    if (!barangay.trim()) return 'Barangay is required.';
    return '';
  }

  async function handleRegister() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError('');
    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const fbUser = credential.user;
      await updateProfile(fbUser, { displayName: fullName.trim() });

      const now = new Date().toISOString();
      const userPayload = {
        uid: fbUser.uid,
        displayName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        barangay: barangay.trim(),
        address: address.trim(),
        isAdmin: false,   // promoted manually in the Firestore console
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(firestoreDB, 'users', fbUser.uid), userPayload);
      } catch { }

      try {
        const db = await getDatabase();
        await upsertUser(db, {
          id: fbUser.uid,
          name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          role: 'user',
          barangay: barangay.trim(),
          address: address.trim(),
          profile_photo: null,
          is_admin: false,
          is_active: true,
          created_at: now,
          updated_at: now,
          synced: true,
        });
      } catch { }

      login({
        uid: fbUser.uid,
        displayName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        barangay: barangay.trim(),
        address: address.trim(),
        isAdmin: false,
        isActive: true,
      });
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err?.code ?? ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>Create Account</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Join the {APP_CONFIG.appName} network
          </Text>
        </View>

        <Surface style={styles.card} elevation={2}>
          <Text variant="labelLarge" style={styles.sectionLabel}>Personal Info</Text>

          <TextInput label="Full Name" mode="outlined" style={styles.input}
            value={fullName} onChangeText={setFullName} autoCapitalize="words"
            textContentType="name" returnKeyType="next"
            left={<TextInput.Icon icon="account-outline" />} />

          <TextInput label="Phone Number" mode="outlined" style={styles.input}
            value={phone} onChangeText={setPhone} keyboardType="phone-pad"
            textContentType="telephoneNumber" returnKeyType="next"
            left={<TextInput.Icon icon="phone-outline" />} />

          <Text variant="labelLarge" style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            Location
          </Text>

          <TextInput label="Barangay" mode="outlined" style={styles.input}
            value={barangay} onChangeText={setBarangay} autoCapitalize="words"
            returnKeyType="next" left={<TextInput.Icon icon="map-marker-outline" />} />

          <TextInput label="Full Address" mode="outlined" style={styles.input}
            value={address} onChangeText={setAddress} autoCapitalize="sentences"
            returnKeyType="next" left={<TextInput.Icon icon="home-outline" />} />

          <Text variant="labelLarge" style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            Account
          </Text>

          <TextInput label="Email Address" mode="outlined" style={styles.input}
            value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" textContentType="emailAddress" returnKeyType="next"
            left={<TextInput.Icon icon="email-outline" />} />

          <TextInput label="Password" mode="outlined" style={styles.input}
            value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
            textContentType="newPassword" returnKeyType="done"
            onSubmitEditing={handleRegister}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setShowPassword((v) => !v)}
              />
            } />

          {error !== '' && (
            <HelperText type="error" visible style={styles.errorText}>{error}</HelperText>
          )}

          <Button
            mode="contained"
            style={styles.registerButton}
            contentStyle={styles.buttonContent}
            onPress={handleRegister}
            disabled={loading}
            buttonColor={colors.primary}
          >
            {loading ? <ActivityIndicator size="small" color={colors.white} /> : 'Create Account'}
          </Button>
        </Surface>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>Already have an account?</Text>
          <Button mode="text" compact textColor={colors.primary} onPress={() => navigation.goBack()}>
            Log In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { flexGrow: 1, padding: 24, paddingBottom: 40 },
    header: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
    title: { color: colors.primary, fontWeight: 'bold' },
    subtitle: { color: colors.textSecondary, marginTop: 6 },
    card: { borderRadius: 16, padding: 24, backgroundColor: colors.surface },
    sectionLabel: { color: colors.textSecondary, marginBottom: 8 },
    sectionLabelSpaced: { marginTop: 16 },
    input: { marginBottom: 12, backgroundColor: colors.surface },
    errorText: { marginBottom: 4, fontSize: 13 },
    registerButton: { marginTop: 16, borderRadius: 8 },
    buttonContent: { paddingVertical: 4 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
    footerText: { color: colors.textSecondary },
  });
}
