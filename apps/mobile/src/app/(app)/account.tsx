/**
 * Account hub (FR-018/FR-019; figma p4).
 *
 * - Initials avatar: the mock never supplies an image URL, so the fallback
 *   path renders for every account (data-model.md) — exactly what we want to
 *   have hardened before real avatars arrive.
 * - Rows are ≥56pt with chevrons; unbuilt destinations answer with a
 *   "coming soon" notice — zero dead taps (FR-019).
 * - Sign Out is visually separated at the LIST BOTTOM (ergonomic ground
 *   rules: destructive/rare actions live away from the browse flow), asks for
 *   confirmation, and on confirm the contract purge + guard flip do the rest —
 *   no navigation code here (G4).
 * - `__DEV__`-only "Expire session" row corrupts the stored token so the next
 *   launch exercises US2's "please sign in again" path (research §1b).
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { devExpireSession, useAuthSession } from '@/features/auth/providers/mock-auth-provider';
import type { AuthUser } from '@/types/auth';

const ACCOUNT_ROWS = [
  { icon: '👤', label: 'Contact Info' },
  { icon: '🔒', label: 'Privacy Settings' },
  { icon: '🎛️', label: 'Preferences' },
  { icon: '🔗', label: 'Link Social Media' },
  { icon: '⚙️', label: 'Settings' },
] as const;

// UserProfile derivations (data-model.md) — computed, never stored.
function initialsFor(user: AuthUser): string {
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  if (first) return (first + last).toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}

function displayNameFor(user: AuthUser): string {
  if (user.firstName) {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
  }
  return user.email.split('@')[0];
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthSession();
  const [signingOut, setSigningOut] = useState(false);

  // The guard guarantees a session while this screen is mounted; the null
  // branch only covers the unmount frame right after sign-out.
  if (!user) return null;

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut(); // purge + guard flip; (app) unmounts with history removal
          } catch {
            setSigningOut(false);
            Alert.alert('Sign out failed', 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: BottomTabInset + 32,
          paddingHorizontal: 24,
          gap: 24,
        }}>
        {/* Profile header — avatar (initials fallback), name truncates without shifting layout. */}
        <Animated.View
          entering={FadeInDown.springify().mass(0.8).damping(18).stiffness(160)}
          className="items-center gap-3">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
            <Text className="text-2xl font-semibold text-on-primary">{initialsFor(user)}</Text>
          </View>
          <View className="items-center gap-0.5">
            <Text numberOfLines={1} className="max-w-full font-serif text-2xl text-ink">
              {displayNameFor(user)}
            </Text>
            <Text numberOfLines={1} className="text-sm text-ink-muted">
              {user.email}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).springify().mass(0.8).damping(18).stiffness(160)}
          className="overflow-hidden rounded-3xl bg-surface-card">
          {ACCOUNT_ROWS.map((row, index) => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={() =>
                Alert.alert(row.label, 'This section is coming soon — nothing here yet.')
              }
              // min-h-14 = 56pt rows (ergonomic ground rules / SC-007).
              className={`min-h-14 flex-row items-center gap-3 px-4 active:bg-surface-dim ${
                index > 0 ? 'border-t border-line' : ''
              }`}>
              <Text className="text-lg">{row.icon}</Text>
              <Text className="flex-1 text-base text-ink">{row.label}</Text>
              <Text className="text-lg text-ink-muted">›</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Separated destructive zone. */}
        <View className="gap-3">
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={confirmSignOut}
            className="min-h-14 flex-row items-center justify-center gap-2 rounded-3xl border border-danger/30 bg-danger-surface active:opacity-80">
            {signingOut ? (
              <ActivityIndicator color="#B3261E" />
            ) : (
              <Text className="text-base font-semibold text-danger">Sign Out</Text>
            )}
          </Pressable>

          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await devExpireSession();
                Alert.alert(
                  'Session expired (dev)',
                  'The stored token is now invalid. Relaunch the app to see the “please sign in again” flow.',
                );
              }}
              className="min-h-14 items-center justify-center rounded-3xl border border-dashed border-line">
              <Text className="text-sm text-ink-muted">Expire session (dev)</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
