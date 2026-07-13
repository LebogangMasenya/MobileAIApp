# Data Model: Wardrobe Vault + Hotspot Rendering Fix

**Date**: 2026-07-12 · **Feature**: 005-wardrobe-vault

All data is device-local; nothing leaves the phone. Files live under the app's document storage (OS-purge-safe), metadata in one versioned JSON index.

## Entities

### VaultEntry *(`src/types/vault.ts`)*

| Field | Type | Rule |
|-------|------|------|
| id | string | collision-safe random id (`vlt_` + timestamp/random base36); the merge key |
| scanId | string \| null | links camera-flow entries to their 001 scan session; null for demo entries |
| imageUri | string | permanent `file://` URI under `vault/images/` (camera entries) or the hosted demo-image https URL (demo entries — research §4 caveat) |
| capturedAt | string (ISO) | grid sorts newest-first |
| matches | ProductMatch[] | canonical six-field shape (feature 003); deduped by `source_url` on merge |
| source | 'camera' \| 'demo' | provenance; not surfaced in UI this feature |

Rules:
- Created on scan completion (camera) or search `done` (demo); **image durably placed before the record is written** (FR-007 — no half-entries).
- Later per-garment match fetches **merge** into the entry via `scanId` (FR-005) — never duplicate entries, never duplicate matches.
- Deleting an entry removes record **and** image file; a record whose file delete fails is still removed, and the orphaned file is swept on next index write (FR-008's no-orphans guarantee, eventually consistent).

### VaultIndex *(document storage: `vault/index.json`)*

`{ v: 1, entries: VaultEntry[] }` — read whole, validated per-entry from `unknown` (invalid records dropped, not fatal); written whole after every mutation. Corrupt/unreadable file ⇒ `error` state in the hook, designed retry UI, never a crash (FR-006, Constitution VII).

### ProductMatch *(existing, feature 003 — unchanged)*

The canonical stored match shape. Adapters at the edges (research §5):

```text
MatchedProduct/SimilarItem (001, in-session) ──matchedProductToProductMatch──▶ ProductMatch (stored)
ProductMatch[] (stored) ──productMatchesToModalState──▶ GarmentDetailModal props (display)
```

Accepted lossiness (spec-approved): 001's rich fields (similarityScore, isExactMatch, store regions/logo, numeric price) are flattened at write; the modal renders vault matches as uniform match cards with display-string prices.

### VaultRevealState *(gesture-owned, never persisted)*

```text
        drag (1:1 with finger)
closed ◀──────────────────────▶ open
  0 ◀── progress (shared value) ──▶ 1

release: spring to nearest attractor judged by position + velocity
re-catch mid-flight: gesture resumes from current progress — no jumps
```

- Armed **only** in the scan capture phase (`photo == null`, no modal/overlay presented) — FR-011.
- `progress` is the single owner of the transition; there is no separate boolean that could disagree with it mid-flight (Constitution VIII; same principle as the 002 gate).

## Hotspot stacking contract (US1)

Explicit z-bands replace implicit sibling order on both scanning surfaces:

| Layer | z (NativeWind) | Notes |
|-------|----------------|-------|
| Photo | base | — |
| NeonTracingOverlay | z-10 | `pointerEvents="none"`, animates transform/opacity |
| InteractionHotspot layer | **z-50** | user directive; every ancestor to the screen root explicitly non-clipping (`overflow: visible`) |
| Busy pills / selectors | z-20..30 | must never cover hotspots |
| Failure overlays / modals | above all | unchanged — failures still own the screen |

## Relationships

```text
Scan capture (001) ──persistImage (move temp→vault/images)──▶ permanent URI
   ├──▶ scan submit / display / retry (all use permanent URI)
   ├──▶ RecentScanSummary (Home rail — now durable thumbnails, latent bug fixed)
   └──▶ VaultEntry (created at scan ready)
useGarmentMatches success ──normalize──▶ mergeMatches(scanId) ──▶ VaultEntry.matches
Demo scan done (003) ──▶ VaultEntry (source: 'demo', hosted image URL)
VaultGrid ──tap──▶ productMatchesToModalState ──▶ GarmentDetailModal (no refetch)
```

## Validation & error surfaces

| Boundary | Failure | Surface |
|----------|---------|---------|
| Image move at capture | FS error | scan proceeds with the temp URI (vault save skipped, logged) — scanning is never blocked (FR-007) |
| Index read | corrupt / unreadable | `useVaultEntries` → `error` + retry state; valid entries salvaged where possible |
| Entry render | missing image file | per-card placeholder; grid intact (FR-015) |
| Entry delete | file delete fails | record removed; file swept later (no dangling records ever) |
| Gesture | mid-flight interruption | spring retargets from current progress (Constitution V) |
