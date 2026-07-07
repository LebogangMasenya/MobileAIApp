# Data Model: Camera Scan-to-Match Garment Identification

Derived from `spec.md` § Key Entities and Functional Requirements. All shapes are strict TypeScript interfaces per the constitution's "no `any`, concrete interface for every payload" rule — these are the source of truth for the contracts in `contracts/`.

## ScanSession

Represents a single capture-or-import event and its lifecycle.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Server-assigned on submission |
| `source` | `"camera" \| "import"` | Which entry point produced the photo (FR-002, FR-002a) |
| `createdAt` | `string` (ISO 8601) | Capture/import timestamp |
| `status` | `"processing" \| "segmented" \| "failed"` | `failed` covers FR-012 (no identifiable person/garments) |
| `regionUsed` | `string` (ISO 3166-1 alpha-2) | Region applied when this session's matches were resolved (FR-010) |
| `people` | `DetectedPerson[]` | Populated once `status === "segmented"`; one entry per distinguishable person found in the photo |
| `garments` | `DetectedGarment[]` | Garments for whichever `DetectedPerson` is currently selected. For a single-person photo, this is auto-populated for that one person immediately; for a multi-person photo, this stays empty until the user selects a person (FR-016) |
| `failureReason` | `string \| null` | Human-readable reason when `status === "failed"` — covers both "no person/garments detected" (FR-012) and "people detected but could not be processed" (FR-018) |

**Validation rules**:
- `people` and `garments` MUST both be empty while `status !== "segmented"`.
- `status === "failed"` MUST always carry a non-null `failureReason`.
- When `people.length > 1`, `garments` MUST stay empty until a person is explicitly selected (see `contracts/scan-api.md`'s per-person endpoint); when `people.length === 1`, `garments` MAY be populated immediately for that person.

**State transitions**: `processing → segmented` (success) or `processing → failed` (no person/garments detected, FR-012; or people detected but unprocessable, FR-018). Terminal states do not transition further; a retry creates a new `ScanSession`.

## DetectedPerson

One distinguishable person identified within a `ScanSession`'s photo. Positioning data drives the tap-to-select UI (FR-016); a session with more than one `DetectedPerson` requires the user to pick one before any garments are shown for it.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Unique within its `ScanSession` |
| `boundingRegion` | `{ x: number; y: number; width: number; height: number }` | Normalized (0–1) coordinates relative to the photo, used to render the tap target (FR-016) |
| `segmentationStatus` | `"pending" \| "segmented" \| "failed"` | `pending` until the user selects this person and per-person garment segmentation is requested; `failed` covers a per-person processing failure distinct from the whole-session failure in FR-018 |

**Validation rules**:
- `boundingRegion` coordinates MUST be within `[0, 1]`.
- A `DetectedPerson` transitions `pending → segmented` only in response to the user selecting them (FR-016), never automatically when `people.length > 1` — this is what keeps multi-person photos from segmenting everyone at once.

## DetectedGarment

One segmented clothing item within a `ScanSession`, associated with the specific `DetectedPerson` it was found on. Positioning data drives bubble placement (FR-005).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Unique within its `ScanSession` |
| `personId` | `string` | FK to `DetectedPerson.id` — which selected person this garment belongs to |
| `category` | `string` | e.g. `"jacket"`, `"pants"`, `"shoes"` — open vocabulary, not a fixed enum, since garment taxonomy will evolve |
| `confidence` | `number` (0–1) | Detection confidence from the segmentation pipeline |
| `boundingRegion` | `{ x: number; y: number; width: number; height: number }` | Normalized (0–1) coordinates relative to the photo, used to position the bubble (FR-005) |
| `matchStatus` | `"unresolved" \| "matched" \| "no_match"` | `unresolved` until the detail view is opened and matches are fetched (lazy-load, see `contracts/`); `no_match` covers FR-013 |

**Validation rules**:
- `boundingRegion` coordinates MUST be within `[0, 1]`.
- `confidence` below a minimum threshold (implementation-defined, tracked as a tuning parameter, not a spec value) MUST exclude the garment from `ScanSession.garments` entirely rather than surfacing a low-confidence bubble — a user never sees a bubble the system already doubts (supports SC-002's "clearly visible, distinct" bar).

## MatchedProduct

A specific store listing identified as the same or a close match to a `DetectedGarment` (FR-007).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Provider-issued or derived listing ID |
| `garmentId` | `string` | FK to `DetectedGarment.id` |
| `store` | `Store` | Embedded, not a separate fetch (single round trip for the detail view) |
| `title` | `string` | Product title as shown to the user |
| `imageUrl` | `string` (URL) | Product thumbnail |
| `price` | `{ amount: number; currency: string } \| null` | `null` when price is unavailable from the source |
| `ctaUrl` | `string` (URL) | Destination for the "go to store" call-to-action (FR-008) |
| `isExactMatch` | `boolean` | Distinguishes the identified item itself from a look-alike |

## SimilarItem

A `MatchedProduct` variant explicitly surfaced as a visual alternative rather than the identified item itself (FR-009, FR-011).

| Field | Type | Notes |
|---|---|---|
| *(extends `MatchedProduct`)* | | Same shape as `MatchedProduct` |
| `similarityScore` | `number` (0–1) | Used for ranking within the similar-items list |
| `regionAvailable` | `boolean` | Whether this item is available to the requesting session's `regionUsed` — surfaced items MUST have `regionAvailable === true` (FR-010, FR-011) |

**Validation rules**:
- The similar items list returned to the client MUST only contain entries with `regionAvailable === true`; region filtering happens server-side, not client-side, so the client never has to reason about ineligible items (supports FR-011 and the User Story 3 "no regional match found" state cleanly — an empty list *is* that state).

## Store

A retailer offering `MatchedProduct`/`SimilarItem` listings.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Provider-issued or derived store ID |
| `name` | `string` | Display name |
| `regions` | `string[]` (ISO 3166-1 alpha-2) | Regions this store is considered to serve |
| `logoUrl` | `string \| null` | Optional branding asset |

## RegionPreference (client-local only, not server-persisted)

Not part of the API contracts — lives entirely on-device per the "no account required" assumption.

| Field | Type | Notes |
|---|---|---|
| `region` | `string` (ISO 3166-1 alpha-2) | Currently active region |
| `source` | `"inferred" \| "user_override"` | Whether the value came from device locale or an explicit user choice (Constitution-mandated hybrid: FR-010, FR-010a) |

## Relationships

```text
ScanSession 1───* DetectedPerson 1───* DetectedGarment 1───* MatchedProduct (0 or 1 exact match + N similar items)
                                                          └──* SimilarItem (extends MatchedProduct)
MatchedProduct/SimilarItem *───1 Store
```
