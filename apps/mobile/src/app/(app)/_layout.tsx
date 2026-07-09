/**
 * Signed-in group layout. The tab UI lives INSIDE the protected group so a
 * sign-out unmounts every authenticated surface in one guard flip
 * (feature 002, research §7). Since feature 003 this is a Stack: the tab
 * group plus full-screen routes that sit OUTSIDE the tab bar (the visual-
 * search demo) — native stack transitions are UIKit spring-driven and
 * gesture-cancellable (Constitution V).
 */

import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="demo-scan" />
    </Stack>
  );
}
