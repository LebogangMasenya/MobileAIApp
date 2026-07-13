/**
 * VaultEntryCard (specs/005 US4) — one image-dominant grid cell.
 * expo-image is sized to the cell, so decoded bitmaps downsample to what's
 * rendered (SC-005 — no full-resolution images in cells); `recyclingKey`
 * keeps recycled FlatList cells from flashing stale photos.
 */

import { Image } from 'expo-image';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { VaultEntry } from '@/types/vault';

interface VaultEntryCardProps {
  entry: VaultEntry;
  /** Position in the entrance stagger (capped by the caller's list). */
  index: number;
  onPress: (entry: VaultEntry) => void;
  onDelete: (entry: VaultEntry) => void;
  /**
   * Present ONLY while the vault is public (feature 006 FR-003) — the
   * affordance is absent, not disabled, in private mode.
   */
  onShare?: (entry: VaultEntry) => void;
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function VaultEntryCard({ entry, index, onPress, onDelete, onShare }: VaultEntryCardProps) {
  const confirmDelete = () => {
    Alert.alert('Delete this look?', 'Its photo and matches are removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry) },
    ]);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 55)
        .springify()
        .mass(0.8)
        .damping(18)
        .stiffness(160)}
      className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Look from ${formatDay(entry.capturedAt)}, ${entry.matches.length} matches`}
        accessibilityHint="Opens saved matches. Long-press to delete."
        onPress={() => onPress(entry)}
        onLongPress={confirmDelete}
        className="overflow-hidden rounded-2xl bg-surface-card active:opacity-80">
        <Image
          source={{ uri: entry.imageUri }}
          style={{ width: '100%', height: 190 }}
          contentFit="cover"
          recyclingKey={entry.id}
          transition={120}
          accessibilityLabel="Saved look photo"
        />
        <View className="flex-row items-center justify-between px-3 py-2.5">
          <Text className="text-xs font-medium text-ink">{formatDay(entry.capturedAt)}</Text>
          <Text className="text-xs text-ink-muted">
            {entry.matches.length === 1 ? '1 match' : `${entry.matches.length} matches`}
          </Text>
        </View>
      </Pressable>

      {/* Share affordance — mounts/unmounts with the public toggle (springified). */}
      {onShare ? (
        <Animated.View
          entering={FadeInDown.springify().mass(0.7).damping(16).stiffness(200)}
          className="absolute right-2 top-2 z-10">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this look"
            hitSlop={8}
            onPress={() => onShare(entry)}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/45 active:bg-black/65">
            <Text className="text-sm text-white">⤴</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
