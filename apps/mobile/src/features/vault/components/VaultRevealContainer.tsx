/**
 * VaultRevealContainer (specs/005 contracts §3) — the Shazam pull.
 *
 * One shared value, `progress` (0 = scanning, 1 = vault open), OWNS the
 * transition the entire time. The finger drives it 1:1 during a pan; release
 * hands it to a spring aimed at the nearest attractor (judged on position
 * AND velocity); a re-catch mid-flight simply starts the next pan from the
 * current value. There is deliberately NO boolean "isOpen" that could
 * disagree with the surface mid-flight (Constitution V/VIII — the same
 * state-owns-position principle as the feature-002 route gate).
 *
 * Layering: scan content (base, recedes with progress) → pull handle (z-30)
 * → vault layer (z-40, slides from above) — under the failure overlays' z-60
 * band (specs/005 US1 z-band contract).
 */

import { useState, type ReactNode } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
// Reanimated 4 deprecates runOnJS; worklet→JS calls go through worklets core.
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VaultRevealContainerProps {
  /** Arming rule (FR-011): pan only responds while true (capture state, no overlays). */
  enabled: boolean;
  /** The scan capture UI. */
  children: ReactNode;
  /** The vault surface; receives a close() that springs the reveal shut. */
  renderVault: (close: () => void) => ReactNode;
}

/** Settle spring — brisk but soft-landing (<600ms, SC-003). */
const SETTLE_SPRING = { mass: 0.9, damping: 18, stiffness: 140 };
/** Open/close attractors: position past 35% or a decisive flick wins. */
const POSITION_THRESHOLD = 0.35;
const VELOCITY_THRESHOLD = 500;

export function VaultRevealContainer({ enabled, children, renderVault }: VaultRevealContainerProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);
  // JS-side mirror ONLY for pointerEvents (the vault must not eat taps while
  // hidden); visuals never read this — they read `progress` directly.
  const [vaultInteractive, setVaultInteractive] = useState(false);

  useAnimatedReaction(
    () => progress.value > 0.02,
    (interactive, previous) => {
      if (interactive !== previous) scheduleOnRN(setVaultInteractive, interactive);
    },
  );

  const settle = (toOpen: boolean) => {
    'worklet';
    progress.value = withSpring(toOpen ? 1 : 0, SETTLE_SPRING);
  };

  const pan = Gesture.Pan()
    .enabled(enabled)
    .onStart(() => {
      // Re-catch resumes from wherever the surface currently is — this line
      // is the whole "interruptible" guarantee.
      dragStart.value = progress.value;
    })
    .onUpdate((event) => {
      const next = dragStart.value + event.translationY / height;
      progress.value = Math.min(Math.max(next, 0), 1);
    })
    .onEnd((event) => {
      const flickOpen = event.velocityY > VELOCITY_THRESHOLD;
      const flickClosed = event.velocityY < -VELOCITY_THRESHOLD;
      settle(flickOpen || (progress.value > POSITION_THRESHOLD && !flickClosed));
    });

  const close = () => {
    progress.value = withSpring(0, SETTLE_SPRING);
  };

  // Scan content recedes as the vault surfaces — Shazam's depth cue.
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * 0.06 }],
    opacity: 1 - progress.value * 0.35,
  }));

  const vaultStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-height, 0]) }],
  }));

  const handleHintStyle = useAnimatedStyle(() => ({
    // Hint fades early — the vault replaces it. Clamped: past progress 0.5
    // the raw expression goes NEGATIVE, and negative opacity is undefined
    // behavior some platforms render as fully opaque (the exact wrong look).
    opacity: Math.max(0, 1 - progress.value * 2),
  }));

  return (
    <View className="flex-1 overflow-visible bg-black">
      <Animated.View style={scanStyle} className="flex-1">
        {children}
      </Animated.View>

      {/* Pull affordance — the visible, ≥44pt gesture surface (FR-009). */}
      {enabled ? (
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[{ top: insets.top }, handleHintStyle]}
            className="absolute left-0 right-0 z-30 h-12 items-center justify-center">
            <View className="items-center gap-0.5 rounded-full bg-black/35 px-4 py-1.5">
              <View className="h-1 w-8 rounded-full bg-white/70" />
              <Text className="text-[10px] font-medium uppercase tracking-widest text-white/70">
                Vault
              </Text>
            </View>
          </Animated.View>
        </GestureDetector>
      ) : null}

      {/* The vault surface — slides in from above the viewport (z-40). */}
      <Animated.View
        style={vaultStyle}
        pointerEvents={vaultInteractive ? 'auto' : 'none'}
        className="absolute inset-0 z-40">
        {/* Grab bar at the vault's bottom edge: the same pan closes it. */}
        <View className="flex-1 overflow-visible">
          {renderVault(close)}
          <GestureDetector gesture={pan}>
            <View
              style={{ paddingBottom: Math.max(insets.bottom, 8) }}
              className="absolute bottom-0 left-0 right-0 z-30 h-12 items-center justify-end">
              <View className="h-1 w-10 rounded-full bg-ink-muted/50" />
            </View>
          </GestureDetector>
        </View>
      </Animated.View>
    </View>
  );
}
