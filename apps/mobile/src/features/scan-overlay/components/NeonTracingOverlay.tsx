/**
 * NeonTracingOverlay (specs/004 T002) — the scanning visual both surfaces
 * share: a neon light that RUNS THE PERIMETER of the target region over a
 * soft stacked glow.
 *
 * Why no SVG paths: react-native-svg is a native module we deliberately did
 * not add (user decision 2026-07-12 — no dev-client rebuild). The trace
 * therefore follows the region's BOUNDING RECTANGLE, not the garment's
 * silhouette; true contour pathing is the recorded SVG/Skia follow-up if the
 * rectangle reads as insufficiently premium on device (plan.md).
 *
 * How the runner works: one shared value `lap` climbs 0→4 forever, one
 * spring per edge (`withRepeat(withSequence(spring 1, 2, 3, 4))`). Each of
 * the four edge runners owns a quarter of the lap: it interpolates its
 * translate along its edge inside its quarter and fades out outside it.
 * Position at lap=4 equals lap=0 (a full circuit), so the repeat restart is
 * seamless. Springs — not timing curves — shape each leg, so every corner
 * gets a physical ease-through (Constitution V; `Easing.linear` banned).
 *
 * Performance: the whole effect is 4 transforms + 2 static glow layers on
 * the UI thread — no per-frame layout, no native blur (blur forces a view
 * snapshot per frame — Constitution III; glow is faked with stacked
 * translucent borders, same trick as 001's SegmentationOverlay had).
 */

import { useEffect } from 'react';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { regionToLayout, type LayoutRect } from '@/features/scan/utils/layout';
import type { BoundingRegion } from '@/types/scan';

export interface NeonTracingOverlayProps {
  /** Normalized region to trace (0–1, relative to the photo). */
  region: BoundingRegion;
  /** Rendered photo frame in container pixels (from useCoordinateTransform). */
  frame: LayoutRect;
  /**
   * "tracing" = runner circling + breathing glow while work is in flight;
   * "settled" = runner parked, outline faded static — results own the scene.
   * Mode changes SPRING between levels (never snap) so the handoff reads as
   * one continuous moment, interruptible mid-flight.
   */
  mode: 'tracing' | 'settled';
}

/** Neon palette — cyan rings, white-hot runner core. */
const NEON = '#22D3EE';
const NEON_SOFT = 'rgba(34, 211, 238, 0.35)';
const RUNNER_CORE = 'rgba(240, 253, 255, 0.95)';

/** Fraction of an edge the runner bar occupies. */
const RUNNER_FRACTION = 0.32;
const RUNNER_THICKNESS = 3;

/** One perimeter leg — brisk but readable; four legs ≈ a 2s lap. */
const LAP_SPRING = { mass: 1.1, damping: 20, stiffness: 42 };
const ENTRANCE_SPRING = { mass: 0.9, damping: 13, stiffness: 150 };
const PULSE_SPRING = { mass: 1.4, damping: 18, stiffness: 60 };

type Edge = 'top' | 'right' | 'bottom' | 'left';
const EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
/** Which quarter of the lap each edge owns. */
const EDGE_START: Record<Edge, number> = { top: 0, right: 1, bottom: 2, left: 3 };

interface EdgeRunnerProps {
  edge: Edge;
  /** Overlay-local box the runner travels within. */
  size: { width: number; height: number };
  lap: SharedValue<number>;
  /** 0→1 "settled" level — runners fade out as the trace settles. */
  settled: SharedValue<number>;
}

function EdgeRunner({ edge, size, lap, settled }: EdgeRunnerProps) {
  const horizontal = edge === 'top' || edge === 'bottom';
  const trackLength = horizontal ? size.width : size.height;
  const runnerLength = Math.max(24, trackLength * RUNNER_FRACTION);
  const travel = Math.max(0, trackLength - runnerLength);
  const start = EDGE_START[edge];
  // Bottom and left legs travel "backwards" so the light keeps circling in
  // one continuous clockwise direction instead of ping-ponging.
  const reversed = edge === 'bottom' || edge === 'left';

  const style = useAnimatedStyle(() => {
    const local = lap.value - start; // 0..1 while this edge owns the runner
    const progress = reversed ? 1 - local : local;
    return {
      // Quick fade at the quarter boundaries so consecutive edges cross-fade
      // through each corner instead of blinking; the whole runner fades with
      // `settled`, spring-driven, so pausing is itself interruptible motion.
      opacity:
        (1 - settled.value) *
        interpolate(local, [-0.08, 0.08, 0.92, 1.08], [0, 1, 1, 0], 'clamp'),
      transform: horizontal
        ? [{ translateX: interpolate(progress, [0, 1], [0, travel], 'clamp') }]
        : [{ translateY: interpolate(progress, [0, 1], [0, travel], 'clamp') }],
    };
  });

  const base = {
    position: 'absolute' as const,
    borderRadius: RUNNER_THICKNESS,
    backgroundColor: RUNNER_CORE,
    shadowColor: NEON,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  };
  const placement = horizontal
    ? {
        left: 0,
        width: runnerLength,
        height: RUNNER_THICKNESS,
        ...(edge === 'top' ? { top: -RUNNER_THICKNESS / 2 } : { bottom: -RUNNER_THICKNESS / 2 }),
      }
    : {
        top: 0,
        height: runnerLength,
        width: RUNNER_THICKNESS,
        ...(edge === 'left' ? { left: -RUNNER_THICKNESS / 2 } : { right: -RUNNER_THICKNESS / 2 }),
      };

  return <Animated.View pointerEvents="none" style={[base, placement, style]} />;
}

export function NeonTracingOverlay({ region, frame, mode }: NeonTracingOverlayProps) {
  const entrance = useSharedValue(0);
  const lap = useSharedValue(0);
  const pulse = useSharedValue(0);
  const settled = useSharedValue(mode === 'settled' ? 1 : 0);

  useEffect(() => {
    entrance.value = withSpring(1, ENTRANCE_SPRING);
    // The endless clockwise circuit: one spring per edge, restarting
    // seamlessly because lap=4 lands exactly where lap=0 begins.
    lap.value = withRepeat(
      withSequence(
        withSpring(1, LAP_SPRING),
        withSpring(2, LAP_SPRING),
        withSpring(3, LAP_SPRING),
        withSpring(4, LAP_SPRING),
      ),
      -1,
      false,
    );
    // Soft breathing on the base glow — a breath, not a blink.
    pulse.value = withRepeat(
      withSequence(withSpring(1, PULSE_SPRING), withSpring(0, PULSE_SPRING)),
      -1,
      true,
    );
  }, [entrance, lap, pulse]);

  useEffect(() => {
    settled.value = withSpring(mode === 'settled' ? 1 : 0, ENTRANCE_SPRING);
  }, [mode, settled]);

  const glowStyle = useAnimatedStyle(() => {
    const breathing = 0.5 + pulse.value * 0.5; // 0.5 ↔ 1.0
    return {
      // Settled: park at a faint static outline (0.35) so results own the eye.
      opacity: entrance.value * (breathing + (0.35 - breathing) * settled.value),
      transform: [
        { scale: (0.97 + entrance.value * 0.03) * (1 + pulse.value * 0.012 * (1 - settled.value)) },
      ],
    };
  });

  const rect = regionToLayout(region, frame);
  if (rect.width <= 0 || rect.height <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        glowStyle,
        { position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}>
      {/* Stacked translucent rings = the neon glow, no blur pass. */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -4,
          left: -4,
          right: -4,
          bottom: -4,
          borderRadius: 24,
          borderWidth: 4,
          borderColor: NEON_SOFT,
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: NEON,
        }}
      />
      {EDGES.map((edge) => (
        <EdgeRunner
          key={edge}
          edge={edge}
          size={{ width: rect.width, height: rect.height }}
          lap={lap}
          settled={settled}
        />
      ))}
    </Animated.View>
  );
}
