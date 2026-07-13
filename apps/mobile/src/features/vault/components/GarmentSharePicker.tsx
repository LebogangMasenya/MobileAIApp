/**
 * GarmentSharePicker (specs/006 contract §6) — "which piece?" — presented
 * only for looks with ≥2 garments. Rows show a lazily generated crop
 * thumbnail (spinner until ready, look photo on crop failure), category, and
 * match availability; plus a "Whole look" row. Scrim tap cancels silently.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { cropGarment } from '@/features/vault/utils/garment-crop';
import type { VaultEntry, VaultGarment } from '@/types/vault';

interface GarmentSharePickerProps {
  entry: VaultEntry | null;
  onPick: (entry: VaultEntry, garment: VaultGarment | 'look') => void;
  onDismiss: () => void;
}

function GarmentRow({
  entry,
  garment,
  onPress,
}: {
  entry: VaultEntry;
  garment: VaultGarment;
  onPress: () => void;
}) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void cropGarment(entry, garment).then((uri) => {
      if (cancelled) return;
      if (uri) setThumbUri(uri);
      else setThumbFailed(true); // fall back to the look photo thumbnail
    });
    return () => {
      cancelled = true;
    };
  }, [entry, garment]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Share ${garment.category}, ${garment.matches.length} links`}
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 px-4 active:bg-surface-dim">
      {thumbUri || thumbFailed ? (
        <Image
          source={{ uri: thumbUri ?? entry.imageUri }}
          style={{ width: 44, height: 54, borderRadius: 10 }}
          contentFit="cover"
          accessibilityLabel={`${garment.category} thumbnail`}
        />
      ) : (
        <View className="h-[54px] w-11 items-center justify-center rounded-[10px] bg-surface-dim">
          <ActivityIndicator size="small" color="#6C4AB0" />
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold capitalize text-ink">{garment.category}</Text>
        <Text className="text-xs text-ink-muted">
          {garment.matches.length === 0
            ? 'No links yet'
            : garment.matches.length === 1
              ? '1 link'
              : `${garment.matches.length} links`}
        </Text>
      </View>
      <Text className="text-lg text-ink-muted">›</Text>
    </Pressable>
  );
}

export function GarmentSharePicker({ entry, onPick, onDismiss }: GarmentSharePickerProps) {
  return (
    <Modal visible={entry !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable accessibilityLabel="Cancel sharing" className="flex-1" onPress={onDismiss} />
        {entry ? (
          <Animated.View
            entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(180)}
            className="rounded-t-3xl bg-surface pb-8 pt-3">
            <View className="items-center pb-2">
              <View className="h-1 w-10 rounded-full bg-line" />
              <Text className="pt-3 text-base font-semibold text-ink">Share which piece?</Text>
            </View>
            {entry.garments.map((garment) => (
              <GarmentRow
                key={garment.id}
                entry={entry}
                garment={garment}
                onPress={() => onPick(entry, garment)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share the whole look"
              onPress={() => onPick(entry, 'look')}
              className="min-h-14 flex-row items-center gap-3 border-t border-line px-4 active:bg-surface-dim">
              <Image
                source={{ uri: entry.imageUri }}
                style={{ width: 44, height: 54, borderRadius: 10 }}
                contentFit="cover"
                accessibilityLabel="Whole look thumbnail"
              />
              <Text className="flex-1 text-base font-semibold text-ink">Whole look</Text>
              <Text className="text-lg text-ink-muted">›</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}
