/**
 * TactileTiltCard (specs/007 US2, contracts/vault-surfaces §1) — the
 * Revolut-style "physical card" wrapper: press and roll a finger and the
 * card tilts toward the touch point while a band of light sweeps across it;
 * release and it springs softly back to rest.
 *
 * THE architectural trick (research R6): the gesture is `Gesture.Manual`
 * used as a PURE OBSERVER — it listens to onTouchesDown/Move/Up/Cancelled
 * but NEVER calls `activate()`, so it never enters the gesture arena as a
 * competitor. That makes FR-008 true *by construction*:
 *   - a vertical drag becomes a FlatList scroll exactly as before (the
 *     scroll's take-over cancels our touches → we spring to rest),
 *   - taps and long-presses on the wrapped Pressable fire untouched,
 *   - there are no activation thresholds to mistune.
 * Compare: the naive Gesture.Pan() recipe competes with scroll and eats the
 * long-press — the classic tilt-hijacks-list failure.
 *
 * Everything runs as UI-thread transforms (Constitution III): touch position
 * maps to rotateX/rotateY targets chased by soft springs (high damping, low
 * stiffness — the card feels weighty, not twitchy), behind a `perspective`
 * so the tilt reads as depth instead of a skew.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export interface TactileTiltCardProps {
  children: ReactNode;
  /**
   * Max tilt in degrees. Default 10 — the guide's 15° ceiling reads as
   * "about to flip" at vault-grid card sizes; tune on device, not simulator.
   */
  maxTilt?: number;
  disabled?: boolean;
}

/**
 * Heavy-card chase spring: high damping / low stiffness per the guide, so
 * the card leans after the finger with a hint of inertia instead of
 * snapping to it.
 */
const CHASE_SPRING = { mass: 0.9, damping: 26, stiffness: 120 };
/** Rest spring — a touch livelier so release feels like a settle, not a droop. */
const REST_SPRING = { mass: 0.9, damping: 20, stiffness: 160 };

export function TactileTiltCard({ children, maxTilt = 10, disabled = false }: TactileTiltCardProps) {
  // Reduce-motion: tilt is pure decoration — the wrapped Pressable's own
  // active:opacity feedback remains the press signal (§3 matrix).
  const reducedMotion = useReducedMotion();
  const active = !disabled && !reducedMotion;

  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  /** 0→1 press presence — drives the sheen's visibility. */
  const pressed = useSharedValue(0);
  /** Card size, captured on the UI thread from the touch event's target metrics. */
  const size = useSharedValue({ width: 1, height: 1 });

  /** Map a touch point to tilt targets: edges = full tilt, center = flat. */
  const aimAt = (x: number, y: number) => {
    'worklet';
    const nx = Math.min(Math.max(x / size.value.width, 0), 1) - 0.5; // -0.5..0.5
    const ny = Math.min(Math.max(y / size.value.height, 0), 1) - 0.5;
    // Touching the top tips the top AWAY (negative rotateX) — the card
    // "gives" under the finger like a real object; same for left/right.
    rotateY.value = withSpring(nx * 2 * maxTilt, CHASE_SPRING);
    rotateX.value = withSpring(-ny * 2 * maxTilt, CHASE_SPRING);
  };

  const restore = () => {
    'worklet';
    rotateX.value = withSpring(0, REST_SPRING);
    rotateY.value = withSpring(0, REST_SPRING);
    pressed.value = withSpring(0, REST_SPRING);
  };

  // The observer. No .activate(), no .fail() — we are a fly on the wall of
  // the arena. onTouchesCancelled is the scroll-takeover path (FR-008
  // scenario 3): the list claiming the gesture is our cue to settle.
  const observer = Gesture.Manual()
    .enabled(active)
    .onTouchesDown((event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      pressed.value = withSpring(1, CHASE_SPRING);
      aimAt(touch.x, touch.y);
    })
    .onTouchesMove((event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      aimAt(touch.x, touch.y);
    })
    .onTouchesUp(() => restore())
    .onTouchesCancelled(() => restore());

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      // Perspective MUST come first in the transform list or the rotations
      // flatten into skews — a classic RN 3D-transform pitfall worth knowing.
      { perspective: 800 },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
    ],
  }));

  // T010 — the light catch: a white→transparent band that slides opposite
  // the horizontal tilt (tilt right, light sweeps left — how a glossy
  // surface actually behaves under a fixed light). Opacity rides `pressed`
  // so the card is matte at rest and only "catches light" under a finger.
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * interpolate(Math.abs(rotateY.value), [0, maxTilt], [0.08, 0.3], 'clamp'),
    transform: [
      { translateX: interpolate(rotateY.value, [-maxTilt, maxTilt], [size.value.width * 0.5, -size.value.width * 0.5]) },
    ],
  }));

  return (
    <GestureDetector gesture={observer}>
      <Animated.View
        style={tiltStyle}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) size.value = { width, height };
        }}
        // overflow-hidden keeps the sheen inside the card's own rounded
        // bounds — it never escapes into the grid (no global z, §1).
        className="overflow-hidden rounded-2xl">
        {children}
        {active ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 0, bottom: 0, left: '-25%', width: '150%' }, sheenStyle]}>
            <LinearGradient
              // Diagonal band: transparent → white → transparent, angled like
              // an actual reflection rather than a flat wash.
              colors={['transparent', 'rgba(255,255,255,0.9)', 'transparent']}
              start={{ x: 0, y: 0.3 }}
              end={{ x: 1, y: 0.7 }}
              locations={[0.35, 0.5, 0.65]}
              style={{ flex: 1 }}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
