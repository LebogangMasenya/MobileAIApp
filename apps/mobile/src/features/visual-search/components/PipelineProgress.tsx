/**
 * PipelineProgress (specs/008 US1, contracts/pipeline.md §3) — four segments,
 * one per honest pipeline stage. A segment FILLS (spring) only when its
 * stage genuinely completes; the ACTIVE segment carries a breathing pulse so
 * no visual sits static longer than 1.5s while work is in flight (SC-001) —
 * living motion WITHOUT fabricated percentages (FR-008). The guide's
 * 0–25/26–50 progress map was rejected in research R5 precisely because a
 * stalled upload "creeping to 50%" is a lying bar; a segment can only fill
 * when the code that finishes the work says so.
 *
 * Transform/opacity only (Constitution III): fills are scaleX on the UI
 * thread (the 007 translateX-fill precedent), breathing is an opacity spring
 * loop (ScanPulseWave idiom). Failure: the failed segment adopts the danger
 * treatment and earned segments STAY filled — retry re-enters at the failed
 * stage, so the bar never resets to zero (earned history is real history).
 *
 * Reduce-motion (§3 matrix): the breathing loop is rhythm = decoration and
 * is dropped; discrete segment fills + stage copy carry identical
 * information (SC-006).
 */

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { LiftSearchStage, LiftSearchState } from '@/features/visual-search/hooks/useLiftSearch';

const STAGES: LiftSearchStage[] = ['isolating', 'preparing', 'matching', 'assembling'];

/** Contract §2 stage copy — announced ONLY while that phase is truly live. */
const STAGE_COPY: Record<LiftSearchStage, string> = {
  isolating: 'Isolating garment contours…',
  preparing: 'Preparing your piece…',
  matching: 'Matching global visual catalogs…',
  assembling: 'Assembling your matches…',
};

/** Fill sweep — deliberate, softly overshooting: a stage "clicking" done. */
const FILL_SPRING = { mass: 0.9, damping: 16, stiffness: 140 };
/** Breathing — same personality as the house pulse loops (007). */
const BREATH_SPRING = { mass: 1.4, damping: 18, stiffness: 60 };

type SegmentStatus = 'pending' | 'active' | 'complete' | 'failed';

function statusFor(stage: LiftSearchStage, state: LiftSearchState): SegmentStatus {
  const index = STAGES.indexOf(stage);
  switch (state.phase) {
    case 'isolating':
    case 'preparing':
    case 'matching':
    case 'assembling': {
      const activeIndex = STAGES.indexOf(state.phase);
      if (index < activeIndex) return 'complete';
      if (index === activeIndex) return 'active';
      return 'pending';
    }
    case 'done':
      return 'complete';
    case 'failed': {
      const failedIndex = STAGES.indexOf(state.failedStage);
      if (index < failedIndex) return 'complete'; // earned history stays
      if (index === failedIndex) return 'failed';
      return 'pending';
    }
    default:
      return 'pending';
  }
}

interface SegmentProps {
  status: SegmentStatus;
  reducedMotion: boolean;
}

function Segment({ status, reducedMotion }: SegmentProps) {
  /** 0 = empty, 1 = filled — drives scaleX, never width (no layout work). */
  const fill = useSharedValue(status === 'complete' ? 1 : 0);
  /** Breathing level for the active state's glow. */
  const breath = useSharedValue(0);

  useEffect(() => {
    if (status === 'complete' || status === 'failed') {
      // Fill on completion; the failed segment also fills (in danger tone) so
      // "where it stopped" reads at a glance. Reduce-motion: discrete set.
      fill.value = reducedMotion ? withTiming(1, { duration: 200 }) : withSpring(1, FILL_SPRING);
    } else if (status === 'pending') {
      fill.value = withTiming(0, { duration: 0 }); // new run resets forward segments
    } else {
      fill.value = withTiming(0, { duration: 0 });
    }

    if (status === 'active' && !reducedMotion) {
      breath.value = withRepeat(
        withSequence(withSpring(1, BREATH_SPRING), withSpring(0, BREATH_SPRING)),
        -1,
        true,
      );
    } else {
      breath.value = withTiming(0, { duration: 150 });
    }
  }, [status, reducedMotion, fill, breath]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

  const breathStyle = useAnimatedStyle(() => ({
    // The active segment's track itself breathes 0.25 ↔ 0.6 — visibly alive
    // every moment its stage is running, claiming no progress at all.
    opacity: 0.25 + breath.value * 0.35,
  }));

  const isFailed = status === 'failed';
  const isActive = status === 'active';

  return (
    <View className="h-1.5 flex-1 overflow-hidden rounded-full">
      <Animated.View
        className={isActive ? 'absolute inset-0 rounded-full bg-white' : 'absolute inset-0 rounded-full bg-white/25'}
        style={isActive ? breathStyle : undefined}
      />
      <Animated.View
        // scaleX grows from the left edge — origin via left-anchored transform.
        className={`absolute inset-0 rounded-full ${isFailed ? 'bg-danger' : 'bg-white'}`}
        style={[{ transformOrigin: 'left' }, fillStyle]}
      />
    </View>
  );
}

export interface PipelineProgressProps {
  state: LiftSearchState;
}

export function PipelineProgress({ state }: PipelineProgressProps) {
  const reducedMotion = useReducedMotion();

  const activeStage: LiftSearchStage | null =
    state.phase === 'isolating' ||
    state.phase === 'preparing' ||
    state.phase === 'matching' ||
    state.phase === 'assembling'
      ? state.phase
      : null;

  return (
    <View className="gap-2.5 px-6" pointerEvents="none">
      <View className="flex-row gap-1.5">
        {STAGES.map((stage) => (
          <Segment key={stage} status={statusFor(stage, state)} reducedMotion={reducedMotion} />
        ))}
      </View>
      {activeStage ? (
        <Text className="text-center text-sm font-medium text-white">{STAGE_COPY[activeStage]}</Text>
      ) : state.phase === 'failed' ? (
        <Text className="text-center text-sm font-medium text-white/80">
          Paused — your garment is safe.
        </Text>
      ) : null}
    </View>
  );
}
