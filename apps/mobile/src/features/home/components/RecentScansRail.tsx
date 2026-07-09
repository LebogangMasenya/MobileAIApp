/**
 * RecentScansRail — horizontally swipeable scan history (FR-013, figma p3).
 * Pure presentation: data arrives sorted newest-first from useRecentScans,
 * navigation is the parent's business.
 */

import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import type { RecentScanSummary } from '@/types/auth';

interface RecentScansRailProps {
  scans: RecentScanSummary[];
  onPressScan: (scan: RecentScanSummary) => void;
  onSeeAll: () => void;
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function RecentScansRail({ scans, onPressScan, onSeeAll }: RecentScansRailProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-6">
        <Text className="text-lg font-semibold text-ink">Recently scanned</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onSeeAll}
          className="min-h-11 justify-center">
          <Text className="text-sm font-semibold text-primary">See all</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
        {scans.map((scan, index) => (
          <Animated.View
            key={scan.scanId}
            // Small stagger so the rail pours in as one motion, capped so a
            // full rail doesn't take seconds to settle.
            entering={FadeInRight.delay(Math.min(index, 5) * 60)
              .springify()
              .mass(0.8)
              .damping(18)
              .stiffness(160)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Scan from ${formatDay(scan.capturedAt)}, ${scan.garmentCount} garments`}
              onPress={() => onPressScan(scan)}
              className="w-36 overflow-hidden rounded-2xl bg-surface-card active:opacity-80">
              <Image
                source={{ uri: scan.thumbnailUri }}
                style={{ width: '100%', height: 176 }}
                contentFit="cover"
                accessibilityLabel="Scan thumbnail"
              />
              <View className="gap-0.5 px-3 py-2.5">
                <Text className="text-xs font-medium text-ink">{formatDay(scan.capturedAt)}</Text>
                <Text className="text-xs text-ink-muted">
                  {scan.garmentCount === 1 ? '1 garment' : `${scan.garmentCount} garments`}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
