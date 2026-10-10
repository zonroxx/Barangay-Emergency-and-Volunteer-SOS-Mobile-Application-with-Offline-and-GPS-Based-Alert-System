import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Snackbar } from 'react-native-paper';
import { useAutoSync } from '../hooks/useAutoSync';
import { useColors } from '../theme/ThemeContext';

export default function SyncSnackbar() {
  const colors = useColors();
  const { pushedCount, visible, dismiss } = useAutoSync();

  return (
    <Portal>
      <Snackbar
        visible={visible}
        onDismiss={dismiss}
        duration={4000}
        style={[styles.snackbar, { backgroundColor: colors.success }]}
      >
        {`Synced ${pushedCount} pending alert${pushedCount === 1 ? '' : 's'}`}
      </Snackbar>
    </Portal>
  );
}

const styles = StyleSheet.create({
  // Clear of the bottom tab bar
  snackbar: { marginBottom: 72 },
});
