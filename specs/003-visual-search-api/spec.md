# Feature Specification: Visual Search Demo Flow (Demo Image → Real Search → Product Cards)

**Feature Branch**: `003-visual-search-api`

**Created**: 2026-07-09

**Status**: Draft (revised same day per user direction) — awaiting user approval before planning

**Input**: User description: "Build the lightweight backend API layer for the visual search flow (Next.js serverless on Vercel, SerpApi Google Lens, strict ProductMatch normalization, graceful 500s). **Revised**: instead of client image upload, create a mock matcher demo showing how the flow works end-to-end with a fixed demo image — the repo file `test_image/test_image.jpeg` (chosen over an external share link for reliability): the image shows in the frontend, the scan animation plays, SerpApi is hit for real, and clothing cards are shown."

---

## Scope note *(what "mock" means here)*

The **capture step is mocked** — a fixed, publicly hosted demo garment image stands in for camera capture + garment cropping + upload. The **search is real** — the backend genuinely calls SerpApi's Google Lens with the demo image's URL and the frontend renders genuine shoppable results. This proves the entire pipe (UI → API → provider → normalized cards) while deferring the two hard upload problems (client image transport, ephemeral public hosting for the provider) to a follow-up.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the Demo Scan End-to-End (Priority: P1)

From the app, the user triggers a demo scan. The demo garment image appears on screen, the familiar scanning animation plays over it while the search runs, and the screen resolves into a swipeable set of clothing product cards — each with product photo, title, price, store name, and a link out to buy — sourced live from real stores.

**Why this priority**: This is the whole feature — a working, demonstrable slice of the product's core promise ("see it, scan it, shop it") with real search results.

**Independent Test**: Trigger the demo from a clean build; verify image → animation → live product cards in one uninterrupted flow, and that every card's link opens a real product page.

**Acceptance Scenarios**:

1. **Given** the demo entry point, **When** the user triggers it, **Then** the demo garment image is displayed and the scan animation plays over it while the search is in flight (no frozen or blank interlude).
2. **Given** the search completes with results, **When** cards render, **Then** each card shows exactly the contract fields — product image, title, price (or a graceful "price unavailable" when null), store name — and tapping a card opens its product page.
3. **Given** the animation is still playing when results arrive, **When** the transition to cards happens, **Then** it is a smooth animated handoff (no hard cut mid-animation — Constitution motion bar applies).
4. **Given** the backend response, **When** inspected, **Then** every match contains exactly: `id`, `title`, `source_url`, `thumbnail`, `price` (nullable), `store_name` — no extra provider fields leaking through.

---

### User Story 2 - No Matches Is a Result, Not an Error (Priority: P2)

If the search legitimately finds nothing shoppable, the demo resolves into the designed "no matches" empty state — clearly distinct from a failure.

**Independent Test**: Force an empty normalized result (e.g., all provider entries lack essential fields); verify the app shows the no-matches state, not an error.

**Acceptance Scenarios**:

1. **Given** a search with zero usable results, **When** it completes, **Then** the API returns success with an empty list and the app shows its "no matches" state.
2. **Given** provider entries that all fail normalization, **When** normalization completes, **Then** the outcome is that same successful empty list.

---

### User Story 3 - Upstream Failure Degrades Gracefully (Priority: P2)

If SerpApi is down, slow, or over quota, the app promptly receives a structured error payload and shows its designed error/empty state — never a hang, never a raw provider error.

**Independent Test**: Run the demo with an invalid key, unreachable host, and forced timeout; verify each returns the structured error payload within the timeout budget and the app renders its designed fallback.

**Acceptance Scenarios**:

1. **Given** the provider is unreachable or errors, **When** the demo runs, **Then** the API responds with a server-error status and a structured payload (stable code + human message) the app parses to show its error state.
2. **Given** the provider exceeds the timeout budget, **When** the budget elapses, **Then** the upstream call is abandoned and the same structured error shape returns — the scan animation never spins forever.
3. **Given** any failure payload, **When** inspected, **Then** it contains no secrets, stack traces, or raw provider internals.

---

### Edge Cases

- **Demo image URL unreachable from the provider's side**: surfaces as the standard upstream-failure payload; the app shows its error state (the demo must fail visibly, not mysteriously).
- **Provider quota exhausted / key rejected**: same upstream-failure payload; distinguishable in server logs only.
- **Repeated demo triggers (double-tap)**: requests are stateless and idempotent to run; the UI ignores re-triggers while a demo is in flight.
- **Slow search with fast animation**: the scan animation loops/holds gracefully until results or failure arrive — it never completes into a blank screen.
- **Very large result sets**: capped at a fixed maximum (top results) to keep cards snappy on mobile.

## Requirements *(mandatory)*

### Functional Requirements

**Backend endpoint**

- **FR-001**: The system MUST expose a single request/response endpoint that accepts a **publicly reachable image URL** and returns normalized product matches for it. *(Client image upload — base64/multipart — is explicitly out of scope this feature; see Assumptions.)*
- **FR-002**: The endpoint MUST validate input before any upstream call: URL present, well-formed, and http(s) — violations return a structured client-error payload and consume no upstream quota.
- **FR-003**: The system MUST submit the image URL to the visual search provider — **SerpApi's Google Lens engine**, per explicit user directive *(named-technology exception documented in Assumptions)* — and await its product results.
- **FR-004**: The system MUST normalize provider results into a uniform match list where each entry contains **exactly**: `id`, `title`, `source_url`, `thumbnail`, `price` (display string or null when unreported), `store_name` — and nothing else. Entries lacking a usable `title` or `source_url` MUST be dropped.
- **FR-005**: The response MUST be capped at a fixed maximum number of matches (default 20, top-ranked first).
- **FR-006**: Zero usable matches MUST return a successful response with an empty list — explicitly distinct from every failure response.
- **FR-007**: Every upstream failure mode (provider error, network failure, malformed response, timeout) MUST return a server-error response with one stable payload shape (machine-readable code + human-readable message); raw provider errors MUST never reach the client.
- **FR-008**: The system MUST enforce its own upstream timeout budget (default 10 seconds) so a slow provider produces the FR-007 payload rather than an opaque platform kill.
- **FR-009**: The provider credential MUST live only in server-side configuration, never accepted from or exposed to the client, logs, or error payloads.
- **FR-010**: Server-side logging MUST record failures (codes, timings, upstream status) without logging full provider payloads.

**Frontend demo flow**

- **FR-011**: The app MUST provide a demo entry point (signed-in area) that triggers the flow with the designated demo garment image.
- **FR-012**: On trigger, the app MUST display the demo image and play the scanning animation over it for the duration of the search — reusing the feature-001 scanning visual language — with the animation looping/holding gracefully however long the search takes.
- **FR-013**: On success, the app MUST transition (interruptible spring motion, Constitution V) from the scanning state into a set of product cards rendering exactly the contract fields, with null prices shown as a graceful "price unavailable" and card taps opening the product page in the browser.
- **FR-014**: On empty results, the app MUST show a designed "no matches" state; on failure, a designed error state with retry — never a raw error or infinite spinner (reusing feature-001 fallback patterns).
- **FR-015**: The request/response shapes MUST be published as strict typed definitions shared verbatim between API and mobile client.

### Key Entities

- **DemoScanRequest**: The frontend's trigger — carries the demo image URL (server may also default it).
- **ProductMatch**: One shoppable result — exactly `id`, `title`, `source_url`, `thumbnail`, `price` (nullable), `store_name`.
- **VisualSearchResult**: Success envelope — ordered, capped list of ProductMatch (possibly empty).
- **VisualSearchError**: Failure envelope — one stable shape: machine-readable code (invalid-input, upstream-failed, upstream-timeout, internal), human-readable message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From demo trigger to rendered cards (or designed empty/error state) in under 10 seconds for 95% of runs; no run ever exceeds 15 seconds without resolving to a designed state.
- **SC-002**: 100% of rendered cards carry all contract fields with working links; zero provider fields outside the contract reach the client.
- **SC-003**: Every induced failure mode (unreachable provider, invalid key, forced timeout, malformed payload, invalid input) resolves to the single structured error shape and a designed UI state — zero unhandled exceptions, hangs, or raw errors.
- **SC-004**: "No matches" and "search failed" are visually and programmatically distinct in 100% of cases.
- **SC-005**: Zero occurrences of the provider credential anywhere client-visible or in logs.
- **SC-006**: The demo is showable: a first-time viewer watching one run sees image → scan → live shoppable cards without explanation or developer intervention.

## Assumptions

- **Named technologies** (Next.js/Vercel serverless, SerpApi Google Lens, TypeScript contracts): explicit user directive — documented exception to the no-implementation-details rule, same precedent as feature 002.
- **Demo image**: the repo file **`test_image/test_image.jpeg`** (399×501 JPEG, ~25 KB — street shot with jacket, jeans, sneakers, and bag: multiple matchable garments). Chosen by the user over an external share link for reliability. Two consumption paths, one file:
  - **Frontend display**: bundled with the mobile app as a static asset — renders instantly and offline-safe.
  - **Provider search**: SerpApi fetches images by public URL from its own servers, so the same file must also be **publicly hosted** — the natural home is the API app's static assets (served by the deployed Vercel instance). How local development gets a provider-reachable URL (deployed instance, tunnel, or temporary host) is a plan-phase decision recorded in `research.md`.
- **Upload is deferred**: accepting camera crops (base64/multipart) plus ephemeral public hosting for the provider is the natural follow-up feature; this demo proves the pipe first. The endpoint's URL-based contract is forward-compatible (a future upload step resolves to a URL and reuses everything downstream).
- **Demo entry placement**: somewhere natural in the signed-in app (e.g., an affordance on the Scan screen or Home) — exact placement is a plan/design decision; it must not disrupt the real feature-001 camera flow.
- **Feature 001's mock matcher stays**: the existing `mockProvider` behind the 001 scan flow is untouched; unifying it with this real search is a follow-up.
- **No endpoint auth this feature**: no server-side account system exists yet (feature 002 auth is device-mocked); guardrails are the server-held key and provider quotas. Noted as a launch prerequisite.
- **Price fidelity**: `price` is the provider's display string passed through verbatim, or null — never parsed or fabricated.
- **Operational prerequisite**: a SerpApi account with its key in server configuration (`SERPAPI_API_KEY`); free-tier quota suffices for development and validation.
