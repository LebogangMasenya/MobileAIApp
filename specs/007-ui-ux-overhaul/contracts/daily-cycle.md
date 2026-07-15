# Contract — Daily Wardrobe Cycle (US5)

## §1 Store surface (`services/daily-cycle-store.ts`)

```ts
loadToday(now?: Date): Promise<DailyCycleRecord>   // read-repair rollover (data-model §3)
markSegment(id: SegmentId, now?: Date): Promise<DailyCycleRecord>  // idempotent per day
markCelebrated(now?: Date): Promise<void>
```

Invariants (mirror useVaultVisibility):
- Persist BEFORE state update; corrupt/absent storage ⇒ fresh today-record;
  never throws to callers; `now` injectable for testability (rollover logic
  is a pure exported function `resolveRollover(record, today)`).

## §2 Segment fulfillment mapping (v1 — re-bindable, spec US5 scenario 4)

| SegmentId | Fulfilled when (v1) | Call site |
|-----------|--------------------|-----------|
| `log` | A look is saved to the vault today | scan flow, after successful `upsertEntry` |
| `harmony` | User opens a saved look's detail (engages with wardrobe) | VaultSheet `setOpenEntry` |
| `coordinate` | User confirms a locally-composed outfit suggestion | CoordinateSuggestionSheet |

Future features (real wear-log, color-harmony engine, AI coordinate
generator) re-bind by moving the `markSegment(id)` call — the store, ring,
and record never change.

## §3 Ring rendering (`DailyCycleRing`)

- `react-native-svg`: three `Circle` arcs (stroke-dasharray thirds, gapped,
  round caps) + animated `strokeDashoffset` via `useAnimatedProps` (UI
  thread).
- Segment close: spring sweep + `confirm()` beat (motion-tactility §2/§3).
- Full ring: `RingCelebration` once per day (`celebrated` flag — survives the
  interrupted-celebration edge case: on next mount, `allDone ∧ ¬celebrated`
  simply plays it then).
- Ring shows genuine state only (SC-007): render from `DailyCycleRecord`,
  no optimistic pre-fill. The "incomplete ring open-loop" psychology comes
  from real incompleteness, not fake 66% initialization.
- Placement: a Home dashboard card between GreetingHeader and the rails
  (design pre-flight gate — Constitution II — before building the view).

## §4 CoordinateSuggestionSheet (minimal stand-in, R9)

- Pure local composition: picks garments across ≥2 categories from stored
  `VaultEntry.garments` (crops via existing feature-006 crop util where
  `imageSize` exists; whole-look thumbnails otherwise).
- Empty/tiny vault: sheet explains it needs scans and deep-links to the scan
  tab — a designed cold-start, never a broken zero (spec edge case).
- Confirm action marks `coordinate`; dismissing without confirm marks
  nothing (honest completion).
- No network, no AI calls — this is a placeholder the future generator
  feature replaces wholesale.
