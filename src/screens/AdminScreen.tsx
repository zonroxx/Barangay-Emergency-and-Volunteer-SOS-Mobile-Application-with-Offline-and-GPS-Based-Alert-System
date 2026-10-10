import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import AlertHistoryScreen from './admin/AlertHistoryScreen';
import UserAccountsScreen from './admin/UserAccountsScreen';
import StatisticsScreen from './admin/StatisticsScreen';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

type AdminView = 'alerts' | 'users' | 'stats';

// Single Admin tab hosting the three admin views via a segmented toggle —
// same pattern the Alerts tab uses, and it needs no extra navigator package.
export default function AdminScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [view, setView] = useState<AdminView>('alerts');

  return (
    <View style={styles.container}>
      <View style={styles.toggleWrap}>
        <SegmentedButtons
          value={view}
          onValueChange={(v) => setView(v as AdminView)}
          buttons={[
            { value: 'alerts', label: 'Alerts', icon: 'history' },
            { value: 'users', label: 'Users', icon: 'account-group-outline' },
            { value: 'stats', label: 'Stats', icon: 'chart-box-outline' },
          ]}
        />
      </View>

      <View style={styles.content}>
        {view === 'alerts' && <AlertHistoryScreen />}
        {view === 'users' && <UserAccountsScreen />}
        {view === 'stats' && <StatisticsScreen />}
      </View>
    </View>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    toggleWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: colors.background },
    content: { flex: 1 },
  });
}
