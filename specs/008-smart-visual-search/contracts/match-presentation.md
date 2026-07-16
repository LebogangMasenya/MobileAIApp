# Contract — Match Presentation (US2–US5)

Binds `MatchWall`, `MatchCard`, `HarmonyRing`, the hero treatment in
`LiftStage`, and the pure utils. 007 motion-tactility rules apply wholesale
(springs only, tactile.ts beats only, reduce-motion matrix, glass
constraints).

## §1 Isolated-garment hero (FR-011, SC-008)

- The transparent PNG renders on a SOLID dark elevated card (`bg-header`
  family token, rounded-3xl, native shadow offset {0,6} / opacity ~0.25,
  radius ~12) — NO blur/glass on app surfaces (007 §4; research R11).
- Contrast duty: hero must stay legible over light/dark/busy contexts —
  the dark card IS the controlled backdrop; verify with a white garment
  (quickstart Pass 6 analogue).
- Hero sits above the fold with the match wall below; primary actions in
  the thumb band (ergonomics duty, waiver condition).

## §2 Cascade & masonry (FR-010, SC-003)

- Two-column masonry via pure `masonry-split.ts` (greedy shortest-column;
  aspect from `thumbnail_width/height`, default 1:1.2). Split computed
  BEFORE render — no measure-then-reflow, zero layout shift by
  construction.
- Entry: house `FadeInDown.springify()` per card; per-card delay =
  `min(index * 80, 640 - settle)` so cumulative stagger ≤ 640ms for ANY
  result count (FR-010). Cards animate only on first appearance, never on
  scroll recycle.
- Reduce-motion: plain fades, no stagger (`ReduceMotion.System` on
  entrances); identical information (SC-006).
- Empty result: designed no-matches state (003 US2 idiom), never a blank
  wall.

## §3 Savings label (FR-012/013, CL-002)

- Rendered ONLY from `deriveSavings` output (pure, currency-partitioned,
  highest-comparable anchor; anchor card unlabeled; <2 priced matches ⇒ no
  labels anywhere).
- Copy: "{percent}% less than comparable retail" — the word *comparable*
  is contractual (the anchor is a comparable match, NOT the original
  garment's MSRP; claiming otherwise violates SC-005).
- Label is a quiet pill on the card (existing pill idiom, `bg-primary`
  family) — an accent, not a siren; no label under any ambiguity.

## §4 Harmony ring (FR-014/015)

- Rendered ONLY when `harmonyScore()` returns non-null (personalized
  profile + usable taxonomy); cold-start users see no ring anywhere
  (honest absence).
- Visual: compact single-arc dash-offset ring (007 DailyCycleRing idiom,
  `useAnimatedProps`, UI thread), springing 0→score on first viewport
  entry; numeric value beside it must equal the arc fill.
- Reduce-motion: static ring at value + number (no sweep).
- Copy claims category coordination only ("pairs with your recent scans")
  — never color intelligence (007 R8 holds).

## §5 Perfect-match jackpot (FR-016, CL-003)

- Trigger: `match.exact === true` ONLY. No local heuristic may set it.
- Treatment: bounded shimmer — gradient band inside the card's own
  stacking context, translateX spring loop, ~3 sweeps, settling to a
  static "Exact match" badge; `celebrate()` beat once per `resultSetId`
  on first exposure (scrolling back never re-fires).
- Reduce-motion: static badge + the one-shot beat (information, not
  rhythm — 007 §2 rule).
- Multiple exact matches in one set: every card gets the badge; the beat
  and shimmer play once (the first exposed card) — a jackpot, not a drum
  roll.

## §6 Entry point & sample path (CL-001, FR-017)

- Home's visual-search card (evolved DemoScanCard) opens the fullscreen
  route: capture / import / "try the sample" affordances.
- The sample path preserves feature 003 behavior (server-resolved demo
  image, existing useVisualSearch hook) so 003's FRs stay verifiable.
- Completed real searches upsert one vault entry (`source: 'lift'`,
  source-photo imageUri, `garments: []`) — the demo-entry precedent.
