# Implementation Plan: Wardrobe Vault (Scan History) + Hotspot Rendering Fix

**Branch**: `main` (no feature branch in use) | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-wardrobe-vault/spec.md`

## Summary

Fix the hotspot rendering regression (explicit z-band stacking + non-clipping ancestors, with the Fabric implicit-stacking hypothesis root-caused on device), then build the Shazam-style Wardrobe Vault: scan photos **move** from temp cache into permanent document storage at capture hand-off (also fixing the Home rail's latent dangling-thumbnail bug), every completed scan becomes a durable `VaultEntry` (id, permanent URI, timestamp, canonical `ProductMatch[]`, merged-not-duplicated as garment matches arrive), a finger-tracked pull-down on the scan capture screen reveals the vault with interruptible spring physics, and an image-dominant two-column grid reopens any look in the existing `GarmentDetailModal` from local data alone. **One new dependency** (`expo-file-system`, user-approved — dev-client rebuild required); everything else reuses installed machinery.

## Technical Context

**Language/Version**: TypeScript strict on RN 0.81 / Expo SDK 54 (New Architecture) — `apps/mobile` only; no API changes

**Primary Dependencies**: expo-file-system (NEW — the only install; new `File`/`Directory`/`Paths` API, verified against installed `.d.ts` before coding per AGENTS.md), react-native-gesture-handler + Reanimated 4 (installed) for the reveal, expo-image (installed) for grid cells, NativeWind 4

**Storage**: `Paths.document/vault/images/*.jpg` + versioned `vault/index.json` (whole-file read-modify-write, per-entry runtime validation); SecureStore stores from 002/003 unchanged

**Testing**: manual via `quickstart.md` (5 scenarios incl. regression sweep) + `tsc`/lint zero-error gates

**Performance Goals**: gesture 1:1 with finger at 60fps; spring settle <600ms; 50-entry grid scroll jank-free (FlatList + expo-image downsampling); vault writes never block the scan path

**Constraints**: no `Easing.linear`; hotspot stacking becomes an explicit invariant (z-10 trace / z-50 hotspots / non-clipping ancestors); vault gesture armed only in capture phase; no half-entries (image durably placed before record)

**Scale/Scope**: 1 fix across 2 overlay files + scan screen wrappers; 1 storage service + 1 hook + adapters; 1 reveal container + vault sheet + grid card + empty/error states; 2 write-path integrations (001 scan + matches, 003 demo)

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-checked post-Phase-1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Clarity Over Assumption | ✅ PASS | Regression grounded in code inspection with ranked root-cause hypotheses (Fabric implicit stacking primary) and a device-confirmation step — the directed fix ships, but not unexamined (FR-003). Scope calls (entry granularity, canonical match shape, demo-entry image caveat, rail non-migration) were surfaced in the spec's Assumptions and approved. expo-file-system's SDK-54 API re-verified against installed types before code. |
| II | Design-First Implementation | ✅ PASS | Vault UX transcribed from the named reference (Shazam's pull-down history) into concrete gesture/threshold/parallax contracts; grid/cards follow the established token + card idiom; no undesigned surfaces. |
| III | Performance First | ✅ PASS | Gesture and springs on the UI thread; FlatList virtualization + expo-image downsampling for the grid; file I/O fire-and-forget off the interaction path. |
| IV | Anti-Abstraction Mandate | ✅ PASS | One storage service module owning expo-file-system (the `device-store.ts` precedent), one read hook, two pure adapters at the type edges — no repository/ORM layers; JSON index over SQLite at this scale (research §3). |
| V | Native-Grade Fluid Motion | ✅ PASS | Finger-owned progress value, position+velocity spring attractors, re-catch resumes mid-flight; staggered grid entrances; `Easing.linear` banned and grepped. |
| VI | Educational Code Architecture | ✅ PASS | Why-comments mandated at: the z-band contract (each wrapper names the invariant), move-at-capture (why the URI must be permanent before anything consumes it), the no-half-entries write order, and the gesture's single-owner progress value. |
| VII | Defensive Error Scaffolding | ✅ PASS | Vault failures never disturb scanning (V4); corrupt index → salvage + designed retry; missing images → per-card placeholder; deletes never leave dangling records. |
| VIII | State Isolation | ✅ PASS | `useVaultEntries` is the read seam; `vault-store.ts` the write seam; screens stay orchestrators; the reveal state is one shared value owned by the gesture. |

**Post-Phase-1 re-check (after data-model/contracts/quickstart)**: all gates still pass; no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/005-wardrobe-vault/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/vault-storage-gesture.md
└── tasks.md (/speckit-tasks — not created here)
```

### Source Code (apps/mobile)

```text
src/
├── types/
│   └── vault.ts                          # NEW: VaultEntry, VaultIndex envelope
├── services/
│   └── vault-store.ts                    # NEW: the ONLY expo-file-system consumer —
│                                         #   persistImage/discardImage/upsertEntry/
│                                         #   mergeMatches/loadEntries/deleteEntry (contract §1)
├── features/
│   ├── scan-overlay/components/
│   │   ├── InteractionHotspot.tsx        # MODIFIED: explicit z-50 stacking (US1)
│   │   └── NeonTracingOverlay.tsx        # MODIFIED: explicit z-10 band
│   └── vault/
│       ├── components/
│       │   ├── VaultRevealContainer.tsx  # NEW: pan-driven progress, spring attractors,
│       │   │                             #   arming rules, scan-content parallax (contract §3)
│       │   ├── VaultSheet.tsx            # NEW: the vault surface — header, close affordance, grid
│       │   ├── VaultEntryCard.tsx        # NEW: image-dominant cell, date + match count,
│       │   │                             #   press feedback, delete affordance
│       │   └── VaultEmptyState.tsx       # NEW: first-run invitation + error/retry variant
│       ├── hooks/
│       │   └── useVaultEntries.ts        # NEW: read seam (contract §2)
│       └── utils/
│           └── matches-adapter.ts        # NEW: 001→canonical + canonical→modal-state (contract §5)
├── app/(app)/(tabs)/
│   └── scan.tsx                          # MODIFIED: capture state wrapped in VaultRevealContainer;
│                                         #   submitPhoto moves photo via persistImage first;
│                                         #   non-clipping wrappers verified (US1)
├── features/scan/hooks/
│   ├── useCreateScan.ts                  # MODIFIED: vault upsertEntry at ready (alongside rail write)
│   └── useGarmentMatches.ts              # MODIFIED: mergeMatches on success (normalized)
├── features/visual-search/hooks/
│   └── useVisualSearch.ts                # MODIFIED: demo entry upsert on done (source: 'demo')
└── app/(app)/demo-scan.tsx               # (unchanged unless the z-band sweep requires the wrapper comment)
package.json                              # MODIFIED: + expo-file-system (the one install)
```

**Structure Decision**: vault is a `features/vault` module living inside the scan tab (no new route, no new tab — spec assumption); storage I/O centralized in `services/` beside `device-store.ts`/`recent-scans-store.ts`; the hotspot fix lands in the 004 shared module where the regression lives.

## Key Design Decisions (details in research.md)

1. **Root-cause + harden, not just harden** — Fabric implicit-stacking is the primary hypothesis; explicit z-bands (trace z-10, hotspots z-50) and verified non-clipping ancestors make stacking a stated invariant either way; device confirmation recorded in /lessons (FR-003).
2. **Move at capture hand-off** — the photo becomes permanent before anything consumes its URI (display, upload, rail, vault), making FR-004 structural and fixing the rail's dead-thumbnail latent bug; failed/abandoned scans discard the moved file.
3. **Whole-file versioned JSON index** with image-before-record write order — honest machinery for a personal history's scale; `useVaultEntries` is the SQLite/server swap point if that ever changes.
4. **In-tab overlay gesture, not a route** — a route transition can't hand mid-flight control back to the finger; a pan-owned progress shared value is the Shazam feel, and arming rules keep it out of the camera's way.
5. **Adapters at the type edges** — 001's rich matches normalize to canonical ProductMatch at write (approved lossiness); a second pure adapter feeds `GarmentDetailModal` unchanged, with no refetch path for local data.

## Complexity Tracking

No constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
