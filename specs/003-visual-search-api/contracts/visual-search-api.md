# Contract: Visual Search API & Demo Flow

**Feature**: 003-visual-search-api · **Date**: 2026-07-09

## 1. Endpoint

### `POST /v1/visual-search`

Route file: `apps/api/src/app/v1/visual-search/route.ts` (thin adapter over `src/routes/visual-search.ts`, matching 001's pattern). Exports `maxDuration = 30`.

**Request** (JSON body, all fields optional):

```json
{ "imageUrl": "https://…/demo-garment.jpeg", "country": "us" }
```

- `imageUrl` absent → server defaults to `<request origin>/demo/demo-garment.jpeg` (self-hosted static asset; `DEMO_IMAGE_URL` env overrides).
- `imageUrl` present but not a well-formed http(s) URL → 400, no upstream call (FR-002).

**Success — 200**:

```json
{
  "matches": [
    {
      "id": "1",
      "title": "Camel Wool Cropped Jacket",
      "source_url": "https://store.example/product/123",
      "thumbnail": "https://…/thumb.jpg",
      "price": "$79.99",
      "store_name": "store.example"
    }
  ]
}
```

- Exactly the six `ProductMatch` fields per entry, `price` null when unreported, capped at 20, top-ranked first.
- **Empty `matches` is a 200** — the legitimate no-results outcome (FR-006).

**Failure — one envelope, four codes** (body shape identical to feature 001's `ErrorResponse`):

```json
{ "error": { "code": "UPSTREAM_TIMEOUT", "message": "The search took too long. Please try again." } }
```

| HTTP | code | When |
|------|------|------|
| 400 | INVALID_INPUT | malformed `imageUrl` |
| 502 | UPSTREAM_FAILED | provider error/unreachable/malformed payload |
| 504 | UPSTREAM_TIMEOUT | provider exceeded the 10s abort budget |
| 500 | INTERNAL_ERROR | unexpected fault (outermost catch) |

Guarantees: no raw provider errors/stack traces/key material in any response (FR-007/FR-009); images never logged (FR-010 hygiene); nothing persisted.

## 2. Shared TypeScript interfaces (FR-015)

Defined in `apps/api/src/types/visual-search.ts`, mirrored **verbatim** in `apps/mobile/src/types/visual-search.ts` (001's documented copy-pattern):

```ts
export interface ProductMatch {
  id: string;
  title: string;
  source_url: string;
  thumbnail: string;
  price: string | null;
  store_name: string;
}

export interface VisualSearchResponse {
  matches: ProductMatch[];
}

export type VisualSearchErrorCode =
  | 'INVALID_INPUT'
  | 'UPSTREAM_FAILED'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL_ERROR';
// Failure envelope: feature 001's ErrorResponse { error: { code, message } }.
```

## 3. Provider call (server-internal)

```text
GET https://serpapi.com/search.json
    ?engine=google_lens
    &type=visual_matches
    &url=<public image URL>
    &country=<optional>
    &api_key=<SERPAPI_API_KEY — env only, never logged, never echoed>
AbortController budget: 10s → UPSTREAM_TIMEOUT
```

Normalization (research §1): `visual_matches[]` → drop entries missing `title` or http(s) `link`; `thumbnail ?? image`; `price?.value ?? null`; `source ?? hostname(link)`; take first 20. Runtime-guarded parse from `unknown` — a malformed provider body is UPSTREAM_FAILED, never a throw.

## 4. Mobile transport contract

`apiClient.ts` gains:

```ts
runVisualSearch(params?: { imageUrl?: string; country?: string }): Promise<ApiResult<VisualSearchResponse>>
```

- Reuses the existing `request<T>` helper and `ApiResult` union — offline (`network`), structured failure (`api` + retryable), success (`ok`).
- `UPSTREAM_FAILED` / `UPSTREAM_TIMEOUT` / `INTERNAL_ERROR` join the retryable-code set; `INVALID_INPUT` is not retryable.
- The app itself never constructs the public image URL — it sends an empty body and lets the server default (the bundled asset is for display only).

## 5. Demo flow UI contract

| Element | File | Behavior |
|---------|------|----------|
| Entry card | `features/visual-search/components/DemoScanCard.tsx`, rendered on Home | "Try a demo scan" → `router.push('/demo-scan')`; ≥44pt target |
| Demo screen | `src/app/(app)/demo-scan.tsx` | bundled `demo-garment.jpeg` full-frame; triggers `useVisualSearch.run()` on mount |
| Scanning state | reuses 001 `SegmentationOverlay` (`active` mode, full-image region via `containFrame`) | loops for the whole `searching` phase — never completes into blank (edge case) |
| Results | `ProductMatchCard` list, springified `entering` stagger | six contract fields; null price renders "Price unavailable"; tap → `expo-web-browser` opens `source_url` |
| Empty (US2) | designed no-matches state | distinct copy + "Try again"; visually distinct from failure |
| Failure (US3) | `ScanErrorFallback` reuse | mapped message + Retry when retryable; back affordance always present |
| Motion | Constitution V | all transitions `withSpring`/`.springify()`; no `Easing.linear`; re-trigger ignored while searching |

## 6. Configuration contract

| Variable | Where | Required | Notes |
|----------|-------|----------|-------|
| `SERPAPI_API_KEY` | `apps/api` env (Vercel project / `.env.local`) | yes | server-side only (FR-009) |
| `DEMO_IMAGE_URL` | `apps/api` env | no | overrides the self-origin default; needed for local dev (localhost isn't provider-reachable). Currently set to the public Drive file's **direct-content** URL (`drive.usercontent.google.com/download?id=…&export=view`) — never the `/file/d/…/view` HTML page (research §2) |
| `EXPO_PUBLIC_API_URL` | `apps/mobile` env | existing | already how the app finds the API (001) |
