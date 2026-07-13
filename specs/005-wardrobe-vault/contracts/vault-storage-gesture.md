# Contract: Vault Storage Service, Reveal Gesture & Hotspot Stacking

**Feature**: 005-wardrobe-vault · **Date**: 2026-07-12

No HTTP surface — the contracts are (1) the storage service every flow writes through, (2) the read hook the grid consumes, (3) the reveal-gesture behavior, (4) the hotspot stacking invariant, (5) the modal-reuse adapter.

## 1. Vault storage service (`src/services/vault-store.ts`)

The ONLY module that touches `expo-file-system` for vault purposes (mirrors `device-store.ts`'s role for SecureStore). All operations best-effort and non-throwing toward callers in the scan path (FR-007):

```ts
/** Move a temp capture/import file into vault/images/. Returns the permanent
 *  file:// URI, or null on failure (caller proceeds with the temp URI). */
persistImage(sourceUri: string): Promise<string | null>;

/** Delete a persisted image that never got an entry (failed/abandoned scan). */
discardImage(permanentUri: string): Promise<void>;

/** Create or replace an entry (image must already be durably placed). */
upsertEntry(entry: VaultEntry): Promise<void>;

/** Merge matches into the entry linked to scanId (dedupe by source_url). No-op if absent. */
mergeMatches(scanId: string, matches: ProductMatch[]): Promise<void>;

/** Read the index — never throws. */
loadEntries(): Promise<{ entries: VaultEntry[]; failed: boolean }>;

/** Remove record + image file (record removal never blocked by file failure). */
deleteEntry(id: string): Promise<void>;
```

Invariants: **V1** image placed before record written (no half-entries) · **V2** merge never duplicates entries or matches · **V3** reads salvage valid entries from a partially corrupt index · **V4** no vault failure ever surfaces as a scan-flow error.

## 2. Read hook (`features/vault/hooks/useVaultEntries.ts`)

`{ entries, isLoading, error, retry, remove(id) }` — newest-first; reload on vault reveal (not app-wide polling). The single swap point if the store ever graduates to SQLite/server (Constitution VIII).

## 3. Reveal gesture (`features/vault/components/VaultRevealContainer.tsx`)

| Aspect | Contract |
|--------|----------|
| Affordance | visible pull handle strip at the top of the scan capture state (≥44pt tall target) |
| Drive | `Gesture.Pan` → `progress` shared value 0→1, finger-tracked 1:1; vault sheet translates from −100% → 0; scan content scales ~0.94 + dims with progress |
| Release | spring (tuned mass/damping/stiffness) to open if `progress > 0.35 \|\| velocity > 500pt/s` downward, else closed; symmetric rules for closing |
| Interrupt | re-catch resumes from current progress; no boolean state may snap the surface (data-model VaultRevealState) |
| Arming | capture phase only: `photo == null` && no modal/failure overlay presented; review-phase gestures and camera controls untouched (FR-011) |
| Dismiss | upward pan anywhere on the open vault's handle + explicit close button; returns to the exact scan state left behind (FR-012) |
| Motion bans | `Easing.linear`, timing-only transitions, jump-cuts (Constitution V) |

## 4. Hotspot stacking invariant (US1 fix)

- `InteractionHotspot` root Pressable: explicit **z-50** (NativeWind `z-50`); `NeonTracingOverlay` root: **z-10**.
- Every ancestor between screen root and the hotspot layer declares non-clipping (`overflow-visible` / no `overflow-hidden` introduced later) — enforced by a why-comment at each wrapper naming this contract.
- Applies to both surfaces (`(tabs)/scan.tsx`, `demo-scan.tsx` if hotspots arrive there later); verified in quickstart with edge-clamped garments in both trace modes.
- Root cause confirmed on device and recorded in `/lessons` (FR-003).

## 5. Modal-reuse adapter (`features/vault/utils/matches-adapter.ts`)

```ts
matchedProductToProductMatch(product: MatchedProduct | SimilarItem): ProductMatch; // 001 → canonical, price → display string
productMatchesToModalState(matches: ProductMatch[]): GarmentMatchesState;          // canonical → GarmentDetailModal input
```

- Vault card tap → `GarmentDetailModal` with adapted state; **no refetch path** (retry affordance not wired for vault entries — the data is local and final).
- Adapters are pure and total: never throw on odd data; unmappable fields become nulls the modal already handles.

## 6. Configuration / dependency contract

| Item | Requirement |
|------|-------------|
| `expo-file-system` | `npx expo install expo-file-system` (SDK-54 version); **dev-client rebuild required** (`npx expo run:ios`) before any vault scenario runs |
| New-API check | verify `File`/`Directory`/`Paths` exports against the installed package's `.d.ts` before writing code (`apps/mobile/AGENTS.md` rule) |
| Storage layout | `Paths.document/vault/images/<id>.jpg` + `Paths.document/vault/index.json` |
