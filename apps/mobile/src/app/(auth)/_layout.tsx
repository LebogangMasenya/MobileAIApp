/**
 * Signed-out group layout — the auth funnel stack (Welcome anchor).
 *
 * Motion note (Constitution V): screen-to-screen transitions here are the
 * native UIKit stack transition, which is spring-driven and gesture-owned by
 * the OS — a half-swipe back is cancellable mid-flight and settles either way
 * with physical momentum. That IS the interruptible behavior FR-020 demands;
 * re-implementing it in JS would only add jank. In-screen content layers its
 * own `springify()` entrances on top (see the individual screens).
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      initialRouteName="welcome"
      screenOptions={{
        headerShown: false,
        // Interactive pop gesture on — mid-transition interruption is a spec
        // requirement, not a nice-to-have (spec edge cases).
        gestureEnabled: true,
        animation: 'slide_from_right',
      }}
    />
  );
}
