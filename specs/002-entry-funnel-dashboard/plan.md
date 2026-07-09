# Implementation Plan: Entry Funnel & Home Dashboard

**Branch**: `main` (no feature branch in use) | **Date**: 2026-07-08 · **Revised**: 2026-07-09 (mock-provider amendment) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-entry-funnel-dashboard/spec.md` (as amended 2026-07-09)

## Summary

Build the app's complete entry funnel — animated Satori splash → Welcome → Sign-In/Create-Account/Reset — and the signed-in Home dashboard + Account hub, per the approved `figma.pdf` review (11 UX findings D1–D11 folded into requirements). Authentication is served by an **on-device `MockAuthProvider`** behind a narrow **`AuthContract`** session contract (spec FR-022..FR-025, user decision 2026-07-09): a device-local account registry and session token in SecureStore reproduce a managed provider's observable behavior with **zero new dependencies**; real Clerk integration is a follow-up that swaps only the provider implementation. Routing security is declarative: **expo-router `Stack.Protected` guards** mount exactly one of the `(auth)` / `(app)` route groups from the single `useAuthSession()` source of truth, with the splash acting as the bootstrap airlock. All screens are NativeWind-styled; all funnel transitions are interruptible Reanimated springs (Constitution V).

## Technical Context

**Language/Version**: TypeScript (strict, no `any`) on React Native 0.81 / React 19.1 via Expo SDK 54 (managed + custom dev client)

**Primary Dependencies**: expo-router ~6.0 (Stack.Protected/Tabs/NativeTabs), react-native-reanimated ~4.1 (+ react-native-worklets), NativeWind 4, expo-secure-store ~15 (mock registry + session), expo-splash-screen ~31 — **all already installed; this feature adds no packages, no config-plugin changes, no `.env`**

**Storage**: Mock auth registry + session token under versioned SecureStore keys (`satori.auth.accounts.v1`, `satori.auth.session.v1` — Keychain/Keystore-backed, FR-009); recent-scan summaries as a small local JSON store (device-local, no server persistence this feature)

**Testing**: Manual scenario validation via `quickstart.md` (consistent with feature 001 — no automated test suite requested); `tsc --noEmit` + ESLint as hard gates (Constitution Verification Rule)

**Target Platform**: iOS (primary, simulator + device via existing dev client); Android-compatible; web builds must not break (`.web.tsx` variants where needed)

**Project Type**: Mobile app (`apps/mobile`) — no `apps/api` changes; no external service dependencies this feature

**Performance Goals**: 60fps transitions (springs on UI thread via Reanimated worklets); cold-launch-to-Home < 3s for returning users (SC-002); zero signed-out flash frames

**Constraints**: No linear easing anywhere (Constitution V); no `any` types; NativeWind-first styling; mock operations carry simulated latency (~400–900ms) so busy states and idempotence are honestly exercised; the mock is `__DEV__`-scaffold-grade and blocked from any public release (FR-025)

**Scale/Scope**: 6 new screens (Welcome, Sign-In, Sign-Up, Reset, Home, Account), 1 evolved splash, root-layout restructure into 2 route groups, 1 session provider + contract, ~4 new hooks, tab restructure (Explore → Account)

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-checked post-Phase-1 design (both after the 2026-07-09 amendment).*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Clarity Over Assumption | ✅ PASS | Both scope-critical ambiguities halted on and resolved by the user: managed provider (2026-07-08), then mock-for-now (2026-07-09). The mock's observable behavior is fully specified (FR-022..FR-025); what it cannot prove is explicitly bounded in spec Assumptions. |
| II | Design-First Implementation | ✅ PASS | `figma.pdf` (12 pages) reviewed page-by-page; UX critique with 11 findings + ergonomic optimization plan presented in spec and approved by the user before this plan. Amendment changes no visual design. |
| III | Performance First | ✅ PASS | Springs run as Reanimated worklets on the UI thread; splash gate waits on a genuine async SecureStore read without blocking; no JS-side image/canvas work in this feature. |
| IV | Anti-Abstraction Mandate | ⚠️ PASS (one justified abstraction) | The `AuthContract` + `useAuthSession()` seam **is** an abstraction layer — but it is the mechanism FR-024 explicitly requires so the mock can be swapped for a real provider without touching screens. It is narrow (one interface, one hook), owns no logic beyond the provider itself, and is recorded in Complexity Tracking. Everything else consumes framework primitives directly (`Stack.Protected`, Reanimated, SecureStore inside the provider). |
| V | Native-Grade Fluid Motion | ✅ PASS | All funnel transitions specified as interruptible `withSpring` (mass/stiffness/damping tuned); `Easing.linear` banned; splash morph continues from current position on interrupt (spec edge case). |
| VI | Educational Code Architecture | ✅ PASS | Why-comments mandated for the route-guard gate, splash airlock, session-state flow, and the mock's deliberate compromises (plain-text registry password, simulated latency); spec carries the educational Navigation State outline the code comments will mirror. |
| VII | Defensive Error Scaffolding | ✅ PASS | Contract operations wrapped in try/catch with typed `AuthError` → human copy mapping (FR-008); inputs preserved on failure (FR-007); Home data failure fallback (FR-016); corrupt session/store degrade gracefully. |
| VIII | State Isolation | ✅ PASS | Screens stay presentational; session logic lives in `MockAuthProvider`; form flows in `features/auth` hooks; dashboard logic in `features/home` hooks — each independently testable and individually swappable. |

**Post-Phase-1 re-check (after revised data-model/contracts/quickstart)**: all gates still pass; one Complexity Tracking entry (below), fully justified by FR-024.

## Project Structure

### Documentation (this feature)

```text
specs/002-entry-funnel-dashboard/
├── plan.md              # This file (revised 2026-07-09)
├── research.md          # Phase 0 — mock design + routing + motion decisions
├── data-model.md        # Phase 1 — contract read-models, mock internals, state transitions
├── quickstart.md        # Phase 1 — manual validation scenarios (no external accounts needed)
├── contracts/
│   └── auth-navigation.md   # Phase 1 — AuthContract + gate/motion/store contracts
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/mobile/
├── src/
│   ├── app/
│   │   ├── _layout.tsx              # MODIFIED: MockAuthProvider + ThemeProvider + Stack.Protected
│   │   │                            #   gate over (auth)/(app) + splash airlock
│   │   ├── (auth)/                  # NEW: signed-out group
│   │   │   ├── _layout.tsx          #   auth stack (spring screen transitions)
│   │   │   ├── welcome.tsx          #   merged p2+p11 welcome (FR-003) + session-expired notice
│   │   │   ├── sign-in.tsx          #   email/password + simulated Apple/Google (FR-005)
│   │   │   ├── sign-up.tsx          #   create account + inline validation (FR-004)
│   │   │   └── reset-password.tsx   #   enumeration-safe reset (FR-006)
│   │   ├── (app)/                   # NEW: protected group
│   │   │   ├── _layout.tsx          #   NativeTabs: index / scan / account (FR-017)
│   │   │   ├── index.tsx            #   Home dashboard (FR-012..FR-016)
│   │   │   ├── scan.tsx             #   MOVED from src/app/scan.tsx (feature 001, unchanged logic)
│   │   │   └── account.tsx          #   Account hub (FR-018/FR-019) + __DEV__ expire-session row
│   │   ├── explore.tsx              # DELETED (tab retired per spec assumption)
│   │   ├── index.tsx                # DELETED (replaced by (app)/index.tsx)
│   │   └── scan.tsx                 # DELETED (moved into (app)/)
│   ├── features/
│   │   ├── auth/
│   │   │   ├── providers/
│   │   │   │   └── mock-auth-provider.tsx # NEW: MockAuthProvider (registry + session in
│   │   │   │                              #   SecureStore) + useAuthSession() — the ONLY
│   │   │   │                              #   file replaced at real-provider swap (FR-024/FR-025)
│   │   │   ├── components/
│   │   │   │   ├── AuthTextField.tsx      # labeled field + inline validation state
│   │   │   │   ├── AuthSubmitButton.tsx   # keyboard-avoiding busy-state CTA (FR-007, idempotent)
│   │   │   │   ├── SocialSignInRow.tsx    # Apple + Google buttons → contract calls (FR-023)
│   │   │   │   └── AuthErrorNotice.tsx    # inline human-readable errors (FR-008)
│   │   │   └── hooks/
│   │   │       ├── useSignInForm.ts       # form state + contract signIn flow
│   │   │       ├── useSignUpForm.ts       # form state + contract signUp flow
│   │   │       └── usePasswordReset.ts    # enumeration-safe reset flow
│   │   └── home/
│   │       ├── components/
│   │       │   ├── GreetingHeader.tsx     # dark header + personalized greeting (FR-012)
│   │       │   ├── RecentScansRail.tsx    # horizontal rail + See All (FR-013)
│   │       │   ├── EmptyScansState.tsx    # first-run invitation (FR-014)
│   │       │   └── FeatureHighlights.tsx  # "What you will love" rows (FR-014)
│   │       └── hooks/
│   │           ├── useRecentScans.ts      # local scan-summary store + failure fallback
│   │           └── useGreeting.ts         # first-name / time-of-day greeting
│   ├── components/
│   │   ├── animated-icon.tsx        # MODIFIED: evolves into Satori splash morph (FR-001/FR-002)
│   │   ├── app-tabs.tsx             # MODIFIED: Explore→Account trigger, moves under (app)/_layout
│   │   └── app-tabs.web.tsx         # MODIFIED: same tab restructure for web
│   └── types/
│       └── auth.ts                  # NEW: AuthContract, AuthUser, AuthError, UserProfile,
│                                    #   RecentScanSummary
└── (app.json / package.json / .env — UNCHANGED: zero new deps or native config)
```

**Structure Decision**: Extends the established `apps/mobile` feature-module layout from 001 (`features/<domain>/{components,hooks}`), adding a `providers/` folder to `features/auth` for the one swappable piece. The root `src/app/_layout.tsx` becomes the single routing gate; screens move into `(auth)` / `(app)` route groups so protection is structural (group mount/unmount), not per-screen redirects. No `apps/api` changes and no external services.

## Key Design Decisions (details in research.md)

1. **Mock provider now, Clerk later** — user decision 2026-07-09. `MockAuthProvider` reproduces the observable provider contract (registry-backed credential errors, enumeration-safe reset, SecureStore persistence, simulated social consent sheets with a cancel path, simulated latency) with zero new dependencies. Clerk remains the recorded follow-up target (research §1).
2. **The `AuthContract` seam** — one interface + one hook (`useAuthSession()`) is the entire abstraction; screens, gate, and hooks never see provider internals, making the future swap a one-file replacement (FR-024). Deliberate, justified Constitution-IV exception (Complexity Tracking).
3. **`Stack.Protected` gate** — guard flips remove the other group's history entries automatically, making FR-010's back-gesture guarantee structural. Anchor = `(auth)/welcome` when signed out, `(app)/index` when signed in.
4. **Splash airlock** — `expo-splash-screen` holds the native splash; the evolved `AnimatedSplashOverlay` (Satori wordmark + indeterminate shimmer) renders until the provider reports `isLoaded` (a genuine async SecureStore read), then spring-morphs away revealing whichever group the guard mounted. No signed-out flash (SC-002).
5. **Recent scans stay device-local** — feature 001's backend session store is in-memory/anonymous; Home reads a small local JSON store of scan summaries written when scans complete. Server-side per-user history is deferred (future work, alongside real auth).
6. **Transitions** — auth stack screen changes use spring-configured native stack animations; the gate crossing (auth↔app) animates via the splash-morph overlay pattern with `withSpring`, interruptible by design since the guard state, not the animation, owns which group is mounted.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `AuthContract` + `useAuthSession()` wrapper (Constitution IV normally bans abstraction layers over frameworks) | FR-024 mandates that swapping the mock for the real managed provider touches no screen or navigation code — impossible if screens call mock functions directly | Screens calling `MockAuthProvider` internals directly would smear mock-specific code across 7+ files, turning the provider swap into a full-funnel refactor and multiplying regression risk at exactly the moment real credentials arrive |
