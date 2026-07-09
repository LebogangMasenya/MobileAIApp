/**
 * SocialSignInRow — Apple + Google one-tap entries (FR-005/FR-023).
 *
 * A `'cancelled'` result is simply ignored: dismissing the consent sheet is a
 * deliberate act, so the user returns to the form exactly as they left it —
 * no toast, no error state (spec edge case "cancelled social sign-in").
 * Success needs no handling either: the session flip re-routes the whole app
 * through the root guards (G4 — no navigation calls here).
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAuthSession } from '@/features/auth/providers/mock-auth-provider';

type SocialProvider = 'apple' | 'google';

export function SocialSignInRow() {
  const { signInWithApple, signInWithGoogle } = useAuthSession();
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const run = async (provider: SocialProvider) => {
    if (busy) return; // one sheet at a time — idempotent under double-tap (C1)
    setBusy(provider);
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
    } catch {
      // Social flows fail closed and silently back to the form; typed errors
      // are an email/password concern (contract §4).
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-line" />
        <Text className="text-xs uppercase tracking-widest text-ink-muted">or</Text>
        <View className="h-px flex-1 bg-line" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in with Apple"
        disabled={busy !== null}
        onPress={() => run('apple')}
        className="min-h-12 flex-row items-center justify-center gap-2 rounded-full bg-ink active:opacity-80">
        {busy === 'apple' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-base font-semibold text-surface-card"> Continue with Apple</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in with Google"
        disabled={busy !== null}
        onPress={() => run('google')}
        className="min-h-12 flex-row items-center justify-center gap-2 rounded-full border border-line bg-surface-card active:bg-surface-dim">
        {busy === 'google' ? (
          <ActivityIndicator color="#6C4AB0" />
        ) : (
          <Text className="text-base font-semibold text-ink">G Continue with Google</Text>
        )}
      </Pressable>
    </View>
  );
}
