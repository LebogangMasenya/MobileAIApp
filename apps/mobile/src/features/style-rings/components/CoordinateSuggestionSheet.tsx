/**
 * CoordinateSuggestionSheet (specs/007 US5, contracts/daily-cycle §4) — the
 * ring's third act, honestly scoped: a PURE LOCAL composition from garments
 * the user already owns. No network, no AI — this is explicitly the
 * placeholder the future coordinate-generator feature replaces wholesale;
 * its only jobs are (a) make segment 3 completable today and (b) make the
 * ring contract's "fulfillment is the caller's business" claim real.
 *
 * Composition rule (composeCoordinate, exported pure — Constitution VIII):
 * newest garments first, ONE per category, up to three pieces, and it only
 * counts as a coordinate with ≥2 distinct categories — one lonely shirt is
 * not an outfit, and pretending otherwise would cheapen the ring (SC-007).
 *
 * Confirm marks the segment; dismiss marks NOTHING (honest completion —
 * looking at a suggestion isn't wearing one).
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { cropGarment } from '@/features/vault/utils/garment-crop';
import { loadEntries } from '@/services/vault-store';
import type { VaultEntry, VaultGarment } from '@/types/vault';

export interface CoordinatePiece {
  entry: VaultEntry;
  garment: VaultGarment;
}

/**
 * Pick up to `max` pieces across distinct categories, newest look first.
 * Returns [] when fewer than two categories exist — the cold-start signal.
 */
export function composeCoordinate(entries: VaultEntry[], max = 3): CoordinatePiece[] {
  const picks: CoordinatePiece[] = [];
  const usedCategories = new Set<string>();
  // entries arrive newest-first from loadEntries — today's taste leads.
  for (const entry of entries) {
    for (const garment of entry.garments) {
      const category = garment.category.trim();
      if (!category || usedCategories.has(category)) continue;
      usedCategories.add(category);
      picks.push({ entry, garment });
      if (picks.length >= max) return picks;
    }
  }
  return usedCategories.size >= 2 ? picks : [];
}

interface PieceCardProps {
  piece: CoordinatePiece;
  index: number;
}

function PieceCard({ piece, index }: PieceCardProps) {
  // Crop the garment's region when the entry can support it (imageSize
  // known); otherwise the whole look stands in — stored facts only, never a
  // broken image (the feature-006 crop contract).
  const [uri, setUri] = useState(piece.entry.imageUri);

  useEffect(() => {
    let cancelled = false;
    if (piece.entry.imageSize) {
      void cropGarment(piece.entry, piece.garment).then((cropped) => {
        if (!cancelled && cropped) setUri(cropped);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [piece]);

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 80)
        .springify()
        .mass(0.8)
        .damping(18)
        .stiffness(160)}
      className="flex-1 items-center gap-1.5">
      <View className="w-full overflow-hidden rounded-2xl bg-surface-dim">
        <Image
          source={{ uri }}
          style={{ width: '100%', height: 110 }}
          contentFit="cover"
          transition={120}
          accessibilityLabel={`${piece.garment.category} from a saved look`}
        />
      </View>
      <Text className="text-xs font-medium text-ink" numberOfLines={1}>
        {piece.garment.category}
      </Text>
    </Animated.View>
  );
}

export interface CoordinateSuggestionSheetProps {
  visible: boolean;
  /** "Wear it" — the caller marks the `coordinate` segment here. */
  onConfirm: () => void;
  onDismiss: () => void;
  /** Cold-start CTA — the caller routes to the scan tab. */
  onScanInstead: () => void;
}

export function CoordinateSuggestionSheet({
  visible,
  onConfirm,
  onDismiss,
  onScanInstead,
}: CoordinateSuggestionSheetProps) {
  // null = still loading; [] = loaded but not enough wardrobe (cold start).
  const [pieces, setPieces] = useState<CoordinatePiece[] | null>(null);

  useEffect(() => {
    if (!visible) {
      setPieces(null); // reset so each open composes from fresh vault state
      return;
    }
    let cancelled = false;
    void loadEntries().then(({ entries }) => {
      if (!cancelled) setPieces(composeCoordinate(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable accessibilityLabel="Dismiss suggestion" className="flex-1" onPress={onDismiss} />
        <Animated.View
          entering={FadeInDown.springify().mass(0.9).damping(18).stiffness(170)}
          className="gap-4 rounded-t-3xl bg-surface px-6 pb-12 pt-6">
          <View className="gap-1">
            <Text className="font-serif text-2xl text-ink">Today&apos;s coordinate</Text>
            <Text className="text-sm text-ink-muted">
              {pieces && pieces.length > 0
                ? 'Pulled from your own vault — pieces that already live together.'
                : 'Composed from the looks you scan.'}
            </Text>
          </View>

          {pieces === null ? (
            // Brief structural placeholder while the vault index reads.
            <View className="h-32 rounded-2xl bg-surface-dim" />
          ) : pieces.length > 0 ? (
            <>
              <View className="flex-row gap-3">
                {pieces.map((piece, index) => (
                  <PieceCard key={piece.garment.id} piece={piece} index={index} />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Wear this coordinate"
                onPress={onConfirm}
                className="min-h-12 items-center justify-center rounded-full bg-primary px-6 active:bg-primary-pressed">
                <Text className="text-base font-semibold text-on-primary">Wear it</Text>
              </Pressable>
            </>
          ) : (
            // Designed cold start (spec edge case): the honest ask, never a
            // broken zero. Two categories make an outfit — go scan one.
            <View className="items-center gap-3 rounded-2xl bg-surface-card px-6 py-8">
              <Text className="text-3xl">🧥</Text>
              <Text className="text-center text-base font-semibold text-ink">
                Your stylist needs material
              </Text>
              <Text className="text-center text-sm leading-relaxed text-ink-muted">
                Scan a couple of pieces and tomorrow&apos;s coordinate composes itself.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go scan a piece"
                onPress={onScanInstead}
                className="mt-1 min-h-12 items-center justify-center self-stretch rounded-full bg-primary px-6 active:bg-primary-pressed">
                <Text className="text-base font-semibold text-on-primary">Scan a piece</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
