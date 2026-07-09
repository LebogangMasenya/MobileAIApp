# Data Model: Entry Funnel & Home Dashboard

**Date**: 2026-07-08 · **Revised**: 2026-07-09 (mock-provider amendment) · **Feature**: 002-entry-funnel-dashboard

Identity data is **owned by the session provider behind the `AuthContract`** — this release that provider is the on-device `MockAuthProvider` (FR-022); a managed provider (Clerk) replaces it in a follow-up with no changes to these read-model shapes. Screens never see provider internals, only the contract.

## Entities

### AuthUser *(contract read-model, `src/types/auth.ts`)*

What `useAuthSession().user` exposes — shaped to match what a managed provider will return later, so the swap is type-stable:

| Field | Type | Notes |
|-------|------|-------|
| id | string | stable key for all future per-user data |
| email | string | primary identifier |
| firstName | string \| null | drives the Home greeting (FR-012) |
| lastName | string \| null | — |
| imageUrl | string \| null | avatar; always null from the mock → initials fallback path is always exercised (FR-018) |

Validation (enforced at the form layer as-you-type, mirrored by the mock on submit):
- email: RFC-shaped format check, inline (FR-004)
- password: ≥8 chars minimum strength gate, inline (FR-004)

### MockAccount *(mock-internal, never leaves the provider file)*

Device-local registry entry under SecureStore key `satori.auth.accounts.v1`:

| Field | Type | Notes |
|-------|------|-------|
| id | string | generated at sign-up (random UUID-ish string) |
| email | string | unique in the registry (`email-taken` on duplicates) |
| password | string | plain text — acceptable only as a hardware-backed dev scaffold (FR-025); why-comment mandatory |
| firstName | string \| null | demo identity provides one; email sign-up may leave null (exercises time-of-day greeting) |
| createdAt | string (ISO) | — |

### AuthSession *(mock-internal; never an app type)*

- SecureStore key `satori.auth.session.v1`: `{ token: string, userId: string }` — token is a random opaque value; restoration = read key + match `userId` against the registry.
- App code reads only derived booleans through the contract: `isLoaded` (restoration read finished) and `isSignedIn` (valid session matched).
- **Rule**: no token ever appears in navigation params, component props, logs, or app state (spec Navigation State outline §4) — the rule survives the provider swap verbatim.

**State transitions** (identical to the eventual real provider):

```text
        (cold launch)
  UNKNOWN ──isLoaded──▶ SIGNED_OUT ──sign-in/sign-up succeeds──▶ SIGNED_IN
     │                       ▲                                       │
     └──isLoaded (valid──────┼── sign-out / dev-expiry ◀─────────────┘
        session found)───▶ SIGNED_IN
```

- `UNKNOWN`: splash airlock visible; neither route group rendered (FR-001).
- Every transition re-evaluates the root guards; entering `SIGNED_OUT` deletes the session key and unmounts `(app)` with history removal (FR-010/FR-011).
- Expiry is simulated via the `__DEV__`-only "Expire session (dev)" Account row (research §1b) — exercises US2 scenario 2.

### UserProfile *(app read-model, `src/types/auth.ts`)*

| Field | Type | Derivation |
|-------|------|-----------|
| displayName | string | `firstName ?? email-local-part` |
| greetingName | string \| null | `firstName`, null → time-of-day fallback (FR-012) |
| initials | string | from name/email for avatar fallback (FR-018) |
| avatarUrl | string \| null | `imageUrl` |

Pure derivation from `AuthUser` — computed by `useGreeting`/account hooks, never stored.

### RecentScanSummary *(device-local store, `src/types/auth.ts`)*

| Field | Type | Notes |
|-------|------|-------|
| scanId | string | key back into feature 001's scan result view (FR-015) |
| thumbnailUri | string | local photo URI captured at scan time |
| capturedAt | string (ISO) | rail sorts newest-first (FR-013) |
| garmentCount | number | card badge copy |

Store rules:
- Written by the scan flow on successful segmentation (001 integration point); envelope versioned `{ v: 1, scans: [...] }`.
- Capped at 20 newest; corrupt/unreadable store degrades to empty state, never a crash (FR-016).
- Zero records ⇒ Home renders `EmptyScansState` + `FeatureHighlights` (FR-014); ≥1 record ⇒ rail replaces highlights (D9).
- Device-local only this feature; `useRecentScans` is the future swap point for server-side history (research §5).

## Relationships

```text
AuthContract (MockAuthProvider now, managed provider later)
   ├─ user: AuthUser ──derives──▶ UserProfile ──consumed by──▶ GreetingHeader, Account hub
   └─ isLoaded/isSignedIn ──gates──▶ (auth) | (app) route groups (single source of truth)
MockAccount / AuthSession — internal to the provider, invisible past the contract
RecentScanSummary ──references──▶ feature 001 ScanSession (by scanId)
```

## Validation & error surfaces

`AuthError` codes surfaced by the contract (mapped to human copy in the UI — FR-008):
`invalid-credentials` (wrong password *or* unknown account — identical copy, no enumeration) · `email-taken` · `invalid-email` · `weak-password` · `unknown`.

| Boundary | Failure | Surface |
|----------|---------|---------|
| Contract operations | rejected with `AuthError` | inline `AuthErrorNotice`, inputs preserved (FR-007/FR-008) |
| Simulated social sheet | user taps Cancel | silent return to prior form state (FR-023, edge case) |
| Session restore | corrupted/expired token (dev-expiry row) | Welcome + "please sign in again" notice (US2-2) |
| Local scan store | read/parse failure | empty-state fallback + retry (FR-016) |
