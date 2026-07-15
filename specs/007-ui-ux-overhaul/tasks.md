# Tasks: UI/UX Overhaul — Kinetic Polish, Behavioral Loops & Style Rings

**Input**: Design documents from `/specs/007-ui-ux-overhaul/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R11), data-model.md, contracts/ (motion-tactility, daily-cycle, vault-surfaces), quickstart.md

**Tests**: Not requested — no test framework exists in the repo. The quality gate is `npm run lint` + `npx tsc --noEmit` (zero errors) plus the physical-device quickstart passes. Pure logic (style profile, rollover, journey derivation) MUST still ship as independently testable pure functions (Constitution VIII).

**Organization**: Grouped by user story; each phase is an independently verifiable increment. All paths are relative to `apps/mobile/` unless rooted.

**Design authority**: User waiver 2026-07-14 — no Figma pre-flight for new views; binding condition is theme consistency (semantic Tailwind tokens only, existing card/pill/serif idioms, house spring vocabulary — see plan.md Constitution Check II).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (native deps + rebuild)

**Purpose**: One dev-client rebuild carrying all three new native modules (research R2).

- [X] T001 Install new native dependencies in apps/mobile: `npx expo install expo-haptics react-native-svg expo-linear-gradient` (verify they land in apps/mobile/package.json)
- [ ] T002 Rebuild the custom dev client on a physical iPhone (`npx expo run:ios --device` from apps/mobile), confirm the app boots and existing features (scan, vault pull, sharing) still work; document any prebuild/CocoaPods breakthrough in /lessons (Retrospective Discipline)
- [X] T003 Verify installed API surfaces against installed TypeScript types per research R11 — expo-haptics impact/notification signatures, react-native-svg `Circle` + `Animated.createAnimatedComponent`/`useAnimatedProps` interop with Reanimated 4.1, expo-linear-gradient props; note any deviation from plan assumptions in specs/007-ui-ux-overhaul/research.md

**Checkpoint**: Dev client runs with all three modules linked — no user story work before this.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The one cross-story seam every subsequent phase calls into.

- [X] T004 Create the tactile seam in apps/mobile/src/services/tactile.ts per contracts/motion-tactility.md §2 — the ONLY module importing expo-haptics; semantic beats `tick()` (Light), `confirm()` (Medium), `celebrate()` (Success notification + spaced Heavy); every call try/catch fire-and-forget no-op on web/unsupported (Constitution VII); why-comments explaining the seam pattern (device-store precedent)

**Checkpoint**: `tactile.ts` compiles; beats no-op silently on web. User stories can now proceed (US1–US5 are mutually independent after this).

---

## Phase 3: User Story 1 — The Living Scan (Priority: P1) 🎯 MVP

**Goal**: Replace the static ActivityIndicator busy pill with a spring-driven blooming pulse wave + breathing glow + peak-synced haptic ticks that hard-stop on scan resolution.

**Independent Test**: Quickstart Pass 1 — scan on device: wave loops fluidly with one tick per bloom peak; 5/5 scans (incl. one forced failure) end with zero zombie waves (SC-002); 60s interaction with no hitching (SC-001); reduce-motion shows the static equivalent.

- [X] T005 [P] [US1] Create ScanPulseWave in apps/mobile/src/features/scan-overlay/components/ScanPulseWave.tsx — stacked plain `Animated.View` rings (NO SVG here, research R3): staggered loops scale 0.8→2.5 / opacity 1→0 via `withRepeat(withSequence(withSpring…))` (R4, NeonTracingOverlay idiom), breathing under-glow, z-10 band (motion-tactility §5), `useReducedMotion()` → static soft double-ring + "Searching…" variant (§3 matrix), entrance/exit springs interruptible from current value
- [X] T006 [US1] Add haptic peak sync inside ScanPulseWave per research R5 — `useAnimatedReaction` on the lead ring's loop phase crossing its peak → `scheduleOnRN(tick)` from services/tactile.ts; gated on (scan-active ∧ !reducedMotion); never a continuous buzz (depends on T004, T005)
- [X] T007 [US1] Integrate into apps/mobile/src/app/(app)/(tabs)/scan.tsx — mount ScanPulseWave while `scan.state.phase === 'submitting' || seg.state.phase === 'segmenting'` (the current busy-pill windows, scan.tsx:252); status label becomes a glass pill per motion-tactility §4 (expo-glass-effect over camera chrome, `border border-white/20`, solid `bg-black/70` fallback on Android/web); resolution springs the wave to rest within one beat (§6) — coexists with NeonTracingOverlay in the z-10 band, preserves the z-band contract comment block
- [ ] T008 [US1] Run quickstart.md Pass 1 on a physical iPhone (SC-001, SC-002, reduce-motion variant); record results in specs/007-ui-ux-overhaul/quickstart.md as a dated verification note

**Checkpoint**: Scanning feels alive end-to-end — MVP shippable.

---

## Phase 4: User Story 2 — Tactile Garment Cards (Priority: P2)

**Goal**: Vault cards tilt toward the finger with a light sheen and spring back to rest — without ever stealing scroll, tap, or long-press-delete.

**Independent Test**: Quickstart Pass 2 — scripted 20-gesture pass (8 scrolls-on-card, 6 taps, 4 long-presses, 2 tilts): 0 hijacks, 0 suppressed actions (SC-003); reduce-motion disables tilt but keeps press feedback.

- [X] T009 [P] [US2] Create TactileTiltCard in apps/mobile/src/components/TactileTiltCard.tsx per contracts/vault-surfaces.md §1 — **observation-only** `Gesture.Manual` (research R6: tracks onTouchesDown/Move/Up/Cancelled, NEVER calls activate()) driving rotateX/rotateY shared values (perspective 800, maxTilt default 10°, high-damping/low-stiffness springs); release/cancel springs to rest; `disabled` prop ∪ `useReducedMotion()` renders children untouched; educational why-comments on the never-activates arena trick (Constitution VI)
- [X] T010 [US2] Add the light sheen inside TactileTiltCard — expo-linear-gradient white→transparent overlay, `pointerEvents="none"`, horizontal offset interpolated from tilt shared values, contained in the card's own stacking context (no global z) (same file as T009 — sequential, not parallel)
- [X] T011 [US2] Wrap the card body in apps/mobile/src/features/vault/components/VaultEntryCard.tsx with TactileTiltCard — preserve the entrance stagger, Pressable tap → detail, long-press → delete alert, and the conditional share affordance exactly as they are (FR-008: byte-for-byte behavior outside tilt)
- [ ] T012 [US2] Run quickstart.md Pass 2 on device (SC-003 scripted 20-gesture pass + reduce-motion check); record results as a dated verification note

**Checkpoint**: US1 + US2 both verified; vault browsing feels physical.

---

## Phase 5: User Story 3 — Momentum-Framed Welcome (Priority: P3)

**Goal**: First-run vault never shows a cold zero — a Setup Journey shows genuinely-completed steps (account, camera) as ~20–25% progress with one clear CTA.

**Independent Test**: Quickstart Pass 3 — fresh install: journey shows Account ✓ / Camera ✓ / progress ~22% / scan CTA; denied camera shows unchecked (honesty audit, SC-007); first scan advances with confirm beat exactly once, then the grid owns the scene.

- [X] T013 [P] [US3] Create useSetupJourney in apps/mobile/src/features/vault/hooks/useSetupJourney.ts per data-model.md §1 — derive steps from real state only: auth session (mock-auth-provider), `expo-camera` permission status, vault entry count via loadEntries(); every read defensive → `done: false` on failure (Constitution VII); progress is a pure exported function of steps (independently testable, Constitution VIII); once-only celebration flag `satori.journey.celebrated.v1` via services/device-store.ts (useVaultVisibility persist-before-state pattern)
- [X] T014 [P] [US3] Create VaultWelcomeJourney in apps/mobile/src/features/vault/components/VaultWelcomeJourney.tsx per contracts/vault-surfaces.md §2 — theme-consistent (bg-surface-card rounded-3xl, font-serif heading, bg-primary rounded-full min-h-12 CTA, ink/ink-muted text — waiver conditions); checked steps + spring-driven progress bar (reduce-motion: cross-fade); no raw zero count anywhere (FR-009); CTA invokes a `onScanPress` prop
- [X] T015 [US3] Integrate in apps/mobile/src/features/vault/components/VaultSheet.tsx — replace the `empty` variant usage of VaultEmptyState with VaultWelcomeJourney (keep the `error` variant untouched); wire `onScanPress` to the sheet's `onClose` (returns to capture); on first-scan completion play the journey advance + `confirm()` beat once via the celebration flag (FR-010)
- [ ] T016 [US3] Run quickstart.md Pass 3 on device (fresh install, honesty audit incl. denied-camera case, once-only celebration); record results as a dated verification note

**Checkpoint**: New-user cold start is momentum, not homework.

---

## Phase 6: User Story 4 — Smart Defaults (Priority: P4)

**Goal**: A Style-Profile-driven category filter rail in the vault, smart-preselected with truthful micro-copy (research R7: the rail is the FR-011 surface; no manual categorization step exists).

**Independent Test**: Quickstart Pass 4 — with ≥5 looks across ≥2 categories: top personal category pre-highlighted + "Smart-picked from your recent scans"; one tap on "All" clears it; fresh install shows season copy with NO personalization claim (SC-007); empty filter result is a designed state.

- [X] T017 [P] [US4] Create deriveStyleProfile in apps/mobile/src/features/vault/utils/style-profile.ts per data-model.md §2 — pure function over (VaultEntry[], now): recency-weighted category frequencies (30-day half-life on capturedAt), season from device date, `personalized` flag true iff categories non-empty; NO color dimension (research R8 — reserved optional field documented); v1-migrated/demo entries with empty garments contribute nothing (honest absence)
- [X] T018 [P] [US4] Create VaultFilterRail in apps/mobile/src/features/vault/components/VaultFilterRail.tsx per contracts/vault-surfaces.md §3 — horizontal chip row ("All" always first, then categories by profile weight), springy selection transitions, micro-copy line: personalized → "Smart-picked from your recent scans", cold start → "Fresh picks for {season}" (truthful by the `personalized` gate, FR-011/SC-007); theme tokens only
- [X] T019 [US4] Integrate in apps/mobile/src/features/vault/components/VaultSheet.tsx — session-local filter state initialized from the profile's top category when personalized; grid filters by selected category (entries with a matching garment category); designed "no {category} looks yet" empty-filter state (never a blank grid, Constitution VII); rail hidden while the vault is empty (journey owns that scene); one-tap "All" clears preselect (FR-011 no-extra-steps)
- [ ] T020 [US4] Run quickstart.md Pass 4 on device (preselect, one-tap clear, cold-start truthfulness, empty-filter state); record results as a dated verification note

**Checkpoint**: Filters think for the user without lying to them.

---

## Phase 7: User Story 5 — Style Rings Daily Cycle (Priority: P5)

**Goal**: A three-segment SVG daily ring on Home (log / harmony / coordinate), device-local rollover, spring segment closes with confirm beats, once-per-day full-ring celebration, and a minimal local coordinate-suggestion stand-in.

**Independent Test**: Quickstart Pass 5 — complete all three actions: each segment sweeps closed with a beat; full ring celebrates exactly once (kill-app-mid-celebration resumes safely); segments persist across relaunch same-day; date+1 resets; empty vault gets the designed cold start.

- [X] T021 [P] [US5] Create daily-cycle-store in apps/mobile/src/services/daily-cycle-store.ts per data-model.md §3 + contracts/daily-cycle.md §1 — versioned JSON at `satori.dailycycle.v1` via services/device-store.ts; pure exported `resolveRollover(record, today)` (read-repair on date-string mismatch; same-date timezone change keeps earned segments); `loadToday`/`markSegment` (idempotent, ISO completion timestamps, persist-before-state)/`markCelebrated`; corrupt/absent → fresh today-record, never throws (Constitution VII)
- [X] T022 [P] [US5] Create useDailyCycle in apps/mobile/src/features/style-rings/hooks/useDailyCycle.ts — exposes today's record, `markSegment(id)`, `allDone`, and celebration orchestration (`allDone ∧ ¬celebrated` → fire once, resume-safe on next mount); refreshes on screen focus so rollover repairs at day boundaries
- [X] T023 [P] [US5] Create DailyCycleRing in apps/mobile/src/features/style-rings/components/DailyCycleRing.tsx per contracts/daily-cycle.md §3 — react-native-svg: three gapped round-cap `Circle` arcs (stroke-dasharray thirds), animated `strokeDashoffset` via `Animated.createAnimatedComponent` + `useAnimatedProps` (UI thread, Constitution III); segment close = spring sweep + `confirm()` beat; reduce-motion = fade-to-closed + beat (motion-tactility §3); renders genuine state only — no optimistic pre-fill (SC-007); theme palette (primary/plum family on surface-card)
- [X] T024 [P] [US5] Create RingCelebration in apps/mobile/src/features/style-rings/components/RingCelebration.tsx — full-ring moment visibly bigger than a segment close (scale/glow springs + `celebrate()` beat); Home-local overlay, never mounts into the scan z-band (motion-tactility §5); reduce-motion = static congratulation card + beat
- [X] T025 [US5] Create CoordinateSuggestionSheet in apps/mobile/src/features/style-rings/components/CoordinateSuggestionSheet.tsx per contracts/daily-cycle.md §4 — pure local composition picking garments across ≥2 categories from stored VaultEntry.garments (feature-006 crop util where imageSize exists, whole-look thumbnails otherwise); confirm → `markSegment('coordinate')`, dismiss marks nothing; empty/tiny vault → designed cold-start deep-linking to the scan tab; explicitly commented as the future generator's placeholder (depends on T021, T022)
- [X] T026 [US5] Integrate the ring card on Home in apps/mobile/src/app/(app)/(tabs)/index.tsx — DailyCycleRing + segment labels + "Style me" entry to CoordinateSuggestionSheet in a surface-card between GreetingHeader and the rails; FadeInDown.springify entrance matching house style; RingCelebration overlay wiring
- [X] T027 [US5] Wire fulfillment call sites per contracts/daily-cycle.md §2 — `markSegment('log')` in apps/mobile/src/app/(app)/(tabs)/scan.tsx after the successful vault `upsertEntry`; `markSegment('harmony')` in apps/mobile/src/features/vault/components/VaultSheet.tsx on saved-look detail open (`setOpenEntry`); both fire-and-forget, never blocking the scan/vault flows (Constitution VII)
- [ ] T028 [US5] Run quickstart.md Pass 5 on device (segment closes, once-only celebration + interrupt resume, same-day persistence, date+1 rollover, timezone keep, cold start); record results as a dated verification note

**Checkpoint**: All five stories independently verified.

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Sweeps that span every story + the quality gate.

- [ ] T029 [P] Run quickstart.md Pass 6 — reduce-motion sweep of all five stories (SC-008 completeness), glass contrast check over a white garment in bright light (≥4.5:1), Android fallback pill, web boot (`npm run web`: haptics no-op, tilt inert, ring static); record results
- [X] T030 [P] Compliance grep sweep over apps/mobile/src — zero `Easing.linear`, zero `runOnJS` (Reanimated 4: `scheduleOnRN` only), zero `expo-haptics` imports outside services/tactile.ts, zero hex color literals in the new components (semantic tokens only per waiver condition)
- [X] T031 Clamp the pull-hint opacity in apps/mobile/src/features/vault/components/VaultRevealContainer.tsx (`handleHintStyle`: `1 - progress.value * 2` goes to −1 at full open — wrap in Math.max(0, …)) — pre-existing latent issue adjacent to this overhaul's motion sweep
- [X] T032 Quality gate: `npm run lint` and `npx tsc --noEmit` from apps/mobile with zero errors (Constitution: Verification Rule) — code is not complete until this passes
- [X] T033 Update /lessons with any non-obvious breakthroughs from the rebuild, SVG↔Fabric interplay, or Gesture.Manual arena behavior (Retrospective Discipline); update specs/007-ui-ux-overhaul/checklists/requirements.md notes if scope shifted

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: None — but T002 (rebuild) requires a physical device session
- **Phase 2 (Foundational)**: T004 needs T001–T002 (expo-haptics linked) — BLOCKS all stories
- **Phases 3–7 (US1–US5)**: Each needs only Phase 2. **The five stories are mutually independent** — any order or in parallel
- **Phase 8 (Polish)**: After all desired stories

### Within-Story Dependencies

- US1: T005 → T006 → T007 → T008 (T005 parallel with other stories' starts)
- US2: T009 → T010 → T011 → T012
- US3: T013 ∥ T014 → T015 → T016
- US4: T017 ∥ T018 → T019 → T020
- US5: T021 ∥ T022 ∥ T023 ∥ T024 → T025 → T026 → T027 → T028

### Cross-story file-collision warning

VaultSheet.tsx is touched by US3 (T015), US4 (T019), and US5 (T027); scan.tsx by US1 (T007) and US5 (T027). If running stories in parallel, serialize those specific tasks.

## Parallel Example: after Phase 2

```bash
# Kick off every story's first wave simultaneously (different files):
Task: "T005 ScanPulseWave in features/scan-overlay/components/ScanPulseWave.tsx"
Task: "T009 TactileTiltCard in components/TactileTiltCard.tsx"
Task: "T013 useSetupJourney in features/vault/hooks/useSetupJourney.ts"
Task: "T017 deriveStyleProfile in features/vault/utils/style-profile.ts"
Task: "T021 daily-cycle-store in services/daily-cycle-store.ts"
```

## Implementation Strategy

**MVP first**: Phases 1–3 only (Setup → tactile seam → Living Scan) = the highest-visibility win, shippable and device-verified on its own (SC-001/002).

**Incremental delivery**: One story per increment in priority order, running that story's quickstart pass before starting the next — each pass doubles as the outstanding device-verification discipline this repo already tracks (005/006 passes pending).

**Single-developer reality** (this repo): sequential P1→P5 is the recommended path; the parallel waves matter mainly for batching [P] file creation within a story.

## Notes

- Every animated component reads `useReducedMotion()` directly — no wrapper hook (research R10, Constitution IV)
- Persist-before-state for every stored flag (useVaultVisibility precedent)
- Educational why-comments are part of each task's definition of done (Constitution VI)
- Commit after each task or logical group; stop at any checkpoint to validate
