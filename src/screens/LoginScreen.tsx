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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getDatabase } from '../db/database';
import { upsertUser } from '../db/queries';
import { firebaseAuth, firestoreDB } from '../services/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';
import { APP_CONFIG } from '../../constants/config';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'No account found with these credentials.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Login failed. Please try again.';
  }
}

export default function LoginScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginAsGuest } = useAuthStore();

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password
      );
      const fbUser = credential.user;

      // Fetch full profile from Firestore so we don't lose barangay, phone, address
      let profileData: Record<string, any> = {};
      try {
        const snap = await getDoc(doc(firestoreDB, 'users', fbUser.uid));
        if (snap.exists()) profileData = snap.data();
      } catch { }

      // Admins are promoted manually in the Firestore console; absent = false.
      const isAdmin = profileData.isAdmin === true;
      const isActive = profileData.isActive !== false;

      if (!isActive) {
        setError('This account has been deactivated. Please contact your barangay administrator.');
        return;
      }

      const displayName =
        profileData.displayName ?? fbUser.displayName ?? email.split('@')[0];
      const phone = profileData.phone ?? fbUser.phoneNumber ?? null;

      // Mirror the profile locally so the admin screens work offline too
      try {
        const db = await getDatabase();
        await upsertUser(db, {
          id: fbUser.uid,
          name: displayName,
          phone: phone ?? '',
          email: fbUser.email,
          role: 'user',
          barangay: profileData.barangay ?? '',
          address: profileData.address ?? '',
          is_admin: isAdmin,
          is_active: isActive,
          synced: true,
        });
      } catch { }

      login({
        uid: fbUser.uid,
        displayName,
        email: fbUser.email,
        phone,
        barangay: profileData.barangay ?? '',
        address: profileData.address ?? '',
        isAdmin,
        isActive,
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
          <Text variant="displaySmall" style={styles.appName}>
            {APP_CONFIG.appName}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Emergency Response System
          </Text>
        </View>

        <Surface style={styles.card} elevation={2}>
          <Text variant="titleMedium" style={styles.cardTitle}>Sign In</Text>

          <TextInput
            label="Email Address"
            mode="outlined"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            left={<TextInput.Icon icon="email-outline" />}
          />

          <TextInput
            label="Password"
            mode="outlined"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
          />

          {error !== '' && (
            <HelperText type="error" visible style={styles.errorText}>
              {error}
            </HelperText>
          )}

          <Button
            mode="contained"
            style={styles.loginButton}
            contentStyle={styles.buttonContent}
            onPress={handleLogin}
            disabled={loading}
            buttonColor={colors.primary}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              'Log In'
            )}
          </Button>

          <Button
            mode="outlined"
            style={styles.offlineButton}
            contentStyle={styles.buttonContent}
            onPress={loginAsGuest}
            disabled={loading}
            textColor={colors.textSecondary}
          >
            Continue Offline
          </Button>
        </Surface>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            Don't have an account?
          </Text>
          <Button
            mode="text"
            compact
            textColor={colors.primary}
            onPress={() => navigation.navigate('Register')}
          >
            Create Account
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
      paddingBottom: 40,
    },
    header: { alignItems: 'center', marginBottom: 32 },
    appName: { color: colors.primary, fontWeight: 'bold', textAlign: 'center' },
    subtitle: { color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
    card: {
      borderRadius: 16,
      padding: 24,
      backgroundColor: colors.surface,
    },
    cardTitle: { color: colors.text, fontWeight: '600', marginBottom: 20 },
    input: { marginBottom: 12, backgroundColor: colors.surface },
    errorText: { marginBottom: 4, fontSize: 13 },
    loginButton: { marginTop: 8, borderRadius: 8 },
    offlineButton: { marginTop: 10, borderRadius: 8, borderColor: colors.border },
    buttonContent: { paddingVertical: 4 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
    },
    footerText: { color: colors.textSecondary },
  });
}
