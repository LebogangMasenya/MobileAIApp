/**
 * InteractionHotspot (specs/004 T003) — the pressable animated target node,
 * generalizing 001's BubbleMarker: a pulsing core with an expanding sonar
 * ring, anchored to a precomputed center point.
 *
 * Purely presentational (Constitution VIII): placement math stays with the
 * caller (`resolveBubblePlacements` for garments, or any center the surface
 * chooses) — this component only knows its own final center. The visual core
 * is smaller than a finger, so the Pressable keeps a full 44pt hit area via
 * HOTSPOT_DIAMETER regardless of how the visuals are tuned.
 */

import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

/**
 * 44pt = Apple HIG minimum touch target. Exported for the caller's collision
 * math (the role BUBBLE_DIAMETER played for resolveBubblePlacements).
 */
export const HOTSPOT_DIAMETER = 44;

export interface InteractionHotspotProps {
  /** Final center in container pixels (already clamped + de-overlapped). */
  center: { x: number; y: number };
  /** Position in the entrance stagger sequence. */
  index: number;
  onPress: () => void;
  /** Optional short badge (e.g. garment category) shown above the node. */
  label?: string;
  /** Spoken description for screen readers. */
  accessibilityLabel: string;
}

/**
 * Under-damped on purpose: the visible overshoot before settling is what
 * makes the pop feel physical instead of inserted (inherited from
 * BubbleMarker — it's the signature "items found!" moment).
 */
const POP_SPRING = { mass: 0.9, damping: 11, stiffness: 210 };
const PRESS_SPRING = { mass: 0.5, damping: 12, stiffness: 340 };
const RING_SPRING = { mass: 1.3, damping: 16, stiffness: 55 };
const STAGGER_MS = 80;

export function InteractionHotspot({
  center,
  index,
  onPress,
  label,
  accessibilityLabel,
}: InteractionHotspotProps) {
  const pop = useSharedValue(0);
  const press = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    pop.value = withDelay(index * STAGGER_MS, withSpring(1, POP_SPRING));
    // Sonar ring: expand-and-fade forever, spring-shaped both ways so the
    // loop breathes instead of ticking.
    ring.value = withDelay(
      index * STAGGER_MS,
      withRepeat(withSequence(withSpring(1, RING_SPRING), withSpring(0, RING_SPRING)), -1, false),
    );
  }, [pop, ring, index]);

  const nodeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(pop.value * 1.4, 1), // fade in faster than the scale settles
    transform: [{ scale: pop.value * press.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.55 * pop.value,
    transform: [{ scale: 1 + ring.value * 0.9 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        press.value = withSpring(0.85, PRESS_SPRING);
      }}
      onPressOut={() => {
        press.value = withSpring(1, PRESS_SPRING);
      }}
      onPress={onPress}
      // Z-BAND CONTRACT (specs/005 US1): hotspots own the z-50 band, above
      // the trace's z-10. Under Fabric (RN New Architecture), implicit
      // sibling paint order is NOT a stacking contract — a sibling animating
      // transform/opacity (the neon trace) can paint over later siblings that
      // lack an explicit zIndex, which is exactly how the hotspots vanished.
      // Runtime-computed position — the documented NativeWind exception.
      style={{
        position: 'absolute',
        zIndex: 50,
        left: center.x - HOTSPOT_DIAMETER / 2,
        top: center.y - HOTSPOT_DIAMETER / 2,
        width: HOTSPOT_DIAMETER,
        height: HOTSPOT_DIAMETER,
        alignItems: 'center',
        justifyContent: 'center',
        // Sonar ring scales past the 44pt box — never clip it (Android
        // clips children outside bounds by default; iOS doesn't).
        overflow: 'visible',
      }}>
      {/* Sonar ring behind the core. */}
      <Animated.View
        pointerEvents="none"
        style={ringStyle}
        className="absolute h-9 w-9 rounded-full border-2 border-white/80"
      />
      <Animated.View
        style={nodeStyle}
        className="h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white/90 shadow-lg">
        <View className="h-2.5 w-2.5 rounded-full bg-primary" />
      </Animated.View>
      {label ? (
        <Animated.View
          pointerEvents="none"
          style={nodeStyle}
          className="absolute -top-6 rounded-full bg-black/70 px-2 py-0.5">
          <Text numberOfLines={1} className="text-[10px] font-semibold text-white">
            {label}
          </Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
