/**
 * Home dashboard (FR-012..FR-016; figma p3 with critiques D5/D6/D9 applied).
 *
 * Three mutually exclusive content states below the greeting header:
 *   error   → retry card (never a blank rail — FR-016)
 *   empty   → first-run invitation + "What you will love" rows (D5 + D9)
 *   content → "Recently scanned" rail (marketing rows retired — D9)
 *
 * This screen also carries the signed-in half of the gate-crossing motion
 * (contracts §5 row 3): the header and content spring in via `entering`
 * animations when the (app) group mounts after sign-in.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BottomTabInset, RingPalette } from '@/constants/theme';
import { EmptyScansState } from '@/features/home/components/EmptyScansState';
import { DemoScanCard } from '@/features/visual-search/components/DemoScanCard';
import { FeatureHighlights } from '@/features/home/components/FeatureHighlights';
import { GreetingHeader } from '@/features/home/components/GreetingHeader';
import { RecentScansRail } from '@/features/home/components/RecentScansRail';
import { useRecentScans } from '@/features/home/hooks/useRecentScans';
import { CoordinateSuggestionSheet } from '@/features/style-rings/components/CoordinateSuggestionSheet';
import { DailyCycleRing } from '@/features/style-rings/components/DailyCycleRing';
import { RingCelebration } from '@/features/style-rings/components/RingCelebration';
import { useDailyCycle } from '@/features/style-rings/hooks/useDailyCycle';
import { SEGMENT_IDS, type SegmentId } from '@/services/daily-cycle-store';

/** Ring legend copy + swatch per segment (colors mirror DailyCycleRing). */
const SEGMENT_META: Record<SegmentId, { label: string; color: string }> = {
  log: { label: 'Log a look', color: RingPalette.log },
  harmony: { label: 'Explore a look', color: RingPalette.harmony },
  coordinate: { label: 'Style a coordinate', color: RingPalette.coordinate },
};

export default function HomeScreen() {
  const router = useRouter();
  const { scans, isLoading, error, retry } = useRecentScans();
  // Feature 007 US5: the ring's state engine — Home only wires it to visuals.
  const cycle = useDailyCycle();
  const [suggestionVisible, setSuggestionVisible] = useState(false);

  // The header is dark in both themes; flip the status-bar text to light only
  // while Home is focused (tabs keep screens mounted, so a mount-scoped
  // <StatusBar> would leak onto sibling tabs).
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light', true);
      return () => setStatusBarStyle('auto', true);
    }, []),
  );

  return (
    <View className="flex-1 bg-surface">
      <GreetingHeader />
      <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: BottomTabInset + 32, gap: 24 }}>
        {/* Style Rings (feature 007 US5) — the daily open loop, first thing
            the eye lands on. Renders only from today's REAL record (SC-007);
            while the record loads we render nothing rather than a fake ring. */}
        {cycle.record ? (
          <Animated.View
            entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
            className="mx-6 flex-row items-center gap-5 rounded-3xl bg-surface-card px-5 py-5">
            <DailyCycleRing record={cycle.record} />
            <View className="flex-1 gap-2.5">
              <Text className="font-serif text-lg text-ink">Today&apos;s cycle</Text>
              <View className="gap-1.5">
                {SEGMENT_IDS.map((id) => {
                  const done = Boolean(cycle.record?.segments[id]);
                  return (
                    <View key={id} className="flex-row items-center gap-2">
                      <View
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: SEGMENT_META[id].color, opacity: done ? 1 : 0.35 }}
                      />
                      <Text className={done ? 'text-xs font-medium text-ink' : 'text-xs text-ink-muted'}>
                        {SEGMENT_META[id].label}
                        {done ? '  ✓' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Style a coordinate from your vault"
                onPress={() => setSuggestionVisible(true)}
                className="mt-0.5 min-h-9 items-center justify-center self-start rounded-full bg-primary px-4 active:bg-primary-pressed">
                <Text className="text-sm font-semibold text-on-primary">Style me</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {error ? (
          <Animated.View
            entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
            className="mx-6 items-center gap-3 rounded-3xl bg-surface-card px-6 py-8">
            <Text className="text-center text-base font-semibold text-ink">{error}</Text>
            <Text className="text-center text-sm text-ink-muted">
              Your scans are still on this device — let&apos;s try that again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              className="mt-1 min-h-12 items-center justify-center self-stretch rounded-full bg-primary px-6 active:bg-primary-pressed">
              <Text className="text-base font-semibold text-on-primary">Retry</Text>
            </Pressable>
          </Animated.View>
        ) : isLoading ? null : scans.length === 0 ? (
          // Zero scans: invitation + highlight rows together (FR-014).
          <>
            <EmptyScansState onScanFirstOutfit={() => router.push('/scan')} />
            <FeatureHighlights />
          </>
        ) : (
          <RecentScansRail
            scans={scans}
            // FR-015 (partial for now): feature 001 keeps scan sessions
            // in-memory and anonymous — there is no scanId-addressable results
            // route to reopen yet. Until a results screen exists (needs a
            // GET /v1/scans/:id), a card opens the scan experience itself.
            onPressScan={() => router.push('/scan')}
            onSeeAll={() => Alert.alert('Scan history', 'The full history view is coming soon.')}
          />
        )}

        {/* Feature 008: the Subject Lift visual-search entry (evolved from
            003's demo card) — rendered in every content state so the surface
            is always one tap from launch. */}
        <DemoScanCard onPress={() => router.push('/visual-search')} />
      </ScrollView>

      {/* Segment 3's stand-in generator (contracts/daily-cycle §4). Confirm
          marks the segment; dismiss marks nothing — honest completion. */}
      <CoordinateSuggestionSheet
        visible={suggestionVisible}
        onConfirm={() => {
          cycle.complete('coordinate');
          setSuggestionVisible(false);
        }}
        onDismiss={() => setSuggestionVisible(false)}
        onScanInstead={() => {
          setSuggestionVisible(false);
          router.push('/scan');
        }}
      />

      {/* Full-ring moment — owed whenever complete ∧ unacknowledged, so an
          interrupted celebration simply replays on the next visit. */}
      {cycle.shouldCelebrate ? <RingCelebration onDone={cycle.onCelebrated} /> : null}
    </View>
  );
}
