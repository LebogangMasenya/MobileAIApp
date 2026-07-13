/**
 * VaultEmptyState (specs/005 FR-015) — the vault's designed empty and error
 * states. A brand-new vault teaches the ritual; an unreadable index offers
 * retry — neither is ever a blank grid (Constitution VII).
 */

import { Pressable, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface VaultEmptyStateProps {
  variant: 'empty' | 'error';
  onRetry?: () => void;
}

export function VaultEmptyState({ variant, onRetry }: VaultEmptyStateProps) {
  return (
    <Animated.View
      entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
      className="mx-6 items-center gap-3 rounded-3xl bg-surface-card px-6 py-10">
      <Text className="text-4xl">{variant === 'empty' ? '🗄️' : '⚠️'}</Text>
      <Text className="text-center text-lg font-semibold text-ink">
        {variant === 'empty' ? 'Your scans live here' : "Couldn't open your vault"}
      </Text>
      <Text className="text-center text-sm leading-relaxed text-ink-muted">
        {variant === 'empty'
          ? 'Every look you scan is saved automatically. Swipe back up and scan your first outfit.'
          : 'Something went wrong reading your saved looks. Your data may still be intact — try again.'}
      </Text>
      {variant === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-1 min-h-12 items-center justify-center self-stretch rounded-full bg-primary px-6 active:bg-primary-pressed">
          <Text className="text-base font-semibold text-on-primary">Retry</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
