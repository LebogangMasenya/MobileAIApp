/**
 * RingCelebration (specs/007 US5) — the full-ring moment, deliberately a
 * class bigger than a segment close (spec scenario 3: "clearly bigger"):
 * a scrim, a card that springs up with overshoot, an expanding halo echoing
 * the ring itself, and the two-beat `celebrate()` haptic.
 *
 * Resume-safety (interrupted-celebration edge case): this component is
 * DUMB — it plays whenever mounted and reports `onDone` when finished.
 * useDailyCycle owns the "owed a celebration" flag and only persists it via
 * `onDone`, so an app killed mid-moment simply re-mounts this on next visit
 * (allDone ∧ ¬celebrated) and the moment completes then. Never a stuck
 * half-played state, never a double-play after acknowledgment.
 *
 * Mounted Home-local ONLY (motion-tactility §5) — never inside the scan
 * overlay z-bands.
 */

import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { celebrate } from '@/services/tactile';

interface RingCelebrationProps {
  /** Called when the moment has fully played (auto or tap) — persist the flag here. */
  onDone: () => void;
}

/** Card pop: light mass + modest damping = a springy arrival with overshoot. */
const POP_SPRING = { mass: 0.7, damping: 14, stiffness: 190 };
/** Halo bloom: slower, softer — it frames the card, it doesn't race it. */
const HALO_SPRING = { mass: 1.3, damping: 20, stiffness: 60 };
/** The moment's dwell time before it excuses itself. */
const AUTO_DISMISS_MS = 2600;

export function RingCelebration({ onDone }: RingCelebrationProps) {
  const reducedMotion = useReducedMotion();
  const pop = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    // The two-beat fanfare is a one-shot achievement signal — it plays under
    // reduce-motion too (information, not rhythm — motion-tactility §2).
    celebrate();
    if (!reducedMotion) {
      pop.value = withSpring(1, POP_SPRING);
      halo.value = withSpring(1, HALO_SPRING);
    } else {
      pop.value = 1;
      halo.value = 1;
    }
    // The moment never holds the screen hostage: it excuses itself even if
    // the user doesn't tap.
    const timer = setTimeout(onDone, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [halo, onDone, pop, reducedMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.85 + pop.value * 0.15 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - halo.value) * 0.9,
    transform: [{ scale: 0.6 + halo.value * 1.2 }],
  }));

  return (
    <Animated.View
      entering={FadeIn.springify().mass(0.8).damping(18).stiffness(160)}
      exiting={FadeOut.springify().mass(0.8).damping(18).stiffness(160)}
      className="absolute inset-0 z-40 items-center justify-center">
      {/* Tap-anywhere scrim — acknowledging early is always allowed. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss celebration"
        onPress={onDone}
        className="absolute inset-0 bg-header/60"
      />
      {/* Expanding halo — the ring's shape, escaping outward. */}
      <Animated.View
        pointerEvents="none"
        className="absolute h-52 w-52 rounded-full border-4 border-primary"
        style={haloStyle}
      />
      <Animated.View
        style={cardStyle}
        className="items-center gap-2 rounded-3xl border border-line bg-surface-card px-8 py-7">
        <Text className="text-4xl">◎</Text>
        <Text className="font-serif text-2xl text-ink">Cycle complete</Text>
        <Text className="text-center text-sm leading-relaxed text-ink-muted">
          Logged, harmonized, and styled.{'\n'}Your wardrobe worked for you today.
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
