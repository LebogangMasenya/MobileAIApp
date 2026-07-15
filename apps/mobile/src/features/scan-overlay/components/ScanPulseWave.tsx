/**
 * ScanPulseWave (specs/007 US1) — the living heartbeat of an in-flight scan.
 *
 * Replaces the static ActivityIndicator pill: three concentric rings bloom
 * outward (scale 0.8→2.5, opacity →0) on staggered spring loops over a
 * breathing under-glow, and each bloom PEAK fires one light haptic tick so
 * the search is felt, not just seen (FR-004/005).
 *
 * Why plain Views, not SVG (research R3): a "radar ring" IS a border-radius
 * 999 View — SVG would add a native layer over the photo surface for zero
 * visual gain. Same stacked-translucent-border glow trick as
 * NeonTracingOverlay, and the same spring-loop idiom (Constitution V bans
 * timing curves for this; withRepeat(withSequence(withSpring…)) restarts
 * seamlessly because opacity hits 0 exactly where the loop resets).
 *
 * Lifecycle contract (motion-tactility §6): the parent mounts this only
 * while a search is in flight; the `exiting` spring-fade below is what makes
 * resolution read as "the pulse settles" within one beat — never a zombie
 * wave behind results (SC-002). Ticks stop with the mount, structurally.
 *
 * Reduce-motion (§3 matrix): loops and ticks are decoration → replaced by a
 * calm static double-ring; the label pill (information) stays.
 */

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
// Reanimated 4: worklet→JS hops go through worklets core, never runOnJS.
import { scheduleOnRN } from 'react-native-worklets';

import { tick } from '@/services/tactile';

export interface ScanPulseWaveProps {
  /** Status copy for the pill ("Identifying garments…" etc.). */
  label: string;
}

/**
 * One bloom ≈ 1.6s: soft and unhurried — a heartbeat, not an alarm. The
 * near-critical damping means the ring *arrives* at full size rather than
 * bouncing there, which is what lets the opacity fade-out feel continuous.
 */
const BLOOM_SPRING = { mass: 1.3, damping: 22, stiffness: 26 };
/** Breathing under-glow — same personality as NeonTracingOverlay's pulse. */
const BREATH_SPRING = { mass: 1.4, damping: 18, stiffness: 60 };
/** Entrance/exit — brisk settle, matches the house SETTLE_SPRING family. */
const SETTLE = { mass: 0.8, damping: 18, stiffness: 180 };

const RING_COUNT = 3;
/** Rings launch a third of a bloom apart so the pulse never goes silent. */
const STAGGER_MS = 533;
const BASE_DIAMETER = 132;

interface BloomRingProps {
  index: number;
  /** Lead ring exposes its phase so the haptic reaction can watch ONE value. */
  phase?: SharedValue<number>;
}

/**
 * A single expanding ring. `progress` runs 0→1 per bloom: scale maps
 * 0.8→2.5, opacity 0.85→0 — at the loop's instant reset both ends meet at
 * "invisible", so a new wave being born is the only visible discontinuity,
 * and that's the intended look.
 */
function BloomRing({ index, phase }: BloomRingProps) {
  const local = useSharedValue(0);
  const progress = phase ?? local;

  useEffect(() => {
    progress.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          // duration:0 = an instant reset, not motion — no curve involved,
          // so Constitution V (no linear *transitions*) is untouched.
          withTiming(0, { duration: 0 }),
          withSpring(1, BLOOM_SPRING),
        ),
        -1,
        false,
      ),
    );
    // progress is a stable shared value; index never changes for a mounted ring.
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - progress.value),
    transform: [{ scale: 0.8 + progress.value * 1.7 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: BASE_DIAMETER,
          height: BASE_DIAMETER,
          borderRadius: BASE_DIAMETER / 2,
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.85)',
        },
        style,
      ]}
    />
  );
}

/** The status pill: liquid glass where the OS offers it, proven dark pill elsewhere. */
function StatusPill({ label }: { label: string }) {
  // isLiquidGlassAvailable() is a sync capability check (iOS 26+); the
  // fallback is the app's existing bg-black/70 treatment — the pill itself
  // is the "controlled dark backdrop" that guarantees AA contrast over any
  // photo behind it (motion-tactility §4).
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor="rgba(0, 0, 0, 0.45)"
        colorScheme="dark"
        style={{
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          paddingHorizontal: 20,
          paddingVertical: 10,
        }}>
        <Text className="text-sm font-medium text-white">{label}</Text>
      </GlassView>
    );
  }
  return (
    <View className="rounded-full border border-white/20 bg-black/70 px-5 py-2.5">
      <Text className="text-sm font-medium text-white">{label}</Text>
    </View>
  );
}

export function ScanPulseWave({ label }: ScanPulseWaveProps) {
  const reducedMotion = useReducedMotion();
  /** Lead ring's bloom phase — the haptic metronome watches this one value. */
  const leadPhase = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    breath.value = withRepeat(
      withSequence(withSpring(1, BREATH_SPRING), withSpring(0, BREATH_SPRING)),
      -1,
      true,
    );
  }, [breath, reducedMotion]);

  // US1/T006 — the peak tick. One reaction on ONE shared value crossing its
  // expansion peak (≥0.92 ≈ the ring's visual apex before it fades), firing a
  // single discrete beat per bloom (~0.6Hz — an event, not per-frame traffic,
  // Constitution III). Unmount tears the reaction down, so ticks can't outlive
  // the scan (FR-006). Repeating haptics are rhythm = decoration, so the
  // whole reaction is skipped under reduce-motion (motion-tactility §2).
  useAnimatedReaction(
    () => leadPhase.value >= 0.92,
    (atPeak, wasAtPeak) => {
      if (!reducedMotion && atPeak && wasAtPeak === false) {
        scheduleOnRN(tick);
      }
    },
    [reducedMotion],
  );

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + breath.value * 0.25,
    transform: [{ scale: 1 + breath.value * 0.04 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.springify().mass(SETTLE.mass).damping(SETTLE.damping).stiffness(SETTLE.stiffness)}
      // The exit IS the hand-off (§6): resolution unmounts us and this spring
      // fade settles everything — rings, glow, pill — within one beat.
      exiting={FadeOut.springify().mass(SETTLE.mass).damping(SETTLE.damping).stiffness(SETTLE.stiffness)}
      // z-10: the wave lives in the trace band, under chrome/hotspots/failures
      // (specs/005 z-band contract; motion-tactility §5).
      className="absolute inset-0 z-10 items-center justify-center">
      {reducedMotion ? (
        // Calm equivalent: a fixed double ring says "working" without motion.
        <View className="items-center justify-center">
          <View
            style={{
              position: 'absolute',
              width: BASE_DIAMETER,
              height: BASE_DIAMETER,
              borderRadius: BASE_DIAMETER / 2,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.7)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: BASE_DIAMETER * 1.35,
              height: BASE_DIAMETER * 1.35,
              borderRadius: (BASE_DIAMETER * 1.35) / 2,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.35)',
            }}
          />
        </View>
      ) : (
        <View className="items-center justify-center">
          {/* Breathing core glow — stacked translucent fills, no blur pass. */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: BASE_DIAMETER * 0.7,
                height: BASE_DIAMETER * 0.7,
                borderRadius: (BASE_DIAMETER * 0.7) / 2,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
              },
              glowStyle,
            ]}
          />
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <BloomRing key={index} index={index} phase={index === 0 ? leadPhase : undefined} />
          ))}
        </View>
      )}

      {/* Status pill sits in the familiar bottom slot (thumb-band clear). */}
      <View className="absolute bottom-32 left-0 right-0 items-center">
        <StatusPill label={label} />
      </View>
    </Animated.View>
  );
}
