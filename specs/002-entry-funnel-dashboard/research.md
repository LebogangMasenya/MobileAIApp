# Research: Entry Funnel & Home Dashboard

**Date**: 2026-07-08 · **Revised**: 2026-07-09 (mock-provider amendment) · **Feature**: 002-entry-funnel-dashboard

All Technical Context unknowns resolved below. Sources verified against the installed dependency versions (`expo ~54.0.0`, `expo-router ~6.0.24`, `react-native-reanimated ~4.1.1`, `nativewind ^4.2.6`, `expo-secure-store ~15.0.8`).

## 1. Auth provider strategy *(revised 2026-07-09)*

- **Decision**: **On-device simulated provider (`MockAuthProvider`)** behind a narrow session contract (`AuthContract`, consumed via `useAuthSession()`). No provider SDK, account, dashboard, or API keys this release (user decision 2026-07-09; spec FR-022..FR-025). **Zero new dependencies** — the mock persists to the already-installed `expo-secure-store`.
- **Rationale**:
  - Unblocks the entire funnel build immediately: no Clerk application setup, no `.env` secrets, no new native modules, no dev-client rebuild for auth reasons.
  - Every user-visible behavior in the spec remains genuinely testable: the mock keeps a device-local **account registry**, so wrong-password and unknown-account attempts produce real FR-008 error states; sessions persist/restore/purge through SecureStore exactly per FR-009/FR-010; the splash airlock waits on a *real* async restoration read.
  - The gate architecture (research §2–3) is unchanged — it consumes `isLoaded`/`isSignedIn` booleans and never cared where they came from.
- **The swap seam**: screens and the root gate consume only `useAuthSession(): AuthContract`. The follow-up provider feature replaces `MockAuthProvider` with a Clerk-backed adapter implementing the same contract — no screen or navigation code changes (FR-024).
- **Deferred provider target (recorded from the 2026-07-08 analysis, still the pick)**: **Clerk** via `@clerk/expo` v3 — SDK 54-verified, SecureStore token cache, native `useSignInWithApple`/`useSignInWithGoogle`, free 10k MAU tier. Alternatives (Supabase Auth, Firebase Auth, Auth0, own-API) evaluated 2026-07-08; rankings unchanged. That integration is now a separate follow-up feature.
- **What the mock deliberately does not prove**: real credential verification, actual reset emails, genuine Apple/Google identity, cross-device sessions, offline/outage behavior — bounded in the spec's Assumptions.

## 1b. Mock provider design

- **Decision**: A single `MockAuthProvider` React context provider in `src/features/auth/providers/`, with all persistence under versioned SecureStore keys:
  - `satori.auth.accounts.v1` — JSON array of registered accounts `{ id, email, password, firstName, createdAt }`
  - `satori.auth.session.v1` — `{ token, userId }` (token is a random opaque string; "restoration" = read + match against the registry)
- **Behavior mapping** (contract → FR):
  - `signUp`: validates email shape + ≥8-char password (mirrors form-layer rules), rejects duplicate emails (`email-taken`), writes registry + session (FR-004, FR-022).
  - `signIn`: looks up email in the registry; unknown account or password mismatch → `invalid-credentials` (never reveals which — same copy, FR-008).
  - `signInWithApple`/`signInWithGoogle`: presents a native `Alert` styled as a consent sheet ("Continue as Demo User" / "Cancel") after a brief busy state; Continue signs in a canned demo identity, Cancel resolves `'cancelled'` so the silent-return edge case is exercisable (FR-023).
  - `requestPasswordReset`: always resolves to the identical confirmation after the same delay — enumeration-safe by construction, no mail sent (FR-006/FR-022).
  - `signOut`: deletes the session key only (registry survives so re-sign-in works — US2 scenario 4), guard flips (FR-009/FR-010).
  - **Expired-session simulation**: a `__DEV__`-only "Expire session (dev)" row on the Account screen corrupts the stored token, so US2 scenario 2 ("please sign in again") is exercisable on demand.
- **Plain-text password note**: acceptable **only** because this is a hardware-backed, device-local dev scaffold that can never ship as production auth (FR-025); real verification is provider-side after the swap. An educational comment in the mock states this explicitly (Constitution VI).
- **Simulated latency**: each operation awaits a short randomized delay (~400–900ms) so busy states, double-tap idempotence, and transition timing are honestly exercised — instant resolution would hide real UI bugs.
- **Alternatives considered**:
  - **Integrate Clerk now** — declined by the user 2026-07-09 (external account setup friction); recorded as the follow-up.
  - **Hardcoded "always signed in" bypass** — rejected: proves nothing about the funnel, forms, or gate (US1 untestable).
  - **In-memory-only mock (no SecureStore)** — rejected: US2 (session persistence across relaunch) would be untestable and the airlock would have nothing real to wait on.

## 2. Route protection mechanism (Auth Stack → Main App Stack)

- **Decision**: **expo-router `Stack.Protected`** guards in the root layout, wrapping two route groups: `(auth)` guarded by `!isSignedIn`, `(app)` guarded by `isSignedIn`, with **`useAuthSession()` as the single session source of truth** (FR-011/FR-024).
- **Rationale**:
  - Protected routes are the SDK-53+ recommended pattern (our SDK 54 / expo-router ~6 fully supports it, including `Tabs.Protected`).
  - **Guard-flip semantics match FR-010 exactly**: when a guard turns false, the user is redirected to the anchor route and *all of that group's history entries are removed* — the back gesture cannot re-enter the other world because those screens no longer exist in history. This is the "replace, don't push" behavior from the spec's educational outline, provided structurally by the router.
  - Declarative guards eliminate scattered imperative `router.replace()` calls — one gate, evaluated on every session-state change (sign-in, sign-out, expiry).
  - Client-side only (documented limitation) — acceptable because there is no server-rendered surface; server-side authorization arrives with the real provider + per-user API data (out of scope).
- **Alternatives considered**:
  - **Redirect-based auth** (`useRootNavigationState` + `<Redirect>`) — the pre-SDK-53 pattern; more code, easy to leak a frame of the wrong screen, history must be managed manually. Superseded by Protected routes.
  - **Conditional rendering of navigators in `_layout`** (classic React Navigation `isSignedIn ? <AppStack/> : <AuthStack/>`) — works, but bypasses expo-router's file-based conventions and loses deep-link handling for free.

## 3. Splash airlock & bootstrap sequencing

- **Decision**: Keep the native splash visible via `SplashScreen.preventAutoHideAsync()` (already in `_layout.tsx`), render the evolved Satori `AnimatedSplashOverlay` on top of the gate, and dismiss it with a spring morph only when the session provider reports `isLoaded` (the mock's SecureStore restoration read has completed).
- **Rationale**: The guard must not render either group until the session answer is known — this is the spec's "airlock" (FR-001, SC-002 zero signed-out flash). The mock's restoration is a genuine async read, so the airlock mechanism is exercised for real and survives the provider swap untouched. The shimmer is indeterminate (FR-002) because restoration has no meaningful progress fraction.
- **Alternatives considered**: resolving `isLoaded` synchronously in the mock — rejected: it would mask airlock bugs that surface the moment a real provider (with slower restoration) is swapped in.

## 4. Transition motion architecture (Constitution V)

- **Decision**: Three motion layers, all Reanimated 4 springs (`react-native-worklets` already installed):
  1. **Splash → first screen**: overlay morph driven by `withSpring` on shared values (scale/opacity/translate), continuing from current position if interrupted.
  2. **Within the auth stack** (Welcome→Sign-In etc.): native stack transitions with spring-configured animation specs — no linear curves.
  3. **Across the gate** (auth↔app): the guard swap is instant at the router level; visual continuity comes from a short spring-driven cross-morph (departing screen's hero element scales/fades out as the arriving group's content springs in via `entering` animations with `.springify()`).
- **Rationale**: The mounted group is always owned by state, never by animation progress — an interrupted spring can't strand the user "between stacks" (spec edge case). All springs run as UI-thread worklets (Constitution III).
- **Alternatives considered**: fully custom shared-element transition across the gate — rejected as over-engineering (Anti-Abstraction Mandate); the morph-overlay pattern achieves the Apple-tier feel with framework primitives.

## 5. Recent scans data source for Home

- **Decision**: Device-local JSON store of `RecentScanSummary` records (thumbnail URI, date, garment count, scan id), written by the scan flow on completion and read by `useRecentScans`; capped (e.g., 20 newest).
- **Rationale**: Feature 001's backend `sessionStore` is in-memory and anonymous — there is no server-side per-user history to query yet. A local store delivers FR-013/FR-014 truthfully without inventing unplanned backend scope. When accounts gain server-side history, `useRecentScans` is the single swap point (Constitution VIII).
- **Alternatives considered**:
  - Extend `apps/api` with per-user scan history now — rejected: requires real auth + a database — a feature of its own.
  - Query the in-memory backend store — rejected: summaries would vanish on every server restart; dishonest UX.

## 6. NativeWind on the new screens

- **Decision**: All new views styled with NativeWind 4 utility classes (already configured: `nativewind/babel` preset + `jsxImportSource` in `babel.config.js`); the design's palette (lavender surface, plum primary, dark header) is encoded as Tailwind theme tokens in `tailwind.config.js` so screens reference semantic names (`bg-surface`, `bg-primary`) rather than hex literals.
- **Rationale**: Constitution Technology Stack mandate; semantic tokens keep the figma palette consistent across the 6 new screens and both themes.
- **Alternatives considered**: continuing the 001 pattern of `Colors` constant + `StyleSheet` — rejected for new surfaces (constitution restricts `StyleSheet.create` to edge cases NativeWind can't express; existing 001 screens are not retro-styled in this feature).

## 7. Tab restructure mechanics

- **Decision**: Move `NativeTabs` into `(app)/_layout.tsx`; triggers become `index` (Home), `scan`, `account` — Explore retired (spec assumption, D4 label standardized to "Scan"). Web keeps its `expo-router/ui` `Tabs` variant with the same three routes.
- **Rationale**: Tabs must live inside the protected group so the entire tab UI unmounts on sign-out; keeping the existing `NativeTabs`/web split preserves 001's working pattern.
- **Alternatives considered**: keeping tabs at root with per-tab guards — rejected: leaves tab chrome visible to signed-out users and splits the gate across layers.

## Sources

- [Expo Router: Protected routes](https://docs.expo.dev/router/advanced/protected/) — guard semantics, history removal, Tabs.Protected
- [Expo Router: Authentication](https://docs.expo.dev/router/advanced/authentication/) — session-context pattern (the mock follows this shape)
- [Expo blog: Simplifying auth flows with protected routes](https://expo.dev/blog/simplifying-auth-flows-with-protected-routes)
- [expo-secure-store docs](https://docs.expo.dev/versions/latest/sdk/securestore/) — Keychain/Keystore backing for the mock's keys
- Deferred-provider analysis of 2026-07-08 (Clerk vs Supabase/Firebase/Auth0) retained in git history of this file for the follow-up feature.
