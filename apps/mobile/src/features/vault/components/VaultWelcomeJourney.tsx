/**
 * VaultWelcomeJourney (specs/007 US3, contracts/vault-surfaces §2) — the
 * momentum-framed first-run vault. Replaces the cold "your scans live here"
 * empty card with a progress journey whose checked steps are all REAL
 * (useSetupJourney derives them from live state — FR-009/SC-007).
 *
 * Behavioral note (the goal-gradient effect the spec is built on): the bar
 * arriving already ~22% full is what converts "0 garments, start from
 * scratch" into "two steps down, one to go". The honesty guardrail is that
 * the 22% is *earned* — a user who denied camera permission genuinely sees
 * less, and the unchecked row doubles as the nudge to grant it.
 */

import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { JourneyStep, SetupJourney } from '@/features/vault/hooks/useSetupJourney';

interface VaultWelcomeJourneyProps {
  journey: SetupJourney;
  /** CTA — closes the vault back to the capture surface (the next real step). */
  onScanPress: () => void;
}

/** Progress sweep — deliberate and readable; the bar filling IS the message. */
const SWEEP_SPRING = { mass: 1, damping: 20, stiffness: 90 };

function StepRow({ step, index }: { step: JourneyStep; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 90)
        .springify()
        .mass(0.8)
        .damping(18)
        .stiffness(160)}
      className="flex-row items-center gap-3">
      {/* Check circle: filled plum = earned, hollow = the open loop. */}
      <View
        className={
          step.done
            ? 'h-6 w-6 items-center justify-center rounded-full bg-primary'
            : 'h-6 w-6 items-center justify-center rounded-full border-2 border-line'
        }>
        {step.done ? <Text className="text-xs font-bold text-on-primary">✓</Text> : null}
      </View>
      <Text className={step.done ? 'text-sm font-medium text-ink' : 'text-sm text-ink-muted'}>
        {step.label}
      </Text>
      {step.done ? <Text className="text-xs text-ink-muted">Done</Text> : null}
    </Animated.View>
  );
}

export function VaultWelcomeJourney({ journey, onScanPress }: VaultWelcomeJourneyProps) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(0);

  useEffect(() => {
    // Sweep from empty to the earned value on mount (delayed past the card's
    // own entrance so the fill is *watched*, not missed); reduce-motion gets
    // the same information as a simple cross-fade-style set (§3 matrix).
    fill.value = reducedMotion
      ? withTiming(journey.progress, { duration: 0 })
      : withDelay(350, withSpring(journey.progress, SWEEP_SPRING));
  }, [fill, journey.progress, reducedMotion]);

  /** Track width in px so the fill can animate as a pure transform. */
  const trackWidth = useSharedValue(0);

  // The bar renders full-width and slides left by the UNfilled fraction —
  // translateX instead of animated `width`, so the sweep is a UI-thread
  // transform with zero per-frame layout work (Constitution III).
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -trackWidth.value * (1 - fill.value) }],
  }));

  const doneCount = journey.steps.filter((step) => step.done).length;

  return (
    <Animated.View
      entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
      className="mx-6 gap-5 rounded-3xl bg-surface-card px-6 py-8">
      <View className="gap-1">
        <Text className="font-serif text-2xl text-ink">You&apos;re already on your way</Text>
        {/* Momentum copy — counts what's DONE, never announces a zero. */}
        <Text className="text-sm leading-relaxed text-ink-muted">
          {doneCount > 0
            ? `${doneCount} of ${journey.steps.length} steps down. One scan and your wardrobe comes alive.`
            : 'A couple of quick steps and your wardrobe comes alive.'}
        </Text>
      </View>

      {/* The journey bar — starts visibly non-zero because it IS non-zero. */}
      <View
        className="h-2 overflow-hidden rounded-full bg-surface-dim"
        onLayout={(event) => {
          trackWidth.value = event.nativeEvent.layout.width;
        }}>
        <Animated.View className="h-2 w-full rounded-full bg-primary" style={fillStyle} />
      </View>

      <View className="gap-3">
        {journey.steps.map((step, index) => (
          <StepRow key={step.id} step={step} index={index} />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan your first piece"
        onPress={onScanPress}
        className="mt-1 min-h-12 items-center justify-center rounded-full bg-primary px-6 active:bg-primary-pressed">
        <Text className="text-base font-semibold text-on-primary">Scan your first piece</Text>
      </Pressable>
    </Animated.View>
  );
}
