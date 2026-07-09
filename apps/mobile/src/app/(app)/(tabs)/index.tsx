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
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BottomTabInset } from '@/constants/theme';
import { EmptyScansState } from '@/features/home/components/EmptyScansState';
import { DemoScanCard } from '@/features/visual-search/components/DemoScanCard';
import { FeatureHighlights } from '@/features/home/components/FeatureHighlights';
import { GreetingHeader } from '@/features/home/components/GreetingHeader';
import { RecentScansRail } from '@/features/home/components/RecentScansRail';
import { useRecentScans } from '@/features/home/hooks/useRecentScans';

export default function HomeScreen() {
  const router = useRouter();
  const { scans, isLoading, error, retry } = useRecentScans();

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

        {/* Feature 003: visual-search demo entry — rendered in every content
            state so the demo is always one tap from launch (FR-011). */}
        <DemoScanCard onPress={() => router.push('/demo-scan')} />
      </ScrollView>
    </View>
  );
}
