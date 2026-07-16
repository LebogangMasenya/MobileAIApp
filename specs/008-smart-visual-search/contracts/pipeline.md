# Contract — Lift Pipeline (US1)

Binds `useSubjectLift`, `useLiftSearch`, `LiftStage`, `PipelineProgress`,
`ManualCropMarquee`, and `services/subject-lift.ts`.

## §1 The seam (`services/subject-lift.ts`)

The ONLY module importing the background-removal library (one-seam rule —
tactile.ts precedent). Surface:

```ts
isAvailable(): Promise<boolean>       // capability probe, cached; false on web/error
liftSubject(uri: string): Promise<LiftOutcome>
// LiftOutcome = { kind: 'ok'; garment: IsolatedGarment }
//             | { kind: 'unsupported' } | { kind: 'failed' } | { kind: 'degenerate' }
```

- Every library call inside try/catch; any throw → `failed` (Constitution
  VII). The seam never throws.
- Degenerate rule applied HERE (pure helper, exported): result bounds < 4%
  of source area ⇒ `degenerate`.
- `trim` enabled by default (FR-004) — dead transparent pixels removed
  before the pipeline ever sees the image.
- Why-comment duty: explain the seam pattern and the probe-once cache.

## §2 Stage machine (`useLiftSearch`)

Stages: `isolating → preparing → matching → assembling → done | failed`.
Honesty rules (FR-006..009):

- A stage is announced ONLY when its work has begun; copy per stage:
  - isolating: "Isolating garment contours…"
  - preparing: "Preparing your piece…"
  - matching: "Matching global visual catalogs…"
  - assembling: "Assembling your matches…"
- `manualCrop` interposes before `preparing` when the seam returns
  `unsupported`/`failed`/`degenerate`, with reason-specific supportive copy
  (FR-005): unsupported → "Using manual precision crop for optimal visual
  matching."; liftFailed/degenerate → "Let's frame it by hand — drag to fit
  your piece."
- `failed` preserves the IsolatedGarment when one exists; retry re-enters
  at `failedStage` — isolation NEVER re-runs on retry (FR-009).
- Zero matches → `done` with empty result (003 rule: a result, not an
  error) rendering the designed no-matches state.
- Monotonic token invalidates stale async completions (house hook idiom).

## §3 Progress rendering (`PipelineProgress`)

- Four segments, one per stage. A segment fills with a spring ONLY on its
  stage's genuine completion; the ACTIVE segment carries a breathing pulse
  (opacity/scale spring loop — ScanPulseWave idiom) so no visual is static
  >1.5s while in flight (SC-001) without fabricating percentages (FR-008).
- Transform/opacity only (translateX-fill precedent, Constitution III).
- Reduce-motion: no breathing loop; stage copy + discrete segment fills
  (cross-fade) carry the same information (SC-006).
- Failure state: the failed segment adopts the error treatment; the bar
  never resets to zero on retry (earned segments are real history).

## §4 The lift moment (`LiftStage`)

- While `isolating`: perimeter trace around the photo card (NeonTracing
  idiom — spring runner, stacked translucent borders, no blur, z-local).
- On lift completion: background layer fades under the isolated PNG while
  the subject springs to scale 1.05 and back to 1.0 (interruptible, from
  current values), synchronized with ONE `confirm()` beat via
  `scheduleOnRN` (FR-003). One-shot beat → survives reduce-motion; the
  scale flourish does not (static swap instead).
- The isolated hero then renders per match-presentation §1.

## §5 Manual crop marquee (`ManualCropMarquee`)

- Draggable/resizable rect: pan on body moves, pan on corner handles
  resizes; handles ≥44pt hit targets (ergonomics duty); rect clamped to
  image bounds with spring settle on release.
- This gesture ACTIVATES (owns its surface) — the deliberate inverse of
  007's observer tilt; why-comment must teach the distinction.
- Confirm → crop via expo-image-manipulator → IsolatedGarment with
  `method: 'manual'` → pipeline joins at `preparing`. Cancel → back to
  capture/import, nothing marked.
- Reduce-motion: no spring flourishes; direct rect updates; fully usable.

## §6 Failure taxonomy (FR-019)

| Failure | Surface state | Recovery |
|---------|--------------|----------|
| Probe unavailable (web/Android w/o support/old iOS) | manualCrop(unsupported) | crop by hand |
| Lift failed / degenerate | manualCrop(liftFailed/degenerate) | crop by hand |
| Photo permission/storage error | designed error card (scan-surface precedent) | re-pick |
| Upload/network drop | failed(matching), retryable, garment preserved | retry (no re-isolate) |
| Provider 502/504 (incl. Render cold start) | failed(matching), retryable, honest copy ("waking the search service" on first retry) | retry |
| Zero matches | done(empty) — designed no-matches state | new photo / sample |
