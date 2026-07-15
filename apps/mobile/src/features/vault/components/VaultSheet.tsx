/**
 * VaultSheet (specs/005 US4) — the vault surface revealed by the pull:
 * header + two-column image-dominant grid + the existing GarmentDetailModal
 * fed entirely from stored data (no refetch path — contract §5).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthErrorNotice } from '@/features/auth/components/AuthErrorNotice';
import { GarmentDetailModal } from '@/features/scan/components/GarmentDetailModal';
import { GarmentSharePicker } from '@/features/vault/components/GarmentSharePicker';
import { VaultEmptyState } from '@/features/vault/components/VaultEmptyState';
import { VaultEntryCard } from '@/features/vault/components/VaultEntryCard';
import { VaultFilterRail } from '@/features/vault/components/VaultFilterRail';
import { VaultVisibilityToggle } from '@/features/vault/components/VaultVisibilityToggle';
import { VaultWelcomeJourney } from '@/features/vault/components/VaultWelcomeJourney';
import { useSetupJourney } from '@/features/vault/hooks/useSetupJourney';
import { useShareLook } from '@/features/vault/hooks/useShareLook';
import { useVaultEntries } from '@/features/vault/hooks/useVaultEntries';
import { useVaultVisibility } from '@/features/vault/hooks/useVaultVisibility';
import { productMatchesToModalState } from '@/features/vault/utils/matches-adapter';
import { deriveStyleProfile } from '@/features/vault/utils/style-profile';
import { markSegment } from '@/services/daily-cycle-store';
import { confirm } from '@/services/tactile';
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

  // Feature 007 US3: journey derives from live state; `shouldCelebrate` is
  // the once-only first-scan moment (FR-010).
  const { journey, shouldCelebrate, onCelebrated } = useSetupJourney(entries.length);

  // Feature 007 US4: profile is a pure derivation over what's on screen —
  // recomputed with the entries, never stored (SC-007).
  const profile = useMemo(() => deriveStyleProfile(entries, new Date()), [entries]);
  const [filter, setFilter] = useState<string | null>(null);
  // Smart preselect fires ONCE per sheet session, and only for a genuinely
  // personalized profile — after that the selection is entirely the user's
  // (FR-011: a head start, never a cage).
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || isLoading || !profile.personalized) return;
    preselected.current = true;
    setFilter(profile.categories[0]?.category ?? null);
  }, [isLoading, profile]);

  const visibleEntries = useMemo(
    () =>
      filter === null
        ? entries
        : entries.filter((entry) =>
            entry.garments.some((garment) => garment.category.trim() === filter),
          ),
    [entries, filter],
  );

  // First-scan celebration (US3 scenario 3): one confirm beat + the banner
  // below, then the flag retires it permanently. Auto-retire keeps the grid
  // owner of the scene even if the user never taps.
  useEffect(() => {
    if (!shouldCelebrate) return;
    confirm();
    const timer = setTimeout(onCelebrated, 3200);
    return () => clearTimeout(timer);
  }, [shouldCelebrate, onCelebrated]);

  const handleOpenEntry = (entry: VaultEntry) => {
    setOpenEntry(entry);
    // US5 'harmony' fulfillment (contracts/daily-cycle §2): engaging with a
    // saved look is today's stand-in for the color-harmony read.
    // Fire-and-forget — the ring must never block or break the vault.
    void markSegment('harmony');
  };

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

      {/* First-scan moment (US3): a once-only springified banner — the
          journey's payoff — then the populated grid owns the scene. */}
      {shouldCelebrate ? (
        <Pressable className="px-6 pb-2" onPress={onCelebrated}>
          <Animated.View
            entering={FadeInDown.springify().mass(0.7).damping(15).stiffness(190)}
            className="flex-row items-center gap-3 rounded-2xl bg-primary px-4 py-3">
            <Text className="text-base text-on-primary">✓</Text>
            <Text className="flex-1 text-sm font-semibold text-on-primary">
              First piece secured — your vault is live.
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}

      {error ? (
        <VaultEmptyState variant="error" onRetry={retry} />
      ) : !isLoading && entries.length === 0 ? (
        // US3 (FR-009): the momentum journey replaces the cold empty card —
        // never a raw zero. The CTA closes the vault back to capture.
        <VaultWelcomeJourney journey={journey} onScanPress={onClose} />
      ) : (
        <>
          {/* US4: smart-preselected category chips. Renders nothing until
              stored garments give it real categories to offer. */}
          <VaultFilterRail profile={profile} selected={filter} onSelect={setFilter} />
          {visibleEntries.length === 0 && filter !== null ? (
            // Designed filtered-empty state (Constitution VII): the filter
            // found nothing, the vault is fine — say so, offer the way back.
            <Animated.View
              entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
              className="mx-6 items-center gap-3 rounded-3xl bg-surface-card px-6 py-10">
              <Text className="text-center text-base font-semibold text-ink">
                No {filter.toLowerCase()} looks yet
              </Text>
              <Text className="text-center text-sm leading-relaxed text-ink-muted">
                Scan a look with one, or browse everything you&apos;ve saved.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilter(null)}
                className="mt-1 min-h-12 items-center justify-center self-stretch rounded-full bg-primary px-6 active:bg-primary-pressed">
                <Text className="text-base font-semibold text-on-primary">Show all looks</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <FlatList
              data={visibleEntries}
              keyExtractor={(entry) => entry.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
              contentContainerStyle={{ gap: 12, paddingBottom: insets.bottom + 56 }}
              renderItem={({ item, index }) => (
                <VaultEntryCard
                  entry={item}
                  index={index}
                  onPress={handleOpenEntry}
                  onDelete={handleDelete}
                  // Affordance exists ONLY while public — absent, not disabled (FR-003).
                  onShare={visibility.isPublic ? (entry) => void sharing.share(entry) : undefined}
                />
              )}
            />
          )}
        </>
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
