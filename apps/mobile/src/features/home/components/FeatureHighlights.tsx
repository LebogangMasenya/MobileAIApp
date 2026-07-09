/**
 * FeatureHighlights — the "What you will love" rows from figma p3.
 * Rendered ONLY alongside the empty state (critique D9): they double as
 * onboarding for a user with no content, and yield the prime dashboard space
 * to real scan history the moment it exists.
 */

import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const HIGHLIGHTS = [
  {
    icon: '📸',
    title: 'Spot any garment',
    body: 'Scan outfits from the street, a screen, or your camera roll.',
  },
  {
    icon: '🛍️',
    title: 'Shop the exact match',
    body: 'We find the store listing — or the closest look-alikes.',
  },
  {
    icon: '🌍',
    title: 'Made for your region',
    body: 'Matches are filtered to stores that actually ship to you.',
  },
] as const;

export function FeatureHighlights() {
  return (
    <View className="gap-3 px-6">
      <Text className="text-lg font-semibold text-ink">What you will love</Text>
      {HIGHLIGHTS.map((highlight, index) => (
        <Animated.View
          key={highlight.title}
          entering={FadeInDown.delay(80 + index * 70)
            .springify()
            .mass(0.8)
            .damping(18)
            .stiffness(160)}
          className="flex-row items-center gap-4 rounded-2xl bg-surface-card px-4 py-4">
          <Text className="text-2xl">{highlight.icon}</Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold text-ink">{highlight.title}</Text>
            <Text className="text-sm leading-snug text-ink-muted">{highlight.body}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
