import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { getDatabase } from './src/db/database';
import { seedDatabaseIfNeeded, backfillPrimaryContactIfNeeded } from './src/db/seed';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function AppContent() {
  const { isDark } = useTheme();

  useEffect(() => {
    getDatabase()
      .then(() => seedDatabaseIfNeeded())
      .then(() => backfillPrimaryContactIfNeeded())
      .catch(() => {});
  }, []);

  const paperTheme = isDark
    ? { ...MD3DarkTheme,  colors: { ...MD3DarkTheme.colors,  primary: '#FF4D2D' } }
    : { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, primary: '#FF4D2D' } };

  return (
    <GestureHandlerRootView style={styles.root}>
      <PaperProvider theme={paperTheme}>
        <StatusBar style={isDark ? 'light' : 'light'} />
        <AppNavigator />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
