/**
 * HarmonyRing (specs/008 US4, contracts/match-presentation.md §4) — a
 * compact single-arc variant of 007's DailyCycleRing dash-offset idiom:
 * strokeDasharray = [arcLength, circumference] shows exactly one arc, and
 * springing strokeDashoffset through useAnimatedProps sweeps it to the
 * score on the UI thread (the SVG equivalent of a transform —
 * Constitution III).
 *
 * STRUCTURAL HONESTY (FR-015): the number and the arc render from the SAME
 * `score` prop inside this one component, so "visual fill matches the
 * numeric score" is guaranteed by construction, not by reviewer vigilance.
 * The parent renders this ONLY when harmonyScore() returned non-null.
 *
 * Reduce-motion: the sweep is decoration → arc mounts static at value; the
 * number (information) is identical either way (SC-006).
 */

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { RingPalette } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Sweep-to-value — the DailyCycleRing "clicking home" personality. */
const SWEEP_SPRING = { mass: 1, damping: 16, stiffness: 110 };

const STROKE_WIDTH = 3.5;

export interface HarmonyRingProps {
  /** Integer 0–100 from harmonyScore() — never fabricated, never estimated. */
  score: number;
  /** Outer diameter in px. */
  size?: number;
}

export function HarmonyRing({ score, size = 36 }: HarmonyRingProps) {
  const reducedMotion = useReducedMotion();
  const center = size / 2;
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;

  /** 0 = empty arc, 1 = arc at score — sweeps once on first appearance. */
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion ? 1 : withSpring(1, SWEEP_SPRING);
  }, [progress, reducedMotion]);

  // The visible arc is (score/100) of the full circle; offset slides it into
  // view as progress climbs — offset = full arc hidden, 0 = fully drawn.
  const arcLength = (circumference * score) / 100;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - progress.value),
  }));

  return (
    <View
      className="flex-row items-center gap-1.5"
      accessibilityLabel={`Harmony score ${score} out of 100 — pairs with your recent scans`}>
      <Svg width={size} height={size}>
        {/* Full track — the open loop the score fills into. */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={RingPalette.track}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={RingPalette.harmony}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          animatedProps={animatedProps}
          fill="none"
          originX={center}
          originY={center}
          rotation={-90}
        />
      </Svg>
      <Text className="text-xs font-semibold text-ink">{score}</Text>
    </View>
  );
}
