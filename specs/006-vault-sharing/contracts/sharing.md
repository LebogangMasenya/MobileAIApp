# Contract: Vault Sharing — Store v2, Crop, Payload, Toggle

**Feature**: 006-vault-sharing · **Date**: 2026-07-13

## 1. Store surface changes (`src/services/vault-store.ts` — still the only FS consumer)

```ts
/** v1 index read → transparently migrated (garments: [], imageSize: null); next write persists v2. */
loadEntries(): Promise<{ entries: VaultEntry[]; failed: boolean }>;

/** Merge a person's garments into the entry by garment id — never duplicates (FR-008). */
addGarments(scanId: string, garments: VaultGarment[]): Promise<void>;

/** Now garment-aware: appends to the garment's list AND the look aggregate, each deduped by source_url. */
mergeMatches(scanId: string, matches: ProductMatch[], garmentId?: string): Promise<void>;
```

Invariants V1–V4 from feature 005 carry over unchanged; **V5 (new)**: a v1 index is never lost or partially upgraded — migration maps in memory and only a successful full write persists v2.

## 2. Crop utility (`features/vault/utils/garment-crop.ts` — the ONLY image-manipulator consumer)

```ts
/** Region×imageSize → padded (~12%/side), clamped, aspect-true crop of the look photo.
 *  Returns a shareable file URI, or null on ANY failure (caller falls back to the look photo). */
cropGarment(entry: VaultEntry, garment: VaultGarment): Promise<string | null>;
```

Requires `entry.imageSize` and a local `file://` image — demo/migrated entries short-circuit to null. Installed-API verification (context API signatures) happens before this file is written (AGENTS.md rule).

## 3. Payload composer (`features/vault/utils/share-payload.ts` — pure, FR-015)

```ts
composeSharePayload(entry: VaultEntry, garment?: VaultGarment, imageUri?: string):
  { message: string; imageUri: string };
```

Format per data-model.md: date header, ≤6 match lines ("• title — [price ·] store" + link), overflow note, caption-only when zero matches. Total function — never throws, no raw fields (FR-013).

## 4. Share orchestration (`features/vault/hooks/useShareLook.ts`)

`{ share(entry), pickerFor: VaultEntry | null, shareGarment(entry, garment | 'look'), dismissPicker, error, clearError }` — routes single/no-garment entries straight to the sheet, multi-garment to the picker; runs crop → compose → `Share.share({ message, url })`; `dismissedAction` silent; throw → `error` for the inline notice. One share in flight at a time.

## 5. Visibility (`features/vault/hooks/useVaultVisibility.ts` + `VaultVisibilityToggle.tsx`)

- Hook: `{ isPublic, isLoaded, toggle(), explainerVisible, dismissExplainer }` over the `satori.vault.visibility.v1` preference; toggle persists then flips state (persisted value and visuals can never disagree — spec edge case).
- Toggle component: spring-translated knob + crossfaded "Public"/"Private" label; re-flip mid-travel retargets (SC-001); ≥44pt target.
- Gating: `VaultSheet` header hosts the toggle; share affordances in header/cards render only when `isPublic`, entering/exiting springified (FR-003).

## 6. Picker (`features/vault/components/GarmentSharePicker.tsx`)

Modal card (001 sheet idiom): one row per garment — lazy crop thumbnail (spinner until generated), category, match count or "no links yet" — plus "Whole look"; rows ≥56pt; cancel = tap scrim (silent). Presented only for entries with ≥2 garments.

## 7. Dependency contract

| Item | Requirement |
|------|-------------|
| `expo-image-manipulator` | `npx expo install expo-image-manipulator`; **dev-client rebuild required** (second of the workstream) |
| Sharing | React Native built-in `Share` — no new dependency; iOS image+text, Android text-only (documented) |
