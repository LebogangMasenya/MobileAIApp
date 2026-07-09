/**
 * GreetingHeader — the dark dashboard header from figma p3 (FR-012).
 * Extends behind the status bar (safe-area padding, not SafeAreaView) so the
 * dark surface reaches the physical top edge; the screen flips the status-bar
 * style while focused to keep its text legible on the dark ground.
 * `numberOfLines={1}` on the greeting: very long names truncate, they never
 * wrap into layout shift (spec edge case).
 */

import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGreeting } from '@/features/home/hooks/useGreeting';

export function GreetingHeader() {
  const insets = useSafeAreaInsets();
  const { headline } = useGreeting();

  return (
    <View style={{ paddingTop: insets.top + 12 }} className="rounded-b-3xl bg-header px-6 pb-7">
      <Animated.View
        entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
        className="gap-1">
        <Text numberOfLines={1} className="font-serif text-3xl text-on-header">
          {headline}
        </Text>
        <Text className="text-sm text-on-header-muted">Spot it. Scan it. Satori it.</Text>
      </Animated.View>
    </View>
  );
}
