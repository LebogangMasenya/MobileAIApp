/**
 * ManualCropMarquee (specs/008 US1, contracts/pipeline.md §5) — the
 * universal fallback floor: a draggable/resizable crop rect over the photo
 * for every device, OS, or photo the native lift can't serve (FR-005).
 *
 * GESTURE ARCHITECTURE — activate vs observe: 007's TactileTiltCard uses
 * Gesture.Manual as a pure OBSERVER because it decorates a scrolling list
 * and must never compete in the gesture arena. This marquee is the deliberate
 * INVERSE: Gesture.Pan that ACTIVATES and owns its touches, because dragging
 * the rect IS the surface's primary interaction and there is no scroll to
 * yield to — which of the two idioms applies is decided by who has the
 * strongest claim to the touch, not by preference.
 *
 * The rect lives in four shared values mutated directly in worklet
 * onChange handlers (UI thread, zero JS-thread traffic per frame —
 * Constitution III). Movement is HARD-CLAMPED to the photo frame during the
 * drag, so an illegal rect never exists even transiently; the release
 * spring is a tactile settle cue on the border, not a correction.
 *
 * Reduce-motion: gestures track 1:1 by nature (direct manipulation is not
 * an animation); only the release flourish and entrance fade decay (§3).
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ManualCropReason } from '@/features/visual-search/hooks/useLiftSearch';
import type { LayoutRect, Size } from '@/features/scan/utils/layout';
import type { IsolatedGarment } from '@/services/subject-lift';

/** Reason-specific supportive copy (FR-005) — capability gaps get confident
 * framing ("precision"), per-photo failures get collaborative framing. */
const REASON_COPY: Record<ManualCropReason, string> = {
  unsupported: 'Using manual precision crop for optimal visual matching.',
  liftFailed: "Let's frame it by hand — drag to fit your piece.",
  degenerate: "Let's frame it by hand — drag to fit your piece.",
};

/** ≥44pt hit targets (ergonomics duty, contracts/match-presentation §1). */
const HANDLE_HIT = 44;
const HANDLE_DOT = 18;
/** Smallest crop the handles can produce — two hit targets must never overlap. */
const MIN_RECT = 96;

/** Release settle — a small physical acknowledgment, not a correction. */
const SETTLE_SPRING = { mass: 0.7, damping: 16, stiffness: 220 };

export interface ManualCropMarqueeProps {
  sourceUri: string;
  /** Photo pixel size — the crop math's target space. */
  sourceSize: Size;
  /** Rendered photo frame in container px (parent's useCoordinateTransform). */
  frame: LayoutRect;
  reason: ManualCropReason;
  onConfirm: (garment: IsolatedGarment) => void;
  onCancel: () => void;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

export function ManualCropMarquee({
  sourceUri,
  sourceSize,
  frame,
  reason,
  onConfirm,
  onCancel,
}: ManualCropMarqueeProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [cropping, setCropping] = useState(false);
  const [cropError, setCropError] = useState(false);

  // Rect in CONTAINER pixels — the same space as `frame`, so clamping is
  // plain arithmetic against frame edges and the source-pixel mapping at
  // confirm time is one proportional conversion.
  const rectX = useSharedValue(frame.x + frame.width * 0.1);
  const rectY = useSharedValue(frame.y + frame.height * 0.1);
  const rectW = useSharedValue(frame.width * 0.8);
  const rectH = useSharedValue(frame.height * 0.8);
  /** Border settle pulse on release. */
  const settle = useSharedValue(1);

  // Re-center when the frame itself changes (rotation/layout), never on drags.
  useEffect(() => {
    rectX.value = frame.x + frame.width * 0.1;
    rectY.value = frame.y + frame.height * 0.1;
    rectW.value = frame.width * 0.8;
    rectH.value = frame.height * 0.8;
  }, [frame.x, frame.y, frame.width, frame.height, rectX, rectY, rectW, rectH]);

  const release = () => {
    'worklet';
    if (reducedMotion) return; // the settle is decoration
    settle.value = withSequence(withSpring(1.02, SETTLE_SPRING), withSpring(1, SETTLE_SPRING));
  };

  // Body pan: moves the whole rect, clamped so it can never leave the photo.
  const bodyPan = Gesture.Pan()
    .onChange((event) => {
      'worklet';
      rectX.value = Math.min(
        Math.max(rectX.value + event.changeX, frame.x),
        frame.x + frame.width - rectW.value,
      );
      rectY.value = Math.min(
        Math.max(rectY.value + event.changeY, frame.y),
        frame.y + frame.height - rectH.value,
      );
    })
    .onEnd(release);

  /**
   * One pan per corner. Left/top edges move origin AND size together (the
   * opposite edge stays pinned — how every native crop tool behaves); the
   * MIN_RECT floor is enforced inside the same clamp so the rect can never
   * invert.
   */
  const cornerPan = (corner: Corner) =>
    Gesture.Pan()
      .onChange((event) => {
        'worklet';
        const left = corner === 'tl' || corner === 'bl';
        const top = corner === 'tl' || corner === 'tr';
        if (left) {
          const right = rectX.value + rectW.value;
          const nextX = Math.min(Math.max(rectX.value + event.changeX, frame.x), right - MIN_RECT);
          rectX.value = nextX;
          rectW.value = right - nextX;
        } else {
          rectW.value = Math.min(
            Math.max(rectW.value + event.changeX, MIN_RECT),
            frame.x + frame.width - rectX.value,
          );
        }
        if (top) {
          const bottom = rectY.value + rectH.value;
          const nextY = Math.min(Math.max(rectY.value + event.changeY, frame.y), bottom - MIN_RECT);
          rectY.value = nextY;
          rectH.value = bottom - nextY;
        } else {
          rectH.value = Math.min(
            Math.max(rectH.value + event.changeY, MIN_RECT),
            frame.y + frame.height - rectY.value,
          );
        }
      })
      .onEnd(release);

  const rectStyle = useAnimatedStyle(() => ({
    left: rectX.value,
    top: rectY.value,
    width: rectW.value,
    height: rectH.value,
    transform: [{ scale: settle.value }],
  }));

  // Focus scrims: four dim panels around the rect so the kept region reads
  // instantly. Their edges follow the same shared values — one source of
  // geometric truth, no drift.
  const topScrim = useAnimatedStyle(() => ({
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: Math.max(0, rectY.value - frame.y),
  }));
  const bottomScrim = useAnimatedStyle(() => ({
    left: frame.x,
    top: rectY.value + rectH.value,
    width: frame.width,
    height: Math.max(0, frame.y + frame.height - rectY.value - rectH.value),
  }));
  const leftScrim = useAnimatedStyle(() => ({
    left: frame.x,
    top: rectY.value,
    width: Math.max(0, rectX.value - frame.x),
    height: rectH.value,
  }));
  const rightScrim = useAnimatedStyle(() => ({
    left: rectX.value + rectW.value,
    top: rectY.value,
    width: Math.max(0, frame.x + frame.width - rectX.value - rectW.value),
    height: rectH.value,
  }));

  // No explicit Record annotation: useAnimatedStyle's inferred (ViewStyle)
  // type must flow through, or the widened union stops matching Animated.View.
  const handleStyles = {
    tl: useAnimatedStyle(() => ({
      left: rectX.value - HANDLE_HIT / 2,
      top: rectY.value - HANDLE_HIT / 2,
    })),
    tr: useAnimatedStyle(() => ({
      left: rectX.value + rectW.value - HANDLE_HIT / 2,
      top: rectY.value - HANDLE_HIT / 2,
    })),
    bl: useAnimatedStyle(() => ({
      left: rectX.value - HANDLE_HIT / 2,
      top: rectY.value + rectH.value - HANDLE_HIT / 2,
    })),
    br: useAnimatedStyle(() => ({
      left: rectX.value + rectW.value - HANDLE_HIT / 2,
      top: rectY.value + rectH.value - HANDLE_HIT / 2,
    })),
  };

  const confirmCrop = async () => {
    if (cropping) return;
    setCropping(true);
    setCropError(false);
    try {
      // Container px → source px: proportional within the rendered frame.
      const scaleX = sourceSize.width / frame.width;
      const scaleY = sourceSize.height / frame.height;
      const originX = Math.max(0, Math.round((rectX.value - frame.x) * scaleX));
      const originY = Math.max(0, Math.round((rectY.value - frame.y) * scaleY));
      const width = Math.min(Math.round(rectW.value * scaleX), sourceSize.width - originX);
      const height = Math.min(Math.round(rectH.value * scaleY), sourceSize.height - originY);

      const context = ImageManipulator.manipulate(sourceUri);
      context.crop({ originX, originY, width, height });
      const rendered = await context.renderAsync();
      // PNG to match the pipeline's payload contract (the API rejects
      // non-PNG uploads); the manual path must be indistinguishable
      // downstream from an automatic lift.
      const saved = await rendered.saveAsync({ format: SaveFormat.PNG });

      onConfirm({
        uri: saved.uri,
        width: saved.width,
        height: saved.height,
        method: 'manual',
        sourceUri,
      });
    } catch {
      // Filesystem/decode failures land as a designed inline state — the
      // marquee stays usable, cancel stays available (Constitution VII).
      setCropError(true);
    } finally {
      setCropping(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.springify().mass(0.8).damping(18).stiffness(160)} className="absolute inset-0 z-30">
      {/* Supportive copy — WHY the user is here, framed as capability. */}
      <Animated.View
        entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
        style={{ top: insets.top + 64 }}
        className="absolute left-6 right-6 items-center">
        <View className="rounded-full bg-black/70 px-5 py-2.5">
          <Text className="text-center text-sm font-medium text-white">{REASON_COPY[reason]}</Text>
        </View>
      </Animated.View>

      {/* Dim everything the crop will discard. */}
      {[topScrim, bottomScrim, leftScrim, rightScrim].map((style, index) => (
        <Animated.View key={index} pointerEvents="none" style={style} className="absolute bg-black/50" />
      ))}

      {/* The rect itself — body drag surface. */}
      <GestureDetector gesture={bodyPan}>
        <Animated.View
          accessibilityLabel="Crop area. Drag to move."
          style={rectStyle}
          className="absolute rounded-xl border-2 border-white"
        />
      </GestureDetector>

      {/* Corner handles: 44pt hit areas around 18px visible dots. */}
      {CORNERS.map((corner) => (
        <GestureDetector key={corner} gesture={cornerPan(corner)}>
          <Animated.View
            accessibilityLabel="Crop corner. Drag to resize."
            style={[{ width: HANDLE_HIT, height: HANDLE_HIT }, handleStyles[corner]]}
            className="absolute items-center justify-center">
            <View
              style={{ width: HANDLE_DOT, height: HANDLE_DOT, borderRadius: HANDLE_DOT / 2 }}
              className="border-2 border-white bg-primary"
            />
          </Animated.View>
        </GestureDetector>
      ))}

      {/* Actions in the thumb band. */}
      <View style={{ bottom: insets.bottom + 24 }} className="absolute left-6 right-6 gap-3">
        {cropError ? (
          <Text className="text-center text-sm font-medium text-white">
            That crop didn&apos;t save — try adjusting the frame and confirming again.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use this crop"
          disabled={cropping}
          onPress={() => void confirmCrop()}
          className="min-h-12 items-center justify-center rounded-full bg-primary px-6 active:bg-primary-pressed">
          {cropping ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-on-primary">Use this crop</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel crop"
          disabled={cropping}
          onPress={onCancel}
          className="min-h-12 items-center justify-center rounded-full bg-black/50 px-6 active:bg-black/70">
          <Text className="text-base font-medium text-white">Choose another photo</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
