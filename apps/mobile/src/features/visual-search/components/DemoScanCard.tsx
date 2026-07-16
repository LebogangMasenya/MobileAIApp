/**
 * DemoScanCard — the Home entry point into Visual Search (specs/008 FR-017;
 * evolved from feature 003's demo entry, same component seam so Home's
 * wiring never changed). Placement-agnostic: the parent decides where it
 * renders and what onPress does, so the entry can move or be retired
 * without touching this file. The 003 demo behavior itself lives on inside
 * the visual-search route's "Try the sample" affordance.
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
        accessibilityLabel="Find any garment with visual search"
        onPress={onPress}
        className="flex-row items-center gap-4 rounded-2xl bg-header p-4 active:opacity-85">
        <Image
          source={require('@/assets/images/demo-garment.jpeg')}
          style={{ width: 56, height: 70, borderRadius: 12 }}
          contentFit="cover"
          accessibilityLabel="Garment photo"
        />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-on-header">Find any garment</Text>
          <Text className="text-sm leading-snug text-on-header-muted">
            Snap a piece — Satori lifts it out and finds it in stores
          </Text>
        </View>
        <Text className="text-lg text-on-header-muted">›</Text>
      </Pressable>
    </Animated.View>
  );
}
