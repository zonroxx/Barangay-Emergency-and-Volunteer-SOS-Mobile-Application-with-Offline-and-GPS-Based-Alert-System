import React, { useRef, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Card, Text, IconButton } from 'react-native-paper';
import { Swipeable } from 'react-native-gesture-handler';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';
import { DbContact } from '../db/types';

interface ContactCardProps {
  contact: DbContact;
  onCall?: () => void;
  onDelete?: () => void;
  onSetPrimary?: () => void;
}

function DeleteAction({ onPress, colors }: { onPress: () => void; colors: ColorSet }) {
  return (
    <TouchableOpacity
      style={[deleteActionStyle.base, { backgroundColor: colors.danger }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[deleteActionStyle.label, { color: colors.white }]}>Delete</Text>
    </TouchableOpacity>
  );
}

const deleteActionStyle = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center', width: 80, marginBottom: 8, borderRadius: 10 },
  label: { fontWeight: '600', fontSize: 13 },
});

export default function ContactCard({ contact, onCall, onDelete, onSetPrimary }: ContactCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeableRef = useRef<Swipeable>(null);

  function handleDelete() {
    swipeableRef.current?.close();
    onDelete?.();
  }

  const typeLabel = contact.relationship
    ? contact.relationship.charAt(0).toUpperCase() + contact.relationship.slice(1)
    : null;

  const isSystem = contact.user_id === 'system';
  const isPrimary = contact.is_primary === 1;

  return (
    <Swipeable
      ref={swipeableRef}
      enabled={!!onDelete}
      renderRightActions={onDelete ? () => <DeleteAction onPress={handleDelete} colors={colors} /> : undefined}
      overshootRight={false}
      friction={2}
    >
      <Card style={[styles.card, isSystem && styles.systemCard]}>
        <Card.Content style={styles.row}>
          <View style={styles.left}>
            <View style={styles.badgeRow}>
              {isSystem && (
                <View style={styles.systemBadge}>
                  <Text style={styles.systemBadgeText}>Emergency</Text>
                </View>
              )}
              {isPrimary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>SMS Priority</Text>
                </View>
              )}
            </View>
            <Text variant="titleSmall" style={styles.name}>{contact.name}</Text>
            <Text variant="bodySmall" style={styles.phone}>{contact.phone}</Text>
            {typeLabel && !isSystem ? (
              <Text variant="bodySmall" style={styles.rel}>{typeLabel}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            {onSetPrimary && (
              <IconButton
                icon={isPrimary ? 'star' : 'star-outline'}
                iconColor={isPrimary ? colors.warning : colors.textSecondary}
                size={22}
                disabled={isPrimary}
                onPress={onSetPrimary}
                accessibilityLabel={
                  isPrimary ? 'Priority SMS contact' : `Set ${contact.name} as priority SMS contact`
                }
              />
            )}
            {onCall && (
              <IconButton
                icon="phone"
                iconColor={colors.success}
                size={22}
                onPress={onCall}
              />
            )}
            {onDelete && (
              <IconButton
                icon="trash-can-outline"
                iconColor={colors.danger}
                size={22}
                onPress={handleDelete}
              />
            )}
          </View>
        </Card.Content>
      </Card>
    </Swipeable>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    card: { marginBottom: 8, backgroundColor: colors.surface, borderRadius: 10 },
    systemCard: { borderLeftWidth: 4, borderLeftColor: colors.primary },
    badgeRow: { flexDirection: 'row', gap: 5, marginBottom: 4, flexWrap: 'wrap' },
    row: { flexDirection: 'row', alignItems: 'center' },
    left: { flex: 1 },
    name: { fontWeight: 'bold', color: colors.text },
    phone: { color: colors.textSecondary, marginTop: 2 },
    rel: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
    systemBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary + '18',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    primaryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.warning + '22',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    primaryBadgeText: {
      fontSize: 10,
      color: colors.warning,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    systemBadgeText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    actions: { flexDirection: 'row', alignItems: 'center' },
  });
}
