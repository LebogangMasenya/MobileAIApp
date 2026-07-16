# Tasks: Smart Visual Search & Background Isolation — Subject Lift, Live Pipeline & Match Presentation

**Input**: Design documents from `/specs/008-smart-visual-search/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R12), data-model.md, contracts/ (pipeline.md, search-api.md, match-presentation.md), quickstart.md

**Tests**: Not requested as automated test files. The plan's quality gate is `npm run lint` + `npx tsc --noEmit` in both apps; acceptance is the quickstart.md device passes, encoded below as per-story verification tasks. Pure utils (masonry-split, price-anchor, harmony, degenerate rule) must ship as independently testable functions.

**Organization**: Tasks are grouped by user story (US1–US5, priorities P1–P5) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1…US5)
- Every task names its exact file path(s)

## Path Conventions

Expo monorepo: mobile code in `apps/mobile/src/`, API code in `apps/api/src/` (per plan.md Project Structure).

---

## Phase 1: Setup (Native Dependency & Rebuild)

**Purpose**: Land the ONE new native dependency and the single dev-client rebuild that also carries 007's still-pending native modules.

- [X] T001 Install `@six33/react-native-bg-removal` v1.3.4 in `apps/mobile/package.json` (`npx expo install` preferred) and discharge the R1 verification duty against the installed package/types: Expo SDK 54 dev-client, RN 0.81, New Architecture compatibility; confirm the result shape exposes mask bounds and that `trim` behavior matches FR-004. If incompatible, STOP and surface the recorded fallback (custom Swift Expo Module, Android → manual-crop floor) before any US1 work.
- [ ] T002 Run the ONE dev-client rebuild `npx expo run:ios --device` from `apps/mobile/` — carries bg-removal PLUS 007's pending native modules (expo-haptics, react-native-svg, expo-linear-gradient; `ios/Podfile.lock` predates them). Document any prebuild/CocoaPods breakthrough in `/lessons` (Retrospective Discipline). Blocks device verification tasks only (T018, T023, T026, T030, T033, T034) — code tasks may proceed in parallel while it runs.

**Checkpoint**: Native module installed and verified compatible; rebuild available for device passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type contract extensions and the provider normalizer changes that US1–US5 all read from.

**⚠️ CRITICAL**: No user story phase starts until these types exist — every story consumes the extended ProductMatch.

- [X] T003 [P] Extend `ProductMatch` in `apps/api/src/types/visual-search.ts` with optional `price_value?: number`, `currency?: string`, `exact?: boolean`, `thumbnail_width?: number`, `thumbnail_height?: number` (data-model.md §3); update the type-sync comment (contracts/search-api.md §4).
- [X] T004 [P] Mirror the identical `ProductMatch` extension in `apps/mobile/src/types/visual-search.ts` (deliberate near-identical copy, 003 sync rule; update its sync comment) and add the `LiftSearchResult` interface (`matches`, `resultSetId` — data-model.md §3).
- [X] T005 [P] Extend the `VaultEntry` `source` union with `'lift'` in `apps/mobile/src/types/vault.ts` (additive); verify no existing vault code switches on `source` destructively (R12 verification note).
- [X] T006 Modify `apps/api/src/services/visualSearch/serpApiProvider.ts` per contracts/search-api.md §3: request the section set including exact matches (`type=all` — R3), normalize `price_value` (finite number only), `currency` (non-empty string), `exact: true` (membership in the provider's exact-match section), `thumbnail_width/height` when present; existing drop rules and MAX_MATCHES=20 unchanged; display `price` string stays verbatim-or-null. VERIFY the exact-match section name/shape against the provider's live docs (R3 duty — if the account tier returns no exact section, `exact` is never set and US5 stays dormant by design). Provider specifics stay confined to this file. Depends on T003.

**Checkpoint**: Both type copies in sync, provider emits the new optional fields — user story phases can begin.

---

## Phase 3: User Story 1 - Subject Lift & Visible Match Pipeline (Priority: P1) 🎯 MVP

**Goal**: On-device background isolation with live perimeter-trace feedback, a felt "lift" moment, an honest four-stage pipeline (isolate → prepare → match → assemble) that never freezes or lies, manual-crop fallback as the universal floor, and product matches arriving end-to-end through the extended API.

**Independent Test**: On a supported iPhone, photograph a garment against a busy background: outline traces during isolation, the lift lands with one confirm beat, stage copy advances truthfully, matches arrive. Kill the network mid-pipeline → designed retryable failure preserving the isolated garment. On an unsupported device/web → manual crop path, never a crash (quickstart Passes 1–2).

### API implementation (the matching stage's server half)

- [X] T007 [P] [US1] Create `apps/api/src/services/visualSearch/uploadStore.ts` — in-memory ephemeral byte store per data-model.md §6: `StoredUpload` (crypto-random unguessable id, `Uint8Array` bytes, `image/png`, `expiresAt` ≈ now+5min), TTL sweep + LRU cap (~20 entries / ~50MB), NEVER written to disk or any durable store (privacy invariant, R2). Why-comment the single-instance assumption (Render free/starter).
- [X] T008 [US1] Create `apps/api/src/app/v1/visual-search/images/[id]/route.ts` — public GET returning stored PNG bytes with `content-type: image/png`; 404 after TTL/eviction or unknown id; no listing/enumeration (contracts/search-api.md §2). Verify Next.js route-handler idioms against `node_modules/next/dist/docs/` first (apps/api/AGENTS.md rule). Depends on T007.
- [X] T009 [US1] Modify `apps/api/src/routes/visual-search.ts` — dual-mode POST per contracts/search-api.md §1: Mode A (JSON `{ imageUrl?, country? }`, empty body ⇒ demo image) preserved verbatim; NEW Mode B `multipart/form-data` field `photo` (PNG, reject >8MB with `INVALID_INPUT` 400) + optional `country` → store bytes in uploadStore → build self-origin URL `{origin}/v1/visual-search/images/{id}` → provider search → same `{ matches }` envelope. Error taxonomy unchanged (`INVALID_INPUT`/`UPSTREAM_FAILED` 502/`UPSTREAM_TIMEOUT` 504/`INTERNAL_ERROR` 500); uploadStore misses degrade to `UPSTREAM_FAILED`. Depends on T007, T008.

### Mobile implementation

- [X] T010 [P] [US1] Create `apps/mobile/src/services/subject-lift.ts` — the NEW one-seam module (contracts/pipeline.md §1): ONLY file importing `@six33/react-native-bg-removal`; `isAvailable()` cached capability probe (false on web/error); `liftSubject(uri) → LiftOutcome` (`ok` with `IsolatedGarment` | `unsupported` | `failed` | `degenerate`); every library call in try/catch — the seam never throws (Constitution VII); exported pure degenerate rule (result bounds < 4% of source area ⇒ `degenerate`); `trim` enabled by default (FR-004). Why-comments: the seam pattern and the probe-once cache.
- [X] T011 [US1] Create `apps/mobile/src/features/visual-search/hooks/useSubjectLift.ts` — isolation lifecycle: probe, lift, degenerate/failure → manual-crop join; produces the immutable session-local `IsolatedGarment` (`uri/width/height/method/sourceUri`, data-model.md §1) exactly once per pipeline run. Depends on T010.
- [X] T012 [US1] Create `apps/mobile/src/features/visual-search/hooks/useLiftSearch.ts` — the `LiftSearchState` discriminated-union stage machine (data-model.md §2, contracts/pipeline.md §2): `idle → isolating → manualCrop? → preparing → matching → assembling → done | failed(failedStage)`; stages announced ONLY when genuinely begun with the four contract copy strings; `failed` preserves the garment and retry re-enters at `failedStage` (isolation NEVER re-runs — FR-009); zero matches ⇒ `done` with empty result (003 rule); monotonic request token guards stale async; multipart upload to POST /v1/visual-search (10s abort budget precedent, cold-start honest retry copy "waking the search service"); derives `resultSetId` locally (e.g., response timestamp+hash); holds the per-resultSetId jackpot fired-flag. Why-comment the honest-progress state machine. Depends on T004, T011.
- [X] T013 [P] [US1] Create `apps/mobile/src/features/visual-search/components/LiftStage.tsx` — while `isolating`: perimeter trace around the photo card (004 NeonTracingOverlay idiom — spring runner, stacked translucent borders, no SVG path, no blur); on completion: background layer fades under the isolated PNG while the subject springs to scale 1.05 and back (interruptible, from current values) synchronized with ONE `confirm()` beat via `scheduleOnRN` (FR-003; Reanimated v4 — no `runOnJS`). Reduce-motion: static boundary treatment + static swap, beat survives (contracts/pipeline.md §4).
- [X] T014 [P] [US1] Create `apps/mobile/src/features/visual-search/components/PipelineProgress.tsx` — four segments, one per stage; a segment spring-fills ONLY on its stage's genuine completion; active segment carries a breathing pulse (ScanPulseWave idiom) so nothing is static >1.5s in flight (SC-001) without fabricated percentages (FR-008); transform/opacity only (Constitution III); failed segment adopts the error treatment and the bar never resets on retry; reduce-motion: no breathing, discrete cross-fade fills (contracts/pipeline.md §3).
- [X] T015 [P] [US1] Create `apps/mobile/src/features/visual-search/components/ManualCropMarquee.tsx` — draggable/resizable rect (gesture-handler pan on body = move, corner handles = resize, handles ≥44pt hit targets), rect clamped to image bounds with spring settle on release; confirm → crop via expo-image-manipulator → `IsolatedGarment` with `method: 'manual'` joining the pipeline at `preparing`; cancel → back to capture, nothing marked; reason-specific supportive copy (unsupported → "Using manual precision crop for optimal visual matching."; liftFailed/degenerate → "Let's frame it by hand — drag to fit your piece."); reduce-motion: direct rect updates, fully usable. Why-comment the activate-vs-observe gesture distinction vs 007's tilt (contracts/pipeline.md §5).
- [X] T016 [US1] Create `apps/mobile/src/app/(app)/visual-search.tsx` — NEW fullscreen route (substack precedent, R12): capture (expo-camera) / import (expo-image-picker) / "try the sample" affordances (sample path reuses the existing `useVisualSearch` demo hook, preserving 003 behavior); wires useSubjectLift + useLiftSearch + LiftStage + PipelineProgress + ManualCropMarquee; designed failure states per the contracts/pipeline.md §6 taxonomy (photo permission/storage, network, provider 502/504 incl. Render cold start, "nothing to lift"); designed no-matches state; on a completed real search with ≥1 match, upsert ONE vault entry (`source: 'lift'`, `imageUri` = SOURCE photo via the existing persistImage flow, `matches` = returned matches, `garments: []` — data-model.md §7). Depends on T005, T012, T013, T014, T015.
- [X] T017 [US1] Modify `apps/mobile/src/features/visual-search/components/DemoScanCard.tsx` into the visual-search entry card (Home card opens the new route) and retire `apps/mobile/src/app/(app)/demo-scan.tsx` (route removed — the sample path in visual-search.tsx carries the demo FRs; `ProductMatchCard.tsx` and `useVisualSearch.ts` stay untouched). Depends on T016.

### Device verification

- [ ] T018 [US1] Run quickstart.md Pass 1 (Subject Lift & pipeline — SC-001, SC-002, SC-007: trace, lift beat, honest segments, <1s first feedback, mid-pipeline network kill preserves garment, plain-wall "nothing to lift", isolated-vs-raw relevance spot check) and Pass 2 (fallback floor — SC-004: marquee ergonomics, 20-attempt manual pass, web probe unavailable without crash) on a physical iPhone + one unsupported device/sim + web. Depends on T002, T009, T017, and a deployed/reachable API with `SERPAPI_API_KEY`.

**Checkpoint**: US1 is the shippable MVP — isolation, honest pipeline, fallback floor, and real matches end-to-end.

---

## Phase 4: User Story 2 - The Cascading Match Wall (Priority: P2)

**Goal**: Matches enter as a two-column masonry waterfall (cumulative stagger ≤640ms, zero layout shift) and the isolated garment reads clearly on a solid dark elevated hero card over any backdrop.

**Independent Test**: Trigger a search returning ≥8 matches: staggered cascade completes within budget with zero shift of visible content; white/black/busy garments all stay legible on the hero card; reduce-motion gives plain fades with identical information (quickstart Pass 3).

- [X] T019 [P] [US2] Create `apps/mobile/src/features/visual-search/utils/masonry-split.ts` — pure greedy shortest-column assignment (~20 lines, independently testable): aspect from `thumbnail_width/height` when provided, 1:1.2 default; split computed BEFORE render so layout shift is zero by construction (R7). Why-comment the greedy split.
- [X] T020 [P] [US2] Create `apps/mobile/src/features/visual-search/components/MatchCard.tsx` — base match card extending the ProductMatchCard idiom (thumbnail, title, store name, verbatim price string, link-out), semantic theme tokens only (no hex literals), animates only on first appearance, never on scroll recycle. (Savings pill, harmony ring, and jackpot slots are added by US3–US5.)
- [X] T021 [US2] Create `apps/mobile/src/features/visual-search/components/MatchWall.tsx` — two vertical stacks from `masonry-split` inside the existing scroll; entry via house `FadeInDown.springify()` with per-card delay `min(index * 80, 640 − settle)` so cumulative stagger ≤640ms for ANY result count (FR-010); reduce-motion: plain fades, no stagger (`ReduceMotion.System`); designed no-matches state, never a blank wall (contracts/match-presentation.md §2). Depends on T019, T020.
- [X] T022 [US2] Implement the isolated-garment hero treatment (contracts/match-presentation.md §1, R11) in the results scene of `apps/mobile/src/app/(app)/visual-search.tsx` (hero rendering shared with `LiftStage.tsx`): transparent PNG on a SOLID dark elevated card (`bg-header`-family token, rounded-3xl, native shadow offset {0,6} / opacity ~0.25 / radius ~12) — NO blur/glass anywhere on this surface; hero above the fold, primary actions in the thumb band; wire `MatchWall` below the hero for the `done` state. Depends on T021.
- [ ] T023 [US2] Run quickstart.md Pass 3 (cascade & hero — SC-003: ≤640ms cascade with zero layout shift over 10 varied result sets; SC-008: white/black/busy garments legible on the dark hero card in bright light; smooth 20-match scroll; designed no-matches state) on a physical iPhone. Depends on T002, T022.

**Checkpoint**: US1 + US2 — the results scene is a designed shopping moment, not a list.

---

## Phase 5: User Story 3 - Price-Advantage Framing (Priority: P3)

**Goal**: Cheaper matches carry an arithmetically verifiable "{X}% less than comparable retail" label anchored to the highest-priced same-currency comparable match (CL-002); absence of data produces absence of claim.

**Independent Test**: A result set with ≥2 same-currency priced matches labels cheaper cards with verifiable percentages and leaves the anchor unlabeled; sets with <2 priced matches or unreliable price data show zero claims (quickstart Pass 4).

- [X] T024 [P] [US3] Create `apps/mobile/src/features/visual-search/utils/price-anchor.ts` — pure `deriveSavings(matches) → SavingsLabel[]` (data-model.md §4, R4): consider only matches with `price_value` + `currency`; partition by currency and use the MODAL currency's set; require ≥2 priced matches else no labels at all; anchor = highest `price_value` (anchor match never labeled); label only where floored `percent ≥ 1`; deterministic (identical inputs → identical labels, SC-005). Why-comment the currency-partitioned anchor math.
- [X] T025 [US3] Render the savings label in `apps/mobile/src/features/visual-search/components/MatchCard.tsx` ONLY from `deriveSavings` output (wired through `MatchWall.tsx`): quiet pill (existing pill idiom, `bg-primary` family), copy exactly "{percent}% less than comparable retail" — the word *comparable* is contractual (contracts/match-presentation.md §3); no label under any ambiguity (FR-013). Depends on T020, T024.
- [ ] T026 [US3] Run quickstart.md Pass 4 (savings labels — SC-005: hand-verify arithmetic on 5 cards, anchor card unlabeled, <2-priced/mixed-currency sets show zero labels, display-price-only matches make no claim) on a physical iPhone. Depends on T002, T025.

**Checkpoint**: US1–US3 — the savings story is live and every claim is auditable.

---

## Phase 6: User Story 4 - Wardrobe Harmony Score (Priority: P4)

**Goal**: A deterministic 0–100 harmony ring derived only from the user's actual vault (007 style profile), rendered only for genuinely personalized profiles — empty/uncategorized vaults see nothing.

**Independent Test**: With ≥5 categorized vault looks, a complementary-category match scores higher than an unrelated one and identical inputs re-render to identical scores; a fresh install shows no ring or coordination copy anywhere (quickstart Pass 5).

- [X] T027 [P] [US4] Create `apps/mobile/src/features/visual-search/utils/harmony.ts` — pure `harmonyScore(match, profile) → number | null` over the existing 007 `deriveStyleProfile` output (data-model.md §5, R8): `null` when `!profile.personalized` or the match yields no taxonomy tokens (FR-014, honest absence); components = category affinity (match title/category tokens vs profile category weights) + complementarity (small static complement table, e.g. tops ↔ bottoms/outerwear); normalized integer 0–100; deterministic; NO color inputs (007 R8 — colors stay reserved).
- [X] T028 [P] [US4] Create `apps/mobile/src/features/visual-search/components/HarmonyRing.tsx` — compact single-arc dash-offset ring (007 DailyCycleRing idiom, react-native-svg + `useAnimatedProps`, UI thread) springing 0→score on first viewport entry; the numeric value beside it MUST equal the arc fill (FR-015); reduce-motion: static ring at value + number.
- [X] T029 [US4] Integrate the harmony ring into `apps/mobile/src/features/visual-search/components/MatchCard.tsx`, rendered ONLY when `harmonyScore()` returns non-null (profile wired from the vault via `MatchWall.tsx`/route); copy claims category coordination only ("pairs with your recent scans") — never color intelligence (contracts/match-presentation.md §4). Depends on T020, T027, T028.
- [ ] T030 [US4] Run quickstart.md Pass 5 (harmony — SC-005: ring springs to value on first entry, number equals fill, complementary > unrelated, identical re-render scores, fresh-install shows NO ring, copy audit for color claims) on a physical iPhone. Depends on T002, T029.

**Checkpoint**: US1–US4 — personalized exploration on top of the working wall.

---

## Phase 7: User Story 5 - The Perfect Match Moment (Priority: P5)

**Goal**: Provider-flagged exact duplicates (`exact === true` only, CL-003) get a bounded shimmer + static "Exact match" badge, with one `celebrate()` beat per result set on first exposure; no provider signal ⇒ the tier stays dormant.

**Independent Test**: Force a known exact-duplicate result: shimmer plays ~3 sweeps and settles to the badge with one success haptic; scrolling away and back never re-fires; ordinary close matches never trigger it (quickstart Pass 6).

- [X] T031 [US5] Implement the jackpot treatment in `apps/mobile/src/features/visual-search/components/MatchCard.tsx` — trigger is `match.exact === true` ONLY (no local heuristic may set it, FR-016): expo-linear-gradient band inside the card's own stacking context, translateX driven by `withRepeat(withSequence(withSpring…))` for a bounded ~3 sweeps on first exposure, settling to a static "Exact match" badge (R9); reduce-motion: static badge only (information, not rhythm). Depends on T020.
- [X] T032 [US5] Wire the once-per-result-set celebration: `celebrate()` beat (services/tactile.ts, via `scheduleOnRN`) fired on the FIRST exposed exact card, guarded by the per-`resultSetId` fired-flag in `apps/mobile/src/features/visual-search/hooks/useLiftSearch.ts` and exposure wiring in `MatchWall.tsx`; scroll-back never re-fires; multiple exact matches → every card badged, shimmer + beat play once (contracts/match-presentation.md §5). Depends on T012, T021, T031.
- [ ] T033 [US5] Run quickstart.md Pass 6 (perfect match: mass-market item returns exact card(s) with badge, ~3 sweeps then settle, ONE celebrate beat per result set, no re-fire on scroll-back, exact-section-free result sets stay dormant) on a physical iPhone. Depends on T002, T032.

**Checkpoint**: All five stories functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility sweep, constitution cross-checks, quality gate, retrospective.

- [ ] T034 Run quickstart.md Pass 7 — Reduce Motion ON, abbreviated re-run of Passes 1–6 (SC-006): trace → static boundary; segment breathing off (copy + discrete fills remain); lift scale flourish off but confirm beat present; cascade → plain fades; ring static at value; shimmer → static badge + celebrate beat; every flow completable with equivalent information, zero repeating animations. Depends on T018, T023, T026, T030, T033.
- [X] T035 [P] Run the quickstart Cross-check sweep over the new/modified files: zero `Easing.linear`, zero `runOnJS` (Reanimated v4 — `scheduleOnRN` only), zero haptics imports outside `apps/mobile/src/services/tactile.ts`, zero bg-removal imports outside `apps/mobile/src/services/subject-lift.ts`, zero hex literals in new components (semantic tokens only); API: uploaded image GET 404s after TTL, nothing written to disk server-side, `SERPAPI_API_KEY` never logged.
- [X] T036 Quality gate: `npm run lint` + `npx tsc --noEmit` in BOTH `apps/mobile` and `apps/api` — zero errors (plan.md Testing).
- [X] T037 [P] Record a `/lessons` entry covering the rebuild/native-module outcome (T001/T002 findings), the provider exact-section shape as verified live (T006), and any pipeline/upload breakthroughs (Retrospective Discipline, CLAUDE.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first; T002 depends on T001 and blocks ONLY device-verification tasks (T018, T023, T026, T030, T033, T034) — all code tasks can proceed while the rebuild is pending.
- **Foundational (Phase 2)**: T003/T004/T005 independent [P]; T006 depends on T003. BLOCKS all user story phases.
- **US1 (Phase 3)**: depends on Foundational. Internal chains: T007 → T008 → T009 (API); T010 → T011 → T012 → T016 → T017 (mobile core); T013/T014/T015 parallel with the hook chain, all feeding T016; T018 last (needs T002 + T009 + T017 + deployed API).
- **US2 (Phase 4)**: depends on Foundational; layers onto US1's route/results state. T019/T020 [P] → T021 → T022 → T023.
- **US3 (Phase 5)**: depends on Foundational + T020. T024 [P] → T025 → T026.
- **US4 (Phase 6)**: depends on Foundational + T020 (+ existing 007 style profile). T027/T028 [P] → T029 → T030.
- **US5 (Phase 7)**: depends on Foundational (provider `exact` from T006) + T012 + T020/T021. T031 → T032 → T033.
- **Polish (Phase 8)**: T034 after all device passes; T035/T037 [P] anytime after their inputs exist; T036 before calling the feature done.

### User Story Dependencies

- **US1 (P1)**: only Foundational — the standalone MVP.
- **US2 (P2)**: presentation layer over US1's `done` state; MatchWall/MatchCard are new files, independently buildable, wired into the US1 route.
- **US3 (P3)**: pure util + a pill on US2's MatchCard.
- **US4 (P4)**: pure util + ring on US2's MatchCard; needs an established vault for meaningful verification.
- **US5 (P5)**: badge/shimmer on US2's MatchCard + the US1 stage machine's fired-flag.

### Parallel Opportunities

- Phase 2: T003, T004, T005 together.
- US1: T007 (API) alongside T010 (mobile seam); T013, T014, T015 (three independent components) together while T011/T012 build the hooks; the whole API chain (T007–T009) in parallel with the whole mobile chain until T012 needs the endpoint live for end-to-end.
- US2: T019 + T020 together. US4: T027 + T028 together.
- Once Foundational completes, US2's pure utils/components (T019, T020) can start in parallel with late US1 work — different files.
- T002 (rebuild) runs concurrently with any code task.

---

## Parallel Example: User Story 1

```bash
# After Foundational — start API and mobile seams simultaneously:
Task: "T007 Create apps/api/src/services/visualSearch/uploadStore.ts"
Task: "T010 Create apps/mobile/src/services/subject-lift.ts"

# While hooks (T011, T012) are being built, all three presentational components in parallel:
Task: "T013 Create LiftStage.tsx"
Task: "T014 Create PipelineProgress.tsx"
Task: "T015 Create ManualCropMarquee.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (T001 install + verify; kick off T002 rebuild in parallel).
2. Phase 2 (types + provider).
3. Phase 3 (US1) — API chain + mobile chain.
4. **STOP and VALIDATE**: quickstart Passes 1–2 on device (T018). This alone is the shippable "found it" capability.

### Incremental Delivery

1. US1 → device passes → MVP.
2. US2 → Pass 3 → the designed shopping moment.
3. US3 → Pass 4 → savings story.
4. US4 → Pass 5 → personalization.
5. US5 → Pass 6 → delight tier (may legitimately stay dormant if the provider tier lacks the exact section — CL-003).
6. Phase 8 polish (reduce-motion sweep + cross-checks + quality gate + /lessons).

---

## Notes

- Tasks marked [P] touch different files with no incomplete-task dependencies.
- Pure utils (T010's degenerate rule, T019, T024, T027) and the T012 stage machine must be written as independently testable functions even without test files (plan.md Testing).
- One provider call per search (quota rule); budget ~30 real searches across the device passes.
- MatchCard (T020) is deliberately extended in place by T025/T029/T031 — those tasks are sequential on that file, never parallel with each other.
- Commit after each task or logical group; any checkpoint is a valid stopping point.
