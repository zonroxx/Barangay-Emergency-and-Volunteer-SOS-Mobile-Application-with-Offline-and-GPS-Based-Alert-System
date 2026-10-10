import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useColors } from '../theme/ThemeContext';
import { ColorSet } from '../../constants/colors';

const HOLD_MS = 2500;
const BUTTON_SIZE = 180;
const RING_SIZE = BUTTON_SIZE + 28;
const RING_THICKNESS = 6;

interface SOSButtonProps {
  onActivate: () => void;
  isGuest?: boolean;
  disabled?: boolean;
}

function ProgressRing({ progress }: { progress: Animated.Value }) {
  const rotateRight = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '0deg', '0deg'],
  });
  const rotateLeft = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '-180deg', '0deg'],
  });
  const leftOpacity = progress.interpolate({
    inputRange: [0, 0.49, 0.5],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.05],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const half = RING_SIZE / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: ringOpacity }, ringStyles.outer]}
    >
      <View style={[ringStyles.half, { right: 0 }]}>
        <Animated.View
          style={[
            ringStyles.rotator,
            { left: -half, transform: [{ rotate: rotateRight }] },
          ]}
        />
      </View>
      <Animated.View style={[ringStyles.half, { left: 0, opacity: leftOpacity }]}>
        <Animated.View
          style={[
            ringStyles.rotator,
            { left: 0, transform: [{ rotate: rotateLeft }] },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}

export default function SOSButton({ onActivate, isGuest, disabled }: SOSButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [timeLeft, setTimeLeft] = useState(HOLD_MS / 1000);

  const isDisabled = disabled || isGuest;

  const triggerHaptics = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Haptics = require('expo-haptics');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // expo-haptics unavailable
    }
  }, []);

  function startHold() {
    if (isDisabled) return;
    setIsHolding(true);
    setTimeLeft(HOLD_MS / 1000);

    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    });

    animRef.current.start(async ({ finished }) => {
      if (finished) {
        await triggerHaptics();
        onActivate();
      }
      progress.setValue(0);
      setIsHolding(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    });

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, parseFloat((t - 0.1).toFixed(1))));
    }, 100);
  }

  function endHold() {
    if (!isHolding) return;
    animRef.current?.stop();
    progress.setValue(0);
    setIsHolding(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const pulseAnim = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (isDisabled) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isDisabled, pulseAnim]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.ringContainer}>
        <ProgressRing progress={progress} />
      </View>

      <TouchableWithoutFeedback
        onPressIn={startHold}
        onPressOut={endHold}
        disabled={isDisabled}
      >
        <Animated.View
          style={[
            styles.button,
            isDisabled && styles.buttonDisabled,
            !isHolding && !isDisabled && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          {isHolding ? (
            <>
              <Text style={styles.countdownNum}>{timeLeft.toFixed(1)}</Text>
              <Text style={styles.countdownLabel}>HOLD</Text>
            </>
          ) : isGuest ? (
            <>
              <MaterialCommunityIcons name="lock-outline" size={32} color={colors.white} />
              <Text style={styles.guestLabel}>Log in{'\n'}to use SOS</Text>
            </>
          ) : (
            <Text style={styles.label}>SOS</Text>
          )}
        </Animated.View>
      </TouchableWithoutFeedback>

      {!isGuest && !isDisabled && (
        <Text style={styles.hint}>
          {isHolding ? 'Release to cancel' : 'Hold for 2.5 seconds to activate'}
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ColorSet) {
  return StyleSheet.create({
    wrapper: { alignItems: 'center' },
    ringContainer: {
      position: 'absolute',
      width: RING_SIZE,
      height: RING_SIZE,
      top: -(RING_SIZE - BUTTON_SIZE) / 2,
      left: -(RING_SIZE - BUTTON_SIZE) / 2,
    },
    button: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      backgroundColor: colors.sosRed,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 10,
      shadowColor: colors.sosRed,
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 4 },
    },
    buttonDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    label: { color: colors.white, fontSize: 40, fontWeight: 'bold', letterSpacing: 4 },
    countdownNum: { color: colors.white, fontSize: 44, fontWeight: 'bold' },
    countdownLabel: { color: colors.white, fontSize: 14, letterSpacing: 3, marginTop: -4 },
    guestLabel: { color: colors.white, fontSize: 13, textAlign: 'center', marginTop: 6 },
    hint: { color: colors.textSecondary, fontSize: 12, marginTop: 16, textAlign: 'center' },
  });
}

const ringStyles = StyleSheet.create({
  outer: { width: RING_SIZE, height: RING_SIZE },
  half: {
    position: 'absolute',
    width: RING_SIZE / 2,
    height: RING_SIZE,
    overflow: 'hidden',
  },
  rotator: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_THICKNESS,
    borderColor: '#FFFFFF',
  },
});
