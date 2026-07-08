/**
 * GarmentDetailModal (T028/T032/T036) — bottom sheet showing a garment's
 * exact store match, similar items, and the FR-013/FR-011 empty states.
 *
 * A bottom sheet rather than a full-screen modal is a deliberate FR-014
 * choice: the segmented photo stays visibly alive behind it, so "dismiss
 * preserves the photo and bubbles" is guaranteed by construction — there is
 * no navigation to undo. All data comes in via props; this component owns
 * zero API state (Constitution Principle VIII).
 */

import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import type { DetectedGarment, MatchedProduct, SimilarItem } from '../../../types/scan';
import type { GarmentMatchesState } from '../hooks/useGarmentMatches';

export interface GarmentDetailModalProps {
  visible: boolean;
  /** The tapped garment; null only while nothing has been tapped yet. */
  garment: DetectedGarment | null;
  /** Active region code — used by the FR-011 empty-state copy (T036). */
  region: string;
  state: GarmentMatchesState;
  onRetry: () => void;
  onClose: () => void;
}

/** Open: gentle overshoot so the sheet "arrives". */
const OPEN_SPRING = { mass: 1, damping: 18, stiffness: 190 };
/** Close: clamped — a sheet bouncing back up past the edge looks broken. */
const CLOSE_SPRING = { mass: 1, damping: 22, stiffness: 220, overshootClamping: true };

/** Drag distance / fling velocity beyond which release means "dismiss". */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

function formatPrice(price: MatchedProduct['price']): string | null {
  if (!price) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.amount);
  } catch {
    // Unknown/garbled currency code from the provider — show it raw rather
    // than hiding the price entirely.
    return `${price.currency} ${price.amount.toFixed(2)}`;
  }
}

function titleCase(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

/** Product card shared by the exact match and each similar item (T032 CTA). */
function ProductCard({
  product,
  compact,
  onLinkError,
}: {
  product: MatchedProduct;
  compact: boolean;
  onLinkError: () => void;
}) {
  const openStore = useCallback(async () => {
    // Affiliate URLs come from an external provider — a malformed or dead
    // link must degrade to a visible message, never a crash or silent no-op
    // (Constitution Principle VII).
    try {
      await Linking.openURL(product.ctaUrl);
    } catch {
      onLinkError();
    }
  }, [product.ctaUrl, onLinkError]);

  return (
    <View className={compact ? 'w-40 rounded-2xl bg-neutral-800 p-3' : 'rounded-2xl bg-neutral-800 p-4'}>
      <Image
        source={{ uri: product.imageUrl }}
        style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={product.title}
      />
      <Text numberOfLines={2} className="mt-2 text-sm font-medium text-white">
        {product.title}
      </Text>
      <Text numberOfLines={1} className="mt-0.5 text-xs text-neutral-400">
        {product.store.name}
      </Text>
      {formatPrice(product.price) ? (
        <Text className="mt-1 text-sm font-semibold text-white">{formatPrice(product.price)}</Text>
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={openStore}
        className="mt-3 min-h-11 items-center justify-center rounded-full bg-white px-4 py-2.5 active:opacity-80">
        <Text numberOfLines={1} className="text-sm font-semibold text-black">
          {compact ? 'View' : `View at ${product.store.name}`}
        </Text>
      </Pressable>
    </View>
  );
}

function MatchesContent({
  garment,
  region,
  state,
  onRetry,
  onLinkError,
}: {
  garment: DetectedGarment;
  region: string;
  state: GarmentMatchesState;
  onRetry: () => void;
  onLinkError: () => void;
}) {
  switch (state.phase) {
    case 'idle':
    case 'loading':
      return (
        <View className="items-center py-14">
          <ActivityIndicator color="#ffffff" />
          <Text className="mt-3 text-sm text-neutral-400">Finding matches…</Text>
        </View>
      );
    case 'error':
      return (
        <View className="items-center rounded-2xl bg-neutral-800 px-6 py-10">
          <Text className="text-center text-base font-semibold text-white">{"Couldn't load matches"}</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-neutral-300">{state.message}</Text>
          {state.retryable ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              className="mt-5 min-h-11 items-center justify-center rounded-full bg-white px-6 py-2.5 active:opacity-80">
              <Text className="text-sm font-semibold text-black">Try again</Text>
            </Pressable>
          ) : null}
        </View>
      );
    case 'loaded': {
      const { exactMatch, similarItems } = state.matches;

      // FR-013: both empty renders ONE clear message, not two empty sections.
      if (!exactMatch && similarItems.length === 0) {
        return (
          <View className="items-center rounded-2xl bg-neutral-800 px-6 py-10">
            <Text className="text-center text-base font-semibold text-white">No matches found</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-neutral-300">
              {`We couldn't find this ${garment.category} or anything similar. Try again with a different angle or photo.`}
            </Text>
          </View>
        );
      }

      return (
        <View>
          {exactMatch ? (
            <ProductCard product={exactMatch} compact={false} onLinkError={onLinkError} />
          ) : (
            <View className="rounded-2xl bg-neutral-800 px-5 py-4">
              <Text className="text-sm leading-5 text-neutral-300">
                No exact match for this {garment.category} — here are similar styles instead.
              </Text>
            </View>
          )}

          <Text className="mb-3 mt-6 text-base font-semibold text-white">Similar items</Text>
          {similarItems.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {similarItems.map((item: SimilarItem) => (
                <ProductCard key={item.id} product={item} compact onLinkError={onLinkError} />
              ))}
            </ScrollView>
          ) : (
            // T036 / FR-011: an *explicit* regional empty state — the server
            // already filtered by region, so an empty list means exactly this.
            <View className="rounded-2xl bg-neutral-800 px-5 py-6">
              <Text className="text-center text-sm leading-5 text-neutral-300">
                No similar items are available in your region ({region}) right now.
              </Text>
            </View>
          )}
        </View>
      );
    }
  }
}

export function GarmentDetailModal({
  visible,
  garment,
  region,
  state,
  onRetry,
  onClose,
}: GarmentDetailModalProps) {
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useSharedValue(screenHeight);
  const dragStart = useSharedValue(0);
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, OPEN_SPRING);
    }
  }, [visible, translateY]);

  // Plain functions, no useCallback: the React Compiler memoizes these
  // automatically, and manual memo here fights its analysis (lint:
  // react-hooks/preserve-manual-memoization).
  // Clearing the link error on the way OUT (not in the open effect) means
  // every open starts clean without an effect-driven setState cascade.
  const finishClose = () => {
    setLinkError(false);
    onClose();
  };

  const requestClose = () => {
    // Animate out first, then unmount the RN Modal — unmounting immediately
    // would hard-cut the exit and violate the "no sudden state jumps" bar.
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design; event-handler writes are the documented API
    translateY.value = withSpring(screenHeight, CLOSE_SPRING, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  };

  // Pan lives on the grab-handle header only, so it never wrestles with the
  // content ScrollView for vertical gestures.
  const pan = Gesture.Pan()
    .onStart(() => {
      dragStart.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = dragStart.value + event.translationY;
      // Downward follows the finger 1:1; upward is resisted (÷12) so the
      // sheet feels anchored rather than rigidly clamped — and because the
      // position is spring/gesture-driven the whole time, the interaction is
      // fully interruptible (Constitution Principle V).
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design; gesture-worklet writes are the documented API
      translateY.value = next >= 0 ? next : next / 12;
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        // eslint-disable-next-line react-hooks/immutability -- see onUpdate note
        translateY.value = withSpring(screenHeight, CLOSE_SPRING, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
      } else {
        translateY.value = withSpring(0, OPEN_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    // Backdrop opacity tracks the sheet position so a half-dragged sheet has
    // a half-faded backdrop — one continuous scene, not two animations.
    opacity: 1 - Math.min(Math.max(translateY.value / screenHeight, 0), 1),
  }));

  if (!garment) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={requestClose}>
      {/* Gestures inside an RN Modal need their own gesture root — the app-level
          one (if any) doesn't reach into the modal's native window. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={backdropStyle} className="absolute inset-0 bg-black/60">
          <Pressable accessibilityLabel="Close details" className="flex-1" onPress={requestClose} />
        </Animated.View>

        <Animated.View
          style={[sheetStyle, { maxHeight: screenHeight * 0.85 }]}
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-neutral-900 pb-8">
          <GestureDetector gesture={pan}>
            <View className="items-center px-5 pb-2 pt-3">
              <View className="h-1.5 w-10 rounded-full bg-neutral-600" />
              <Text className="mt-3 self-start text-xl font-semibold text-white">
                {titleCase(garment.category)}
              </Text>
            </View>
          </GestureDetector>

          <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 16 }}>
            {linkError ? (
              <View className="mb-3 rounded-2xl bg-red-950 px-4 py-3">
                <Text className="text-sm text-red-200">
                  {"That store link couldn't be opened. Please try another listing."}
                </Text>
              </View>
            ) : null}
            <MatchesContent
              garment={garment}
              region={region}
              state={state}
              onRetry={onRetry}
              onLinkError={() => setLinkError(true)}
            />
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
