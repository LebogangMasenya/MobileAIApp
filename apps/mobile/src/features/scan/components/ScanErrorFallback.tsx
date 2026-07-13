/**
 * ScanErrorFallback (T010) — the feature's single non-destructive failure
 * surface, covering FR-012/FR-013/FR-015/FR-018 message states.
 *
 * One component instead of per-error UIs: every failure in this feature is
 * structurally the same (a friendly message + zero, one, or two recovery
 * actions), and centralizing it guarantees no call site can invent a dead-end
 * state (Constitution: Defensive Error Scaffolding). Parents render it as an
 * overlay so whatever was on screen (segmented photo, bubbles) stays intact
 * behind it — "non-destructive" is a layout property, not just wording.
 */

import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export interface ScanErrorFallbackProps {
  /** Short headline, e.g. "Nothing found". */
  title: string;
  /** User-safe explanation — never a technical error string. */
  message: string;
  /** Primary recovery action (e.g. "Try again"). Omit for message-only states. */
  primaryLabel?: string;
  onPrimary?: () => void;
  /** Secondary escape hatch (e.g. "New photo") for non-retryable failures. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Entrance spring: slightly under-damped so the card lands with a small,
 * organic settle instead of a mechanical pop (Constitution Principle V —
 * no linear curves, tuned mass/damping/stiffness).
 */
const ENTRANCE_SPRING = { mass: 0.8, damping: 14, stiffness: 180 };

export function ScanErrorFallback({
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: ScanErrorFallbackProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, ENTRANCE_SPRING);
  }, [progress]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Scale from 92% rather than 0 — a full-scale pop from nothing reads as
    // jarring; a subtle grow reads as the card "arriving".
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  return (
    <View
      // z-[60]: failure overlays top the whole z-band stack (specs/005 US1) —
      // explicit, because Fabric doesn't guarantee implicit sibling order.
      className="absolute inset-0 z-[60] items-center justify-center px-6"
      // The scrim itself swallows taps so users can't interact with stale UI
      // beneath an unresolved failure, but the content behind stays rendered.
      pointerEvents="auto">
      <View className="absolute inset-0 bg-black/50" />
      <Animated.View style={entranceStyle} className="w-full max-w-sm rounded-3xl bg-neutral-900 p-6">
        <Text className="text-center text-lg font-semibold text-white">{title}</Text>
        <Text className="mt-2 text-center text-base leading-6 text-neutral-300">{message}</Text>

        {primaryLabel && onPrimary ? (
          <Pressable
            accessibilityRole="button"
            onPress={onPrimary}
            className="mt-6 min-h-12 items-center justify-center rounded-full bg-white px-6 py-3 active:opacity-80">
            <Text className="text-base font-semibold text-black">{primaryLabel}</Text>
          </Pressable>
        ) : null}

        {secondaryLabel && onSecondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSecondary}
            className="mt-3 min-h-12 items-center justify-center rounded-full px-6 py-3 active:opacity-60">
            <Text className="text-base font-medium text-neutral-300">{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
