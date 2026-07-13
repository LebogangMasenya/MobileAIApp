# Data Model: Vault Sharing Groundwork

**Date**: 2026-07-13 · **Feature**: 006-vault-sharing

## Entities

### VaultEntry v2 *(extends 005's record — `src/types/vault.ts`)*

| Field | Type | Change | Rule |
|-------|------|--------|------|
| id, scanId, imageUri, capturedAt, source | *(as v1)* | unchanged | — |
| matches | ProductMatch[] | unchanged | the AGGREGATE view — grid count + detail modal keep reading this |
| **imageSize** | {width, height} \| null | NEW | photo pixel dimensions, known at capture; null on migrated/demo entries (blocks cropping only) |
| **garments** | VaultGarment[] | NEW | empty on migrated v1 and demo entries — such entries share as whole looks |

### VaultGarment *(the shareable unit)*

| Field | Type | Rule |
|-------|------|------|
| id | string | 001's garment id — the merge key (re-segmentation never duplicates) |
| category | string | picker label + share header |
| boundingRegion | BoundingRegion (normalized 0–1) | crop source; facts, not cache — crop files are derived |
| matches | ProductMatch[] | THAT garment's matches, deduped by source_url; grows as fetched |

### VaultIndex v2 + migration

`{ v: 2, entries: VaultEntry[] }`. Read accepts v1 **and** v2: v1 entries map to `{ ...entry, imageSize: null, garments: [] }` (lossless — FR-007); the next write persists v2. Per-entry runtime validation as before (one bad record never poisons the rest).

### VaultVisibilityPreference *(device-store key `satori.vault.visibility.v1`)*

`{ v: 1, isPublic: boolean, explainerShown: boolean }` — absent/corrupt ⇒ `{ isPublic: false, explainerShown: false }` (private is the safe default, FR-002). `explainerShown` drives the once-only FR-004 explanation.

### VaultSharePayload *(pure derivation — never stored)*

```text
composeSharePayload(entry, garment?) →
  imageUri: garment crop file (generated on demand) | entry.imageUri (whole look / fallback)
  message:  "My {category|look} — spotted {date} with Satori"
            "• {title(≤60)} — {price? price ·} {store}"
            "  {source_url}"            × min(matches, 6)
            "+{n} more finds"           (when matches > 6)
```

Null price ⇒ the price segment is omitted entirely (SC-003: no "null" ever). Zero matches ⇒ header + short caption only.

## State & flow

```text
Toggle: private ⇄ public (spring-animated, interruptible)
  └─ persisted via useVaultVisibility; affordances mount/unmount with springs (FR-003)

Share tap (public only):
  garments.length ≥ 2 ──▶ GarmentSharePicker (crop thumbs lazy) ──▶ choice
  garments.length ≤ 1 or whole-look choice ──▶ compose ──▶ Share.share
      crop fails / imageSize null ──▶ fall back to look photo (FR-010)
      result dismissedAction ──▶ silent return (FR-014)
      throw ──▶ inline gentle notice; vault untouched
```

## Validation & error surfaces

| Boundary | Failure | Surface |
|----------|---------|---------|
| Preference read | corrupt | private + explainer unseen (safe defaults) |
| Index read (v1 file) | — | transparent migration; entries intact (US3) |
| Crop generation | missing region/imageSize, manipulator error | whole-look photo fallback — sharing never dead-ends |
| Share invocation | user cancel | silent (deliberate act, not an error) |
| Share invocation | OS error | inline notice, vault unchanged (Constitution VII) |
