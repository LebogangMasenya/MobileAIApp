# Tasks: Visual Search Demo Flow (Demo Image → Real Search → Product Cards)

**Input**: Design documents from `/specs/003-visual-search-api/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/visual-search-api.md, quickstart.md

**Tests**: Not requested — validation is manual via `quickstart.md` (curl contract checks + on-device scenarios) plus zero-error `tsc`/lint gates in **both** apps (Constitution Verification Rule).

**Organization**: Tasks grouped by user story (US1 demo end-to-end, US2 empty state, US3 failure modes). Paths are repo-relative. **Zero new npm dependencies in either app.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (demo end-to-end), US2 (empty result), US3 (graceful failure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Static assets and configuration — everything else builds on these.

- [X] T001 Copy `test_image/test_image.jpeg` to both asset homes: `apps/api/public/demo/demo-garment.jpeg` (provider-fetchable when deployed) and `apps/mobile/src/assets/images/demo-garment.jpeg` (bundled for instant display) — byte-identical copies of the source of truth (research §2)
- [X] T002 Verify `apps/api/.env.local` configuration: `SERPAPI_API_KEY` present and `DEMO_IMAGE_URL` set to the Drive file's **direct-content** URL (`https://drive.usercontent.google.com/download?id=…&export=view` — already set and verified 2026-07-09; the `/file/d/…/view` share-page form must never be used); confirm `.env.local` is git-ignored

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared contract types, the provider, the endpoint, and the mobile transport — every story flows through these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `apps/api/src/types/visual-search.ts`: `ProductMatch` (exactly `id`, `title`, `source_url`, `thumbnail`, `price: string | null`, `store_name`), `VisualSearchResponse` (`{ matches: ProductMatch[] }`), `VisualSearchErrorCode` (`INVALID_INPUT | UPSTREAM_FAILED | UPSTREAM_TIMEOUT | INTERNAL_ERROR`) — per contracts §2, strict types, no `any`
- [X] T004 [P] Create `apps/mobile/src/types/visual-search.ts`: verbatim mirror of T003 with the 001-style "MUST stay in sync" header comment (FR-015, copy-pattern per research §6)
- [X] T005 Create `apps/api/src/services/visualSearch/serpApiProvider.ts`: `fetch` to `https://serpapi.com/search.json?engine=google_lens&type=visual_matches&url=…&api_key=…` (+ optional `country`/`hl`), 10s `AbortController` budget, runtime-guarded parse of `visual_matches[]` from `unknown` (minimal `SerpApiVisualMatch` shape stays in this file only), normalization per the research §1 mapping table — drop entries missing `title`/http(s) `link`, `thumbnail ?? image`, `price?.value ?? null`, `source ?? hostname(link)`, cap 20 — returning a discriminated result (`ok(matches) | failed | timeout`); the key never appears in logs or thrown values (FR-009/FR-010); educational why-comments on the drop rules and abort budget (Constitution VI)
- [X] T006 Create `apps/api/src/routes/visual-search.ts` (handler: JSON-body parse tolerant of empty body, `imageUrl` http(s) validation → 400 `INVALID_INPUT` with no upstream call, default image URL = `DEMO_IMAGE_URL` env ?? `<request origin>/demo/demo-garment.jpeg` with a why-comment on the self-origin trick, provider result → 200 `{matches}` / 502 `UPSTREAM_FAILED` / 504 `UPSTREAM_TIMEOUT`, outermost try/catch → 500 `INTERNAL_ERROR`, all failures in 001's `{ error: { code, message } }` envelope with user-safe copy) and the thin adapter `apps/api/src/app/v1/visual-search/route.ts` (POST → handler; `export const maxDuration = 30`) — contracts §1, FR-002/FR-006..FR-009
- [X] T007 Extend `apps/mobile/src/services/apiClient.ts`: add `runVisualSearch(params?: { imageUrl?: string; country?: string }): Promise<ApiResult<VisualSearchResponse>>` posting JSON to `/v1/visual-search` via the existing `request<T>` helper, and add `UPSTREAM_FAILED`/`UPSTREAM_TIMEOUT` to `RETRYABLE_CODES` (`INTERNAL_ERROR` already present; `INVALID_INPUT` stays non-retryable) — contracts §4
- [X] T008 Foundational verification gate: `cd apps/api && npx tsc --noEmit && npm run lint` and `cd apps/mobile && npx tsc --noEmit && npx expo lint` — zero errors both; then quickstart Scenario 1 (curl the endpoint with `{}` → 200 six-field matches, with `{"imageUrl":"not-a-url"}` → 400 envelope) against `npm run dev` with the real key

**Checkpoint**: The API answers with normalized ProductMatch data — frontend stories can begin (US1 first; US2/US3 largely ride on US1's screen).

---

## Phase 3: User Story 1 - Run the Demo Scan End-to-End (Priority: P1) 🎯 MVP

**Goal**: Home entry card → `/demo-scan` screen: demo image + looping 001 scan glow → spring handoff into live product cards; card tap opens the store page.

**Independent Test**: From a signed-in session, tap "Try a demo scan"; watch image → animation → real shoppable cards in one uninterrupted flow; card links open real product pages (quickstart Scenario 2).

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `apps/mobile/src/features/visual-search/hooks/useVisualSearch.ts`: discriminated-union machine `idle | searching | done(matches) | failed(message, retryable)` per data-model.md — `run()` calls `apiClient.runVisualSearch()` with the 001-style request-token guard (re-trigger while `searching` is ignored — spec edge case); `done` with an empty array IS the US2 state (never a separate flag); `retry()` re-runs; maps `ApiResult` `api`/`network` kinds to user-safe copy (Constitution VIII)
- [X] T010 [P] [US1] Create `apps/mobile/src/features/visual-search/components/ProductMatchCard.tsx`: NativeWind card rendering exactly the six contract fields — expo-image thumbnail, title (2-line truncation), store name, `price` or "Price unavailable" when null; ≥44pt tap target opening `source_url` via `expo-web-browser` (`openBrowserAsync`); springified `entering` prop accepted from the parent for staggering (contracts §5)
- [X] T011 [P] [US1] Create `apps/mobile/src/features/visual-search/components/DemoScanCard.tsx`: "Try a demo scan" entry card (demo-image thumbnail + copy + chevron, ≥44pt, `bg-surface-card` idiom) invoking an `onPress` prop — placement-agnostic (FR-011)
- [X] T012 [US1] Create `apps/mobile/src/app/(app)/demo-scan.tsx`: bundled `demo-garment.jpeg` full-frame (expo-image, contain) with the 001 `SegmentationOverlay` in `active` mode over a full-image region (frame via `containFrame` from `features/scan/utils/layout`, image natural size 399×501) looping while `useVisualSearch` is `searching` (auto-`run()` on mount); on `done(matches.length > 0)` spring-morph (`.springify()` staggered `entering`) into a scrollable `ProductMatchCard` list over/below the image; back affordance (≥44pt) always present; status-bar handling consistent with the dark scan context (FR-012/FR-013, contracts §5)
- [X] T013 [US1] Render `DemoScanCard` on Home: in `apps/mobile/src/app/(app)/index.tsx`, below the rail/empty-state content in all three content states' shared scroll, wired to `router.push('/demo-scan')`; regenerate expo-router typed routes (brief `npx expo start --offline` — see `/lessons/2026-07-09-expo-router-typed-routes-stale.md`) so `/demo-scan` type-checks
- [ ] T014 [US1] US1 verification: both-apps zero-error gates; quickstart Scenario 2 end-to-end on the simulator (entry card → image+glow → live cards → card tap opens browser; double-tap on entry triggers exactly one search; schema identical across repeat runs)

**Checkpoint**: The demo is showable — image, scan animation, real shoppable cards (SC-006).

---

## Phase 4: User Story 2 - No Matches Is a Result, Not an Error (Priority: P2)

**Goal**: `done([])` renders a designed "no matches" state, visually and structurally distinct from failure.

**Independent Test**: Point `DEMO_IMAGE_URL` at a no-content image; the demo resolves to the no-matches state, not an error (quickstart Scenario 3).

### Implementation for User Story 2

- [X] T015 [US2] Add the designed empty state to `apps/mobile/src/app/(app)/demo-scan.tsx`: when `done` with zero matches, spring in a no-matches card (distinct copy — "Nothing shoppable in this one" tone, invitation to try again + back) that shares layout language with Home's `EmptyScansState` but is clearly NOT the failure state (FR-014, SC-004); structurally driven by `matches.length === 0`, never a separate flag (data-model state machine)
- [ ] T016 [US2] US2 verification: quickstart Scenario 3 (temporary `DEMO_IMAGE_URL` swap to a no-content image → designed empty state; restore env afterwards); confirm the empty and failure states are visually distinguishable side-by-side

---

## Phase 5: User Story 3 - Upstream Failure Degrades Gracefully (Priority: P2)

**Goal**: Every failure mode resolves to the designed error state with retry — never a hang, raw error, or crash.

**Independent Test**: Invalid key, forced timeout, and stopped API each produce the structured envelope and the designed error UI within the timeout budget (quickstart Scenario 4).

### Implementation for User Story 3

- [X] T017 [US3] Wire the failure state in `apps/mobile/src/app/(app)/demo-scan.tsx`: `failed` renders the 001 `ScanErrorFallback` over the demo image with the mapped message, Retry (calling `retry()`) when `retryable`, and a back path — the scan glow stops on failure, never loops forever (FR-014, US3); verify the retryable mapping (`INVALID_INPUT` → no retry button, upstream codes → retry)
- [ ] T018 [US3] US3 verification: quickstart Scenario 4 — invalid key (502 envelope + error UI), forced timeout (504 within budget, not a platform kill), API stopped (mobile `network` path → retry works after restart), payload hygiene (no key/stack/provider internals in any failure body; grep API logs for the key — zero hits, SC-005)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Motion audit, full pass, retrospective.

- [ ] T019 [P] Motion audit per quickstart Scenario 5: glow loops smoothly through artificially slow searches and never completes into a blank frame; card stagger springs; back-swipe mid-search exits cleanly and re-entry starts fresh; grep new code for `Easing.linear` — zero matches (Constitution V)
- [ ] T020 Full quickstart pass (all 5 scenarios in order) + final zero-error gates in both apps; fix anything that fails before marking complete
- [X] T021 [P] If a debugging breakthrough occurred (e.g., SerpApi URL-fetch quirks beyond the documented Drive share-page gotcha), add a `/lessons` entry (Constitution: Local Retrospective)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001/T002 independent — start immediately.
- **Foundational (Phase 2)**: T003 ∥ T004 first (T005–T007 import the types); then T005 → T006 (handler consumes provider); T007 needs T004; T008 last. **Blocks all stories.**
- **US1 (Phase 3)**: after Foundational. T009/T010/T011 all parallel; T012 composes T009+T010; T013 needs T011 (and touches Home — coordinate with nothing else, 002 is done); T014 last.
- **US2 (Phase 4)**: after T012 (same screen file). T015 → T016.
- **US3 (Phase 5)**: after T012 (same screen file). T017 → T018. **T015 and T017 both edit `demo-scan.tsx` — sequence them.**
- **Polish (Phase 6)**: after all stories. T019/T021 parallel; T020 final.

### Within-story rule

Hooks/components (different files) → screen composition → verification. Every verification task (T008, T014, T016, T018, T020) requires zero `tsc`/lint errors in **both apps** before its story is "done".

---

## Parallel Example: User Story 1

```bash
# After T008, launch the three US1 building blocks together:
Task: "useVisualSearch in apps/mobile/src/features/visual-search/hooks/useVisualSearch.ts"
Task: "ProductMatchCard in apps/mobile/src/features/visual-search/components/ProductMatchCard.tsx"
Task: "DemoScanCard in apps/mobile/src/features/visual-search/components/DemoScanCard.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2 — after T008 the API is provably answering with normalized matches (curl, no mobile needed).
2. Phase 3 — **stop and validate**: the demo is showable end-to-end (SC-006). This is the stakeholder moment.
3. US2/US3 are small additions to the same screen; Polish closes it out.

### Incremental Delivery

Setup+Foundational → curl-proven API (T008) → US1 demo (T014) → US2 empty state (T016) → US3 failure modes (T018) → Polish (T020).

---

## Notes

- Total: **21 tasks** (T001–T021). Setup: 2 · Foundational: 6 · US1: 6 · US2: 2 · US3: 2 · Polish: 3.
- **Local dev reality** (research §2): SerpApi can't fetch localhost, so local end-to-end runs ride the Drive direct-content `DEMO_IMAGE_URL` already in `.env.local`; a deployed Vercel instance needs no env at all for the image (self-origin default).
- The SerpApi key lives only in `apps/api/.env.local` / Vercel project env — it must never appear in mobile code, responses, or logs (FR-009, SC-005).
- `demo-scan.tsx` is touched by T012 (US1), T015 (US2), and T017 (US3) — sequence those three if parallelizing.
