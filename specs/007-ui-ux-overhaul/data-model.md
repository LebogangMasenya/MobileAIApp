# Data Model — 007 UI/UX Overhaul

Three small models. Two are **pure derivations** (never persisted — honesty
by construction, SC-007); one is a tiny persisted record. No changes to
`VaultIndex` v2.

## 1. SetupJourney (derived, US3)

```ts
type JourneyStepId = 'account' | 'camera' | 'firstScan';

interface JourneyStep {
  id: JourneyStepId;
  /** Human label — "Account ready", "Camera calibrated", "Scan your first piece". */
  label: string;
  done: boolean;
}

interface SetupJourney {
  steps: JourneyStep[];          // fixed order: account → camera → firstScan
  /** 0–1. Derived: base 0.22 when any setup step is done; 1 when firstScan done. */
  progress: number;
  /** True once firstScan is done — welcome framing retires (FR-010). */
  complete: boolean;
}
```

**Sources of truth** (each read defensively; a failed read ⇒ `done: false`,
never a crash — Constitution VII):

| Step | Derived from |
|------|--------------|
| `account` | Auth session exists (mock-auth-provider today) |
| `camera` | `expo-camera` permission status === granted |
| `firstScan` | `loadEntries().entries.length > 0` |

**Validation/invariants**:
- `progress` is monotone over the fixed step order and MUST be > 0 iff at
  least one step is genuinely done — the ~20–25% initialization (FR-009)
  comes from `account`+`camera` being genuinely done, never a constant.
- No persistence: recomputed per mount ⇒ cannot drift from reality.
- One persisted flag rides beside it: `satori.journey.celebrated.v1`
  (device-store boolean JSON) so the first-scan celebration plays exactly once.

## 2. StyleProfile (derived, US4)

```ts
interface CategoryAffinity {
  category: string;   // as stored on VaultGarment.category
  /** Recency-weighted frequency, normalized 0–1 within the profile. */
  weight: number;
}

interface StyleProfile {
  /** Descending by weight; empty for a cold-start user. */
  categories: CategoryAffinity[];
  /** 'spring'|'summer'|'autumn'|'winter' from device date at derivation. */
  season: Season;
  /**
   * True when categories is non-empty — gates the "from your recent scans"
   * micro-copy (FR-011 truthfulness; a cold start says season-based copy).
   */
  personalized: boolean;
  /** RESERVED (R8): populated only when garment color data exists upstream. */
  colors?: string[];
}
```

**Derivation** (`deriveStyleProfile(entries: VaultEntry[], now: Date)`, pure,
independently testable — Constitution VIII):
- Iterate `entries[].garments[].category`; weight each occurrence by entry
  recency (simple half-life on `capturedAt`, e.g. 30 days).
- Entries with empty `garments` (v1-migrated, demo) contribute nothing —
  honest absence, not fabricated data.

## 3. DailyCycleRecord (persisted, US5)

```ts
type SegmentId = 'log' | 'harmony' | 'coordinate';

interface DailyCycleRecord {
  v: 1;
  /** Device-local calendar date, 'YYYY-MM-DD'. THE rollover key. */
  date: string;
  /** Absent key = not done. Value = ISO timestamp of completion (audit/SC-007). */
  segments: Partial<Record<SegmentId, string>>;
  /** True once the full-ring celebration has played for `date` (edge case: interrupted celebrations). */
  celebrated: boolean;
}
```

**Storage**: JSON under device-store key `satori.dailycycle.v1`
(SecureStore; « 2KB). Parse failures / missing key ⇒ fresh record for today
(the `useVaultVisibility` safe-default pattern).

**State transitions**:

```
load(raw, today):
  parsed invalid ............... → fresh(today)
  parsed.date ≠ today .......... → fresh(today)          // rollover (read-repair)
  parsed.date = today .......... → parsed                 // timezone change mid-day
                                                          // keeps earned segments
markSegment(id):
  segments[id] absent → set to now-ISO, persist-then-update-state
  segments[id] present → no-op (idempotent per day)

allDone = segments has all 3 keys
allDone ∧ ¬celebrated → play celebration once, set celebrated, persist
```

**Invariants**:
- `markSegment` persists BEFORE updating React state (the useVaultVisibility
  write-order rule) so stored value and ring visuals can never disagree.
- The store never throws to callers; failures degrade to in-memory state for
  the session (Constitution VII).
- Fulfillment mapping (which app action calls `markSegment(id)`) lives in
  the callers per contracts/daily-cycle.md — the record is action-agnostic
  (spec US5 scenario 4).

## 4. Transient (non-model) state

Documented for completeness; lives in shared values / component state only:

- **Tilt state** (US2): `touchX, touchY, pressed` per card → rotateX/rotateY/
  sheen offset. Never persisted, dies with the touch.
- **Wave phase** (US1): loop shared values; lifecycle bound to
  `scan.state.phase ∈ {submitting} ∪ seg.state.phase ∈ {segmenting}`.
- **Filter selection** (US4): `VaultSheet` local state, initialized from
  `StyleProfile.categories[0..n]`; intentionally session-local (a persisted
  filter that hides looks across sessions is a support ticket).
