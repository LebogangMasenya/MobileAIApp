/**
 * VaultSheet (specs/005 US4) — the vault surface revealed by the pull:
 * header + two-column image-dominant grid + the existing GarmentDetailModal
 * fed entirely from stored data (no refetch path — contract §5).
 */

import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthErrorNotice } from '@/features/auth/components/AuthErrorNotice';
import { GarmentDetailModal } from '@/features/scan/components/GarmentDetailModal';
import { GarmentSharePicker } from '@/features/vault/components/GarmentSharePicker';
import { VaultEmptyState } from '@/features/vault/components/VaultEmptyState';
import { VaultEntryCard } from '@/features/vault/components/VaultEntryCard';
import { VaultVisibilityToggle } from '@/features/vault/components/VaultVisibilityToggle';
import { useShareLook } from '@/features/vault/hooks/useShareLook';
import { useVaultEntries } from '@/features/vault/hooks/useVaultEntries';
import { useVaultVisibility } from '@/features/vault/hooks/useVaultVisibility';
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
  // Feature 006: the public toggle gates the whole sharing surface (FR-003).
  const visibility = useVaultVisibility();
  const sharing = useShareLook();

  const handleDelete = async (entry: VaultEntry) => {
    // Deleting the entry whose modal is open closes it first (spec edge case).
    if (openEntry?.id === entry.id) setOpenEntry(null);
    await remove(entry.id);
  };

  return (
    <View style={{ paddingTop: insets.top + 8 }} className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between gap-3 px-6 pb-3">
        <View className="flex-1">
          <Text className="font-serif text-2xl text-ink">Wardrobe Vault</Text>
          <Text className="text-xs text-ink-muted">
            {entries.length === 1 ? '1 saved look' : `${entries.length} saved looks`}
          </Text>
        </View>
        <VaultVisibilityToggle
          isPublic={visibility.isPublic}
          disabled={!visibility.isLoaded}
          onToggle={() => void visibility.toggle()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close vault"
          onPress={onClose}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface-dim active:bg-line">
          <Text className="text-base text-ink">✕</Text>
        </Pressable>
      </View>

      {/* Once-only explainer (FR-004) — honesty about what "public" does today. */}
      {visibility.explainerVisible ? (
        <Pressable className="px-6 pb-2" onPress={visibility.dismissExplainer}>
          <AuthErrorNotice
            tone="gentle"
            message="Sharing enabled — tap any look's share icon. Public style profiles are coming later. (Tap to dismiss)"
          />
        </Pressable>
      ) : null}

      {/* Share failure notice (FR-014) — gentle, dismissible, never a crash. */}
      {sharing.error ? (
        <Pressable className="px-6 pb-2" onPress={sharing.clearError}>
          <AuthErrorNotice message={sharing.error} />
        </Pressable>
      ) : null}

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
            <VaultEntryCard
              entry={item}
              index={index}
              onPress={setOpenEntry}
              onDelete={handleDelete}
              // Affordance exists ONLY while public — absent, not disabled (FR-003).
              onShare={visibility.isPublic ? (entry) => void sharing.share(entry) : undefined}
            />
          )}
        />
      )}

      <GarmentSharePicker
        entry={sharing.pickerFor}
        onPick={(entry, garment) => void sharing.shareGarment(entry, garment)}
        onDismiss={sharing.dismissPicker}
      />

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
