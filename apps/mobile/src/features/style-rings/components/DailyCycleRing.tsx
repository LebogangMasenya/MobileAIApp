/**
 * DailyCycleRing (specs/007 US5, contracts/daily-cycle §3) — the Apple-Watch
 * -style open loop: three gapped, round-capped arcs, each sweeping closed
 * with a spring the moment its real-world action completes.
 *
 * Why SVG (research R2): three rounded arc segments with gaps are genuine
 * arc geometry — border tricks can't draw them. The sweep animates
 * `strokeDashoffset` through `useAnimatedProps`, so the arc math runs as a
 * UI-thread prop update (Constitution III), the SVG equivalent of a
 * transform.
 *
 * The dash trick, since it reads like magic: each segment's circle carries
 * `strokeDasharray = [segmentLength, circumference]` — one dash, then blank
 * past a full lap, so exactly one arc is ever visible. `strokeDashoffset`
 * slides that dash INTO view: offset = segmentLength means fully hidden,
 * 0 means fully drawn. Spring the offset and the arc *sweeps*.
 *
 * Honesty rule (SC-007): arcs render ONLY from today's DailyCycleRecord.
 * The open-loop pull comes from real incompleteness — there is no fake 66%.
 */

import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { RingPalette } from '@/constants/theme';
import { SEGMENT_IDS, type DailyCycleRecord, type SegmentId } from '@/services/daily-cycle-store';
import { confirm } from '@/services/tactile';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DailyCycleRingProps {
  record: DailyCycleRecord;
  /** Outer diameter in px. */
  size?: number;
}

/** Segment sweep — deliberate, softly overshooting: an arc "clicking" home. */
const SWEEP_SPRING = { mass: 1, damping: 16, stiffness: 110 };
/** Gap between segments, in degrees of arc. */
const GAP_DEGREES = 14;
const STROKE_WIDTH = 9;

const SEGMENT_COLOR: Record<SegmentId, string> = {
  log: RingPalette.log,
  harmony: RingPalette.harmony,
  coordinate: RingPalette.coordinate,
};

interface SegmentArcProps {
  id: SegmentId;
  index: number;
  done: boolean;
  /** Suppress the entrance beat — mount reflects state, it doesn't re-earn it. */
  isInitialRender: boolean;
  radius: number;
  center: number;
}

function SegmentArc({ id, index, done, isInitialRender, radius, center }: SegmentArcProps) {
  const reducedMotion = useReducedMotion();
  const circumference = 2 * Math.PI * radius;
  const segmentLength = (circumference * (120 - GAP_DEGREES)) / 360;

  /** 0 = open, 1 = swept closed. */
  const progress = useSharedValue(done && isInitialRender ? 1 : 0);

  useEffect(() => {
    if (!done) {
      // Rollover reopens the arc — quietly (losing progress is not a moment).
      progress.value = withTiming(0, { duration: 0 });
      return;
    }
    if (isInitialRender) return; // mounted already-closed: no sweep, no beat
    // A segment EARNED while watching: sweep + one confirm beat. The beat is
    // a one-shot (information), so it survives reduce-motion; only the sweep
    // decays to an instant set (§3 matrix — fade-to-closed).
    progress.value = reducedMotion
      ? withTiming(1, { duration: 0 })
      : withSpring(1, SWEEP_SPRING);
    confirm();
  }, [done, isInitialRender, progress, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: segmentLength * (1 - progress.value),
  }));

  // Rotate each segment's dash to its 120° slot, starting at 12 o'clock
  // (-90°), with half a gap on each side so the gaps center between arcs.
  const rotation = -90 + index * 120 + GAP_DEGREES / 2;

  return (
    <AnimatedCircle
      cx={center}
      cy={center}
      r={radius}
      stroke={SEGMENT_COLOR[id]}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeDasharray={`${segmentLength} ${circumference}`}
      animatedProps={animatedProps}
      fill="none"
      originX={center}
      originY={center}
      rotation={rotation}
    />
  );
}

export function DailyCycleRing({ record, size = 108 }: DailyCycleRingProps) {
  const center = size / 2;
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const trackLength = (circumference * (120 - GAP_DEGREES)) / 360;

  // First render mounts arcs at their stored state without sweeps/beats;
  // anything that changes AFTER is a live achievement and gets the moment.
  const isInitialRender = useRef(true);
  useEffect(() => {
    isInitialRender.current = false;
  }, []);

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="Daily wardrobe cycle ring">
      <Svg width={size} height={size}>
        {/* Unearned track arcs — the visible open loop begging to be closed. */}
        {SEGMENT_IDS.map((id, index) => (
          <Circle
            key={`track-${id}`}
            cx={center}
            cy={center}
            r={radius}
            stroke={RingPalette.track}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${trackLength} ${circumference}`}
            fill="none"
            originX={center}
            originY={center}
            rotation={-90 + index * 120 + GAP_DEGREES / 2}
          />
        ))}
        {SEGMENT_IDS.map((id, index) => (
          <SegmentArc
            key={id}
            id={id}
            index={index}
            done={Boolean(record.segments[id])}
            isInitialRender={isInitialRender.current}
            radius={radius}
            center={center}
          />
        ))}
      </Svg>
    </View>
  );
}
