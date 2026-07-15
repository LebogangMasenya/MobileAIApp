# Quickstart — 007 UI/UX Overhaul (device verification)

All motion/haptic/gesture acceptance runs on a **real iPhone** (project
practice). Contracts: [motion-tactility](./contracts/motion-tactility.md),
[daily-cycle](./contracts/daily-cycle.md),
[vault-surfaces](./contracts/vault-surfaces.md).

## Prerequisites (one-time)

```bash
cd apps/mobile
npx expo install expo-haptics react-native-svg expo-linear-gradient
npx expo run:ios --device        # dev-client REBUILD required (new native modules)
```

Quality gate before any pass: `npm run lint` and `npx tsc --noEmit` — zero
errors (Constitution: Verification Rule).

## Pass 1 — Living Scan (US1 → SC-001, SC-002)

1. Scan tab → capture a photo of an outfit.
2. During "Identifying garments…": blooming wave + breathing pulse (no
   static spinner); feel one light tick per bloom peak — discrete, never a
   buzz.
3. Watch resolution (bubbles appear OR failure overlay): wave + ticks stop
   within one beat, springy hand-off, **no zombie wave** behind results.
   Repeat 5 scans incl. one forced failure (photo of a wall) — 5/5 clean
   stops = SC-002.
4. 60s of continuous scan + vault browsing: no visible hitching (SC-001;
   ProMotion device if available).
5. Settings → Accessibility → Motion → Reduce Motion ON → rescan: static
   double-ring + label, zero repeating ticks (motion-tactility §3).

## Pass 2 — Tactile Cards (US2 → SC-003)

1. Vault (pull down on capture) with ≥6 saved looks.
2. Press-hold a card, roll the finger: tilt toward touch + moving sheen;
   release → soft spring to rest (no snap).
3. Scripted 20-gesture pass: 8 scrolls started ON cards, 6 quick taps
   (detail modal must open), 4 long-presses (delete alert must appear), 2
   press-roll-release tilts. Expected: 0 hijacks, 0 suppressed actions
   (SC-003) — tilt is observation-only so any failure is a defect.
4. Reduce Motion ON: no tilt, press feedback still present.

## Pass 3 — Momentum Welcome (US3 → SC-004 proxy, SC-007)

1. Delete & reinstall the dev build (fresh state) → sign in → grant camera →
   open vault before scanning.
2. Expect: no "0 saved looks" framing; journey shows Account ✓, Camera ✓,
   progress bar already ~20–25%, single CTA to scan (FR-009).
3. Honesty audit (SC-007): deny camera permission on another fresh install —
   the camera step MUST show unchecked.
4. Complete first scan → journey sweeps closed with a confirm beat, plays
   once; reopening the vault shows the populated grid (FR-010).

## Pass 4 — Smart Defaults (US4 → SC-005 proxy, SC-007)

1. With ≥5 looks across ≥2 categories: open vault → filter rail shows
   category chips, top personal category pre-highlighted, micro-copy
   "Smart-picked from your recent scans".
2. One tap on "All" clears the preselect (FR-011 no-extra-steps).
3. Fresh install (no history): season copy shown, NO personalization claim
   (SC-007).
4. Filter to a category with no looks (after deleting them): designed empty
   message, never a blank grid.

## Pass 5 — Style Rings (US5 → SC-006 proxy, SC-008)

1. Home tab: three-segment ring reflecting today's real state (fresh day =
   all open).
2. Scan a look → return Home: `log` segment sweeps closed with confirm beat.
3. Open a saved look in the vault → `harmony` closes.
4. Tap "Style me" → suggestion sheet composes from stored garments → confirm
   → `coordinate` closes → full-ring celebration (bigger moment + celebrate
   beat), exactly once.
5. Kill the app mid-celebration → relaunch: celebration resolves/plays once,
   never a stuck state.
6. Persistence: force-quit and relaunch same day — segments stay closed.
   Set device date +1 day → ring resets (rollover); earned-today segments
   survive a timezone change within the same local date.
7. Empty vault: "Style me" shows the designed cold-start (deep-link to scan),
   never an error.

## Pass 6 — Accessibility & glass sweep (→ SC-008)

1. Reduce Motion ON: run passes 1–5 abbreviated — every flow completable,
   equivalent information, one-shot beats still present, zero loops.
2. Glass check: scan status pill over a white garment in bright light —
   text legible (≥4.5:1), hairline border present; Android/web fallback =
   solid `bg-black/70` pill.
3. Web (`npm run web`): no crashes — haptics no-op, tilt disabled or inert,
   ring renders statically.

## Cross-check

- Zero `Easing.linear`, zero `runOnJS` (v4 — `scheduleOnRN` only), zero raw
  `expo-haptics` imports outside `services/tactile.ts`.
- Update `/lessons` if the rebuild or SVG/Fabric interplay yields a
  non-obvious breakthrough (Retrospective Discipline).
