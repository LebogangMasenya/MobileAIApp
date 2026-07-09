/**
 * EmptyScansState — the first-run invitation (FR-014, critique D5).
 * A brand-new user gets an inviting call-to-action, never an empty rail; the
 * CTA is one tap from their first scan (SC-005).
 */

import { Pressable, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface EmptyScansStateProps {
  onScanFirstOutfit: () => void;
}

export function EmptyScansState({ onScanFirstOutfit }: EmptyScansStateProps) {
  return (
    <Animated.View
      entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
      className="mx-6 items-center gap-3 rounded-3xl bg-surface-card px-6 py-8">
      <Text className="text-4xl">👗</Text>
      <Text className="text-center text-lg font-semibold text-ink">Nothing scanned yet</Text>
      <Text className="text-center text-sm leading-relaxed text-ink-muted">
        See an outfit you love? Point your camera at it and Satori finds where to shop the look.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onScanFirstOutfit}
        className="mt-2 min-h-12 items-center justify-center self-stretch rounded-full bg-primary px-6 active:bg-primary-pressed">
        <Text className="text-base font-semibold text-on-primary">Scan your first outfit</Text>
      </Pressable>
    </Animated.View>
  );
}
