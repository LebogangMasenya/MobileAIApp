/**
 * RegionPreferenceSettings (T034) — view/change the region override (FR-010a).
 *
 * Receives the preference + mutators as props instead of calling
 * useRegionPreference itself: the scan screen must hold the ONE hook
 * instance whose value feeds scan requests. A second instance here would
 * have its own state and the settings UI could drift from what scans
 * actually send.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';

import type { RegionPreference } from '../../../types/scan';

export interface RegionPreferenceSettingsProps {
  preference: RegionPreference;
  onSetRegion: (region: string) => void;
  onClearOverride: () => void;
}

/**
 * A starter set, not a product decision: the matching provider determines
 * true coverage. The user's inferred region is always injected on top, so
 * nobody's own region is ever missing from the list.
 */
const COMMON_REGIONS: { code: string; label: string }[] = [
  { code: 'ZA', label: 'South Africa' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'KE', label: 'Kenya' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
  { code: 'JP', label: 'Japan' },
];

export function RegionPreferenceSettings({
  preference,
  onSetRegion,
  onClearOverride,
}: RegionPreferenceSettingsProps) {
  const regions = COMMON_REGIONS.some((entry) => entry.code === preference.region)
    ? COMMON_REGIONS
    : [{ code: preference.region, label: preference.region }, ...COMMON_REGIONS];

  return (
    <View className="rounded-3xl bg-neutral-900 p-5">
      <Text className="text-lg font-semibold text-white">Shopping region</Text>
      <Text className="mt-1 text-sm leading-5 text-neutral-400">
        {preference.source === 'inferred'
          ? `Detected from your device settings (${preference.region}).`
          : `You chose ${preference.region}.`}{' '}
        Store availability is filtered to this region. Applies to your next scan.
      </Text>

      <ScrollView className="mt-4 max-h-72">
        {regions.map((entry) => {
          const selected = entry.code === preference.region;
          return (
            <Pressable
              key={entry.code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSetRegion(entry.code)}
              className={
                selected
                  ? 'mb-2 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3'
                  : 'mb-2 flex-row items-center justify-between rounded-2xl bg-neutral-800 px-4 py-3 active:bg-neutral-700'
              }>
              <Text className={selected ? 'text-base font-semibold text-black' : 'text-base text-white'}>
                {entry.label}
              </Text>
              <Text className={selected ? 'text-sm font-medium text-black' : 'text-sm text-neutral-400'}>
                {entry.code}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {preference.source === 'user_override' ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearOverride}
          className="mt-3 min-h-11 items-center justify-center rounded-full px-4 py-2.5 active:opacity-60">
          <Text className="text-sm font-medium text-neutral-300">Use my device region instead</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
