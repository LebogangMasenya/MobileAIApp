# Implementation Plan: Smart Visual Search & Background Isolation — Subject Lift, Live Pipeline & Match Presentation

**Branch**: `main` (no feature branch — repo convention to date) | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-smart-visual-search/spec.md` (CL-001..003 resolved 2026-07-15: standalone surface, highest-comparable price anchor, provider-flagged exactness only)

## Summary

A standalone Subject Lift visual-search surface (evolving the feature-003
demo route into the real thing):

1. **US1 Subject Lift & visible pipeline** — on-device background isolation
   via a new one-seam module over `@six33/react-native-bg-removal`
   (iOS 17+ Vision / Android MLKit), perimeter-trace feedback while
   isolating, a haptic "lift" moment on separation, honest four-stage
   segmented progress (isolate → prepare → match → assemble), and a manual
   crop marquee as the universal fallback floor.
2. **US2 Cascading match wall** — two-column JS masonry with spring-stagger
   entry capped at 640ms cumulative, isolated garment hero on a solid dark
   elevated card (no glass on app surfaces — 007 §4 rule).
3. **US3 Price-advantage framing** — numeric provider prices normalize into
   the contract; pure anchor math (highest same-currency comparable);
   labels only when arithmetic is verifiable.
4. **US4 Harmony ring** — pure score over the existing 007 style profile;
   renders only for genuinely personalized profiles.
5. **US5 Perfect-match jackpot** — provider `exact` flag only; bounded
   spring shimmer + one `celebrate()` beat per result set.

Backend: the visual-search route gains a multipart upload path with an
ephemeral public image store (TTL) so the URL-only provider can fetch the
isolated PNG from the deployed origin — feature 003's JSON path stays
intact.

## Technical Context

**Language/Version**: TypeScript ~5.9 (strict) both apps; React 19.1 / RN
0.81.5 (mobile); Next.js 16.2 App Router (api — per apps/api/AGENTS.md,
verify against `node_modules/next/dist/docs/` at implementation time).

**Primary Dependencies (existing)**: Expo SDK 54 + custom dev client,
Reanimated ~4.1.1 (`scheduleOnRN`, no `runOnJS`), gesture-handler ~2.28,
NativeWind 4, expo-image, expo-image-picker, expo-image-manipulator
(~14.0.8, installed with 006), expo-linear-gradient + react-native-svg +
expo-haptics (installed with 007), services seams: tactile.ts,
device-store.ts, vault-store.ts.

**NEW native dependency**: `@six33/react-native-bg-removal` v1.3.4
(research R1) — requires a dev-client rebuild. **007's rebuild (its T002)
has still not run** (ios/Podfile.lock predates expo-haptics/svg/gradient),
so ONE rebuild carries all four native modules. Compatibility with RN 0.81
/ New Architecture is a named verification task before any US1 work.

**Storage**: No new mobile storage — pipeline state is session-local by
design (spec Key Entities); completed searches write a vault entry
(`source: 'lift'`, additive union extension). API gains an in-process
ephemeral upload store (TTL ~5 min, LRU-capped) — deliberately NOT durable
(privacy: user photos live server-side for minutes).

**Testing**: `npm run lint` + `tsc --noEmit` (both apps) as the quality
gate; pure logic ships as independently testable functions (masonry split,
price anchor, harmony score, degenerate-mask rule, stage machine
reducers); motion/haptics/device acceptance via quickstart.md passes on a
physical iPhone.

**Target Platform**: iOS-first (on-device lift needs iOS 17+; capability-
probed at runtime); Android and older iOS take the manual-crop floor; web
must not crash (probe returns unavailable → manual path or import-only).

**Project Type**: Mobile app + API (Expo monorepo `apps/mobile`,
`apps/api`).

**Performance Goals**: SC-001/002 — first visible feedback <1s, no static
visual >1.5s while in flight; cascade ≤640ms budget with zero layout shift
(SC-003); all loops UI-thread transform/opacity only.

**Constraints**: Springs only, `Easing.linear` banned (Constitution V);
no blur/glass on app surfaces (007 motion-tactility §4); haptics only via
services/tactile.ts beats (`confirm` on lift, `celebrate` on jackpot —
one-shots that survive reduce-motion); provider quota respected (single
provider call per search; 10s abort budget precedent); Render free-tier
cold starts must surface as designed retry states, not hangs.

**Scale/Scope**: 1 new route/screen, ~7 new components, 2 hooks, 4 pure
utils, 1 new mobile seam (subject-lift.ts), API: 1 modified route + 1 new
ephemeral store + 1 new public image GET, extended ProductMatch contract
(both type copies), 1 dev-client rebuild (shared with 007).

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-evaluated post-Phase-1 (v2.0.1).*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Clarity Over Assumption | ✅ PASS | CL-001..003 resolved by user (all recommended options, 2026-07-15). Remaining interpretation calls are documented research decisions surfaced with this plan, not guesses: R2 (ephemeral upload hosting), R5 (segmented honest progress vs the guide's percentage map), R6 (perimeter trace, not a pre-mask contour), R8 (harmony formula over existing profile data). Named verification duties: R1 (library/New-Arch compat), R3 (exact-match section shape vs live provider docs). |
| II | Design-First Implementation | ✅ PASS (standing user waiver, 2026-07-14) | User waived Figma pre-flight for new views with the binding condition of theme consistency — semantic Tailwind tokens only, existing card/pill/serif idioms, house spring vocabulary. The ergonomics-critique duty is discharged in contracts/match-presentation.md (thumb-band CTA placement, marquee handle sizes ≥44pt, hero contrast) and inline why-comments. |
| III | Performance First | ✅ PASS | Isolation runs in the native module (no JS-side pixel work); mask→vector contour extraction explicitly deferred for this reason (R6). All loops = UI-thread transforms/opacity (trace runner, breathing segment, shimmer translateX, ring dash-offset via useAnimatedProps). No blur anywhere on the surface (R11). Upload uses the isolated (smaller) PNG — payload trimmed before network (R2). |
| IV | Anti-Abstraction | ✅ PASS | Direct library/APIs everywhere; ONE new seam (`services/subject-lift.ts`) mirroring the sanctioned one-seam-per-hardware-boundary pattern (tactile/device-store) — it is the capability/failure gate FR-005 demands, not a wrapper of a wrapper. Masonry is a 20-line pure function, not a list library (R7). Provider specifics stay confined to serpApiProvider.ts (003 rule). |
| V | Native-Grade Fluid Motion | ✅ PASS | Springs everywhere: trace loop (004 idiom), segment fills, cascade staggers, marquee release, shimmer sweeps (`withRepeat(withSequence(withSpring…))`, bounded ~3 — R9). Lift moment springs from current values; every transition interruptible; zero `Easing.linear`. |
| VI | Educational Code Architecture | ✅ PASS | Why-comments contracted for: the seam pattern, the honest-progress state machine, greedy masonry split, currency-partitioned anchor math, the activate-vs-observe gesture distinction (marquee vs 007 tilt). |
| VII | Defensive Error Scaffolding | ✅ PASS | Isolation failure/degenerate mask → manual crop (never a crash); upload/provider/network failures → typed, retryable states preserving the isolated image (FR-009); API keeps the one error envelope; uploadStore misses degrade to UPSTREAM_FAILED; web/unsupported probe → manual/import path. |
| VIII | State Isolation | ✅ PASS | Logic in hooks/pure utils: `useSubjectLift`, `useLiftSearch` (stage machine), `masonry-split`, `price-anchor`, `harmony`, degenerate-mask rule. Components stay presentational. |

**Post-Phase-1 re-check (2026-07-15)**: design artifacts introduce no new
violations. Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-smart-visual-search/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R12
├── data-model.md        # Phase 1 — pipeline machine, IsolatedGarment, contract extensions
├── quickstart.md        # Phase 1 — device verification passes (SC-001…008)
├── contracts/
│   ├── pipeline.md            # Stage machine, never-freeze rules, failure taxonomy, retry
│   ├── search-api.md          # Upload endpoint, ephemeral image hosting, ProductMatch extensions
│   └── match-presentation.md  # Cascade/masonry, hero contrast, savings/harmony/jackpot rules
├── checklists/requirements.md
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
apps/api/src/
├── routes/visual-search.ts               # MODIFIED — multipart upload path + JSON path; wires uploadStore
├── services/visualSearch/
│   ├── serpApiProvider.ts                # MODIFIED — type=all, exact flag, numeric price fields
│   └── uploadStore.ts                    # NEW — ephemeral TTL/LRU byte store (no durable persistence)
├── app/v1/visual-search/
│   ├── route.ts                          # existing adapter (unchanged shape)
│   └── images/[id]/route.ts              # NEW — public GET the provider fetches
└── types/visual-search.ts                # MODIFIED — ProductMatch + exact/price_value/currency

apps/mobile/src/
├── services/subject-lift.ts              # NEW seam — ONLY importer of the bg-removal lib; probe + typed failures
├── features/visual-search/
│   ├── components/
│   │   ├── LiftStage.tsx                 # NEW — photo→isolated hero moment (trace, lift spring, confirm beat)
│   │   ├── PipelineProgress.tsx          # NEW — 4-segment honest bar + breathing active segment
│   │   ├── ManualCropMarquee.tsx         # NEW — draggable/resizable crop fallback (44pt handles)
│   │   ├── MatchWall.tsx                 # NEW — two-column masonry, ≤640ms cascade
│   │   ├── MatchCard.tsx                 # NEW — extends ProductMatchCard idiom + savings/harmony/exact
│   │   ├── HarmonyRing.tsx               # NEW — single-arc dash-offset ring (007 idiom)
│   │   ├── ProductMatchCard.tsx          # existing (demo) — untouched
│   │   └── DemoScanCard.tsx              # MODIFIED — becomes the visual-search entry card
│   ├── hooks/
│   │   ├── useVisualSearch.ts            # existing demo hook — untouched (sample path reuses it)
│   │   ├── useSubjectLift.ts             # NEW — isolation lifecycle (probe, lift, degenerate rule, manual joins)
│   │   └── useLiftSearch.ts              # NEW — full pipeline stage machine (upload/search/assemble, retry)
│   └── utils/
│       ├── masonry-split.ts              # NEW pure — greedy shortest-column assignment
│       ├── price-anchor.ts               # NEW pure — currency-partitioned anchor + savings %
│       └── harmony.ts                    # NEW pure — 0–100 score over 007 style profile
├── app/(app)/
│   ├── visual-search.tsx                 # NEW fullscreen route (substack precedent); supersedes demo-scan.tsx
│   └── demo-scan.tsx                     # RETIRED — route removed once visual-search.tsx carries the sample path
└── types/
    ├── visual-search.ts                  # MODIFIED — mirror of api copy (sync rule)
    └── vault.ts                          # MODIFIED — source union + 'lift' (additive)
```

**Structure Decision**: Extends the existing `features/visual-search`
module rather than creating a parallel one — 008 is the graduation of that
feature. The isolation seam lives in `services/` beside its precedents
(one seam per hardware boundary). The route is a fullscreen substack
sibling of demo-scan (2026-07-09 lesson), which it supersedes.

## State Mutations (planning-mode disclosure)

| State | Owner | Mutation |
|-------|-------|----------|
| `LiftSearchState` (stage machine) | `useLiftSearch` | idle → isolating → preparing → matching → assembling → done/failed(stage); retry re-enters at the failed stage, isolated image preserved (FR-009) |
| `IsolatedGarment` | `useSubjectLift` | Produced once per photo by lift OR manual crop; immutable thereafter; dies with the session |
| Trace/segment/shimmer/ring shared values | UI thread | Spring loops bound to their stage/exposure; all interruptible |
| Marquee rect | UI thread per gesture | Pan-driven; springs to legal bounds on release |
| Upload bytes | api `uploadStore` | set(id) on upload → provider fetch window → TTL/LRU eviction; never persisted |
| Vault entry (`source: 'lift'`) | vault-store | One upsert per completed search with matches (the demo-path precedent) |
| Jackpot fired-flag | `useLiftSearch` (per result set) | Set on first exact-card exposure; resets only with a new result set |

## Complexity Tracking

> No constitutional violations to justify. (subject-lift.ts is a sanctioned
> hardware-boundary seam; the ephemeral uploadStore is a privacy decision,
> not an abstraction layer.)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
