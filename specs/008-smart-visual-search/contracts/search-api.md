# Contract — Visual Search API Extensions (US1, US3, US5)

Extends specs/003 contracts. One error envelope (`{ error: { code,
message } }`), one dialect. apps/api/AGENTS.md rule applies: verify Next.js
idioms against `node_modules/next/dist/docs/` before writing route code.

## §1 POST /v1/visual-search — now dual-mode

**Mode A (existing, unchanged)**: JSON body `{ imageUrl?, country? }` —
feature 003 demo behavior preserved verbatim (empty body ⇒ server-resolved
demo image).

**Mode B (new)**: `multipart/form-data` with field `photo` (PNG, the
trimmed isolated garment; reject > 8MB with INVALID_INPUT) and optional
`country` field. Flow: store bytes in uploadStore → build self-origin URL
`{origin}/v1/visual-search/images/{id}` → provider search with that URL →
same response envelope as Mode A.

Response 200: `{ matches: ProductMatch[] }` — empty array remains a
legitimate 200 (nothing shoppable is a result). Mobile derives
`resultSetId` locally (e.g., response timestamp+hash); the wire stays as-is.

Errors: `INVALID_INPUT` 400 (bad multipart/oversize/wrong type),
`UPSTREAM_FAILED` 502, `UPSTREAM_TIMEOUT` 504, `INTERNAL_ERROR` 500 —
unchanged taxonomy (FR-019 maps them to designed mobile states).

## §2 GET /v1/visual-search/images/[id]

- Returns stored PNG bytes with `content-type: image/png`; 404 after
  TTL/eviction or unknown id. No listing, no enumeration — ids are
  unguessable crypto-random tokens.
- Exists ONLY so the URL-bound provider can fetch the upload from the
  deployed origin (research R2). Not a CDN, not durable storage: TTL ≈ 5
  min, LRU cap, memory-only (privacy invariant — user photos never touch a
  durable store server-side).

## §3 Provider request/normalization changes (`serpApiProvider.ts`)

- Request the section set that includes exact matches (`type=all` — R3);
  VERIFY the exact-match section name/shape against the provider's live
  docs at implementation time (003 precedent). If the provider/account
  returns no exact section, `exact` is simply never set — the US5 tier
  stays dormant by design.
- Normalizer additions (all optional, dropped unless well-typed):
  - `price_value` ← provider numeric extracted price (finite number only)
  - `currency` ← provider currency (non-empty string)
  - `exact: true` ← membership in the provider's exact-match section
  - `thumbnail_width/height` ← provider image dims when present
- Existing drop rules and MAX_MATCHES=20 unchanged; display `price` string
  stays verbatim-or-null (never fabricated).
- Provider specifics remain confined to this module (003 one-file-swap
  rule); the raw exact-section shape never crosses into shared types.

## §4 Type sync rule

`apps/api/src/types/visual-search.ts` and
`apps/mobile/src/types/visual-search.ts` are deliberate near-identical
copies (003 decision) — BOTH gain the same optional ProductMatch fields in
the same change; the sync comment in each file is updated.
