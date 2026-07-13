# Quickstart Validation: Vault Sharing Groundwork

**Feature**: 006-vault-sharing · **Date**: 2026-07-13

## Prerequisites

1. Install the crop dependency and **rebuild the dev client** (second rebuild of this workstream):
   ```bash
   cd apps/mobile && npx expo install expo-image-manipulator && npx expo run:ios
   ```
2. API running (`cd apps/api && npm run dev`); at least one pre-006 vault entry saved (for the migration scenario, keep an install that scanned under feature 005 — or seed one before updating).
3. Gates: `npx tsc --noEmit && npx expo lint` — zero errors.

## Scenario 1 — Toggle & gating (US1 / SC-001, SC-004)

1. Open the vault (pull down). **Expect**: header shows the "Make Vault Public" toggle, initially **Private** on a fresh preference.
2. Flip it. **Expect**: knob springs across with the label crossfading; the first flip to Public shows the once-only explainer; share affordances spring into the header and onto every card.
3. Flip rapidly back and forth mid-animation. **Expect**: the knob retargets from wherever it is — no snap; final visual state matches the label.
4. Force-quit, relaunch, open the vault. **Expect**: the chosen state restored; the explainer does NOT reappear.
5. Flip to Private. **Expect**: share affordances animate out and are absent (not disabled).

## Scenario 2 — Share a garment (US2 / SC-002, SC-003)

1. Complete a fresh camera scan (post-006) with 2+ garments; open its matches for at least one garment. Pull down to the vault, ensure Public.
2. Tap the look's share affordance. **Expect**: the garment picker — one row per garment with a cropped thumbnail (spinner then crop), category, match count (or "no links yet"), plus "Whole look".
3. Choose a garment with matches. **Expect**: native share sheet with the garment's **crop** attached and only that garment's lines. Share to Notes: verify header, "• title — price · store" lines with working links, no "null", no debug fields, ≤6 lines + overflow note when applicable.
4. Choose "Whole look". **Expect**: full photo + the look's aggregate lines.
5. Single-garment look: tap share. **Expect**: sheet directly, no picker (≤2 taps).
6. Inspect a crop (from Notes): garment recognizable, padded, undistorted — try one whose region touches the photo edge (clamped, not skewed).
7. Cancel a share sheet. **Expect**: silent return, vault unchanged.

## Scenario 3 — Migration & fallbacks (US3 / SC-004)

1. With a pre-006 vault: update the build, open the vault. **Expect**: every old entry intact (image, date, count) and opening normally.
2. Share an old entry (Public on). **Expect**: no picker — whole-look photo + aggregate lines (no fabricated garment breakdown).
3. Share the demo entry. **Expect**: whole-look path; on iOS the remote image may or may not attach — the text block stands alone either way; never an error about crops.
4. Dev-corrupt the visibility preference value. **Expect**: vault reopens **Private** (safe default), no crash.

## Scenario 4 — Failure modes & regression sweep (SC-005, SC-006)

1. Force a crop failure (dev: point a garment's region at an entry with `imageSize: null`). **Expect**: share proceeds with the full look photo — never dead-ends.
2. Force an OS share failure if reproducible (or code-inspect the throw path). **Expect**: gentle inline notice, vault stable.
3. Feature-005 regression pass: pull-down physics, grid scroll, entry open (detail modal), delete-with-no-orphans, relaunch persistence — all unchanged.
4. `grep -rn "Easing.linear" src/` → zero matches; both gates zero-error.

## Pass criteria

Every numbered expectation holds. Failures map to FR/SC in [spec.md](./spec.md); details in [data-model.md](./data-model.md) and [contracts/sharing.md](./contracts/sharing.md).
