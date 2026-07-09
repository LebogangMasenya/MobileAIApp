# Implementation Plan: Visual Search Demo Flow (Demo Image → Real Search → Product Cards)

**Branch**: `main` (no feature branch in use) | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-visual-search-api/spec.md`

## Summary

Prove the product's core pipe end-to-end with a demo: the bundled `test_image` garment photo shows on a new `/demo-scan` screen, feature 001's scanning glow loops while the backend genuinely queries **SerpApi's Google Lens** (`type=visual_matches`) with a publicly hosted copy of the same image, and the results spring in as **ProductMatch** cards (exactly six fields, price nullable, capped at 20). The capture step is mocked; the search is real. One new endpoint (`POST /v1/visual-search`) reuses feature 001's error envelope and thin-adapter route pattern; the mobile side reuses the `apiClient` `ApiResult` transport, the scanning overlay, and the error-fallback component. Zero new npm dependencies in either app.

## Technical Context

**Language/Version**: TypeScript strict on both sides — Next.js 16.2.10 App Router route handlers (`apps/api`, Node runtime, Vercel target) and Expo SDK 54 / RN 0.81 (`apps/mobile`)

**Primary Dependencies**: none added. API: native `fetch` + `AbortController` (no SerpApi SDK). Mobile: existing expo-router, Reanimated 4, NativeWind 4, expo-image, expo-web-browser

**Storage**: none — request-scoped only; demo image ships as static assets (api `public/demo/`, mobile bundled asset); no image retention (FR-011 satisfied structurally)

**Testing**: manual scenario validation via `quickstart.md` (incl. curl-level contract checks) + `tsc --noEmit`/lint zero-error gates in **both** apps (Constitution Verification Rule)

**Target Platform**: API — Vercel serverless (works identically under `next dev`); Mobile — iOS primary via existing dev client, web must not break

**Project Type**: Cross-cutting — `apps/api` (new route + service) and `apps/mobile` (new screen + feature module)

**Performance Goals**: demo trigger → resolved UI ≤10s p95 / ≤15s hard (SC-001); upstream abort budget 10s inside `maxDuration = 30`; scan animation on the UI thread throughout (Constitution III)

**Constraints**: `SERPAPI_API_KEY` server-side only; empty result ≠ error, structurally distinct (US2/SC-004); one failure envelope for all failure modes (FR-007); no `Easing.linear`; local dev needs `DEMO_IMAGE_URL` pointing at a public copy (SerpApi cannot fetch localhost — research §2)

**Scale/Scope**: 1 endpoint + 1 provider module + shared types (api); 1 screen, 1 entry card, 1 hook, 2 components, 1 apiClient function, mirrored types (mobile); 2 static-asset copies of the demo image

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-checked post-Phase-1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Clarity Over Assumption | ✅ PASS | Provider request/response shape verified against SerpApi's live docs (not guessed); Next 16 conventions checked against bundled docs per `apps/api/AGENTS.md`; the share-link vs direct-URL problem was surfaced and resolved by the user (repo test image). Edge cases (timeout, quota, empty, double-trigger) enumerated in spec. |
| II | Design-First Implementation | ✅ PASS | No new visual language: the demo screen composes feature 001's approved scanning glow and fallback components plus 002's card/token system; the one new surface (product cards) follows the existing card idiom. No figma pages exist for this demo — reuse *is* the design decision, recorded here. |
| III | Performance First | ✅ PASS | Scan glow is 001's UI-thread Reanimated worklet; search runs server-side; no image bytes travel from the phone (bundled display copy + server-hosted search copy). |
| IV | Anti-Abstraction Mandate | ✅ PASS | No SerpApi SDK — one `fetch` in one provider module; no new client wrapper — one function added to the existing `apiClient`; types mirrored by 001's documented copy-pattern rather than a shared package. |
| V | Native-Grade Fluid Motion | ✅ PASS | Looping glow → springified card stagger handoff; `withSpring`/`.springify()` only; re-trigger ignored mid-search so interruption can't fork state. |
| VI | Educational Code Architecture | ✅ PASS | Why-comments mandated at: the origin-derivation default (why the server names its own image URL), the abort-budget-vs-maxDuration split, and the normalizer's drop rules. |
| VII | Defensive Error Scaffolding | ✅ PASS | Four typed failure codes in 001's envelope; outermost catch guarantees the shape (FR-009); mobile inherits `ApiResult` offline/malformed handling; UI reuses `ScanErrorFallback` with retry. |
| VIII | State Isolation | ✅ PASS | `useVisualSearch` owns the whole lifecycle as a discriminated-union machine (001's hook idiom); the screen only wires states to visuals; provider parsing isolated in one server module. |

**Post-Phase-1 re-check (after data-model/contracts/quickstart)**: all gates still pass; no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/003-visual-search-api/
├── plan.md              # This file
├── research.md          # Phase 0 — provider shape (verified), hosting, timeouts, reuse decisions
├── data-model.md        # Phase 1 — ProductMatch/envelopes, state machine
├── quickstart.md        # Phase 1 — curl contract checks + on-device scenarios
├── contracts/
│   └── visual-search-api.md # Phase 1 — endpoint, shared TS interfaces, provider call, UI contract
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
apps/api/
├── public/demo/
│   └── demo-garment.jpeg            # NEW: copy of test_image/test_image.jpeg (provider-fetchable)
└── src/
    ├── app/v1/visual-search/
    │   └── route.ts                 # NEW: thin adapter (POST) + `export const maxDuration = 30`
    ├── routes/
    │   └── visual-search.ts         # NEW: handler — input validation, default image URL from
    │                                #   request origin, error envelope, outermost catch
    ├── services/visualSearch/
    │   └── serpApiProvider.ts       # NEW: fetch google_lens (type=visual_matches, 10s abort),
    │                                #   runtime-guarded parse, normalize → ProductMatch[≤20]
    └── types/
        └── visual-search.ts         # NEW: ProductMatch, VisualSearchResponse, error codes

apps/mobile/
├── assets/images/
│   └── demo-garment.jpeg            # NEW: same image, bundled for instant display
├── src/app/(app)/
│   ├── _layout.tsx                  # MODIFIED: now a Stack — "(tabs)" + "demo-scan" (NativeTabs
│   │                                #   renders only declared triggers, so full-screen non-tab
│   │                                #   routes must be Stack siblings; see /lessons 2026-07-09)
│   ├── (tabs)/                      # NEW nesting level: _layout.tsx (AppTabs) + index/scan/account
│   │                                #   moved here — URLs unchanged (groups don't affect paths)
│   ├── demo-scan.tsx                # NEW: image + looping scan glow → card list / empty / error
│   └── (tabs)/index.tsx             # MODIFIED: renders DemoScanCard below dashboard content
├── features/visual-search/
│   ├── components/
│   │   ├── DemoScanCard.tsx         # NEW: Home entry card → /demo-scan
│   │   └── ProductMatchCard.tsx     # NEW: six-field card; null price → "Price unavailable";
│   │                                #   tap → expo-web-browser
│   └── hooks/
│       └── useVisualSearch.ts       # NEW: idle|searching|done|failed machine + token guard
├── services/
│   └── apiClient.ts                 # MODIFIED: + runVisualSearch(); + retryable codes
└── types/
    └── visual-search.ts             # NEW: mirror of the api types (FR-015)

test_image/test_image.jpeg           # source of truth for both asset copies (kept)
```

**Structure Decision**: Both apps extend their established 001 layouts — thin route adapter over a `routes/` handler over a `services/` provider (api), and a `features/<domain>/{components,hooks}` module plus one `(app)` screen (mobile). The demo screen lives inside the protected group (feature 002's gate), so the demo is only reachable signed-in, per spec FR-011.

## Key Design Decisions (details in research.md)

1. **`type=visual_matches`** on the Google Lens call — the consistently populated section with commerce fields when available; `products`/`exact_matches` are too often empty for street photos and would make the demo look broken (research §1, verified field mapping included).
2. **Self-hosted, self-referencing demo image** — the route defaults the search URL to `<its own origin>/demo/demo-garment.jpeg`, so a deployed instance needs zero config; `DEMO_IMAGE_URL` overrides for local dev since SerpApi can't reach localhost (research §2).
3. **Own the timeout** — 10s `AbortController` budget inside `maxDuration = 30`: every slow upstream becomes a designed `UPSTREAM_TIMEOUT` payload, never an opaque platform kill (research §3).
4. **Reuse 001's error dialect and transport** — same `{ error: { code, message } }` envelope (new UPPER_SNAKE codes) and one new `apiClient` function; the mobile flow inherits offline handling and retryability mechanically (research §4).
5. **Reuse 001's scanning visuals** — `SegmentationOverlay` in active mode over a full-image frame loops for the whole search; results hand off with a springified card stagger; `ScanErrorFallback` covers failure (research §5).

## Complexity Tracking

No constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
