/**
 * SegmentationOverlay (T019) — the spring-driven glowing outline confirming
 * a person was recognized (FR-004).
 *
 * Everything here runs as Reanimated worklets on the UI thread: the pulse
 * loop never touches the JS thread, so segmentation network work and this
 * animation cannot stutter each other (Constitution Principle III).
 * All motion is `withSpring` — no timing curves anywhere (Principle V).
 */

import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import type { BoundingRegion } from '../../../types/scan';
import { regionToLayout, type LayoutRect } from '../utils/layout';

export interface SegmentationOverlayProps {
  region: BoundingRegion;
  /** Rendered photo frame (contain-fit) in container pixels. */
  frame: LayoutRect;
  /**
   * "active" = full glow + breathing pulse while segmentation is fresh;
   * "rest" = faded static outline once bubbles arrive, so the outline stops
   * competing with them for attention. The overlay never captures touches
   * in either mode — bubbles beneath must stay tappable.
   */
  mode: 'active' | 'rest';
}

/** Entrance: a touch under-damped so the glow "blooms" into place. */
const ENTRANCE_SPRING = { mass: 0.9, damping: 13, stiffness: 150 };
/** Pulse: soft and slow — a breath, not a blink. */
const PULSE_SPRING = { mass: 1.4, damping: 18, stiffness: 60 };

export function SegmentationOverlay({ region, frame, mode }: SegmentationOverlayProps) {
  const entrance = useSharedValue(0);
  const pulse = useSharedValue(0);
  const rest = useSharedValue(mode === 'rest' ? 1 : 0);

  useEffect(() => {
    entrance.value = withSpring(1, ENTRANCE_SPRING);
    // Infinite breathing loop, spring-shaped in both directions. Built from
    // springs (not withTiming) so each half-cycle keeps organic damping.
    pulse.value = withRepeat(
      withSequence(withSpring(1, PULSE_SPRING), withSpring(0, PULSE_SPRING)),
      -1,
      true,
    );
  }, [entrance, pulse]);

  useEffect(() => {
    // Mode changes spring between glow levels rather than snapping, so the
    // handoff to bubbles reads as one continuous scene (interruptible).
    rest.value = withSpring(mode === 'rest' ? 1 : 0, ENTRANCE_SPRING);
  }, [mode, rest]);

  const rect = regionToLayout(region, frame);

  const glowStyle = useAnimatedStyle(() => {
    const activeOpacity = 0.55 + pulse.value * 0.45; // breathe 0.55 ↔ 1.0
    return {
      opacity: entrance.value * (activeOpacity + (0.35 - activeOpacity) * rest.value),
      transform: [
        // Subtle scale breath around the person, anchored at center.
        { scale: (0.97 + entrance.value * 0.03) * (1 + pulse.value * 0.015 * (1 - rest.value)) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        glowStyle,
        { position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}>
      {/* Two stacked rings fake a soft glow without a native blur pass —
          blur would force a heavy view snapshot per frame (Principle III). */}
      <Animated.View className="absolute -inset-1 rounded-3xl border-4 border-emerald-300/40" />
      <Animated.View className="absolute inset-0 rounded-3xl border-2 border-emerald-300" />
    </Animated.View>
  );
}
