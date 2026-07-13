# Quickstart Validation: Wardrobe Vault + Hotspot Fix

**Feature**: 005-wardrobe-vault · **Date**: 2026-07-12

## Prerequisites

1. Install the one new dependency and **rebuild the dev client** (native module):
   ```bash
   cd apps/mobile && npx expo install expo-file-system && npx expo run:ios
   ```
2. API running for scan/matches flows (`cd apps/api && npm run dev`); mock auth from 002 (no accounts needed).
3. Gates (zero errors before any scenario passes): `npx tsc --noEmit && npx expo lint`.

## Scenario 1 — Hotspot regression fix (US1 / SC-001)

1. Camera flow: complete a single-person scan. **Expect**: every detected garment shows its hotspot — visible above photo and neon trace, pulsing, tappable → detail modal opens.
2. Repeat with a garment near the photo edge. **Expect**: hotspot + sonar ring render whole (no clipping), on iOS and (if available) Android.
3. Multi-person flow: select a person, wait for trace → settled. **Expect**: hotspots appear in both trace modes.
4. Record the confirmed root cause in `/lessons` (FR-003) — note which hypothesis from research §1 reproduced.

## Scenario 2 — Persistence engine (US2 / SC-002)

1. Complete a camera scan; open a garment's matches. Force-quit the app; relaunch; pull down the Vault. **Expect**: the entry is there — image renders, date + match count correct.
2. Enable Airplane Mode; tap that entry. **Expect**: full matches render from local data; store links present (tapping may fail offline — that's the browser, not the vault).
3. Inspect the storage directory (via a dev log of `Paths.document`): image lives under `vault/images/`, **not** in any cache path; `index.json` parses with `v: 1`.
4. Re-open matches for the same scan (fetch another garment's matches). **Expect**: same entry updated (merge) — no duplicate entry, no duplicate matches.
5. Kill the app mid-scan (before results) and relaunch. **Expect**: no half-entry in the vault; no error.

## Scenario 3 — Reveal gesture physics (US3 / SC-003)

1. On the scan capture screen, drag the pull handle down slowly. **Expect**: viewport follows the finger 1:1; scan content recedes (scale/dim) as the vault surfaces.
2. Release at ~25% → springs closed; release at ~50% → springs open; short fast flick → springs open on velocity alone.
3. Mid-transition, catch the surface and reverse. **Expect**: it follows from the current position — no jump, no restart.
4. Take a photo (review phase): try the pull gesture. **Expect**: not armed — review gestures and camera controls unaffected.
5. From the open vault: swipe up and tap the close affordance. **Expect**: both return to the exact scan state with the same physics; 60fps in the perf monitor throughout.

## Scenario 4 — Vault grid & reopen (US4 / SC-004/SC-005)

1. With several entries: pull down. **Expect**: image-dominant two-column grid, newest first, date + match count per card, staggered spring entrance, pressed-state feedback.
2. Tap a card. **Expect**: the existing garment detail experience opens with that entry's stored matches — instantly, zero network (verify in airplane mode).
3. Fresh install (or cleared storage): open the vault. **Expect**: designed empty state inviting a scan — never a blank grid.
4. Corrupt `index.json` via a dev hook (or delete an entry's image file manually). **Expect**: per-entry placeholder / designed retry state; the grid never crashes.
5. Load ~50 entries (loop scans or a dev seeding hook) and scroll hard. **Expect**: no dropped-frame stutter.
6. Delete an entry (its delete affordance). **Expect**: card leaves with a spring; the image file is gone from `vault/images/` (verify via dev log) — zero orphans.

## Scenario 5 — Regression sweep (SC-006)

1. Full 001 pass: capture, import, multi-person select, hotspot tap → matches, failure overlays.
2. Full 003 Scenario 2: demo scan end-to-end; **Expect**: a `demo` vault entry appears (hosted image URL — renders when online; camera entries are the offline-guaranteed ones).
3. Home rail still renders (thumbnails now durable — permanent URIs); sign-out/in (002) unaffected.
4. `grep -rn "Easing.linear" src/` → zero matches.

## Pass criteria

Every numbered expectation holds, plus zero TypeScript/lint errors. Failures map to FR/SC in [spec.md](./spec.md); details in [data-model.md](./data-model.md) and [contracts/vault-storage-gesture.md](./contracts/vault-storage-gesture.md).
