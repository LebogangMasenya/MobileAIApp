/**
 * LiftStage (specs/008 US1, contracts/pipeline.md §4) — the photo → isolated
 * hero moment.
 *
 * While isolation runs: the proven perimeter trace (feature 004's
 * NeonTracingOverlay, reused directly — Constitution IV says use the working
 * primitive, don't re-derive it) circles the photo. Research R6 records WHY
 * a mask-contour trace is impossible honestly: the mask does not exist until
 * isolation finishes, so the perimeter is the only truthful thing to draw.
 *
 * The lift (FR-003): the instant the isolated PNG arrives, the source photo
 * fades away UNDER it while the subject springs 1 → 1.05 → 1 — springing
 * FROM current values so an interrupt (failure, reset) never snaps — with
 * exactly ONE confirm() beat. The beat is information ("it worked") and
 * survives reduce-motion; the scale flourish is decoration and does not
 * (007 motion-tactility §2/§3).
 */

import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { NeonTracingOverlay } from '@/features/scan-overlay/components/NeonTracingOverlay';
import type { LayoutRect } from '@/features/scan/utils/layout';
import type { IsolatedGarment } from '@/services/subject-lift';
import { confirm } from '@/services/tactile';

/** Slightly inset so the trace reads as "scanning the subject", not a frame. */
const TRACE_REGION = { x: 0.05, y: 0.04, width: 0.9, height: 0.92 };

/** The pop: quick out... */
const POP_SPRING = { mass: 0.7, damping: 14, stiffness: 220 };
/** ...soft settle home — together they read as one physical "lift". */
const SETTLE_SPRING = { mass: 0.9, damping: 18, stiffness: 160 };
/** Background release — unhurried, so the subject visibly "leaves" it. */
const FADE_SPRING = { mass: 1, damping: 20, stiffness: 90 };

export interface LiftStageProps {
  sourceUri: string;
  /** Rendered photo frame from the parent's useCoordinateTransform. */
  frame: LayoutRect | null;
  /** Null while isolating; the moment it arrives IS the lift moment. */
  garment: IsolatedGarment | null;
  /** True only while the on-device lift is actually running (trace gate). */
  isolating: boolean;
}

export function LiftStage({ sourceUri, frame, garment, isolating }: LiftStageProps) {
  const reducedMotion = useReducedMotion();

  /** 1 = source photo fully visible, 0 = fully released under the subject. */
  const background = useSharedValue(1);
  const subjectScale = useSharedValue(1);
  const subjectOpacity = useSharedValue(0);
  /** One beat per garment — a re-render must never re-fire the moment. */
  const liftedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!garment) {
      // New run (or reset): restore the photo, hide the subject layer.
      background.value = withSpring(1, FADE_SPRING);
      subjectOpacity.value = withTiming(0, { duration: 0 });
      subjectScale.value = 1;
      liftedFor.current = null;
      return;
    }
    if (liftedFor.current === garment.uri) return;
    liftedFor.current = garment.uri;

    if (reducedMotion) {
      // Calm equivalent: a static swap. The confirm beat still fires — it is
      // the information channel, not the decoration (FR-003 + SC-006).
      background.value = withTiming(0.12, { duration: 200 });
      subjectOpacity.value = withTiming(1, { duration: 200 });
    } else {
      background.value = withSpring(0.12, FADE_SPRING);
      subjectOpacity.value = withSpring(1, SETTLE_SPRING);
      subjectScale.value = withSequence(withSpring(1.05, POP_SPRING), withSpring(1, SETTLE_SPRING));
    }
    // JS-thread call site, so no scheduleOnRN hop is needed here (tactile.ts
    // rule: only WORKLET call sites must hop threads first).
    confirm();
  }, [garment, reducedMotion, background, subjectOpacity, subjectScale]);

  const backgroundStyle = useAnimatedStyle(() => ({ opacity: background.value }));
  const subjectStyle = useAnimatedStyle(() => ({
    opacity: subjectOpacity.value,
    transform: [{ scale: subjectScale.value }],
  }));

  return (
    <View className="flex-1" pointerEvents="none">
      {/* Source photo — the layer the subject gets lifted OUT of. */}
      <Animated.View style={[{ flex: 1 }, backgroundStyle]}>
        <Image
          source={{ uri: sourceUri }}
          style={{ flex: 1 }}
          contentFit="contain"
          accessibilityLabel="Your photo"
        />
      </Animated.View>

      {/* The isolated subject, contain-fit over the same space: it appears
          exactly where the photo's subject stood, so the fade underneath
          reads as separation rather than replacement. */}
      {garment ? (
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, subjectStyle]}>
          <Image
            source={{ uri: garment.uri }}
            style={{ flex: 1 }}
            contentFit="contain"
            accessibilityLabel="Isolated garment"
          />
        </Animated.View>
      ) : null}

      {/* Perimeter trace while the lift genuinely runs (FR-002). Reduce-
          motion: the trace's loops are rhythm → a calm static boundary
          carries the same "this region is being worked on" information. */}
      {frame && isolating ? (
        reducedMotion ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: frame.x + TRACE_REGION.x * frame.width,
              top: frame.y + TRACE_REGION.y * frame.height,
              width: TRACE_REGION.width * frame.width,
              height: TRACE_REGION.height * frame.height,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: 'rgba(34, 211, 238, 0.8)',
            }}
          />
        ) : (
          <NeonTracingOverlay region={TRACE_REGION} frame={frame} mode="tracing" />
        )
      ) : null}
    </View>
  );
}
