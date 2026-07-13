# Tasks: Wardrobe Vault (Scan History) + Hotspot Rendering Fix

**Input**: Design documents from `/specs/005-wardrobe-vault/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vault-storage-gesture.md, quickstart.md

**Tests**: Not requested — manual validation via `quickstart.md` (5 scenarios) plus zero-error `tsc`/lint gates (Constitution Verification Rule).

**Organization**: Grouped by user story (US1 hotspot fix, US2 persistence, US3 reveal gesture, US4 vault grid). All paths relative to `apps/mobile/`. **One new dependency** (`expo-file-system` — user-approved; dev-client rebuild required).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (hotspots), US2 (persistence), US3 (gesture), US4 (grid)

---

## Phase 1: Setup

**Purpose**: The one dependency and its API verification.

- [X] T001 Install the feature's single new dependency: `cd apps/mobile && npx expo install expo-file-system` (SDK-54-matched version lands in `package.json`), then rebuild the dev client (`npx expo run:ios`) — the module is native and nothing vault-related runs in the old client
- [X] T002 Verify the installed API surface against its own types (`apps/mobile/AGENTS.md` rule): confirm `File`, `Directory`, `Paths` exports and their move/create/read/write/delete method signatures in `node_modules/expo-file-system/build/*.d.ts` before writing any code; note the verified signatures in a comment block at the top of `vault-store.ts` when T004 creates it

---

## Phase 2: Foundational (Blocking Prerequisites for US2–US4)

**Purpose**: Types, the storage service, adapters, and the read hook — every vault story flows through these. (US1 does NOT depend on this phase — see Dependencies.)

- [X] T003 [P] Create `src/types/vault.ts`: `VaultEntry` (id, scanId: string | null, imageUri, capturedAt ISO, matches: ProductMatch[], source: 'camera' | 'demo') and the versioned `VaultIndex` envelope (`{ v: 1, entries: VaultEntry[] }`) per data-model.md — strict types, no `any`
- [X] T004 Create `src/services/vault-store.ts` — the ONLY expo-file-system consumer (contract §1): directories `Paths.document/vault/images/` + `vault/index.json` created on demand; `persistImage(sourceUri)` moves the file to `vault/images/<id>.jpg` returning the permanent `file://` URI or null on failure; `discardImage(uri)`; `upsertEntry(entry)` (image durably placed BEFORE the record — invariant V1, why-comment); `mergeMatches(scanId, matches)` deduping by `source_url` (V2); `loadEntries()` → `{ entries, failed }` never throwing, salvaging valid entries from partial corruption (V3); `deleteEntry(id)` removing record then best-effort image file (record removal never blocked — FR-008). Every scan-path-facing operation swallows its own errors (V4)
- [X] T005 [P] Create `src/features/vault/utils/matches-adapter.ts` (contract §5): `matchedProductToProductMatch` (001's `MatchedProduct`/`SimilarItem` → canonical six-field ProductMatch; `Price {amount,currency}` → display string, null-safe) and `productMatchesToModalState` (ProductMatch[] → the `GarmentDetailModal` matches-state shape, all entries as match cards, pure and total — unmappable fields become nulls the modal already handles)
- [X] T006 Create `src/features/vault/hooks/useVaultEntries.ts` (contract §2): `{ entries, isLoading, error, retry, remove(id) }` over `loadEntries`/`deleteEntry`, newest-first, reload-on-demand (called when the vault reveals) — the future SQLite/server swap point (Constitution VIII)
- [X] T007 Foundational gate: `cd apps/mobile && npx tsc --noEmit && npx expo lint` — zero errors

**Checkpoint**: Storage engine provable in isolation — vault stories can begin.

---

## Phase 3: User Story 1 - Garment Hotspots Visibly Anchor on Results (Priority: P1) 🔴 regression

**Goal**: Hotspots visible/tappable above photo and trace on both surfaces, stacking made an explicit invariant, root cause confirmed and recorded.

**Independent Test**: Complete scans (single + multi-person + edge-positioned garments); every hotspot visible in both trace modes, whole (unclipped), tappable → detail modal (quickstart Scenario 1). **No dependency on Phases 1–2** — can start immediately.

### Implementation for User Story 1

- [X] T008 [US1] Apply the z-band contract (data-model stacking table): explicit `z-50` on the `InteractionHotspot` root Pressable in `src/features/scan-overlay/components/InteractionHotspot.tsx` and `z-10` on the `NeonTracingOverlay` root in `src/features/scan-overlay/components/NeonTracingOverlay.tsx` — each with a why-comment naming the invariant (implicit sibling paint order is not a contract under Fabric; research §1)
- [X] T009 [US1] Non-clipping ancestor sweep: in `src/app/(app)/(tabs)/scan.tsx` (and `src/app/(app)/demo-scan.tsx` for consistency), verify/annotate every wrapper between screen root and the overlay layers as non-clipping for absolutely-positioned children (explicit `overflow-visible` where platform defaults differ — Android clips by default); bump sibling chrome (busy pill, selectors) into the z-20..30 band so nothing can cover hotspots
- [ ] T010 [US1] US1 verification: gates zero-error; quickstart Scenario 1 on device (single, multi-person, edge garments, both trace modes, both platforms if available); confirm WHICH research-§1 hypothesis reproduced and record the root cause in a `/lessons` entry (FR-003)

**Checkpoint**: The regression is dead and stacking is a stated invariant.

---

## Phase 4: User Story 2 - Every Scan Is Saved to the Vault, Permanently (Priority: P1)

**Goal**: Photos move to permanent storage at capture hand-off; every completed scan becomes a durable, mergeable VaultEntry; vault writes never disturb scanning.

**Independent Test**: Scan → force-quit → relaunch → entry intact; airplane-mode open renders stored matches; no half-entries after mid-scan kill (quickstart Scenario 2).

### Implementation for User Story 2

- [X] T011 [US2] Move-at-capture in `src/app/(app)/(tabs)/scan.tsx`: `submitPhoto` awaits `persistImage(captured.uri)` and proceeds with the permanent URI for display, upload, and everything downstream (null result → proceed with the temp URI, vault save skipped — scanning is never blocked, FR-007); `resetAll` and terminal scan-failure paths call `discardImage` when no entry was written (why-comment on the move-before-consume rule)
- [X] T012 [US2] Entry creation in `src/features/scan/hooks/useCreateScan.ts`: on `ready`, alongside the existing `appendRecentScan`, fire-and-forget `upsertEntry({ id, scanId: session.id, imageUri: photo.uri, capturedAt: session.createdAt, matches: [], source: 'camera' })` — note the rail summary now receives the permanent URI via T011 (latent dangling-thumbnail bug fixed for free)
- [X] T013 [US2] Match merging in `src/features/scan/hooks/useGarmentMatches.ts`: on successful fetch, normalize `exactMatch` + `similarItems` through `matchedProductToProductMatch` and fire-and-forget `mergeMatches(scanId, normalized)` — requires the hook to receive/know `scanId` (it does: `fetchMatches(scanId, garmentId)`)
- [X] T014 [US2] Demo entries in `src/features/visual-search/hooks/useVisualSearch.ts`: on `done` with matches, upsert `{ source: 'demo', scanId: null, imageUri: <hosted demo image URL> }` keyed to one stable demo id per run — hosted-URL caveat per research §4 (camera entries carry the hard offline guarantee)
- [ ] T015 [US2] US2 verification: gates zero-error; quickstart Scenario 2 (relaunch persistence, airplane-mode open, storage-path inspection, merge-not-duplicate, mid-scan kill leaves no half-entry)

**Checkpoint**: The vault has durable data — the door and the room can be built.

---

## Phase 5: User Story 3 - Swipe Down from Scan to Reveal the Vault (Priority: P2)

**Goal**: Finger-tracked pull-down from the capture state reveals the vault with interruptible spring physics; armed only when it can't fight the camera.

**Independent Test**: Drag/release at various positions and velocities; mid-flight re-catch; gesture inert during review phase (quickstart Scenario 3).

### Implementation for User Story 3

- [X] T016 [US3] Create `src/features/vault/components/VaultRevealContainer.tsx` (contract §3): `Gesture.Pan` on the pull-affordance strip (≥44pt) drives a `progress` shared value 0→1 tracking the finger 1:1; vault slot translates −100%→0 while scan content scales ~0.94 + dims with progress; release springs to open (`progress > 0.35 || velocity > 500`) or closed, symmetric on dismiss; re-catch resumes from current progress; `enabled` prop gates arming; children: `{ scanContent, vaultContent }` slots — why-comments on the single-owner progress value (Constitution V/VIII)
- [X] T017 [US3] Integrate in `src/app/(app)/(tabs)/scan.tsx`: wrap the CAPTURE-phase return in `VaultRevealContainer` with the visible pull handle above the camera controls' safe area; `enabled={photo === null && !settingsVisible && importError === null}` (FR-011 arming rule); review phase renders outside the container untouched; vault slot hosts `VaultSheet` (placeholder view until T021 if sequenced first)
- [ ] T018 [US3] US3 verification: gates zero-error; quickstart Scenario 3 (1:1 tracking, threshold/velocity settles, mid-flight reversal, review-phase inertness, both dismiss paths, 60fps perf-monitor pass)

**Checkpoint**: The Shazam pull works against a placeholder — the grid drops in next.

---

## Phase 6: User Story 4 - Browse the Vault, Reopen Any Look (Priority: P2)

**Goal**: Image-dominant two-column grid with micro-interactions; card tap reopens the existing detail experience from local data; designed empty/error states.

**Independent Test**: Grid renders entries newest-first with date + match count; tap → GarmentDetailModal offline; empty state on fresh install; corrupt entries degrade per-card (quickstart Scenario 4).

### Implementation for User Story 4

- [X] T019 [P] [US4] Create `src/features/vault/components/VaultEntryCard.tsx`: fixed-size image-dominant cell (expo-image sized to the cell so bitmaps downsample, `recyclingKey`), capture date + match count footer, spring press-down feedback, staggered `entering` (capped like the 003 card list), long-press or affordance → delete with confirmation
- [X] T020 [P] [US4] Create `src/features/vault/components/VaultEmptyState.tsx`: first-run invitation ("Your scans live here — pull down anytime") + `error` variant with retry (FR-015), NativeWind tokens, springified entrance
- [X] T021 [US4] Create `src/features/vault/components/VaultSheet.tsx`: vault surface (header, entry count, close affordance ≥44pt) over a two-column `FlatList` of `VaultEntryCard`s from `useVaultEntries` (reload on reveal), empty/error states via `VaultEmptyState`, delete wiring through `remove(id)` with spring exit (SC-005 jank-free at 50 entries)
- [X] T022 [US4] Wire card tap → existing detail experience: `VaultSheet` hosts `GarmentDetailModal` fed by `productMatchesToModalState(entry.matches)` — no refetch path (retry affordance not wired for local data, contract §5); deleting the open entry closes the modal gracefully (spec edge case)
- [ ] T023 [US4] US4 verification: gates zero-error; quickstart Scenario 4 (grid order/metadata/micro-interactions, offline reopen, empty state, corrupt-entry degradation, 50-entry scroll, delete leaves zero orphaned files)

**Checkpoint**: All four stories functional — the vault loop closes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Regression sweep per quickstart Scenario 5: full 001 pass (capture/import/multi-person/hotspot tap/failures), 003 demo end-to-end (+ demo vault entry appears), Home rail with durable thumbnails, 002 sign-out/in; `grep -rn "Easing.linear" src/` → zero matches
- [ ] T025 Full quickstart pass (Scenarios 1–5 in order) + final zero-error gates; fix anything failing before marking complete
- [ ] T026 [P] `/lessons` entries: the confirmed hotspot root cause (from T010, if not already written) and any expo-file-system new-API gotchas worth preserving (Constitution: Local Retrospective)

---

## Dependencies & Execution Order

### Phase Dependencies

- **US1 (Phase 3) is fully independent** — no new dependency, no vault code; it can run before/parallel with Phases 1–2 and should land first (regression outranks features).
- **Setup (Phase 1)**: T001 → T002. Blocks Phases 2 and 4–6 (everything vault).
- **Foundational (Phase 2)**: T003 ∥ T005 first; T004 needs T002+T003; T006 needs T004; T007 last. Blocks US2–US4.
- **US2 (Phase 4)**: T011 → T012 (both touch the capture path); T013 needs T005; T014 parallel with T013; T015 last.
- **US3 (Phase 5)**: T016 independent of US2; T017 touches `scan.tsx` — **sequence after T011** (same file); T018 last.
- **US4 (Phase 6)**: T019 ∥ T020; T021 composes them + T006; T022 needs T021 + T005; T023 last. VaultSheet slots into T017's container (placeholder until then is fine in either order).
- **Polish (Phase 7)**: after all stories; T024/T026 parallel; T025 final.

### File-collision notes

`scan.tsx` is touched by T009 (US1), T011 (US2), T017 (US3) — sequence those three. `useVisualSearch.ts` only by T014.

---

## Parallel Example: Foundational + US1 together

```bash
# US1 needs nothing from Setup — run it while the rebuild (T001) bakes:
Task: "z-band contract in scan-overlay components (T008)"
Task: "vault types in src/types/vault.ts (T003)"
Task: "matches adapters in src/features/vault/utils/matches-adapter.ts (T005)"
```

---

## Implementation Strategy

### MVP First

1. **US1 immediately** (T008–T010) — the regression fix ships even if the vault slips.
2. Setup + Foundational (T001–T007) — the engine, provable via dev logs before any UI.
3. **US2** (T011–T015) — durable data; demo + camera writes proven across relaunch.
4. **US3 → US4** (T016–T023) — the door, then the room.
5. Polish (T024–T026).

### Incremental Delivery

Each checkpoint is demoable: fixed hotspots → (invisible but verifiable) persistence → the Shazam pull with a placeholder → the full grid.

---

## Notes

- Total: **26 tasks** (T001–T026). Setup: 2 · Foundational: 5 · US1: 3 · US2: 5 · US3: 3 · US4: 5 · Polish: 3.
- **T001's rebuild is the long pole** — start it first and do US1 while it runs.
- The storage service is the only expo-file-system consumer (contract C-style invariant, like `device-store.ts` for SecureStore); nothing else may import it for vault purposes.
- Educational why-comments are definition-of-done for T004 (write-order invariant), T008/T009 (z-band contract), T011 (move-before-consume), T016 (single-owner progress).
