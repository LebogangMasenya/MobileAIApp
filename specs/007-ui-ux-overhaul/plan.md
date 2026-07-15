# Implementation Plan: UI/UX Overhaul — Kinetic Polish, Behavioral Loops & Style Rings

**Branch**: `main` (no feature branch created — repo convention to date) | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-ui-ux-overhaul/spec.md` (scope resolved: US1–US5; pack ritual, paywall, AI chat deferred)

## Summary

Elevate the two core surfaces (scan, vault) from functional to tactile-premium,
and add the Style Rings retention engine:

1. **US1 Living Scan** — replace the static `ActivityIndicator` busy pill
   (scan.tsx) with a spring-driven blooming pulse wave + breathing glow, each
   bloom peak emitting a light haptic tick; hard-stops (springs to rest) on
   scan resolution.
2. **US2 Tactile Cards** — `VaultEntryCard` gains touch-tracking 3D tilt with
   a gradient light sheen, implemented as an *observation-only* gesture that
   can never steal scroll/tap/long-press.
3. **US3 Momentum Welcome** — the vault's `empty` state becomes a Setup
   Journey (account ✓, camera ✓, first scan ○) whose progress derives 100%
   from real state — honest momentum by construction.
4. **US4 Smart Defaults** — a Style Profile derived purely from stored vault
   entries powers a new smart-preselected category filter rail in the vault.
5. **US5 Style Rings** — a three-segment SVG daily ring on Home, backed by a
   tiny device-store record with device-local day rollover; segment closes
   and full-ring celebration are spring + haptic moments.

Cross-cutting: first-ever haptics infrastructure (`services/tactile.ts` seam)
and reduce-motion compliance (Reanimated `useReducedMotion` + `ReduceMotion`
config) across every animated treatment, old and new.

## Technical Context

**Language/Version**: TypeScript ~5.9 (strict), React 19.1, React Native 0.81.5

**Primary Dependencies**: Expo SDK 54 (managed + custom dev client),
`react-native-reanimated` **~4.1.1** (NOT v3 as the Master Guide assumed — v4
idioms apply: `scheduleOnRN` from `react-native-worklets`, no `runOnJS`),
`react-native-gesture-handler` ~2.28, NativeWind 4, `expo-image`,
`expo-glass-effect` (installed, unused so far).

**New native dependencies (one dev-client rebuild)**: `expo-haptics` (no JS
alternative — required by FR-003/005/013), `react-native-svg` (ring arcs —
reverses the 2026-07-12 "no SVG" decision; see research.md R2),
`expo-linear-gradient` (card sheen). All three ride a single rebuild.

**Storage**: Existing seams only — `device-store.ts` (SecureStore KV, <2KB
payloads) gains the daily-cycle record + celebration-seen flag, following the
`useVaultVisibility` versioned-JSON pattern. No vault schema change: Style
Profile and Setup Journey are pure derivations over existing `VaultIndex` v2
data. No new storage backend.

**Testing**: `npm run lint` + `tsc --noEmit` (quality gate); pure logic
(style-profile derivation, daily rollover, journey derivation) is extracted
into independently testable functions (Constitution VIII); motion/haptics/
gesture acceptance is physical-iPhone verification via quickstart.md.

**Target Platform**: iOS-first on real devices (ProMotion 120Hz aware);
Android + web must not break (haptics/blur/glass degrade gracefully — web
falls back like `device-store` does).

**Project Type**: Mobile app (Expo monorepo `apps/mobile`); no backend
changes in this feature.

**Performance Goals**: SC-001 — sustain native refresh rate during scan +
vault browsing; all loops are UI-thread transform/opacity only (no per-frame
layout, no native blur in loops — the NeonTracingOverlay precedent).

**Constraints**: Interruptible springs only, `Easing.linear` banned
(Constitution V); no main-thread blocking (III); JS↔UI crossings via shared
values + `scheduleOnRN` for discrete haptic beats only; SecureStore payloads
< 2KB; z-band contract preserved (trace z-10 < chrome z-20/30 < hotspots
z-50 < failures z-60).

**Scale/Scope**: 5 user stories, ~9 new components/hooks, 2 modified
surfaces (scan.tsx busy state, VaultSheet/VaultEntryCard), 1 new feature
module (`style-rings`), 3 new deps, 1 dev-client rebuild.

**Known discrepancy**: `apps/mobile/AGENTS.md` says "read Expo v57 docs";
`package.json` pins `expo ~54.0.0` (RN 0.81). Installed package types are
the source of truth for API verification (the vault-store precedent);
the v57 pointer likely tracks `@expo/ui@57`. Flagged for the user — resolve
AGENTS.md at leisure, do not upgrade the SDK inside this feature.

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-evaluated post-Phase-1 (v2.0.1).*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Clarity Over Assumption | ✅ PASS | CL-001 resolved by user (Option C). Two residual interpretation calls are documented as research decisions, not guesses: R7 (FR-011 lands on a new vault filter rail — no manual categorization step exists) and R8 (ring segment fulfillment stand-ins, blessed by spec US5 scenario 4 + Assumptions). Both surfaced for approval with this plan. |
| II | Design-First Implementation | ✅ PASS (user waiver 2026-07-14) | User explicitly waived the Figma/mockup pre-flight for 007's new views ("creative freedom on these new features"), with one binding condition: **visual consistency with the established theme** — semantic Tailwind tokens only (`bg-surface`/`primary`/`ink`/`line` families, never hex literals), existing card/pill/radius/serif-header idioms, and the house spring vocabulary. The ergonomics-critique duty stands and is discharged inline in code comments + contracts. |
| III | Performance First | ✅ PASS | All loops = UI-thread transforms/opacity (wave: scale+opacity; tilt: rotateX/Y; ring: `useAnimatedProps` on `strokeDashoffset`). Haptics are discrete `scheduleOnRN` events at bloom peaks (~0.5Hz), not per-frame. No blur inside loops; glass reserved for static chrome. |
| IV | Anti-Abstraction | ✅ PASS | Direct Reanimated/GH/SVG/expo-haptics APIs. One new seam, `services/tactile.ts`, mirrors the sanctioned one-seam-per-backend pattern (device-store, vault-store): it is the single availability/reduce-motion/platform gate FR-003 demands, not a wrapper of a wrapper. |
| V | Native-Grade Fluid Motion | ✅ PASS | Springs everywhere including the wave loop (`withRepeat(withSequence(withSpring…))` — NeonTracingOverlay precedent); resolution hand-off springs from current value (interruptible); tilt release springs; no `Easing.linear` anywhere. |
| VI | Educational Code Architecture | ✅ PASS | Every new engine (observation-only gesture, ring arc math, rollover logic) ships with why-comments per house style. |
| VII | Defensive Error Scaffolding | ✅ PASS | tactile.ts swallows haptic failures to no-ops; daily-cycle store parses defensively to a safe default (useVaultVisibility pattern); camera-permission read failure renders the journey step unchecked (honest), never a crash. |
| VIII | State Isolation | ✅ PASS | Logic in hooks/pure utils: `useDailyCycle`, `useSetupJourney`, `deriveStyleProfile` (pure), `resolveRollover` (pure). Components stay presentational. |

**Post-Phase-1 re-check (2026-07-14)**: No new violations introduced by the
design artifacts. Complexity Tracking remains empty; Principle II gate stands
as a tasks-phase step.

## Project Structure

### Documentation (this feature)

```text
specs/007-ui-ux-overhaul/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R9
├── data-model.md        # Phase 1 — StyleProfile, DailyCycleRecord, SetupJourney
├── quickstart.md        # Phase 1 — device verification passes (SC-001…008)
├── contracts/
│   ├── motion-tactility.md   # Motion language, haptic vocabulary, reduce-motion matrix, glass rules
│   ├── daily-cycle.md        # Ring store shape, fulfillment mapping, rollover semantics
│   └── vault-surfaces.md     # Tilt gesture, welcome journey, filter rail contracts
├── checklists/requirements.md
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
apps/mobile/src/
├── services/
│   ├── tactile.ts                 # NEW — the ONLY expo-haptics touchpoint (beat vocabulary)
│   ├── daily-cycle-store.ts       # NEW — versioned JSON in device-store; rollover logic (pure)
│   └── device-store.ts            # unchanged (reused)
├── components/
│   └── TactileTiltCard.tsx        # NEW — reusable observation-only tilt + sheen wrapper (US2)
├── features/
│   ├── scan-overlay/components/
│   │   └── ScanPulseWave.tsx      # NEW — blooming wave + breathing pulse + peak ticks (US1)
│   ├── scan/…                     # scan.tsx busy pill → ScanPulseWave hand-off (MODIFIED)
│   ├── vault/
│   │   ├── components/
│   │   │   ├── VaultEntryCard.tsx      # MODIFIED — wrapped in TactileTiltCard
│   │   │   ├── VaultWelcomeJourney.tsx # NEW — replaces VaultEmptyState 'empty' variant (US3)
│   │   │   └── VaultFilterRail.tsx     # NEW — smart-preselected category chips (US4)
│   │   ├── hooks/
│   │   │   └── useSetupJourney.ts      # NEW — derives journey from real state (US3)
│   │   └── utils/
│   │       └── style-profile.ts        # NEW — pure derivation over VaultEntry[] (US4)
│   └── style-rings/                    # NEW feature module (US5)
│       ├── components/
│       │   ├── DailyCycleRing.tsx      # SVG segmented ring, useAnimatedProps arcs
│       │   ├── RingCelebration.tsx     # full-ring close moment
│       │   └── CoordinateSuggestionSheet.tsx  # minimal local "style me" (segment 3 stand-in)
│       └── hooks/
│           └── useDailyCycle.ts        # segment state + markSegment(), rollover-aware
└── app/(app)/(tabs)/
    ├── index.tsx                  # MODIFIED — hosts DailyCycleRing card on Home
    └── scan.tsx                   # MODIFIED — busy state + 'log' segment marking
```

**Structure Decision**: Extends the established `features/<domain>/
{components,hooks,utils}` layout; one new feature module (`style-rings`); new
cross-backend seams live in `services/` beside their precedents. The tilt
wrapper is app-level (`src/components/`) because ProductMatchCard and future
card surfaces inherit it — it is not vault-specific.

## State Mutations (planning-mode disclosure)

| State | Owner | Mutation |
|-------|-------|----------|
| `progress`/wave shared values | UI thread (Reanimated) | Loop while `phase ∈ {submitting, segmenting}`; spring-to-rest on resolution |
| Tilt `rotateX/rotateY/sheen` | UI thread per card | Driven by `Gesture.Manual` touch observation; spring to 0 on release/cancel |
| `DailyCycleRecord` | `daily-cycle-store.ts` (device-store KV) | `markSegment(id)` — idempotent per day; read-repair rollover on load |
| Setup Journey | Derived (no store) | Pure function of (auth session, camera permission, vault count) |
| Style Profile | Derived (no store) | Pure function of `VaultEntry[]` |
| `celebrationSeen.v1` | device-store KV | Set once when first-scan journey completes (US3 scenario 3) |
| Vault filter selection | `VaultSheet` local state | Initialized from Style Profile; user changes are session-local |

## Complexity Tracking

> No constitutional violations to justify. (`tactile.ts` is a sanctioned
> backend seam, not an abstraction layer — see Constitution Check IV.)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
