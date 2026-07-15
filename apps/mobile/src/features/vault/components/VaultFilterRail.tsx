/**
 * VaultFilterRail (specs/007 US4, contracts/vault-surfaces §3) — the smart
 * defaults surface. Category chips derived from the user's OWN stored
 * garments, ordered by Style Profile weight, with the top category
 * pre-selected when (and only when) the profile is genuinely personalized.
 *
 * FR-011's "no extra steps" rule shapes the layout: "All" is always the
 * first chip, so escaping the smart preselect is one tap — the smart
 * default is a head start, never a cage. The micro-copy line under the rail
 * is gated by `personalized` so it can never claim history the user doesn't
 * have (SC-007).
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { StyleProfile } from '@/features/vault/utils/style-profile';

interface VaultFilterRailProps {
  profile: StyleProfile;
  /** null = "All" (no filter). */
  selected: string | null;
  onSelect: (category: string | null) => void;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      // Selected = solid plum, unselected = dim surface — the same
      // primary/surface-dim contrast pair the rest of the app speaks.
      className={
        active
          ? 'min-h-9 items-center justify-center rounded-full bg-primary px-4 py-1.5 active:bg-primary-pressed'
          : 'min-h-9 items-center justify-center rounded-full bg-surface-dim px-4 py-1.5 active:bg-line'
      }>
      <Text className={active ? 'text-sm font-semibold text-on-primary' : 'text-sm text-ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VaultFilterRail({ profile, selected, onSelect }: VaultFilterRailProps) {
  // Nothing to filter by ⇒ no rail. (The empty-vault scene belongs to the
  // welcome journey; this guard also covers vaults of v1-migrated entries
  // whose garments are honestly unknown.)
  if (profile.categories.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
      className="gap-1.5 pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}>
        <Chip label="All" active={selected === null} onPress={() => onSelect(null)} />
        {profile.categories.map(({ category }) => (
          <Chip
            key={category}
            label={category}
            active={selected === category}
            onPress={() => onSelect(category)}
          />
        ))}
      </ScrollView>
      {/* Truthful acknowledgment (FR-011): the claim matches the data source. */}
      <View className="px-6">
        <Text className="text-xs text-ink-muted">
          {profile.personalized
            ? 'Smart-picked from your recent scans'
            : `Fresh picks for ${profile.season}`}
        </Text>
      </View>
    </Animated.View>
  );
}
