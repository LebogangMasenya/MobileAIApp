/**
 * ProductMatchCard — one shoppable result (specs/003 contracts §5).
 *
 * Renders exactly the six contract fields and nothing else; a null price is
 * an explicit "Price unavailable" so the layout never shifts between priced
 * and unpriced cards. Tapping opens the product page in an in-app browser
 * (expo-web-browser) — leaving the app entirely for every tap would make the
 * demo feel like an exit, not a feature.
 */

import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';

import type { ProductMatch } from '@/types/visual-search';

interface ProductMatchCardProps {
  match: ProductMatch;
}

export function ProductMatchCard({ match }: ProductMatchCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.title}, ${match.price ?? 'price unavailable'}, at ${match.store_name}`}
      onPress={() => {
        // Fire-and-forget: a failed browser open is a no-op tap, not a crash.
        void WebBrowser.openBrowserAsync(match.source_url).catch(() => undefined);
      }}
      className="flex-row items-center gap-3 rounded-2xl bg-surface-card p-3 active:opacity-80">
      <Image
        source={{ uri: match.thumbnail }}
        style={{ width: 72, height: 88, borderRadius: 12 }}
        contentFit="cover"
        accessibilityLabel="Product photo"
      />
      <View className="flex-1 gap-1">
        <Text numberOfLines={2} className="text-sm font-semibold text-ink">
          {match.title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-ink-muted">
          {match.store_name}
        </Text>
        <Text className={`text-sm font-semibold ${match.price ? 'text-primary' : 'text-ink-muted'}`}>
          {match.price ?? 'Price unavailable'}
        </Text>
      </View>
      <Text className="text-lg text-ink-muted">›</Text>
    </Pressable>
  );
}
