/**
 * Root layout — THE routing gate (specs/002 contracts §2, spec Navigation
 * State outline).
 *
 * How the signed-out and signed-in worlds stay separated:
 *
 * 1. TWO ROUTE GROUPS, ONE GATE — `(auth)` and `(app)` each hold only their
 *    own screens. `Stack.Protected` guards decide which group is mounted, and
 *    the decision is DECLARATIVE: the guards re-evaluate on every session
 *    change, so no imperative `router.replace()` call anywhere can leave both
 *    worlds reachable at once (G1).
 * 2. ONE SESSION KEY — the guards read `useAuthSession()` and nothing else.
 *    Sign-in, sign-out, and expiry all flow through the same booleans, so a
 *    session change anywhere re-routes the whole app consistently (FR-011).
 * 3. REPLACE, DON'T PUSH — when a guard flips, expo-router removes the other
 *    group's history entries. The back gesture can't re-enter the funnel
 *    after sign-in (or the app after sign-out) because those screens no
 *    longer exist in history — structural, not a disabled back button (G2).
 * 4. TOKENS RIDE IN THE VAULT — screens ask "am I signed in?"; tokens live in
 *    SecureStore behind the provider and never travel as params/props (G3).
 * 5. THE SPLASH IS THE AIRLOCK — until `isLoaded`, the Stack isn't rendered at
 *    all and the overlay covers everything, so neither world can flash before
 *    the session answer is known (FR-001, SC-002).
 */

// Theming primitives live in React Navigation, NOT expo-router. Importing them
// from 'expo-router' yields `undefined` and a "displayName of undefined" crash.
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { MockAuthProvider, useAuthSession } from '@/features/auth/providers/mock-auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    // The ONE provider swap point: when real auth lands, MockAuthProvider is
    // replaced here and everything below keeps compiling (FR-024).
    <MockAuthProvider>
      <RootGate />
    </MockAuthProvider>
  );
}

/** Protected destinations a deep link may target (contract G5). */
const APP_DEEP_LINK_PATHS = ['/', '/scan', '/account'] as const;
type AppDeepLinkPath = (typeof APP_DEEP_LINK_PATHS)[number];

function toAppPath(url: string): AppDeepLinkPath | null {
  const path = `/${Linking.parse(url).path ?? ''}`.replace(/\/+$/, '') || '/';
  return (APP_DEEP_LINK_PATHS as readonly string[]).includes(path) ? (path as AppDeepLinkPath) : null;
}

function RootGate() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuthSession();

  // DEEP LINKS QUEUE AT THE GATE (G5, spec outline §6). Verified behavior of
  // expo-router protected routes: a link into a guarded group while the guard
  // is false redirects to the active anchor and is NOT replayed when the
  // guard later flips — so we remember the intended destination ourselves and
  // deliver it (replace, not push) right after sign-in.
  const url = Linking.useURL();
  const pendingDeepLink = useRef<AppDeepLinkPath | null>(null);

  useEffect(() => {
    if (url && isLoaded && !isSignedIn) {
      pendingDeepLink.current = toAppPath(url);
    }
  }, [url, isLoaded, isSignedIn]);

  useEffect(() => {
    if (isSignedIn && pendingDeepLink.current) {
      const target = pendingDeepLink.current;
      pendingDeepLink.current = null;
      router.replace(target);
    }
  }, [isSignedIn, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Airlock: no Stack until restoration answers — there is literally no
          frame in which the wrong group could render (point 5 above). */}
      {isLoaded ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack>
      ) : null}
      {/* Rendered last = on top. Holds until `isLoaded`, then spring-morphs
          away to reveal whichever group the guards mounted (FR-001/FR-002). */}
      <AnimatedSplashOverlay ready={isLoaded} />
    </ThemeProvider>
  );
}
