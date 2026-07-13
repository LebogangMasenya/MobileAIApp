/**
 * VaultSheet (specs/005 US4) — the vault surface revealed by the pull:
 * header + two-column image-dominant grid + the existing GarmentDetailModal
 * fed entirely from stored data (no refetch path — contract §5).
 */

import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GarmentDetailModal } from '@/features/scan/components/GarmentDetailModal';
import { VaultEmptyState } from '@/features/vault/components/VaultEmptyState';
import { VaultEntryCard } from '@/features/vault/components/VaultEntryCard';
import { useVaultEntries } from '@/features/vault/hooks/useVaultEntries';
import { productMatchesToModalState } from '@/features/vault/utils/matches-adapter';
import type { DetectedGarment } from '@/types/scan';
import type { VaultEntry } from '@/types/vault';

interface VaultSheetProps {
  onClose: () => void;
}

/**
 * GarmentDetailModal wants a DetectedGarment for its header; a vault entry is
 * a whole look, so we synthesize a minimal stand-in (the modal only reads
 * display fields from it).
 */
function lookGarment(entry: VaultEntry): DetectedGarment {
  return {
    id: entry.id,
    personId: 'vault',
    category: 'Saved look',
    confidence: 1,
    boundingRegion: { x: 0, y: 0, width: 1, height: 1 },
    matchStatus: entry.matches.length > 0 ? 'matched' : 'no_match',
  };
}

export function VaultSheet({ onClose }: VaultSheetProps) {
  const insets = useSafeAreaInsets();
  const { entries, isLoading, error, retry, remove } = useVaultEntries();
  const [openEntry, setOpenEntry] = useState<VaultEntry | null>(null);

  const handleDelete = async (entry: VaultEntry) => {
    // Deleting the entry whose modal is open closes it first (spec edge case).
    if (openEntry?.id === entry.id) setOpenEntry(null);
    await remove(entry.id);
  };

  return (
    <View style={{ paddingTop: insets.top + 8 }} className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-6 pb-3">
        <View>
          <Text className="font-serif text-2xl text-ink">Wardrobe Vault</Text>
          <Text className="text-xs text-ink-muted">
            {entries.length === 1 ? '1 saved look' : `${entries.length} saved looks`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close vault"
          onPress={onClose}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface-dim active:bg-line">
          <Text className="text-base text-ink">✕</Text>
        </Pressable>
      </View>

      {error ? (
        <VaultEmptyState variant="error" onRetry={retry} />
      ) : !isLoading && entries.length === 0 ? (
        <VaultEmptyState variant="empty" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingBottom: insets.bottom + 56 }}
          renderItem={({ item, index }) => (
            <VaultEntryCard entry={item} index={index} onPress={setOpenEntry} onDelete={handleDelete} />
          )}
        />
      )}

      <GarmentDetailModal
        visible={openEntry !== null}
        garment={openEntry ? lookGarment(openEntry) : null}
        region=""
        state={openEntry ? productMatchesToModalState(openEntry.matches) : { phase: 'idle' }}
        // No refetch path for local data (contract §5) — retry is a no-op.
        onRetry={() => undefined}
        onClose={() => setOpenEntry(null)}
      />
    </View>
  );
}
