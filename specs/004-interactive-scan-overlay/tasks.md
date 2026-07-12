# Tasks: Interactive Scan Overlay (Shared Neon Trace + Hotspots)

**Input**: `plan.md` in this directory (lean tasks-first plan, user-directed 2026-07-12)

**Tests**: Not requested — manual validation via 001/003 quickstart scenarios after adoption, plus zero-error `tsc`/lint gates.

**Organization**: No spec-level user stories exist (tasks-first sprint); phases are grouped by deliverable instead — the three explicit files the user named, then per-surface adoption. All paths relative to `apps/mobile/`. **Zero new dependencies** (user decision — Reanimated layers, no react-native-svg).

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)

---

## Phase 1: Foundational — the three named deliverables

**Purpose**: The shared `features/scan-overlay/` module both surfaces will import.

- [X] T001 Create `src/features/scan-overlay/hooks/useCoordinateTransform.ts`: hook ergonomics over the EXISTING single-source geometry — returns `{ onContainerLayout, containerSize, frame, toLayout(region) }` where `frame` is `containFrame(containerSize, imageSize)` and `toLayout` wraps `regionToLayout`, both imported from `features/scan/utils/layout.ts` (never re-derived — Constitution IV; why-comment explaining the single-source rule); accepts `imageSize: Size` as its argument; `frame`/`toLayout` return null-safe values while the container is unmeasured; strict types, no `any`
- [X] T002 [P] Create `src/features/scan-overlay/components/NeonTracingOverlay.tsx`: dependency-free "SVG pathing" stand-in — a neon light that runs the perimeter of `{ region, frame }`: four absolutely-positioned edge segments whose scale/translate animate in sequence (`withRepeat(withSequence(withSpring…))`) so the highlight travels top → right → bottom → left continuously, over 2 stacked translucent border layers for glow (no native blur — Constitution III); props `{ region, frame, mode: 'tracing' | 'settled' }` with mode changes spring-interpolated (settled = static faded outline, trace paused) exactly like SegmentationOverlay's active/rest handoff; `pointerEvents="none"`; why-comment documenting the rectangle-perimeter-not-silhouette limitation and the SVG/Skia follow-up (plan Technical Context); no `Easing.linear` anywhere
- [X] T003 [P] Create `src/features/scan-overlay/components/InteractionHotspot.tsx`: pressable animated target node generalizing 001's BubbleMarker — pulsing core dot + expanding/fading ring (spring loop), optional `label` badge, props `{ center: { x, y }, index, onPress, label? }` with `index`-based staggered springified entrance; total tap target ≥44pt regardless of visual size (hit slop); `accessibilityRole="button"` + descriptive label; presentational only — placement math stays with the caller (Constitution VIII)
- [X] T004 Foundational verification gate: `cd apps/mobile && npx tsc --noEmit && npx expo lint` — zero errors

**Checkpoint**: The shared module compiles and is importable — adoption can begin on both surfaces in parallel.

---

## Phase 2: Adoption — Demo scan surface (feature 003)

- [X] T005 Adopt in `src/app/(app)/demo-scan.tsx`: replace the `SegmentationOverlay` usage and hand-wired `onLayout`/`containFrame` with `useCoordinateTransform(DEMO_IMAGE_SIZE)` + `<NeonTracingOverlay mode={searching ? 'tracing' : 'settled'}>`; behavior contract unchanged — the trace loops for the entire search and never completes into a blank frame (003 contracts §5)
- [ ] T006 Demo-surface verification: gates zero-error; re-run 003 quickstart Scenario 2 on the simulator (image → neon trace → cards) and Scenario 5 motion checks (backgrounding mid-trace, back-swipe mid-search)

---

## Phase 3: Adoption — Camera scan surface (feature 001)

- [X] T007 Adopt geometry + trace in `src/app/(app)/(tabs)/scan.tsx`: replace the screen's inline `onLayout`/`containFrame` wiring with `useCoordinateTransform` (photo natural size from the captured photo), and swap `SegmentationOverlay` → `NeonTracingOverlay` (`tracing` while `segmenting`, `settled` once garments render) — all existing conditional logic (multi-person selection, busy states, failure overlays) unchanged
- [X] T008 Swap `BubbleMarker` → `InteractionHotspot` in `src/app/(app)/(tabs)/scan.tsx`: keep `resolveBubblePlacements` as the placement source (pass its `center` through), preserve the bubble-tap contract exactly (opens `GarmentDetailModal` via the existing `handleBubblePress`, lazy match fetch untouched); hotspot `label` shows the garment index/category consistent with current bubbles
- [ ] T009 Camera-surface verification: gates zero-error; re-run 001 quickstart scan scenarios (single-person auto-segment, multi-person select, garment tap → detail modal, failure overlays still render above the new visuals)

---

## Phase 4: Polish & Retirement

- [ ] T010 [P] Motion quality audit across both surfaces: perimeter trace loops smoothly through long waits, mode handoff springs (no snap), hotspot pulse doesn't fight the trace visually, 60fps with perf monitor, `grep -rn "Easing.linear" src/` → zero matches (Constitution V)
- [X] T011 Retire replaced components: delete `src/features/scan/components/SegmentationOverlay.tsx` and `BubbleMarker.tsx` once T006 + T009 confirm parity (BUBBLE_DIAMETER consumers move to a constant in InteractionHotspot or the caller); if anything still imports them, fix or document why they stay — no dead code left behind
- [X] T012 [P] Final gates (`tsc` + lint zero-error) and a `/lessons` entry if the Reanimated perimeter-trace technique produced breakthroughs worth preserving (Constitution: Local Retrospective)

---

## Dependencies & Execution Order

- **Phase 1**: T001 first is cleanest (T002/T003 don't depend on it, but reviewers read the geometry story top-down); T002 ∥ T003; T004 last. **Blocks adoption.**
- **Phase 2 ∥ Phase 3**: independent surfaces — parallel if staffed; T007 → T008 (same file, sequence them); each ends with its own verification.
- **Phase 4**: T011 strictly after both T006 and T009 (parity proven before deletion); T010/T012 parallel.

## Notes

- Total: **12 tasks** (T001–T012). Foundational: 4 · Demo adoption: 2 · Camera adoption: 3 · Polish: 3.
- The named deliverables map exactly: `useCoordinateTransform.ts` → T001, `NeonTracingOverlay.tsx` → T002, `InteractionHotspot.tsx` → T003; everything after is adoption + cleanup.
- **Recorded limitation**: the trace runs the region's bounding rectangle, not the garment silhouette — true contour pathing needs react-native-svg/Skia (declined 2026-07-12 to stay dependency-free) and is the natural follow-up feature if the rectangle reads as insufficiently premium on device.
- `scan.tsx` is touched by T007 and T008 — sequence them if parallelizing.
