/**
 * Visual Search — the Subject Lift surface (specs/008, FR-017/CL-001).
 *
 * The standalone route that graduates feature 003's demo into the real
 * end-to-end experience. Three modes, each a thin orchestration over hooks
 * (Constitution VIII — this file owns NO business logic):
 *
 *   capture → live camera (scan-flow CameraView reused) + import + sample
 *   lift    → the 008 pipeline: LiftStage trace/lift moment, honest
 *             4-segment progress, manual-crop fallback, designed failures,
 *             then the results scene (hero + cascading match wall)
 *   sample  → feature 003's demo behavior preserved verbatim (empty-body
 *             request, server resolves the demo image, useVisualSearch) —
 *             so 003's FRs stay verifiable — presented through 008's wall
 *
 * Every phase of the lift machine maps to exactly one visual state, so
 * "empty" and "failed" and "detoured to manual crop" can never blur
 * (the 003 SC-004 lesson, inherited).
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NeonTracingOverlay } from '@/features/scan-overlay/components/NeonTracingOverlay';
import { useCoordinateTransform } from '@/features/scan-overlay/hooks/useCoordinateTransform';
import { CameraView, type CapturedPhoto } from '@/features/scan/components/CameraView';
import { ImportPicker } from '@/features/scan/components/ImportPicker';
import { ScanErrorFallback } from '@/features/scan/components/ScanErrorFallback';
import { type Size } from '@/features/scan/utils/layout';
import { deriveStyleProfile } from '@/features/vault/utils/style-profile';
import { useVaultEntries } from '@/features/vault/hooks/useVaultEntries';
import { LiftStage } from '@/features/visual-search/components/LiftStage';
import { ManualCropMarquee } from '@/features/visual-search/components/ManualCropMarquee';
import { MatchWall } from '@/features/visual-search/components/MatchWall';
import { PipelineProgress } from '@/features/visual-search/components/PipelineProgress';
import { useLiftSearch } from '@/features/visual-search/hooks/useLiftSearch';
import { useVisualSearch } from '@/features/visual-search/hooks/useVisualSearch';
import type { IsolatedGarment } from '@/services/subject-lift';
import type { ProductMatch } from '@/types/visual-search';

/** Natural size of the bundled demo asset (the retired demo-scan's constant). */
const DEMO_IMAGE_SIZE: Size = { width: 399, height: 501 };
/** Demo trace region — inset so the glow reads as "scanning", not a frame. */
const DEMO_REGION = { x: 0.06, y: 0.04, width: 0.88, height: 0.92 };

const ENTER_SPRING = { mass: 0.8, damping: 18, stiffness: 160 };

type Mode = 'capture' | 'lift' | 'sample';

/**
 * The isolated-garment hero (contracts/match-presentation §1, research R11):
 * a SOLID dark elevated card — deliberately NOT glass/blur, which 007 §4
 * bans on app surfaces — because a transparent-background PNG needs a
 * controlled dark backdrop to stay legible over ANY theme or content
 * behind it (SC-008), and a solid fill costs nothing per frame.
 */
function GarmentHero({ source, aspect }: { source: string | number; aspect: number }) {
  return (
    <View
      className="mx-6 items-center rounded-3xl bg-header p-6"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
      }}>
      <Image
        // string = a session file/remote URI; number = a bundled asset module
        // (the sample path's demo image).
        source={typeof source === 'number' ? source : { uri: source }}
        style={{ width: '70%', aspectRatio: 1 / Math.min(aspect, 1.4) }}
        contentFit="contain"
        accessibilityLabel="Your scanned garment"
      />
    </View>
  );
}

/** Designed zero-matches state — a RESULT, structurally distinct from failure. */
function NoMatches({ onAgain }: { onAgain: () => void }) {
  return (
    <Animated.View
      entering={FadeInDown.springify().mass(ENTER_SPRING.mass).damping(ENTER_SPRING.damping).stiffness(ENTER_SPRING.stiffness)}
      className="mx-6 items-center gap-3 rounded-3xl bg-surface-card px-6 py-8">
      <Text className="text-3xl">🧐</Text>
      <Text className="text-center text-lg font-semibold text-ink">Nothing shoppable in this one</Text>
      <Text className="text-center text-sm leading-relaxed text-ink-muted">
        The catalogs came back empty — that happens with some pieces. Try another angle or a different garment.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAgain}
        className="mt-1 min-h-12 items-center justify-center self-stretch rounded-full bg-primary px-6 active:bg-primary-pressed">
        <Text className="text-base font-semibold text-on-primary">Scan another</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function VisualSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>('capture');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const lift = useLiftSearch();
  const sample = useVisualSearch();

  // Harmony inputs (US4): the profile derives fresh from the vault — null
  // while entries load, so a ring can never render before its data exists.
  const vault = useVaultEntries();
  const profile = useMemo(
    () => (vault.isLoading ? null : deriveStyleProfile(vault.entries, new Date())),
    [vault.isLoading, vault.entries],
  );

  // Sample mode's once-per-result-set jackpot claim (US5): reset per run so
  // a re-run is a NEW result set with its own single beat.
  const sampleJackpotFired = useRef(false);
  const claimSampleJackpot = useCallback((): boolean => {
    if (sampleJackpotFired.current) return false;
    sampleJackpotFired.current = true;
    return true;
  }, []);

  // One coordinate space per active photo surface (lift photo or demo asset).
  const imageSize: Size = mode === 'sample' ? DEMO_IMAGE_SIZE : (photo ?? { width: 1, height: 1 });
  const { onContainerLayout, frame } = useCoordinateTransform(imageSize);

  const startLift = useCallback(
    (captured: CapturedPhoto) => {
      setPhoto(captured);
      setMode('lift');
      void lift.start(captured);
    },
    [lift],
  );

  const startSample = useCallback(() => {
    setMode('sample');
    sampleJackpotFired.current = false;
    void sample.run();
  }, [sample]);

  const backToCapture = useCallback(() => {
    lift.reset();
    setPhoto(null);
    setImportError(null);
    setMode('capture');
  }, [lift]);

  const onManualCropConfirm = useCallback(
    (garment: IsolatedGarment) => {
      void lift.continueFromManualCrop(garment);
    },
    [lift],
  );

  // ---------------------------------------------------------------------
  // Scene: results (shared by lift-done and sample-done)
  // ---------------------------------------------------------------------
  const renderResults = (
    heroSource: string | number,
    heroAspect: number,
    matches: ProductMatch[],
    claimJackpot: () => boolean,
  ) => (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <GarmentHero source={heroSource} aspect={heroAspect} />
        {matches.length === 0 ? (
          <NoMatches onAgain={backToCapture} />
        ) : (
          <>
            <View className="px-6">
              <Text className="font-serif text-xl text-ink">Shop this piece</Text>
              <Text className="text-xs text-ink-muted">
                {matches.length} {matches.length === 1 ? 'match' : 'matches'} found
              </Text>
            </View>
            <View className="px-6">
              <MatchWall matches={matches} profile={profile} claimJackpot={claimJackpot} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={backToCapture}
              className="mx-6 min-h-12 items-center justify-center rounded-full bg-primary px-6 active:bg-primary-pressed">
              <Text className="text-base font-semibold text-on-primary">Scan another piece</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );

  // ---------------------------------------------------------------------
  // Mode: sample (feature 003 preserved — trace, pill, then 008's wall)
  // ---------------------------------------------------------------------
  const renderSample = () => {
    const searching = sample.state.phase === 'searching' || sample.state.phase === 'idle';
    if (sample.state.phase === 'done') {
      return renderResults(
        // Bundled asset — the sample's hero never depends on the network.
        require('@/assets/images/demo-garment.jpeg'),
        DEMO_IMAGE_SIZE.height / DEMO_IMAGE_SIZE.width,
        sample.state.matches,
        claimSampleJackpot,
      );
    }
    return (
      <View className="flex-1 overflow-visible bg-black" onLayout={onContainerLayout}>
        <Image
          source={require('@/assets/images/demo-garment.jpeg')}
          style={{ flex: 1 }}
          contentFit="contain"
          accessibilityLabel="Demo outfit photo"
        />
        {frame && searching ? (
          reducedMotion ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: frame.x + DEMO_REGION.x * frame.width,
                top: frame.y + DEMO_REGION.y * frame.height,
                width: DEMO_REGION.width * frame.width,
                height: DEMO_REGION.height * frame.height,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: 'rgba(34, 211, 238, 0.8)',
              }}
            />
          ) : (
            <NeonTracingOverlay region={DEMO_REGION} frame={frame} mode="tracing" />
          )
        ) : null}
        {searching ? (
          <View className="absolute bottom-24 left-0 right-0 z-20 items-center" pointerEvents="none">
            <View className="rounded-full bg-black/70 px-5 py-2.5">
              <Text className="text-sm font-medium text-white">Finding where to shop this look…</Text>
            </View>
          </View>
        ) : null}
        {sample.state.phase === 'failed' ? (
          <ScanErrorFallback
            title="Search didn't go through"
            message={sample.state.message}
            primaryLabel={sample.state.retryable ? 'Try again' : undefined}
            onPrimary={sample.state.retryable ? () => void sample.retry() : undefined}
            secondaryLabel="Go back"
            onSecondary={backToCapture}
          />
        ) : null}
      </View>
    );
  };

  // ---------------------------------------------------------------------
  // Mode: lift (the 008 pipeline)
  // ---------------------------------------------------------------------
  const renderLift = () => {
    if (!photo) return null;
    const { state } = lift;

    if (state.phase === 'done') {
      return renderResults(
        state.garment.uri,
        state.garment.height / state.garment.width,
        state.result.matches,
        lift.claimJackpot,
      );
    }

    const garment =
      state.phase === 'preparing' || state.phase === 'matching' || state.phase === 'assembling'
        ? state.garment
        : state.phase === 'failed'
          ? state.garment
          : null;
    const inFlight =
      state.phase === 'isolating' ||
      state.phase === 'preparing' ||
      state.phase === 'matching' ||
      state.phase === 'assembling';

    return (
      // Z-band ancestor (005 contract): trace z-10, chrome z-20/30, failures
      // z-60 — must stay non-clipping for the overlay stack.
      <View className="flex-1 overflow-visible bg-black" onLayout={onContainerLayout}>
        <LiftStage
          sourceUri={photo.uri}
          frame={frame}
          garment={garment}
          isolating={state.phase === 'isolating'}
        />

        {state.phase === 'manualCrop' && frame ? (
          <ManualCropMarquee
            sourceUri={photo.uri}
            sourceSize={photo}
            frame={frame}
            reason={state.reason}
            onConfirm={onManualCropConfirm}
            onCancel={backToCapture}
          />
        ) : null}

        {inFlight || state.phase === 'failed' ? (
          <View style={{ bottom: insets.bottom + 24 }} className="absolute left-0 right-0 z-20">
            <PipelineProgress state={state} />
          </View>
        ) : null}

        {state.phase === 'failed' ? (
          <ScanErrorFallback
            title="Search paused"
            message={state.message}
            primaryLabel={state.retryable ? 'Try again' : undefined}
            onPrimary={state.retryable ? () => void lift.retry() : undefined}
            secondaryLabel="New photo"
            onSecondary={backToCapture}
          />
        ) : null}
      </View>
    );
  };

  // ---------------------------------------------------------------------
  // Mode: capture
  // ---------------------------------------------------------------------
  const renderCapture = () => (
    <View className="flex-1 bg-black">
      <CameraView
        onCapture={startLift}
        bottomLeftAccessory={
          <ImportPicker onPicked={startLift} onError={(message) => setImportError(message)} />
        }
      />
      {/* Sample affordance — 003's demo stays one tap away (FR-017). */}
      <View className="absolute bottom-32 left-0 right-0 items-center" pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try the sample garment"
          onPress={startSample}
          className="rounded-full bg-black/60 px-5 py-2.5 active:bg-black/80">
          <Text className="text-sm font-medium text-white">Try the sample</Text>
        </Pressable>
      </View>
      {importError ? (
        <ScanErrorFallback
          title="Couldn't open that photo"
          message={importError}
          primaryLabel="OK"
          onPrimary={() => setImportError(null)}
        />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      {mode === 'capture' ? renderCapture() : mode === 'lift' ? renderLift() : renderSample()}

      {/* Close — always present, above every state (the demo-scan rule). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close visual search"
        onPress={() => router.back()}
        style={{ top: insets.top + 8 }}
        className="absolute left-5 z-[70] h-11 w-11 items-center justify-center rounded-full bg-black/40 active:bg-black/60">
        <Text className="text-base text-white">✕</Text>
      </Pressable>
    </View>
  );
}
