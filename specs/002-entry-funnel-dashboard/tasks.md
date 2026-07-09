# Tasks: Entry Funnel & Home Dashboard

**Input**: Design documents from `/specs/002-entry-funnel-dashboard/` (as revised 2026-07-09 — mock-provider amendment)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-navigation.md, quickstart.md

**Tests**: Not requested — validation is manual via `quickstart.md` scenarios plus the constitution's hard gates (`npx tsc --noEmit && npx expo lint`, zero errors). Explicit verification tasks are placed at each checkpoint instead of automated test tasks.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) so each story is an independently testable increment. All paths are relative to `apps/mobile/` unless stated otherwise. **No external accounts, API keys, `.env`, or new dependencies anywhere in this list** — auth is the on-device `MockAuthProvider` (FR-022..FR-025).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (auth funnel), US2 (returning user), US3 (Home dashboard), US4 (Account hub)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Design tokens — the only setup this feature needs (zero new packages or native config).

- [X] T001 Encode the figma palette as semantic tokens in `apps/mobile/tailwind.config.js` theme extension — e.g. `surface` (lavender), `primary` (plum), `header` (dark), plus text-on-dark variants — so all new screens reference `bg-surface`/`bg-primary`, never hex literals (research §6)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The session contract + mock provider, the route-group gate, splash airlock, tab restructure, and shared types. Every user story mounts inside this skeleton.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create `src/types/auth.ts`: `AuthContract` interface exactly per contracts §1 (isLoaded, isSignedIn, user, signUp, signIn, signInWithApple/Google returning `'completed' | 'cancelled'`, requestPasswordReset, signOut), `AuthUser`, typed `AuthError` with codes (`invalid-credentials`, `email-taken`, `invalid-email`, `weak-password`, `unknown`), `UserProfile`, `RecentScanSummary` + versioned store envelope (`{ v: 1, scans: [...] }`) per data-model.md — strict types, no `any`
- [X] T003 Create `src/features/auth/providers/mock-auth-provider.tsx`: `MockAuthProvider` context + `useAuthSession()` hook implementing `AuthContract` — account registry under SecureStore key `satori.auth.accounts.v1`, session `{ token, userId }` under `satori.auth.session.v1`; async restoration on mount drives `isLoaded`; `signIn` validates against the registry (unknown account and wrong password both reject `invalid-credentials`); `signUp` rejects duplicates with `email-taken`; `requestPasswordReset` always resolves identically after the same delay; `signInWithApple`/`Google` present an Alert-based simulated consent sheet ("Continue as Demo User" / "Cancel" → `'cancelled'`); every operation awaits ~400–900ms simulated latency; export a dev-only `expireSession()` that corrupts the stored token. Educational why-comments for the plain-text-password compromise (FR-025) and the contract seam (research §1b, Constitution VI)
- [X] T004 Restructure `src/app/_layout.tsx` into the root gate: wrap the tree in `MockAuthProvider` + `ThemeProvider`, then a `Stack` containing `<Stack.Protected guard={!isSignedIn}>` around the `(auth)` group and `<Stack.Protected guard={isSignedIn}>` around the `(app)` group, reading `useAuthSession()` as the single session source of truth; keep `SplashScreen.preventAutoHideAsync()` and render the splash overlay until `isLoaded` (the airlock — neither group visible before the session answer is known). Educational why-comments mirroring the spec's Navigation State outline §1–§5 (Constitution VI); contract invariants G1–G4 must hold
- [X] T005 Create `src/app/(auth)/_layout.tsx`: auth `Stack` with `/welcome` as anchor (`initialRouteName`) and spring-configured, gesture-cancellable screen transitions (no linear easing — contracts §5 row 2); create a minimal placeholder `src/app/(auth)/welcome.tsx` so the group compiles and the gate is exercisable before US1
- [X] T006 Create `src/app/(app)/_layout.tsx` hosting the tab UI inside the protected group; update `src/components/app-tabs.tsx` and `src/components/app-tabs.web.tsx`: triggers become `index` (Home), `scan` (label "Scan", D4), `account` (SF symbol person.crop.circle) — Explore trigger removed (FR-017, research §7)
- [X] T007 Relocate screens into the protected group: move `src/app/scan.tsx` → `src/app/(app)/scan.tsx` (logic unchanged), move `src/app/index.tsx` → `src/app/(app)/index.tsx` (interim content until US3 replaces it), create placeholder `src/app/(app)/account.tsx`, delete `src/app/explore.tsx`; fix any imports broken by the moves
- [X] T008 Evolve `src/components/animated-icon.tsx` (`AnimatedSplashOverlay`) into the Satori splash: wordmark + "Scan · Style · Shop" motif (figma p1), indeterminate shimmer (FR-002 — no fake determinate progress), and a `withSpring` dismissal morph (scale/opacity/translate shared values) triggered when `useAuthSession()` reports `isLoaded`; spring must retarget from current position if interrupted and the overlay must never block input after `isLoaded` (contracts §5 row 1)
- [ ] T009 Foundational verification gate: `cd apps/mobile && npx tsc --noEmit && npx expo lint` with zero errors; run in the existing dev client (`npx expo run:ios`) and confirm cold launch reaches splash → placeholder Welcome with no crash — no `.env` or account setup required

**Checkpoint**: Gate + mock provider + airlock + tabs proven — user stories can now proceed (US1 first; US3/US4 can run in parallel with US1 if staffed).

---

## Phase 3: User Story 1 - Create an Account or Sign In and Land on Home (Priority: P1) 🎯 MVP

**Goal**: The full signed-out funnel — Welcome, Create Account, Sign In, Password Reset — with simulated Apple/Google one-tap, inline validation/errors, and interruptible spring transitions into Home.

**Independent Test**: From a fresh install with no stored session, complete both the registration path and the sign-in path through to Home; verify each transition is animated and interruptible and the back gesture never re-enters auth (quickstart Scenarios 1 & 3).

### Implementation for User Story 1

- [X] T010 [P] [US1] Create `src/features/auth/components/AuthTextField.tsx`: labeled NativeWind-styled input with as-you-type inline validation state (neutral/valid/error + message slot), ≥44pt touch target (FR-004)
- [X] T011 [P] [US1] Create `src/features/auth/components/AuthSubmitButton.tsx`: bottom-anchored, keyboard-avoiding primary CTA with busy state; disabled while submitting so rapid double-tap is idempotent through the mock's simulated latency (FR-007, contract C1)
- [X] T012 [P] [US1] Create `src/features/auth/components/AuthErrorNotice.tsx`: inline human-readable error banner with springified `entering` animation; renders copy mapped from `AuthError` codes only — never raw codes (FR-008, contract C2)
- [X] T013 [P] [US1] Create `src/features/auth/components/SocialSignInRow.tsx`: Apple + Google buttons calling `signInWithApple()`/`signInWithGoogle()` from the contract; a `'cancelled'` result returns silently to the form with no error toast (FR-023, contracts §4)
- [X] T014 [P] [US1] Create `src/features/auth/hooks/useSignUpForm.ts`: form state + inline email-format and ≥8-char password validation, calls contract `signUp(email, password)`, maps `email-taken`/`weak-password`/`invalid-email` to human copy, inputs preserved on failure (FR-004, FR-007, FR-008)
- [X] T015 [P] [US1] Create `src/features/auth/hooks/useSignInForm.ts`: form state, calls contract `signIn(email, password)`, maps `invalid-credentials` to one shared message (never reveals whether the account exists) with email preserved for immediate retry (FR-005, FR-008)
- [X] T016 [P] [US1] Create `src/features/auth/hooks/usePasswordReset.ts`: calls contract `requestPasswordReset(email)` and renders the identical confirmation state for any input — enumeration-safe by construction (FR-006, contract C3)
- [X] T017 [US1] Implement the full Welcome screen in `src/app/(auth)/welcome.tsx` (replaces T005 placeholder): headline "The world is your wardrobe. Spot it. Scan it. Satori it.", supporting copy, primary "Create account" + secondary ghost "Log in" buttons — both ≥48pt, stacked in the lower thumb arc; copy says "Get Started", never "Get Startef" (FR-003, D3/D7/D10)
- [X] T018 [P] [US1] Create `src/app/(auth)/sign-up.tsx`: composes AuthTextField ×2 + AuthSubmitButton + SocialSignInRow + AuthErrorNotice over `useSignUpForm`; top-aligned fields, keyboard-avoiding CTA (FR-004, FR-007, D11)
- [X] T019 [P] [US1] Create `src/app/(auth)/sign-in.tsx`: email/password fields, "Forgot password?" link routing to `/reset-password`, SocialSignInRow, inline errors over `useSignInForm` (FR-005, FR-007, FR-008)
- [X] T020 [P] [US1] Create `src/app/(auth)/reset-password.tsx`: single email field + submit over `usePasswordReset`, enumeration-safe confirmation state (FR-006)
- [X] T021 [US1] Implement the gate-crossing motion in `src/app/_layout.tsx` + `src/app/(app)/_layout.tsx`: springified `entering`/`exiting` animations (`.springify()` with tuned mass/damping/stiffness) on the group swap so sign-in/sign-up success spring-morphs into Home; the guard state — not the animation — owns which group is mounted, so interruption cannot strand the user between stacks (FR-020, contracts §5 row 3)
- [ ] T022 [US1] US1 verification: `npx tsc --noEmit && npx expo lint` zero errors; run quickstart Scenario 1 (registration funnel incl. duplicate-email retry) and Scenario 3 (failure modes: wrong password, unknown account with identical copy, simulated-sheet cancel + Continue-as-Demo-User, enumeration check, keyboard occlusion) — every expectation holds

**Checkpoint**: A new user can register or sign in and land on Home — the MVP funnel is complete, with zero external setup.

---

## Phase 4: User Story 2 - Returning User Skips the Funnel (Priority: P1)

**Goal**: Valid stored session → splash resolves directly into Home (zero signed-out frames); expired session → Welcome with a gentle notice; deep links queue at the gate.

**Independent Test**: Sign in, kill the app, relaunch — lands directly on Home in <3s. Expire the session via the dev utility — relaunch lands on Welcome with the notice (quickstart Scenario 2).

> Note: the core skip behavior (SecureStore restore + guard flip + airlock) was built in T003/T004/T008 — this phase covers the US2-specific surfaces and proof.

### Implementation for User Story 2

- [X] T023 [US2] Add the session-invalid notice path: when restoration finds a corrupted/expired session (the mock's `expireSession()` scenario), surface a gentle "Please sign in again" `AuthErrorNotice` on `src/app/(auth)/welcome.tsx` — never a crash or blank screen (US2 scenario 2, data-model error surfaces)
- [X] T024 [US2] Verify and, if needed, implement deep-link queuing in `src/app/_layout.tsx`: a deep link to an `(app)` route while signed out must be captured by the router and delivered after successful auth (contract G5, spec edge case); document the observed expo-router behavior in a why-comment
- [ ] T025 [US2] US2 verification: run quickstart Scenario 2 — cold relaunch reaches Home in <3s with zero Welcome/Sign-In frames; after sign-out relaunch lands on Welcome with the registry intact (re-sign-in works); expired-session relaunch shows the notice; SecureStore session key gone after sign-out (SC-002, SC-004). *(Steps 2 and 5 need US4's Sign Out and dev-expiry row — either run after T036/T037 or trigger `signOut()`/`expireSession()` from a temporary dev call)*

**Checkpoint**: Both P1 stories complete — the funnel works for new and returning users.

---

## Phase 5: User Story 3 - Personalized Home Dashboard (Priority: P2)

**Goal**: Home shows a personalized greeting and a "Recently scanned" rail sourced from a device-local store, with a first-run empty state and marketing rows that yield to real content.

**Independent Test**: View Home with (a) zero scans and (b) several scans; verify empty state + highlights, populated rail (newest first), card tap → 001 results, and graceful store-failure fallback (quickstart Scenario 4).

### Implementation for User Story 3

- [X] T026 [P] [US3] Create `src/features/home/hooks/useRecentScans.ts`: reads the versioned local JSON store into `{ scans, isLoading, error, retry }`, sorted newest-first, capped at 20; parse/read failure degrades to `scans: []` + `error` set — never a throw (FR-013, FR-016, contracts §6)
- [X] T027 [P] [US3] Create `src/features/home/hooks/useGreeting.ts`: derives `greetingName` from `useAuthSession().user` firstName with a time-of-day fallback ("Good evening") when no name exists (FR-012, data-model UserProfile derivation)
- [X] T028 [P] [US3] Create `src/features/home/components/GreetingHeader.tsx`: dark header per figma p3 with the personalized greeting, single-line truncation for very long names (no layout shift), status-bar legibility in both themes (FR-012, ergonomic ground rules)
- [X] T029 [P] [US3] Create `src/features/home/components/RecentScansRail.tsx`: horizontal card rail (thumbnail, date, garment-count badge per p3's visual language) with a "See all" affordance; cards ≥44pt targets (FR-013)
- [X] T030 [P] [US3] Create `src/features/home/components/EmptyScansState.tsx`: first-run invitation with a "Scan your first outfit" CTA that activates the Scan tab via router navigation (FR-014, D5)
- [X] T031 [P] [US3] Create `src/features/home/components/FeatureHighlights.tsx`: "What you will love" rows from figma p3, rendered only alongside the empty state (FR-014, D9)
- [X] T032 [US3] Compose the Home dashboard in `src/app/(app)/index.tsx` (replaces the T007 interim content): GreetingHeader + (zero scans → EmptyScansState + FeatureHighlights | ≥1 scan → RecentScansRail) + store-failure retry state, all NativeWind-styled (FR-012..FR-016)
- [X] T033 [US3] Write-side integration: on successful segmentation in the feature-001 scan completion path (locate the completion handler under `src/features/scan/`), append a `RecentScanSummary` (scanId, thumbnailUri, capturedAt, garmentCount) to the local store and trim to 20 newest (contracts §6 write rule)
- [X] T034 [US3] Wire rail-card taps to feature 001's existing scan results view by scanId (FR-015); confirm no p10-template screen exists anywhere (D2)
- [ ] T035 [US3] US3 verification: `npx tsc --noEmit && npx expo lint` zero errors; run quickstart Scenario 4 (empty state → first scan → populated rail → card tap → corrupt-store fallback)

**Checkpoint**: Home is a real dashboard — empty, populated, and failure states all designed.

---

## Phase 6: User Story 4 - Account Hub (Priority: P3)

**Goal**: Account tab with profile header, grouped ≥56pt rows with coming-soon placeholders, a separated confirmed Sign Out that fully purges the session, and the dev-only session-expiry utility row.

**Independent Test**: Open Account — profile renders (initials fallback, since the mock supplies no image), all five rows respond, Sign Out confirms then returns to Welcome with the back gesture unable to re-enter the app (quickstart Scenario 2 steps 2–3 + Scenario 6 step 2).

### Implementation for User Story 4

- [X] T036 [US4] Implement the Account hub in `src/app/(app)/account.tsx` (replaces T007 placeholder): profile header with initials avatar (derive from `useAuthSession().user` — mock `imageUrl` is always null, so the fallback path always renders) + display name (truncating gracefully), grouped rows — Contact Info, Privacy Settings, Preferences, Link Social Media, Settings — each ≥56pt with chevrons; unbuilt rows present a graceful "coming soon" state on tap, zero dead taps; plus a `__DEV__`-only "Expire session (dev)" row calling the mock's `expireSession()` (FR-018, FR-019, research §1b)
- [X] T037 [US4] Implement the sign-out flow in `src/app/(app)/account.tsx`: visually separated Sign Out action → confirmation dialog → contract `signOut()`; session key purged from SecureStore and the guard flip unmounts `(app)` with history removal, spring transition back to Welcome; on failure show an inline notice and retain the session (FR-009, FR-010, contracts §4 sign-out row)
- [ ] T038 [US4] US4 verification: `npx tsc --noEmit && npx expo lint` zero errors; re-run quickstart Scenario 2 end-to-end (now with the real Sign Out and dev-expiry row) plus Scenario 6 step 2 (row heights, coming-soon states, dev row hidden outside `__DEV__`)

**Checkpoint**: All four user stories independently functional — the funnel loop closes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Motion/ergonomics audits, full quickstart pass, and constitution housekeeping.

- [ ] T039 [P] Motion quality audit per quickstart Scenario 5: background-during-splash-morph, half-swipe interruption, 60fps gate crossing with perf monitor; grep the new code for `Easing.linear` — zero matches (FR-020, SC-003, Constitution V)
- [ ] T040 [P] Ergonomics & accessibility audit per quickstart Scenario 6 on an iPhone SE-class simulator: CTAs in bottom 40%, all targets ≥44×44pt, long-name truncation, dark-mode legibility on Home (SC-007)
- [ ] T041 Full quickstart.md pass (all 6 scenarios in order from a clean simulator) + final `npx tsc --noEmit && npx expo lint` zero-error gate; fix anything that fails before marking this task complete
- [X] T042 [P] If any debugging breakthrough occurred during implementation (e.g., route-group migration gotchas, Stack.Protected quirks), document it in a new entry under `/lessons` at the repo root (Constitution: Local Retrospective)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 has no dependencies — start immediately.
- **Foundational (Phase 2)**: T002 first (T003 implements its types); T003 → T004 (gate consumes the provider) → T005/T006 → T007 → T008 → T009. **Blocks all user stories.**
- **US1 (Phase 3)**: After Foundational. Components/hooks T010–T016 all parallel; screens T017–T020 need their components/hooks; T021 needs at least one working sign-in path; T022 last.
- **US2 (Phase 4)**: After Foundational; T023 touches welcome.tsx so runs after T017. Mostly verification of T003/T004/T008 behavior; T025's sign-out/expiry steps are cleanest after T036/T037.
- **US3 (Phase 5)**: After Foundational only — independent of US1/US2 (any registered mock account gives a signed-in session). T026–T031 all parallel; T032 composes them; T033/T034 integrate with feature 001; T035 last.
- **US4 (Phase 6)**: After Foundational only. T036 → T037 → T038.
- **Polish (Phase 7)**: After all desired stories. T039/T040/T042 parallel; T041 final.

### Within-story rule

Components and hooks (different files) → screens that compose them → integration → verification gate. Every verification task (T009, T022, T025, T035, T038, T041) requires zero TypeScript/lint errors before its story is "done" (Constitution Verification Rule).

---

## Parallel Example: User Story 1

```bash
# After T009, launch all US1 building blocks together (7 independent files):
Task: "AuthTextField in src/features/auth/components/AuthTextField.tsx"
Task: "AuthSubmitButton in src/features/auth/components/AuthSubmitButton.tsx"
Task: "AuthErrorNotice in src/features/auth/components/AuthErrorNotice.tsx"
Task: "SocialSignInRow in src/features/auth/components/SocialSignInRow.tsx"
Task: "useSignUpForm in src/features/auth/hooks/useSignUpForm.ts"
Task: "useSignInForm in src/features/auth/hooks/useSignInForm.ts"
Task: "usePasswordReset in src/features/auth/hooks/usePasswordReset.ts"

# Then the three form screens together:
Task: "sign-up.tsx"  Task: "sign-in.tsx"  Task: "reset-password.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational (T003 the mock provider and T004 the gate are the heart of the feature — do not rush them).
2. Phase 3 US1 → **stop and validate** with quickstart Scenarios 1 & 3.
3. This alone is demoable today: a working branded funnel into the existing app, no accounts or keys required.

### Incremental Delivery

1. Setup + Foundational → gate + mock proven with placeholders (T009).
2. US1 → MVP funnel (T022). 3. US2 → returning-user proof (T025, thin by design — the gate did the work). 4. US3 → real dashboard (T035). 5. US4 → account + sign-out closes the loop (T038). 6. Polish → audits + full quickstart (T041).

### Parallel Team Strategy

After Foundational: Developer A takes US1 (largest), Developer B takes US3 (fully independent of auth screens), Developer C takes US4. US2 is a verification-heavy pass best done by whoever finishes first, after T037 exists.

---

## Notes

- Total: **42 tasks** (T001–T042). Setup: 1 · Foundational: 8 · US1: 13 · US2: 3 · US3: 10 · US4: 3 · Polish: 4.
- **Zero external setup**: no Clerk account, dashboard, `.env`, config-plugin, or package install — the previous tasks for those (Clerk/apple-auth install, app.json plugins, publishable key) were removed by the 2026-07-09 amendment.
- The **provider swap seam is sacred**: nothing outside `src/features/auth/providers/` may import SecureStore auth keys or mock internals — screens speak only `useAuthSession()` (FR-024/FR-025, contract C5).
- Educational why-comments (Constitution VI) are part of the definition of done for T003, T004, T008, T021, T024, T037 — the contract seam, gate, airlock, and sign-out are the teaching moments this feature was specified around.
- Avoid cross-story file conflicts: `welcome.tsx` is touched by T017 (US1) then T023 (US2); `account.tsx` by T036 then T037 — sequence those pairs if working in parallel.
