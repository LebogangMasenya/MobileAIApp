/**
 * VaultVisibilityToggle (specs/006 contract §5) — the "Make Vault Public"
 * control. Deliberately NOT React Native's <Switch>: its native animation is
 * neither spring-shaped nor interruptible, and Constitution V makes
 * mid-flight retargeting a requirement — a rapid re-flip must catch the knob
 * wherever it is, not queue a second snap.
 */

import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface VaultVisibilityToggleProps {
  isPublic: boolean;
  /** Render inert (no-op press) until the stored preference has loaded. */
  disabled?: boolean;
  onToggle: () => void;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const KNOB_SIZE = 24;
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - 6;

const KNOB_SPRING = { mass: 0.7, damping: 16, stiffness: 220 };
const TRACK_PRIVATE = '#E3DBF0'; // tailwind `line`
const TRACK_PUBLIC = '#6C4AB0'; // tailwind `primary`

export function VaultVisibilityToggle({ isPublic, disabled = false, onToggle }: VaultVisibilityToggleProps) {
  const position = useSharedValue(isPublic ? 1 : 0);

  useEffect(() => {
    // Spring toward the new state from WHEREVER the knob currently is —
    // interruptible retargeting, the whole reason this isn't a <Switch>.
    position.value = withSpring(isPublic ? 1 : 0, KNOB_SPRING);
  }, [isPublic, position]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(position.value, [0, 1], [TRACK_PRIVATE, TRACK_PUBLIC]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * KNOB_TRAVEL }],
  }));

  const labelPublicStyle = useAnimatedStyle(() => ({ opacity: position.value }));
  const labelPrivateStyle = useAnimatedStyle(() => ({ opacity: 1 - position.value }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isPublic, disabled }}
      accessibilityLabel="Make Vault Public"
      disabled={disabled}
      onPress={onToggle}
      // Row stays ≥44pt tall regardless of the compact visual track.
      className="min-h-11 flex-row items-center gap-2.5">
      <View className="items-end">
        {/* Crossfading state label — absolute overlay so width never shifts. */}
        <Animated.Text style={labelPublicStyle} className="text-xs font-semibold text-primary">
          Public
        </Animated.Text>
        <Animated.Text
          style={[labelPrivateStyle, { position: 'absolute' }]}
          className="text-xs font-semibold text-ink-muted">
          Private
        </Animated.Text>
      </View>
      <Animated.View
        style={[trackStyle, { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2 }]}
        className="justify-center px-[3px]">
        <Animated.View
          style={[knobStyle, { width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: KNOB_SIZE / 2 }]}
          className="bg-surface-card shadow"
        />
      </Animated.View>
    </Pressable>
  );
}
