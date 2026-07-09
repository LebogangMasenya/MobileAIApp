# Quickstart Validation: Entry Funnel & Home Dashboard

**Feature**: 002-entry-funnel-dashboard · **Date**: 2026-07-08 · **Revised**: 2026-07-09 (mock-provider amendment)

Manual end-to-end scenarios proving the feature works. Run all of them on the iOS simulator (primary) after implementation; spot-check web for layout only.

## Prerequisites

1. **No external accounts, keys, or `.env` needed** — authentication is served by the on-device `MockAuthProvider` (spec FR-022..FR-025).
2. Run in the existing custom dev client (feature 001's native vision module already requires it; this feature adds **no** new native modules):
   ```bash
   cd apps/mobile && npx expo run:ios     # or a previously installed dev client
   ```
3. Start with a clean slate: delete the app from the simulator (clears the Keychain-backed mock registry and session) before Scenario 1.
4. Verification gates (must be zero-error before any scenario "passes"):
   ```bash
   cd apps/mobile && npx tsc --noEmit && npx expo lint
   ```

## Scenario 1 — First launch & registration funnel (US1 / SC-001)

1. Cold-launch the app. **Expect**: Satori splash (wordmark + indeterminate shimmer — no fake progress bar), then a continuous spring morph into **Welcome** (never a hard cut, never a flash of Home).
2. Verify Welcome: headline "The world is your wardrobe…", primary **Create account** + secondary **Log in**, both ≥48pt tall in the lower thumb zone; button copy reads "Get Started"/"Create account" (no "Get Startef" typo).
3. Tap **Create account** → enter an invalid email → **Expect** inline validation while typing, not a post-submit alert.
4. Submit valid email + password. **Expect**: busy state on the button for the mock's simulated latency (double-tap does not double-submit), then a spring transition into **Home**; back-swipe from Home does **not** return to any auth screen.
5. Home greeting shows your first name if the form captured one, otherwise the time-of-day greeting.
6. Repeat sign-up with the **same email**. **Expect**: inline "account already exists" style notice (`email-taken`), inputs preserved.

## Scenario 2 — Returning user & session persistence (US2 / SC-002)

1. Kill the app completely; relaunch. **Expect**: splash → **Home directly**, under 3s, with zero frames of Welcome/Sign-In (the mock's session key restored from SecureStore).
2. Account tab → **Sign Out** → confirmation dialog → confirm. **Expect**: spring transition to Welcome; back gesture cannot re-enter Home/Scan/Account.
3. Relaunch after sign-out. **Expect**: splash → Welcome (session key truly purged; registry survives).
4. Sign back in via **Log in** with the Scenario-1 credentials. **Expect**: land on Home (the device-local registry recognized the account).
5. Sign in again, then Account tab → **Expire session (dev)** row (`__DEV__` only) → relaunch. **Expect**: splash → Welcome with a gentle "please sign in again" notice — never a crash or blank screen.

## Scenario 3 — Auth failure modes (US1 edge cases / SC-006)

1. Sign-In: submit the Scenario-1 email with a **wrong password**. **Expect**: inline human-readable error, email field still populated, immediate retry possible.
2. Sign-In: submit an email that was **never registered**. **Expect**: the *same* error copy as step 1 (the mock never reveals whether the account exists).
3. Tap Apple (or Google) sign-in → the simulated consent sheet appears → tap **Cancel**. **Expect**: silent return to the form (no error toast for a deliberate cancel). Tap again → **Continue as Demo User** → **Expect**: land on Home greeted as the demo identity.
4. **Forgot password?** → submit (a) a registered email, (b) an unknown email. **Expect**: byte-for-byte identical confirmation UI and timing (no account enumeration).
5. With the keyboard open on every auth form: **Expect** the submit button visible above the keyboard (FR-007).

> Offline/outage behavior cannot occur organically with the on-device mock — the offline notice UI ships now, and its end-to-end exercise belongs to the provider-integration follow-up (spec Assumptions).

## Scenario 4 — Home dashboard states (US3 / SC-005)

1. Fresh account, zero scans: **Expect** first-run empty state (no empty rail): invitation + **Scan your first outfit** CTA + "What you will love" rows. Tap the CTA → **Expect** the Scan tab activates.
2. Complete one scan (feature 001 flow). Return to Home. **Expect**: "Recently scanned" rail shows the scan (thumbnail, newest first); marketing rows replaced by content.
3. Tap the scan card. **Expect**: opens that scan's results view (001) — *not* the PDF p10 template screen.
4. Corrupt/clear the local scan store (reinstall, or a dev hook to wipe the store). **Expect**: graceful empty/retry state, never a blank region or crash.

## Scenario 5 — Motion quality audit (Constitution V / SC-003)

1. During splash→Welcome morph, background the app mid-animation and return. **Expect**: animation continues/settles smoothly from current position — no jump-cut or clipping.
2. Start Welcome→Sign-In, half-swipe back mid-transition, release. **Expect**: gesture-driven spring settles either way with no stutter.
3. Watch the Sign-In→Home crossing at 60fps (perf monitor on). **Expect**: no dropped-frame stutter, no frame showing both auth and app chrome simultaneously.
4. Grep-level audit: no `Easing.linear` anywhere in the new code.

## Scenario 6 — Ergonomics & accessibility audit (SC-007)

1. On the smallest supported simulator (e.g., iPhone SE class): all primary CTAs render in the bottom 40% of the viewport; every tap target ≥44×44pt; Account rows ≥56pt.
2. Account tab: initials avatar (the mock supplies no image URL, so the fallback path always renders), display name, all five rows + separated Sign Out; unbuilt rows show a "coming soon" state on tap — zero dead taps. The dev-expiry row appears only in `__DEV__`.
3. Register with a very long first name → Home greeting and Account header truncate without layout shift.
4. Toggle dark mode: dark header/status-bar text stays legible in both themes on Home.

## Pass criteria

Every numbered expectation holds, plus zero TypeScript/lint errors. Any failure maps back to its FR/SC in [spec.md](./spec.md) — fix before marking the corresponding task complete. Reference details: [data-model.md](./data-model.md), [contracts/auth-navigation.md](./contracts/auth-navigation.md).
