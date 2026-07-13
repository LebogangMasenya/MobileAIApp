# Research: Vault Sharing Groundwork

**Date**: 2026-07-13 · **Feature**: 006-vault-sharing

## 1. Crop dependency — expo-image-manipulator

- **Decision**: `npx expo install expo-image-manipulator` (SDK-54-matched). Native module → **the second dev-client rebuild** of this workstream (user accepted with the true-crops decision). Recent SDKs use the context API (`ImageManipulator.manipulate(uri).crop(...).renderAsync()` → `saveAsync()`); exact signatures are **verified against the installed package's `.d.ts` before any code** (AGENTS.md rule — same discipline as expo-file-system, whose API had shifted exactly this way).
- **Confinement**: one module — `features/vault/utils/garment-crop.ts` — owns the manipulator (the one-seam-per-backend house pattern). It exposes `cropGarment(entry, garment): Promise<string | null>`; null on any failure → callers fall back to the look photo (FR-010).
- **Crop math**: stored normalized region × stored `imageSize` → pixel rect, padded ~12% per side, clamped to image bounds, aspect preserved (crop only — no resize/distortion; FR-009, SC-003).
- **No persistent crop cache**: crops are generated per share into the manipulator's cache output and handed straight to the share sheet. Rationale: crops are cheap (small source images), derived data with zero invalidation logic this way, and the delete-sweep story stays trivial. Spec's "MAY cache" deliberately not exercised; revisit only if picker thumbnails feel slow on device.
- **Alternatives considered**: react-native-view-shot collage compositing — rejected (multi-image sharing is out of scope, and view-capture for data work is a hack); storing crop files at scan time — rejected (storage grows for shares that may never happen; regions are tiny, files aren't).

## 2. Schema v2 + migration (FR-005..FR-008)

- **Decision**: `VaultIndex` bumps to `v: 2`. `VaultEntry` gains `imageSize: {width, height} | null` and `garments: VaultGarment[]` (`{ id, category, boundingRegion, matches: ProductMatch[] }`). The look-level `matches` array **stays** as the aggregate the grid/modal already consume — per-garment lists are additive, not a restructure of what 005 shipped.
- **Migration = on first read, write back**: `readEntries` accepts v1 (entries mapped with `garments: []`, `imageSize: null`) and v2; the next write persists v2. Lossless by construction — v1 fields are untouched; old entries share as whole looks (US3).
- **Why regions, not crop URIs, in the schema**: regions are a dozen bytes and never stale; crop files are derivable. The schema stores facts, not caches.

## 3. Write-path wiring (where garments and their matches come from)

- `useCreateScan` ready → entry now includes `imageSize` (the captured photo's known dimensions) and `garments` from `session.garments` (single-person scans auto-populate; multi-person start empty).
- `useSegmentPerson` segmented → `addGarments(scanId, garments)` merges that person's garments into the entry (by garment id — re-segmentation never duplicates).
- `useGarmentMatches` success → `mergeMatches(scanId, normalized, garmentId)` — the store appends to **both** the garment's own list and the look aggregate, deduped by `source_url` in each. The hook already has both ids in hand; the grouping is free going forward, impossible retroactively (spec assumption).

## 4. Native share mechanics

- **Decision**: React Native's built-in `Share.share({ message, url })` — zero additional dependency. iOS: `url` (a `file://` crop or photo) rides alongside `message`; Android: `message` only (text designed to stand alone, spec edge case). The result's `dismissedAction` is the silent-cancel path (FR-014); a thrown error is the gentle-notice path.
- **Composition is pure** (FR-015): `composeSharePayload(entry, garment?) → { message, imageUri }` in `share-payload.ts` — header line (date-based), match lines "• title — price · store\nlink" capped at 6 with "+N more finds" overflow, price omitted cleanly when null. The impure orchestration (crop generation, sheet invocation, error state) lives in a `useShareLook` hook.
- **Alternatives considered**: expo-sharing — single-file sharing without a message on iOS (worse fit); react-native-share (3rd-party) — multi-image support we explicitly don't need; both rejected to stay at zero *sharing* dependencies.

## 5. Visibility preference + toggle motion

- **Decision**: one JSON value under the existing SecureStore adapter (`device-store.ts`), key `satori.vault.visibility.v1`: `{ v: 1, isPublic: boolean, explainerShown: boolean }`. Corrupt/absent → private with explainer unseen (FR-002's safe default). Read/write behind `useVaultVisibility` (the settings seam).
- **Toggle motion**: a custom `VaultVisibilityToggle` (Pressable track + spring-translated knob + crossfading state label) — spring-driven so a rapid re-flip retargets mid-travel (SC-001); RN's built-in `Switch` is not interruptible-spring animatable and is rejected for the same reason the constitution bans snap transitions.
- **Share affordances gating** (FR-003): affordances mount/unmount with springified entering/exiting inside the existing `VaultEntryCard`/`VaultSheet`; the boolean comes from the hook, the motion from Reanimated — absent, not disabled, when private.

## 6. Picker UX (the one-image constraint made friendly)

- **Decision**: `GarmentSharePicker` as a lightweight in-vault modal (RN Modal, spring-in card — the 001 sheet idiom): one row per garment (lazy crop thumbnail — generated on picker open, ActivityIndicator until ready — category, match count, "no links yet" hint when zero) plus a "Whole look" row. Single/no-garment entries skip the picker entirely (SC-002's ≤2-tap path).
- **Alternatives considered**: sharing all garments as sequential sheets — rejected (hostile); collage — out of scope by spec.

## Sources

- Code inspection 2026-07-13: `vault-store.ts` v1 shapes, `useGarmentMatches` (has scanId+garmentId at merge time — the grouping seam), `VaultSheet`/`VaultEntryCard` (affordance mount points)
- expo-image-manipulator SDK-54 context API — to be re-verified against installed `.d.ts` at implement time (AGENTS.md rule; precedent: expo-file-system's API had moved)
- React Native `Share` API — `share({ message, url })`, `sharedAction`/`dismissedAction` result contract
