/**
 * DemoScanCard — the Home entry point into the visual-search demo (FR-011).
 * Placement-agnostic (parent decides where it renders and what onPress does)
 * so the demo entry can move or be retired without touching this file.
 */

import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface DemoScanCardProps {
  onPress: () => void;
}

export function DemoScanCard({ onPress }: DemoScanCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(140).springify().mass(0.8).damping(18).stiffness(160)}
      className="px-6">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try a demo scan"
        onPress={onPress}
        className="flex-row items-center gap-4 rounded-2xl bg-header p-4 active:opacity-85">
        <Image
          source={require('@/assets/images/demo-garment.jpeg')}
          style={{ width: 56, height: 70, borderRadius: 12 }}
          contentFit="cover"
          accessibilityLabel="Demo outfit"
        />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-on-header">Try a demo scan</Text>
          <Text className="text-sm leading-snug text-on-header-muted">
            Watch Satori find this outfit in real stores
          </Text>
        </View>
        <Text className="text-lg text-on-header-muted">›</Text>
      </Pressable>
    </Animated.View>
  );
}
