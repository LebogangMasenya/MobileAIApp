/**
 * Welcome — the funnel's front door (FR-003; figma p2+p11 merged per D10).
 *
 * Design decisions carried from the spec's UX critique:
 * - Both CTAs are full-width, ≥48pt, stacked in the LOWER THUMB ARC — the
 *   original p2 "Login" text link was a sub-44pt target in the thumb's dead
 *   zone (D7), so it's a ghost button now.
 * - Copy says "Get started" — the p11 "Get Startef" typo dies here (D3).
 * - Background matches the splash's `header` dark, so the splash's spring
 *   morph reveals a visually continuous scene (no hard cut — FR-001).
 */

import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthErrorNotice } from '@/features/auth/components/AuthErrorNotice';
import { useAuthSession } from '@/features/auth/providers/mock-auth-provider';

// One spring family for the whole screen so the staggered blocks feel like
// one gesture, not three animations (Constitution V).
const enterSpring = (delayMs: number) =>
  FadeInDown.delay(delayMs).springify().mass(0.8).damping(18).stiffness(160);

export default function WelcomeScreen() {
  const router = useRouter();
  const { sessionExpired } = useAuthSession();

  return (
    <View className="flex-1 bg-header">
      <SafeAreaView className="flex-1 px-6">
        {/* US2 scenario 2: restoration found an invalid session — say so
            gently, right where the user can act on it. */}
        <View className="pt-4">
          <AuthErrorNotice
            tone="gentle"
            message={sessionExpired ? 'You were signed out. Please log in again to continue.' : null}
          />
        </View>

        <Animated.View entering={enterSpring(0)} className="flex-1 justify-center gap-5">
          <Text className="text-xs uppercase tracking-[4px] text-on-header-muted">Satori</Text>
          <Text className="font-serif text-4xl leading-tight text-on-header">
            The world is your wardrobe.{'\n'}Spot it. Scan it. Satori it.
          </Text>
          <Text className="text-base leading-relaxed text-on-header-muted">
            Your favourite fashion companion. Point your camera at any outfit and shop the look in
            seconds.
          </Text>
        </Animated.View>

        {/* The action block owns the bottom 40% — the natural one-handed arc. */}
        <Animated.View entering={enterSpring(90)} className="gap-3 pb-6">
          <Text className="text-center text-xs uppercase tracking-[3px] text-on-header-muted">
            Get started
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sign-up')}
            className="min-h-[52px] items-center justify-center rounded-full bg-primary active:bg-primary-pressed">
            <Text className="text-base font-semibold text-on-primary">Create account</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sign-in')}
            className="min-h-[52px] items-center justify-center rounded-full border border-on-header-muted/50 active:bg-on-header/10">
            <Text className="text-base font-semibold text-on-header">Log in</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
