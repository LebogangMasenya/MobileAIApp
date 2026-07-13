/**
 * Demo scan screen (specs/003 FR-012..FR-014, contracts §5).
 *
 * The capture step is mocked (bundled demo image); the search is real. The
 * screen is a thin orchestrator over `useVisualSearch` — each phase of the
 * machine maps to exactly one visual state, so "empty" and "failed" can
 * never blur together (SC-004):
 *
 *   searching → demo image + 001's scanning glow (loops however long the
 *               search takes — it never "completes" into a blank frame)
 *   done(>0)  → results panel springs up over the image
 *   done(0)   → designed "nothing shoppable" state (US2 — NOT an error)
 *   failed    → ScanErrorFallback overlay with Retry when retryable (US3)
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NeonTracingOverlay } from '@/features/scan-overlay/components/NeonTracingOverlay';
import { useCoordinateTransform } from '@/features/scan-overlay/hooks/useCoordinateTransform';
import { ScanErrorFallback } from '@/features/scan/components/ScanErrorFallback';
import { type Size } from '@/features/scan/utils/layout';
import { ProductMatchCard } from '@/features/visual-search/components/ProductMatchCard';
import { useVisualSearch } from '@/features/visual-search/hooks/useVisualSearch';

/** Natural size of the bundled demo asset — the overlay math needs it. */
const DEMO_IMAGE_SIZE: Size = { width: 399, height: 501 };

/**
 * Slightly inset from the photo edges so the glow ring reads as "scanning
 * the outfit", not as a picture frame.
 */
const FULL_OUTFIT_REGION = { x: 0.06, y: 0.04, width: 0.88, height: 0.92 };

export default function DemoScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, run, retry } = useVisualSearch();
  // Feature 004: shared geometry hook replaces the hand-wired onLayout +
  // containFrame ceremony — same single-source math underneath.
  const { onContainerLayout, frame } = useCoordinateTransform(DEMO_IMAGE_SIZE);

  // The demo starts itself — the screen IS the trigger (FR-012). The hook's
  // in-flight guard makes re-mounts and fast re-entries harmless.
  useEffect(() => {
    void run();
  }, [run]);

  const searching = state.phase === 'searching' || state.phase === 'idle';
  const matches = state.phase === 'done' ? state.matches : [];

  return (
    // Z-BAND CONTRACT ancestor (specs/005 US1): hosts the absolute overlay
    // stack (trace z-10, chrome z-20/30). Must stay non-clipping — never add
    // overflow-hidden between here and the overlays.
    <View className="flex-1 overflow-visible bg-black" onLayout={onContainerLayout}>
      <Image
        source={require('@/assets/images/demo-garment.jpeg')}
        style={{ flex: 1 }}
        contentFit="contain"
        accessibilityLabel="Demo outfit photo"
      />

      {/* Neon perimeter trace (feature 004) — loops for the whole search. */}
      {frame && searching ? (
        <NeonTracingOverlay region={FULL_OUTFIT_REGION} frame={frame} mode="tracing" />
      ) : null}

      {searching ? (
        <View className="absolute bottom-24 left-0 right-0 z-20 items-center" pointerEvents="none">
          <View className="flex-row items-center gap-2 rounded-full bg-black/70 px-5 py-2.5">
            <ActivityIndicator size="small" color="#ffffff" />
            <Text className="text-sm font-medium text-white">Finding where to shop this look…</Text>
          </View>
        </View>
      ) : null}

      {/* Results panel (US1) — springs up over the lower half; the image stays
          in view above it so cards read as "found in this photo". */}
      {state.phase === 'done' && matches.length > 0 ? (
        <Animated.View
          entering={SlideInDown.springify().mass(0.9).damping(18).stiffness(140)}
          style={{ maxHeight: '62%' }}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl bg-surface">
          <View className="items-center gap-1 px-6 pb-2 pt-4">
            <View className="h-1 w-10 rounded-full bg-line" />
            <Text className="pt-2 text-lg font-semibold text-ink">Shop this look</Text>
            <Text className="text-xs text-ink-muted">
              {matches.length} {matches.length === 1 ? 'match' : 'matches'} found
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 10 }}>
            {matches.map((match, index) => (
              <Animated.View
                key={match.id}
                // Capped stagger: the first cards pour in as one motion, a
                // 20-card list doesn't take seconds to settle.
                entering={FadeInDown.delay(Math.min(index, 6) * 55)
                  .springify()
                  .mass(0.8)
                  .damping(18)
                  .stiffness(160)}>
                <ProductMatchCard match={match} />
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* No-matches state (US2) — a designed result, visually and structurally
          distinct from failure: calm card, no scrim, invitational tone. */}
      {state.phase === 'done' && matches.length === 0 ? (
        <Animated.View
          entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
          style={{ bottom: insets.bottom + 32 }}
          className="absolute left-6 right-6 z-20 items-center gap-3 rounded-3xl bg-surface px-6 py-7">
          <Text className="text-3xl">🧐</Text>
          <Text className="text-center text-lg font-semibold text-ink">Nothing shoppable in this one</Text>
          <Text className="text-center text-sm leading-relaxed text-ink-muted">
            The search came back empty — that happens with some photos. Give it another go.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void retry()}
            className="mt-1 min-h-12 items-center justify-center self-stretch rounded-full bg-primary px-6 active:bg-primary-pressed">
            <Text className="text-base font-semibold text-on-primary">Try again</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Failure state (US3) — the 001 fallback, over the preserved image. */}
      {state.phase === 'failed' ? (
        <ScanErrorFallback
          title="Search didn't go through"
          message={state.message}
          primaryLabel={state.retryable ? 'Try again' : undefined}
          onPrimary={state.retryable ? () => void retry() : undefined}
          secondaryLabel="Go back"
          onSecondary={() => router.back()}
        />
      ) : null}

      {/* Back affordance — always present, above every state (FR-014). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close demo scan"
        onPress={() => router.back()}
        style={{ top: insets.top + 8 }}
        className="absolute left-5 z-30 h-11 w-11 items-center justify-center rounded-full bg-black/40 active:bg-black/60">
        <Text className="text-base text-white">✕</Text>
      </Pressable>
    </View>
  );
}
