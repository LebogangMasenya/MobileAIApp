# Research: Visual Search Demo Flow

**Date**: 2026-07-09 · **Feature**: 003-visual-search-api

All Technical Context unknowns resolved below. Provider facts verified against SerpApi's live Google Lens documentation (fetched 2026-07-09); Next.js facts verified against the bundled docs in `apps/api/node_modules/next/dist/docs/` (Next 16.2.10 — per `apps/api/AGENTS.md`, training-data conventions are not trusted).

## 1. SerpApi Google Lens request/response (verified)

- **Decision**: Call `GET https://serpapi.com/search.json` with `engine=google_lens`, `url=<public image URL>`, `type=visual_matches`, `api_key=<server env>`, plus optional `country`/`hl` pass-through. Normalize the `visual_matches[]` array.
- **Request facts (from docs)**: image is provided via the **`url` parameter** — there is no upload; `type` is **required** (`all` | `products` | `exact_matches` | `visual_matches`); `country` and `hl` are two-letter codes.
- **Why `type=visual_matches`** (not `products`/`exact_matches`): maximizes recall — it is the consistently populated section, and commerce fields (price/stock) appear on its entries when available. `products`/`exact_matches` are frequently empty for street-style photos, which would make the demo look broken. FR-004's filter (drop entries without title+link) plus nullable price handles the mixed commerce density.
- **Response mapping** (SerpApi field → `ProductMatch`):

  | SerpApi `visual_matches[]` field | ProductMatch field | Rule |
  |---|---|---|
  | `position` (int) | `id` | `String(position)` — stable within a response (spec's only id requirement) |
  | `title` | `title` | required — entry dropped if missing/empty |
  | `link` | `source_url` | required — entry dropped if missing/non-http(s) |
  | `thumbnail` | `thumbnail` | falls back to `image` if thumbnail absent; entry dropped if neither |
  | `price.value` (formatted string, e.g. `"$79.99*"`) | `price` | passed through verbatim; `null` when the `price` object is absent (FR-004 — never fabricated) |
  | `source` (displayed domain/store) | `store_name` | falls back to the `link` hostname if absent |

  All other provider fields (`source_icon`, `image`, `in_stock`, `condition`, `rating`, `reviews`, `exact_matches`, …) are **dropped** — the contract is exactly six fields (FR-004).
- **Alternatives considered**: the `serpapi` npm client — rejected; it's one HTTPS GET, and plain `fetch` (native in Node 18+/Next 16) keeps the dependency count at zero (Anti-Abstraction Mandate).

## 2. Demo image hosting (the provider-reachability problem)

- **Decision**: Ship `test_image/test_image.jpeg` into **`apps/api/public/demo/demo-garment.jpeg`**. The route derives its own public origin from the incoming request (`new URL(request.url).origin`) and defaults the search image to `<origin>/demo/demo-garment.jpeg`; a `DEMO_IMAGE_URL` env var overrides the default. The mobile app also bundles a copy (`apps/mobile/src/assets/images/demo-garment.jpeg`) for instant on-screen display — the app never needs to know the public URL.
- **Rationale**: SerpApi fetches the image **from its own servers**, so the URL must be publicly reachable. Serving it from the API's own static assets means the deployed Vercel instance is self-sufficient with **zero configuration** — the origin derivation makes the deployed URL correct automatically.
- **Local development caveat**: `localhost` is not reachable by SerpApi. Local runs therefore set `DEMO_IMAGE_URL` to any public copy of the image. **Resolved 2026-07-09**: the user published the image to a public Google Drive file; the working value (already in `apps/api/.env.local`) is the **direct-content** form `https://drive.usercontent.google.com/download?id=<id>&export=view` — verified to serve the raw JPEG. The `…/file/d/<id>/view` share link is an HTML viewer page and must NOT be used; the `uc?export=view` form 303-redirects to the usercontent URL, so the final URL is stored to avoid depending on the provider following redirects.
- **Alternatives considered**: tunneling localhost (ngrok) — works but adds tooling nobody needs once a deployment exists; GitHub raw URL — couples the demo to repo visibility; third-party image hosts — an external dependency for a file we already serve.

## 3. Timeout architecture (FR-007/FR-008)

- **Decision**: `AbortController` with a **10s budget** on the SerpApi fetch inside the route; the route exports `maxDuration = 30` so the platform ceiling sits far above our own budget. Timeout returns `504` + `UPSTREAM_TIMEOUT`; other upstream failures return `502` + `UPSTREAM_FAILED`; unexpected faults `500` + `INTERNAL_ERROR`; input rejection `400` + `INVALID_INPUT`.
- **Rationale**: the function must *own* its failure (structured payload) rather than let Vercel kill it opaquely — that is US3's entire point. `maxDuration` as a route export is confirmed current in the bundled Next 16 docs. Distinct status codes cost nothing server-side; the mobile client keys off the **body code**, not the status, so the contract stays "one failure shape" (FR-007).
- **Google Lens latency reality**: multi-second responses are normal; the 10s budget + looping scan animation (FR-012) absorbs it.

## 4. Error envelope & client transport — reuse feature 001's, exactly

- **Decision**: The endpoint speaks 001's existing envelope `{ error: { code, message } }` with new UPPER_SNAKE codes (`INVALID_INPUT`, `UPSTREAM_FAILED`, `UPSTREAM_TIMEOUT`, `INTERNAL_ERROR`), and the mobile side extends the existing `apiClient.ts` (`ApiResult` union, `request<T>` helper) with one `runVisualSearch()` function; the three upstream codes join the retryable set.
- **Rationale**: `apiClient`'s discriminated-union pattern already mechanically enforces the constitution's error scaffolding, and its failure parser already understands this envelope — the demo flow inherits offline handling, non-JSON-body handling, and retryability for free. Inventing a second envelope (the spec's lowercase code sketch) would put two error dialects in one API; the spec's Key Entities are satisfied by shape, with casing normalized to the house style.
- **Note**: spec entity names map as: `VisualSearchError` ⇒ the shared `ErrorResponse` envelope; codes as above.

## 5. Frontend demo flow placement & motion

- **Decision**: A **`/demo-scan` screen** in the protected `(app)` group, entered from a "Try a demo scan" card on Home (rendered below the rail/empty-state content). The screen shows the bundled demo image full-frame, plays the feature-001 scanning glow (`SegmentationOverlay` in `active` mode over a full-image region, sized with the existing `containFrame` util) looping while the search runs, then spring-transitions (`entering` `.springify()`) into a scrollable list of `ProductMatchCard`s. Empty and failure states reuse the `ScanErrorFallback` component; card taps open the product page via `expo-web-browser` (already installed).
- **Rationale**: reusing 001's scanning visual language makes the demo read as *the real product working* (SC-006) at zero new-asset cost; a dedicated route (not a modal over Scan) keeps the real camera flow untouched (spec assumption). Home placement puts the demo one tap from launch for stakeholders.
- **State machine**: `useVisualSearch` hook mirrors 001's hook pattern — `idle | searching | done(matches) | failed(message, retryable)` with a request-token guard against double-triggers (spec edge case). `done` with `matches.length === 0` **is** the empty state (US2) — not a separate phase, so "empty" can never be conflated with "failed".

## 6. Type mirroring (FR-015)

- **Decision**: `ProductMatch` / `VisualSearchResponse` defined in **`apps/api/src/types/visual-search.ts`** and mirrored verbatim in **`apps/mobile/src/types/visual-search.ts`**, following 001's documented copy-pattern (two consumers don't earn a shared package — Anti-Abstraction Mandate, precedent in `types/scan.ts` headers).
- **Raw provider types**: a minimal `SerpApiVisualMatch` interface (only the six source fields we read) lives **only** in the API's provider module — raw provider shapes never cross into shared types.

## Sources

- [SerpApi: Google Lens API](https://serpapi.com/google-lens-api) — `url`/`type`/`country`/`hl` params, `visual_matches[]` fields incl. `price.value` (fetched 2026-07-09)
- `apps/api/node_modules/next/dist/docs/.../route-segment-config/maxDuration.md` — `export const maxDuration` (Next 16.2.10 bundled docs)
- `apps/api/src/app/v1/.../route.ts`, `src/routes/scans.ts` — 001's thin-adapter route pattern and error envelope
- `apps/mobile/src/services/apiClient.ts` — the `ApiResult` transport this feature extends
