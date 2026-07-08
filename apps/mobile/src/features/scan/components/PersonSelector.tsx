/**
 * PersonSelector (T018) — tap-to-select overlay for multi-person photos
 * (FR-016/FR-017).
 *
 * The tap target is each person's full bounding region, not a small badge:
 * person boxes are large, so this maximizes one-handed touch accuracy for
 * free. Overlap handling (people standing in front of each other) is done
 * by render order — see the sort below.
 */

import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import type { DetectedPerson } from '../../../types/scan';
import { regionToLayout, type LayoutRect } from '../utils/layout';

export interface PersonSelectorProps {
  people: DetectedPerson[];
  /** Rendered photo frame (contain-fit) in container pixels. */
  frame: LayoutRect;
  onSelect: (personId: string) => void;
  /** Blocks re-taps while a selection is already segmenting. */
  busy?: boolean;
}

/** Ring entrance: light mass + moderate damping = a lively but settled pop. */
const RING_SPRING = { mass: 0.7, damping: 15, stiffness: 190 };
/** Stagger between rings so the eye reads "several people found", not one flash. */
const STAGGER_MS = 70;

function PersonRing({
  person,
  frame,
  index,
  busy,
  onSelect,
}: {
  person: DetectedPerson;
  frame: LayoutRect;
  index: number;
  busy: boolean;
  onSelect: (personId: string) => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(index * STAGGER_MS, withSpring(1, RING_SPRING));
  }, [progress, index]);

  const rect = regionToLayout(person.boundingRegion, frame);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Select this person to scan their outfit"
      disabled={busy}
      onPress={() => onSelect(person.id)}
      // Absolute geometry comes from runtime math, so it can't be a Tailwind
      // class — this is the documented NativeWind exception (research.md §2).
      style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
      <Animated.View
        style={ringStyle}
        className="flex-1 rounded-2xl border-2 border-white/90 bg-white/10"
      />
    </Pressable>
  );
}

export function PersonSelector({ people, frame, onSelect, busy = false }: PersonSelectorProps) {
  // Render larger regions first so smaller (usually nearer/enclosed) people
  // end up on top of the touch stack — a person standing in front stays
  // selectable even when a taller person's box fully contains theirs.
  const ordered = [...people].sort(
    (a, b) =>
      b.boundingRegion.width * b.boundingRegion.height -
      a.boundingRegion.width * a.boundingRegion.height,
  );

  return (
    <View className="absolute inset-0">
      {/* Dim the photo so the selectable regions read as the active layer. */}
      <View className="absolute inset-0 bg-black/40" pointerEvents="none" />

      {ordered.map((person, index) => (
        <PersonRing
          key={person.id}
          person={person}
          frame={frame}
          index={index}
          busy={busy}
          onSelect={onSelect}
        />
      ))}

      {/* Instruction pill sits at ~75% height: visible above the thumb,
          clear of both the notch and the bottom action zone (T006 plan). */}
      <View className="absolute bottom-32 left-0 right-0 items-center px-6" pointerEvents="none">
        <View className="rounded-full bg-black/70 px-5 py-2.5">
          <Text className="text-sm font-medium text-white">
            {busy ? 'Scanning their outfit…' : 'Tap a person to scan their outfit'}
          </Text>
        </View>
      </View>
    </View>
  );
}
