# Contract — Vault Surfaces (US2, US3, US4)

## §1 TactileTiltCard (US2 — `src/components/TactileTiltCard.tsx`)

Reusable wrapper; VaultEntryCard is the first consumer (ProductMatchCard is
the recorded follow-up).

```ts
interface TactileTiltCardProps {
  children: ReactNode;
  /** Max tilt in degrees (default 10; guide ceiling 15 — tune on device). */
  maxTilt?: number;
  disabled?: boolean; // also internally true under reduce-motion
}
```

Guarantees (FR-007/008):
- **Observation-only gesture** (R6): `Gesture.Manual`, never activates —
  scroll, tap, and long-press pass through untouched *by construction*.
- Touch position → `rotateX/rotateY` (perspective 800), springs with high
  damping/low stiffness; release/cancel springs to rest (soft, never snap).
- Sheen: `expo-linear-gradient` white→transparent overlay, horizontal offset
  interpolated from tilt; `pointerEvents="none"`; lives inside the card's
  stacking context (no global z).
- Tilt range bounded so neighbors never overlap/clip (grid gap 12 respected).
- Verification: SC-003 scripted 20-gesture pass (quickstart §US2).

## §2 VaultWelcomeJourney (US3 — replaces VaultEmptyState `empty` variant)

- Input: `SetupJourney` from `useSetupJourney` (data-model §1). The `error`
  variant of VaultEmptyState is untouched.
- Never renders a raw zero count (FR-009); shows checked real steps +
  progress bar initialized from genuine completion (~0.22 when account+camera
  done) + single CTA ("Scan your first piece") that closes the vault back to
  capture (the existing `close()` affordance).
- First-scan completion: journey sweeps to 1 with `confirm()` beat, plays
  once (celebration flag, data-model §1), then the populated grid owns the
  scene (FR-010).
- Copy claims only what happened: a user who denied camera permission sees
  that step unchecked — the honest state doubles as a permission prompt.
- Design pre-flight gate (Constitution II) before building this view.

## §3 VaultFilterRail (US4 — new row under the VaultSheet header)

- Chips = categories present in stored entries (derived live), ordered by
  `StyleProfile.categories` weight; "All" chip always first.
- Smart preselect: top-weighted category chip pre-highlighted when
  `profile.personalized`; micro-copy beneath: "Smart-picked from your recent
  scans" (personalized) / "Fresh picks for {season}" (cold start) — truthful
  by data-model §2's `personalized` gate (FR-011, SC-007).
- Preselect filters the grid but MUST be dismissible in one tap (the "All"
  chip) — no more steps than an unfilled control (FR-011).
- Session-local selection (data-model §4); empty filter result renders a
  designed "no {category} looks yet" state, never a blank grid
  (Constitution VII).
- Rail hidden while the vault is empty (the journey owns that scene).
- Design pre-flight gate (Constitution II) before building this view.
