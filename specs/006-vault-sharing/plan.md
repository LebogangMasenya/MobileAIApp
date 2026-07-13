# Implementation Plan: Vault Sharing Groundwork (Public Toggle + Share a Garment)

**Branch**: `main` (no feature branch in use) | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-vault-sharing/spec.md` (respecced 2026-07-13: true per-garment crops, schema extended per user approval)

## Summary

Two pieces of sharing groundwork on top of feature 005. **The toggle**: a spring-animated, persisted "Make Vault Public" preference (default private, corrupt-safe) that arms the sharing surface — share affordances spring in/out of the vault header and cards, with a once-only honest explainer. **The share**: the vault schema extends to v2 (per-garment records: category, region, *that garment's own matches*; photo pixel size; lossless migrate-on-read from v1), a confined expo-image-manipulator utility crops garments on demand (padded, clamped, aspect-true; any failure falls back to the look photo), a pure composer builds the payload (date header + ≤6 titled purchase-link lines, null prices cleanly omitted), and RN's built-in `Share` presents it — garment picker when a look has several, straight to the sheet otherwise. **One new dependency** (`expo-image-manipulator` — second dev-client rebuild); sharing itself adds none.

## Technical Context

**Language/Version**: TypeScript strict on RN 0.81 / Expo SDK 54 — `apps/mobile` only; no API changes

**Primary Dependencies**: expo-image-manipulator (NEW — the only install; context-API signatures verified against installed `.d.ts` before coding per AGENTS.md), RN built-in `Share`, Reanimated 4 (toggle + affordance motion), expo-file-system via the existing `vault-store.ts` seam

**Storage**: vault index bumps to v2 (migrate-on-first-read, write-back; invariant V5: never partially upgraded); visibility preference as one JSON value in the existing device-store (`satori.vault.visibility.v1`), default private

**Testing**: manual via `quickstart.md` (4 scenarios incl. migration + 005 regression sweep) + `tsc`/lint zero-error gates

**Performance Goals**: toggle settle <500ms interruptible; crops generated per share (no persistent cache — derived data, zero invalidation logic); picker thumbnails lazy with spinners

**Constraints**: no `Easing.linear`; one image per share (platform sheets) — hence the garment-as-share-unit UX; Android built-in share is text-only (text block stands alone by design); private is the failure-safe default everywhere

**Scale/Scope**: schema v2 + migration in the store; 2 new hooks, 2 new components, 2 new pure/confined utils; 3 write-path touches (scan hooks); toggle + affordance gating in 2 existing vault components

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-checked post-Phase-1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Clarity Over Assumption | ✅ PASS | The crop question was halted on at spec time and answered by the user (true crops, schema extension approved); the one-image platform constraint and Android text-only reality are stated up front, driving the picker UX instead of surfacing as surprises; manipulator API to be verified against installed types (the expo-file-system precedent made this a hard rule). |
| II | Design-First Implementation | ✅ PASS | Toggle/picker/affordances follow the established token + card + spring idiom; the payload format is specified field-by-field in data-model.md; "public" copy is honesty-first (FR-004). |
| III | Performance First | ✅ PASS | Crops on demand off the interaction's critical path (spinner in picker); no persistent cache to invalidate; toggle/affordances are UI-thread springs. |
| IV | Anti-Abstraction Mandate | ✅ PASS | Manipulator confined to one util; composer is one pure function; no share-service layer — the hook calls RN `Share` directly; schema extension is additive (aggregate `matches` untouched, so 005's grid/modal read paths don't change). |
| V | Native-Grade Fluid Motion | ✅ PASS | Custom spring toggle (RN `Switch` rejected — not interruptible); affordances enter/exit springified; picker uses the 001 sheet idiom; re-flip retargets mid-travel. |
| VI | Educational Code Architecture | ✅ PASS | Why-comments mandated at: migrate-on-read/write-back (V5), the region-not-cropURI schema choice (facts vs. cache), the one-image-per-share constraint, private-as-safe-default. |
| VII | Defensive Error Scaffolding | ✅ PASS | Crop failure → whole-look fallback (sharing never dead-ends); cancel silent vs. error notice distinguished; corrupt preference → private; v1 index never partially upgraded. |
| VIII | State Isolation | ✅ PASS | `useVaultVisibility` (settings seam), `useShareLook` (orchestration), pure composer, confined crop util — components stay presentational. |

**Post-Phase-1 re-check (after data-model/contracts/quickstart)**: all gates still pass; no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/006-vault-sharing/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/sharing.md
└── tasks.md (/speckit-tasks — not created here)
```

### Source Code (apps/mobile)

```text
src/
├── types/
│   └── vault.ts                          # MODIFIED: v2 — VaultGarment, imageSize, VaultIndex v:2
├── services/
│   └── vault-store.ts                    # MODIFIED: v1→v2 migrate-on-read (V5), addGarments,
│                                         #   garment-aware mergeMatches (contract §1)
├── features/
│   ├── vault/
│   │   ├── components/
│   │   │   ├── VaultVisibilityToggle.tsx # NEW: spring knob + crossfade label (contract §5)
│   │   │   ├── GarmentSharePicker.tsx    # NEW: garment rows w/ lazy crop thumbs + "Whole look" (§6)
│   │   │   ├── VaultSheet.tsx            # MODIFIED: toggle in header; header share affordance gated
│   │   │   └── VaultEntryCard.tsx        # MODIFIED: per-card share affordance gated + springified
│   │   ├── hooks/
│   │   │   ├── useVaultVisibility.ts     # NEW: preference seam incl. once-only explainer state
│   │   │   └── useShareLook.ts           # NEW: route → crop → compose → Share.share; error state
│   │   └── utils/
│   │       ├── garment-crop.ts           # NEW: the ONLY expo-image-manipulator consumer (§2)
│   │       └── share-payload.ts          # NEW: pure composer (§3, FR-015)
│   └── scan/hooks/
│       ├── useCreateScan.ts              # MODIFIED: entry gains imageSize + session garments
│       ├── useSegmentPerson.ts           # MODIFIED: addGarments on segmented (multi-person)
│       └── useGarmentMatches.ts          # MODIFIED: mergeMatches now passes garmentId
└── package.json                          # MODIFIED: + expo-image-manipulator (the one install)
```

**Structure Decision**: everything lands in the existing `features/vault` module; storage changes stay behind the 005 seams (`vault-store.ts`, `useVaultEntries` untouched in shape); the two new impure edges (manipulator, share sheet) each get exactly one owner file.

## Key Design Decisions (details in research.md)

1. **Schema stores regions, not crop files** — facts over caches: regions are bytes, never stale; crops generate per share and fall back to the look photo on any failure (FR-010).
2. **Additive v2 with migrate-on-read** — the aggregate `matches` array survives untouched (005's grid/modal don't change); v1 entries gain empty garment lists losslessly and share as whole looks (US3).
3. **Garment as the share unit** — platform sheets carry one image, so the picker (multi-garment) / direct sheet (single) UX turns the constraint into the product's natural "share this piece" gesture.
4. **Built-in `Share`, custom toggle** — zero sharing dependencies (text stands alone on Android by design); RN's `Switch` rejected for a spring-driven custom toggle because interruptible retargeting is a constitutional requirement, not a nicety.
5. **Grouping is forward-only** — matches were never garment-tagged in storage before; new scans group naturally (the fetch already knows its garment), old entries honestly stay whole-look.

## Complexity Tracking

No constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
