# Data Model — 008 Smart Visual Search & Background Isolation

Session-local by design: nothing new persists on the device except the
optional vault entry a completed search writes (existing store). The API
gains one deliberately ephemeral store. No color data anywhere (007 R8
precedent holds).

## 1. IsolatedGarment (session-local, US1)

```ts
interface IsolatedGarment {
  /** file:// URI of the transparent-background PNG (trimmed). */
  uri: string;
  /** Pixel size of the trimmed image. */
  width: number;
  height: number;
  /** Which path produced it — drives copy and quickstart audits. */
  method: 'lift' | 'manual';
  /** Source photo URI (kept for retry-with-manual-crop and vault entry). */
  sourceUri: string;
}
```

**Invariants**:
- Produced exactly once per pipeline run (by lift OR manual crop); immutable
  afterward — retry NEVER re-isolates (FR-009).
- Degenerate rule (pure, exported): a lift result whose bounds cover < 4%
  of the source image area is a **failure**, not a result → manual path
  (spec edge case "sliver mask").
- Never persisted; dies with the session. The vault entry stores the
  SOURCE photo (durable, offline-safe), not the transparent PNG.

## 2. LiftSearchState (the pipeline stage machine, US1)

```ts
type LiftSearchState =
  | { phase: 'idle' }
  | { phase: 'isolating'; sourceUri: string }               // on-device lift
  | { phase: 'manualCrop'; sourceUri: string; reason: 'unsupported' | 'liftFailed' | 'degenerate' }
  | { phase: 'preparing'; garment: IsolatedGarment }        // trim/encode
  | { phase: 'matching'; garment: IsolatedGarment }         // upload + provider
  | { phase: 'assembling'; garment: IsolatedGarment }       // parse → first render
  | { phase: 'done'; garment: IsolatedGarment; result: LiftSearchResult }
  | {
      phase: 'failed';
      garment: IsolatedGarment | null;  // null only for pre-isolation failures
      failedStage: 'isolating' | 'preparing' | 'matching' | 'assembling';
      message: string;
      retryable: boolean;
    };
```

**Transition rules** (mirror contracts/pipeline.md):
- A stage is entered ONLY when its work genuinely begins (FR-008) — stage
  copy derives from `phase`, nothing else.
- `manualCrop` joins the pipeline at `preparing` with `method: 'manual'`.
- `failed` with a non-null `garment` retries from `failedStage` (never
  re-isolates); with null garment retry restarts isolation.
- `done` with zero matches is a RESULT (feature 003 US2 rule), not `failed`.
- Monotonic request token guards stale transitions (001/003 hook idiom).

## 3. LiftSearchResult & extended ProductMatch (contract change, US2–US5)

```ts
/** EXTENDED — both type copies (apps/api + apps/mobile) stay in sync. */
interface ProductMatch {
  id: string;
  title: string;
  source_url: string;
  thumbnail: string;
  price: string | null;          // verbatim display string (unchanged)
  store_name: string;
  // NEW — all optional, absent when the provider doesn't supply them:
  /** Numeric price for arithmetic (savings math) — never displayed raw. */
  price_value?: number;
  /** ISO-ish currency code accompanying price_value. */
  currency?: string;
  /** True ONLY for provider-flagged exact matches (CL-003). */
  exact?: boolean;
  /** Thumbnail pixel dims when provided — feeds the masonry split. */
  thumbnail_width?: number;
  thumbnail_height?: number;
}

interface LiftSearchResult {
  matches: ProductMatch[];
  /** Stable per response — the jackpot once-per-result-set key. */
  resultSetId: string;
}
```

**Validation**: normalizer drop rules unchanged (no title/link/image →
drop); new fields pass through only when well-typed (`price_value` finite
number, `currency` non-empty string); `exact` defaults absent/false.

## 4. PriceAnchor (derived, US3 — pure `utils/price-anchor.ts`)

```ts
interface SavingsLabel {
  matchId: string;
  /** Integer percentage below anchor, e.g. 35 → "35% less than comparable retail". */
  percent: number;
}

deriveSavings(matches: ProductMatch[]): SavingsLabel[]
```

**Rules (CL-002)**:
- Consider only matches with `price_value` + `currency`.
- Partition by currency; use the MODAL currency's set; require ≥2 priced
  matches in it, else no labels at all.
- Anchor = highest `price_value` in that set; the anchor match gets no
  label; labels only where `percent ≥ 1` after flooring.
- Deterministic; identical inputs → identical labels (SC-005 audit).

## 5. HarmonyScore (derived, US4 — pure `utils/harmony.ts`)

```ts
harmonyScore(match: ProductMatch, profile: StyleProfile): number | null
```

- `null` (render nothing) when `!profile.personalized` (FR-014) or the
  match yields no taxonomy tokens.
- Components: category-affinity (match title tokens vs profile category
  weights) + complementarity (small static category-complement table),
  normalized to integer 0–100.
- Deterministic; no color inputs exist (007 R8) — copy must claim only
  category coordination.

## 6. Upload record (API-side, ephemeral — `uploadStore.ts`)

```ts
interface StoredUpload {
  id: string;          // unguessable token (crypto random)
  bytes: Uint8Array;   // the isolated PNG
  contentType: 'image/png';
  expiresAt: number;   // now + ~5 min
}
```

**Invariants**: in-memory Map, TTL sweep + LRU cap (~20 entries / ~50MB);
GET after expiry → 404 (provider fetch happens within the same request
window, so expiry is a safety net, not a race); NEVER written to disk or
any durable store (privacy rule, research R2).

## 7. Vault entry (existing store, additive change)

`VaultEntry.source` union gains `'lift'`. A completed search with ≥1 match
upserts one entry: `imageUri` = SOURCE photo (durable local file via the
existing persistImage flow), `matches` = returned matches (existing shape
consumes the extended ProductMatch transparently), `garments: []` (no
region data on this path — honest absence, same as demo entries).

## 8. Transient (non-model) state

- Trace runner / segment breathing / lift scale / shimmer offset / ring
  progress: Reanimated shared values, lifecycle bound to their phase or
  first-exposure flag.
- Marquee rect: shared values driven by an ACTIVATING pan gesture (unlike
  007's observer tilt — this gesture owns its surface); clamped to image
  bounds with spring settle.
- Jackpot fired-flag: per `resultSetId`, session-local.
