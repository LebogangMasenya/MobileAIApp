# API Contract: Scan-to-Match

Two endpoints, split so the latency-critical segmentation step (SC-001: ≤5s) is never blocked on per-garment store/similar-item lookups (SC-003: ≤2s, fetched lazily on bubble tap). All payloads are strictly typed per the constitution's "no `any`, concrete type for every API payload" rule; types below are the contract source of truth (see `data-model.md` for full entity shapes).

## POST /v1/scans

Submit a captured or imported photo for segmentation. Does not resolve store/similar-item matches.

**Request** (`multipart/form-data`):

```ts
interface CreateScanRequest {
  photo: File;                       // the captured or imported image
  source: "camera" | "import";       // FR-002, FR-002a
  region: string;                    // ISO 3166-1 alpha-2, from client RegionPreference
}
```

**Response — 201 Created**:

```ts
interface CreateScanResponse {
  scanSession: ScanSession;
  // status: "segmented"; `people` always populated.
  // people.length === 1 → `garments` is auto-populated for that person.
  // people.length > 1  → `garments` stays empty until the client calls the
  //                       per-person endpoint below for a selected person (FR-016).
}
```

**Response — 200 OK (segmentation ran but found nothing, or people could not be processed)**:

```ts
interface CreateScanFailedResponse {
  scanSession: ScanSession;
  // status: "failed"; failureReason set — covers both "no person/garments
  // detected" (FR-012) and "people detected but could not be processed" (FR-018).
}
```

**Response — 4xx/5xx (transport/validation error, distinct from a "no garments found" business outcome)**:

```ts
interface ErrorResponse {
  error: {
    code: "INVALID_PHOTO" | "UNSUPPORTED_FORMAT" | "UPSTREAM_UNAVAILABLE" | "INTERNAL_ERROR";
    message: string;                 // user-safe, non-technical (Defensive Error Scaffolding)
  };
}
```

**Notes**:
- A "no person/garments detected" outcome is a normal 200/201 business result (`status: "failed"` in the body), not an HTTP error — it's an expected case the client renders a friendly retry state for (FR-012), not an exceptional one. The same applies to "people detected but could not be processed" (FR-018) — same `status: "failed"` shape, different `failureReason` text.
- `UPSTREAM_UNAVAILABLE` covers the cloud-vision-path failure case (research.md §3 Android/fallback path) and MUST map to the network-loss edge case's fallback UI on the client.

## POST /v1/scans/{scanId}/people/{personId}/garments

Request per-person garment segmentation after the user selects a `DetectedPerson` from a multi-person photo (FR-016). Not called at all for single-person photos, since those are auto-populated by `POST /v1/scans`. Callable again for a different `personId` in the same scan when the user chooses to segment another person (FR-017).

**Request**: no body — `scanId` and `personId` are route params.

**Response — 200 OK**:

```ts
interface PersonGarmentsResponse {
  personId: string;
  status: "segmented" | "failed";
  garments: DetectedGarment[];   // empty when status is "failed"
  failureReason: string | null;  // set when status is "failed"
}
```

**Response — 4xx/5xx**:

```ts
interface ErrorResponse {
  error: {
    code: "PERSON_NOT_FOUND" | "UPSTREAM_UNAVAILABLE" | "INTERNAL_ERROR";
    message: string;
  };
}
```

**Notes**:
- A per-person segmentation failure (`status: "failed"` in the 200 body) is distinct from the whole-scan-level FR-018 failure — this is "this specific person couldn't be segmented," not "the photo's people couldn't be processed at all." Both render the same class of friendly failure message to the user; only the trigger differs.

## GET /v1/scans/{scanId}/garments/{garmentId}/matches

Fetch store matches and similar items for one detected garment. Called when the user taps a bubble (FR-006) — not prefetched for every garment on scan creation, to keep the initial scan response fast.

**Response — 200 OK**:

```ts
interface GarmentMatchesResponse {
  garmentId: string;
  exactMatch: MatchedProduct | null;   // null is a valid, expected state (FR-013)
  similarItems: SimilarItem[];         // may be empty — see data-model.md validation rule
                                        // (empty list *is* the "no regional match" state, FR-011 / US3 scenario 2)
}
```

**Response — 4xx/5xx**:

```ts
interface ErrorResponse {
  error: {
    code: "GARMENT_NOT_FOUND" | "UPSTREAM_UNAVAILABLE" | "INTERNAL_ERROR";
    message: string;
  };
}
```

**Notes**:
- `exactMatch: null` combined with `similarItems: []` is the full "no store or similar item found" state (FR-013) — the client renders this as one clear message suggesting the user try again with a different angle or photo, rather than two separate empty-list checks or a blank list.

## Client error-handling contract (applies to both endpoints)

Per Constitution Principle VII (Defensive Error Scaffolding), every call site MUST:
1. Wrap the request in a try/catch (or equivalent) at the hook level (e.g., `useCreateScan`, `useGarmentMatches`).
2. On any `ErrorResponse` or network failure, render the feature's non-destructive fallback UI — never leave the segmented photo/bubbles in a broken or blank state (FR-012, FR-013, FR-015, and the network-loss edge case).
3. Distinguish `UPSTREAM_UNAVAILABLE` (retryable — offer a retry action) from `INVALID_PHOTO`/`UNSUPPORTED_FORMAT` (not retryable without a new photo — route back to capture/import).
