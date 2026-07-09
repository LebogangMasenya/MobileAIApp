# Quickstart Validation: Visual Search Demo Flow

**Feature**: 003-visual-search-api · **Date**: 2026-07-09

## Prerequisites

1. **SerpApi key** in `apps/api/.env.local`:
   ```bash
   SERPAPI_API_KEY=your_key_here          # free tier is sufficient
   # For LOCAL runs only — SerpApi cannot fetch from localhost, so point the
   # demo image at any public copy (e.g. a deployed instance's own asset):
   DEMO_IMAGE_URL=https://<your-app>.vercel.app/demo/demo-garment.jpeg
   ```
   On a **deployed** Vercel instance, `DEMO_IMAGE_URL` is unnecessary — the route defaults to its own origin's `/demo/demo-garment.jpeg`.
2. Run both apps:
   ```bash
   cd apps/api && npm run dev                       # http://localhost:3000
   cd apps/mobile && npx expo run:ios               # existing dev client
   # apps/mobile/.env: EXPO_PUBLIC_API_URL must point at the API (001 setup)
   ```
3. Verification gates (zero errors before any scenario "passes"):
   ```bash
   cd apps/api && npx tsc --noEmit && npm run lint
   cd apps/mobile && npx tsc --noEmit && npx expo lint
   ```

## Scenario 1 — API contract check (US1, no mobile needed)

1. `curl -s -X POST http://localhost:3000/v1/visual-search -H 'content-type: application/json' -d '{}' | jq`
   **Expect**: 200 with `matches[]`; every entry has exactly `id`, `title`, `source_url`, `thumbnail`, `price`, `store_name` (price possibly null); ≤20 entries; no provider fields like `source_icon`/`rating` anywhere.
2. `curl -s -X POST … -d '{"imageUrl":"not-a-url"}'`
   **Expect**: 400 `{ "error": { "code": "INVALID_INPUT", … } }`.
3. Response time for step 1 comfortably under 15s (SC-001) — typically well under 10s.

## Scenario 2 — Demo flow end-to-end (US1 / SC-006)

1. Sign in (mock auth, feature 002) → Home shows the **"Try a demo scan"** card. Tap it.
2. **Expect**: the demo garment image (camel jacket/jeans/sneakers) appears immediately (bundled asset — no network wait), with the feature-001 scanning glow looping over it.
3. When the search lands: **Expect** a smooth spring handoff (no hard cut) into product cards — image, title, store name, price or "Price unavailable"; scroll through them.
4. Tap a card. **Expect**: in-app browser opens that product page.
5. Re-run the demo twice more. **Expect**: same schema every time; rapid double-tap on the entry card triggers exactly one search.

## Scenario 3 — Empty result is designed, not broken (US2)

Hard to produce organically with this image; verify via the seam:

1. Temporarily point `DEMO_IMAGE_URL` at an image with no shoppable content (e.g. a plain-color photo), restart the API, run the demo.
   **Expect**: the designed "no matches" state — clearly not an error, with a retry/back affordance. Restore the env afterwards.

## Scenario 4 — Failure modes (US3 / SC-003)

Each case must resolve to the designed error state with the structured payload — never a spinner-of-death, raw error, or crash:

1. **Invalid key**: set `SERPAPI_API_KEY=bad`, restart API, run demo. **Expect**: error state; server log shows UPSTREAM_FAILED; curl shows 502 envelope.
2. **Timeout**: set the provider budget low temporarily (e.g. 1ms) or block the host. **Expect**: 504 `UPSTREAM_TIMEOUT` within the budget — not a platform kill.
3. **API down**: stop the API, run demo. **Expect**: mobile offline path (`network` result) → error state with Retry; restart API, tap Retry → results appear (input/screen state preserved).
4. **Payload hygiene**: in every failure body above, confirm no key, stack trace, or raw provider text (SC-005); grep API logs for the key — zero hits.

## Scenario 5 — Motion & consistency audit (Constitution V)

1. The scanning glow loops smoothly for the entire search — including artificially slow responses (re-run with network conditioner if available); it never "finishes" into a blank frame.
2. Cards enter with a springified stagger; no `Easing.linear` in any new code (grep).
3. Back-swipe out of `/demo-scan` mid-search. **Expect**: clean exit, no crash, no orphaned state — re-entering starts fresh.

## Pass criteria

Every numbered expectation holds, plus zero TypeScript/lint errors in **both** apps. Failures map back to FR/SC in [spec.md](./spec.md); details in [data-model.md](./data-model.md) and [contracts/visual-search-api.md](./contracts/visual-search-api.md).
