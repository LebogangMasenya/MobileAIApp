# Data Model: Visual Search Demo Flow

**Date**: 2026-07-09 · **Feature**: 003-visual-search-api

Everything here is request-scoped — this feature persists **nothing** (no database, no session state, no image retention; the demo image is a static asset, not stored user data).

## Entities

### ProductMatch *(the shared contract type — `types/visual-search.ts` in both apps)*

| Field | Type | Rule |
|-------|------|------|
| id | string | `String(position)` from the provider — stable within one response only |
| title | string | required; entries without it are dropped (FR-004) |
| source_url | string | required http(s) product-page link; entries without it are dropped |
| thumbnail | string | product image URL (`thumbnail`, falling back to `image`); entries with neither are dropped |
| price | string \| null | provider's display string verbatim (e.g. `"$79.99*"`); null when unreported — never fabricated |
| store_name | string | provider `source`, falling back to the `source_url` hostname |

Exactly these six fields — the normalizer strips everything else the provider sends (FR-004, SC-002).

### VisualSearchResponse *(success envelope)*

| Field | Type | Rule |
|-------|------|------|
| matches | ProductMatch[] | top-ranked first, capped at 20 (FR-005); **empty array = legitimate no-matches result** (FR-006, US2) |

### ErrorResponse *(failure envelope — reuses feature 001's shape)*

`{ error: { code, message } }` with this feature's codes:

| Code | HTTP | Meaning | Client retryable |
|------|------|---------|------------------|
| INVALID_INPUT | 400 | missing/malformed image URL | no |
| UPSTREAM_FAILED | 502 | provider error / network failure / unparseable provider payload | yes |
| UPSTREAM_TIMEOUT | 504 | provider exceeded the 10s budget | yes |
| INTERNAL_ERROR | 500 | unexpected fault (catch-all, FR-009) | yes |

`message` is always user-safe wording; raw provider errors never pass through (FR-007).

### VisualSearchRequest *(API-side input)*

| Field | Type | Rule |
|-------|------|------|
| imageUrl | string (optional) | http(s) URL; when absent the server defaults to its own `/demo/demo-garment.jpeg` (research §2) |
| country | string (optional) | two-letter code passed through to the provider (spec region assumption) |

### SerpApiVisualMatch *(provider-internal — never leaves the API's provider module)*

Only the fields the normalizer reads: `position`, `title`, `link`, `thumbnail`, `image`, `price.value`, `source`. Parsed from `unknown` with runtime guards — the wire is never trusted to match types (house rule from 001's apiClient).

## Frontend state machine (`useVisualSearch`)

```text
 idle ──run()──▶ searching ──normalized OK──▶ done(matches)   // matches may be []
                    │                              (empty array IS the US2 state)
                    └─ApiResult api/network──▶ failed(message, retryable) ──retry──▶ searching
```

- Request-token guard: a re-trigger while `searching` is ignored (spec edge case "double-tap").
- `done([])` vs `failed` is structurally distinct — empty and error can never be conflated (SC-004).
- The scan animation runs exactly while `phase === 'searching'` and hands off with a spring on settle (FR-012/FR-013).

## Relationships

```text
Home "Try a demo scan" card ──▶ /demo-scan screen ──▶ useVisualSearch
    ──▶ apiClient.runVisualSearch() ──▶ POST /v1/visual-search
    ──▶ serpApiProvider (fetch + normalize) ──▶ SerpApi Google Lens
Bundled asset (mobile) = same file as apps/api/public/demo/demo-garment.jpeg (display vs. provider-fetch copies)
ProductMatch (api types) ≡ ProductMatch (mobile types) — mirrored verbatim (FR-015, 001 copy-pattern)
```

## Validation & error surfaces

| Boundary | Failure | Surface |
|----------|---------|---------|
| Route input | bad/missing URL | 400 INVALID_INPUT; nothing sent upstream (FR-002) |
| SerpApi call | error / network / malformed | 502 UPSTREAM_FAILED (FR-007) |
| SerpApi call | > 10s | abort → 504 UPSTREAM_TIMEOUT (FR-008) |
| Route (any) | unexpected throw | 500 INTERNAL_ERROR — outermost catch (FR-009) |
| Mobile transport | offline / non-JSON body | `ApiResult network` → failed(retryable) — inherited from 001's apiClient |
| Demo screen | failed state | `ScanErrorFallback` with retry (FR-014); empty → designed no-matches state |
