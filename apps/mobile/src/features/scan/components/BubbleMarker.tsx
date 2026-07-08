/**
 * BubbleMarker (T020) — one tappable bubble per detected garment (FR-005/FR-006).
 *
 * Position is precomputed by the parent via resolveBubblePlacements so
 * collision-nudging happens once for the whole set; each bubble only knows
 * its own final center. Entrance is a staggered spring pop with slight
 * overshoot — the signature "items found!" moment of the whole app.
 */

import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import type { DetectedGarment } from '../../../types/scan';

/** 44pt = Apple HIG minimum touch target; also used by the collision math. */
export const BUBBLE_DIAMETER = 44;

export interface BubbleMarkerProps {
  garment: DetectedGarment;
  /** Final center in container pixels (already clamped + de-overlapped). */
  center: { x: number; y: number };
  /** Position in the entrance stagger sequence. */
  index: number;
  onPress: (garment: DetectedGarment) => void;
}

/**
 * Under-damped on purpose: the visible overshoot (~scale 1.06 before
 * settling) is what makes the pop feel physical instead of inserted.
 */
const POP_SPRING = { mass: 0.9, damping: 11, stiffness: 210 };
const PRESS_SPRING = { mass: 0.5, damping: 12, stiffness: 340 };
const STAGGER_MS = 80;

export function BubbleMarker({ garment, center, index, onPress }: BubbleMarkerProps) {
  const pop = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    pop.value = withDelay(index * STAGGER_MS, withSpring(1, POP_SPRING));
  }, [pop, index]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(pop.value * 1.4, 1), // fade in faster than the scale settles
    transform: [{ scale: pop.value * press.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View matches for ${garment.category}`}
      onPressIn={() => {
        press.value = withSpring(0.85, PRESS_SPRING);
      }}
      onPressOut={() => {
        press.value = withSpring(1, PRESS_SPRING);
      }}
      onPress={() => onPress(garment)}
      // Runtime-computed position — the documented NativeWind exception.
      style={{
        position: 'absolute',
        left: center.x - BUBBLE_DIAMETER / 2,
        top: center.y - BUBBLE_DIAMETER / 2,
        width: BUBBLE_DIAMETER,
        height: BUBBLE_DIAMETER,
      }}>
      <Animated.View
        style={bubbleStyle}
        className="h-full w-full items-center justify-center rounded-full border border-white/60 bg-white/90 shadow-lg">
        <Text className="text-lg font-semibold text-black">+</Text>
      </Animated.View>
    </Pressable>
  );
}
