import React from 'react';
import { View, Text } from 'react-native';

export const PROVIDER_GOOGLE = 'google';
export const Marker = (_props: any) => null;
export const Polyline = (_props: any) => null;

export default function MapView({ style, children }: any) {
  return (
    <View style={[style, { backgroundColor: '#d1d5db', justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: '#6b7280', fontSize: 14 }}>Map (not available on web)</Text>
      {children}
    </View>
  );
}
