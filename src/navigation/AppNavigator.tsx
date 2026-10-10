import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import {
  NavigationContainer,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
} from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SOSScreen from '../screens/SOSScreen';
import SOSConfirmationScreen from '../screens/SOSConfirmationScreen';
import VolunteerRespondScreen from '../screens/VolunteerRespondScreen';
import MapScreen from '../screens/MapScreen';
import VolunteerAlertScreen from '../screens/VolunteerAlertScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminScreen from '../screens/AdminScreen';
import SyncSnackbar from '../components/SyncSnackbar';

import { useAuthStore } from '../store/useAuthStore';
import { useTheme, useColors } from '../theme/ThemeContext';
import { APP_CONFIG } from '../../constants/config';
import { DbAlert } from '../db/types';


export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  SOS: undefined;
  Map: undefined;
  VolunteerAlert: undefined;
  Admin: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  SOSConfirmation: {
    alert: DbAlert;
    wasSentOnline: boolean;
    smsSent: boolean;
  };
  VolunteerRespond: {
    alert: DbAlert;
  };
};

// ─── Navigators ────────────────────────────────────────────────────────────────

const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const MainStack = createStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function TabNavigator() {
  const colors = useColors();
  // isAdmin is set manually in the Firestore console. Non-admins never see the tab.
  const isAdmin = useAuthStore((state) => state.user?.isAdmin === true);
  return (
    <MainTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
      }}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <MainTab.Screen
        name="SOS"
        component={SOSScreen}
        options={{
          title: 'SOS',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="alarm-light-outline" color={color} size={size} />
          ),
        }}
      />
      <MainTab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="map-outline" color={color} size={size} />
          ),
        }}
      />
      <MainTab.Screen
        name="VolunteerAlert"
        component={VolunteerAlertScreen}
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell-outline" color={color} size={size} />
          ),
        }}
      />
      {isAdmin && (
        <MainTab.Screen
          name="Admin"
          component={AdminScreen}
          options={{
            title: 'Admin',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="shield-account-outline" color={color} size={size} />
            ),
          }}
        />
      )}
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" color={color} size={size} />
          ),
        }}
      />
    </MainTab.Navigator>
  );
}

function MainNavigator() {
  const colors = useColors();
  return (
    <MainStack.Navigator>
      <MainStack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="SOSConfirmation"
        component={SOSConfirmationScreen}
        options={{
          title: 'Alert Sent',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.white,
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />
      <MainStack.Screen
        name="VolunteerRespond"
        component={VolunteerRespondScreen}
        options={{
          title: 'Responding to Alert',
          headerStyle: { backgroundColor: colors.secondary },
          headerTintColor: colors.white,
        }}
      />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const { isDark, colors } = useTheme();

  const navTheme = useMemo(() => {
    const base = isDark ? NavDarkTheme : NavDefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [isDark, colors]);

  if (!_hasHydrated) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.primary }]}>
        <Text variant="headlineMedium" style={styles.splashTitle}>{APP_CONFIG.appName}</Text>
        <ActivityIndicator size="large" color={colors.white} style={styles.spinner} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? (
        <>
          <MainNavigator />
          {/* Mounted once, above the tabs, so auto-sync runs on any screen */}
          <SyncSnackbar />
        </>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  splashTitle: { color: '#FFFFFF', fontWeight: 'bold' },
  spinner: { marginTop: 24 },
});
