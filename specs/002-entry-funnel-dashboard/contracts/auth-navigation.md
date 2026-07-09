# Contract: Session-Driven Navigation & Screen Inventory

**Feature**: 002-entry-funnel-dashboard · **Date**: 2026-07-08 · **Revised**: 2026-07-09 (mock-provider amendment)

This feature exposes no HTTP endpoints. Its contracts are: (1) the **session contract** every screen consumes, (2) the **routing/gate behavior** all code may rely on, (3) the screen inventory, (4) the motion contract, (5) the local scan store.

## 1. The session contract (`AuthContract`, `src/types/auth.ts`)

The single seam between the app and whichever provider is behind it (mock now, managed later — FR-024). Consumed exclusively via `useAuthSession()`:

```ts
interface AuthContract {
  isLoaded: boolean;          // session restoration finished (airlock release signal)
  isSignedIn: boolean;        // valid session exists (the only routing key)
  user: AuthUser | null;      // see data-model.md

  signUp(email: string, password: string, firstName?: string): Promise<void>; // rejects AuthError
  signIn(email: string, password: string): Promise<void>;          // rejects AuthError
  signInWithApple(): Promise<'completed' | 'cancelled'>;           // cancel = silent return
  signInWithGoogle(): Promise<'completed' | 'cancelled'>;
  requestPasswordReset(email: string): Promise<void>;              // ALWAYS resolves identically (FR-006)
  signOut(): Promise<void>;
}
```

Contract rules (hold for mock and real provider alike):
- **C1**: Every operation is async with genuine latency; callers must render busy states and stay idempotent under double-tap.
- **C2**: Failures reject with typed `AuthError` codes (data-model.md) — the UI maps codes to human copy; raw provider errors never surface (FR-008).
- **C3**: `requestPasswordReset` is enumeration-safe by signature: same resolution, same timing, registered or not.
- **C4**: `signOut()` purges all session material from secure storage before resolving (FR-009).
- **C5**: The mock implementation lives only in `src/features/auth/providers/` and is unmistakably named `MockAuthProvider` (FR-025).

## 2. The gate contract (root `_layout.tsx`)

```text
State inputs (from useAuthSession):   Guarantee:
  isLoaded: boolean                     while !isLoaded → splash overlay only; NEITHER group renders
  isSignedIn: boolean                   isLoaded && !isSignedIn → exactly (auth) mounted
                                        isLoaded && isSignedIn  → exactly (app) mounted
```

Invariants any code may assume:

- **G1**: At most one of `(auth)` / `(app)` is ever mounted. There is no frame where both (or neither, post-load) render.
- **G2**: A guard flip removes the unmounted group's screens from navigation history — back gestures cannot cross the gate in either direction (FR-010).
- **G3**: Session truth lives only behind the `AuthContract`, backed by SecureStore. No token in params/props/logs (FR-009).
- **G4**: Any code that needs auth state calls `useAuthSession()` — no duplicated "isLoggedIn" flags anywhere (FR-011/FR-024).
- **G5**: Deep links to `(app)` routes while signed out are captured by the router; after successful auth the user lands on the originally requested route (spec edge case).

## 3. Screen inventory & route table

| Route | Screen | Group | Key requirements |
|-------|--------|-------|------------------|
| `/welcome` | Welcome (merged p2+p11) | (auth) — anchor | FR-003, D3/D7/D10 |
| `/sign-in` | Sign In | (auth) | FR-005, FR-007, FR-008 |
| `/sign-up` | Create Account | (auth) | FR-004, FR-007, FR-008 |
| `/reset-password` | Reset Password | (auth) | FR-006 |
| `/` | Home dashboard | (app) — anchor | FR-012..FR-016, D5/D6/D9 |
| `/scan` | Scan (feature 001, relocated) | (app) | unchanged behavior; label "Scan" (D4) |
| `/account` | Account hub | (app) | FR-018, FR-019 (+ `__DEV__`-only "Expire session" row) |

## 4. Auth flow operations (contract calls the screens make)

| Flow | Operation | Success | Failure surface |
|------|-----------|---------|-----------------|
| Sign up | `signUp(email, password)` | session written → guard flips → (app) mounts | inline notice (`email-taken`, `weak-password`…); inputs preserved |
| Sign in | `signIn(email, password)` | same | `invalid-credentials` inline; email preserved |
| Apple | `signInWithApple()` → simulated consent sheet | `'completed'` → same | `'cancelled'` = silent return, no toast |
| Google | `signInWithGoogle()` → simulated consent sheet | same | same |
| Reset | `requestPasswordReset(email)` | identical confirmation state regardless of registry (FR-006) | never fails organically in the mock |
| Sign out | `signOut()` after confirmation dialog | session key purged; guard flips → (auth) mounts (FR-009/FR-010) | inline notice; session retained on failure |

All operations run inside try/catch with mapped human-readable messages (FR-008, Constitution VII).

## 5. Motion contract (Constitution V)

| Transition | Mechanism | Interruptibility guarantee |
|------------|-----------|---------------------------|
| Splash → first screen | `withSpring` morph on overlay shared values, released by `isLoaded` | spring retargets from current position; overlay never blocks input after `isLoaded` |
| Welcome ↔ Sign-In/Sign-Up/Reset | stack transitions with spring specs | native gesture-driven, cancellable mid-swipe |
| Auth ↔ App (gate crossing) | guard swap + `entering`/`exiting` springified animations | mounted group owned by state, not animation — interrupt cannot strand between stacks |

Banned: `Easing.linear`, non-interruptible timing-only transitions, layout jumps on interrupt.

## 6. Local store contract (`RecentScanSummary`)

- Write: scan flow appends `{ scanId, thumbnailUri, capturedAt, garmentCount }` on successful segmentation; store trims to 20 newest.
- Read: `useRecentScans()` → `{ scans, isLoading, error, retry }`; parse failure ⇒ `scans: []` + `error` set (UI shows retry state, FR-016).
- Schema versioned with a `v` field so future server migration can detect/upgrade old payloads.
