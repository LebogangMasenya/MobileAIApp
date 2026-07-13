# Tasks: Vault Sharing Groundwork (Public Toggle + Share a Garment)

**Input**: Design documents from `/specs/006-vault-sharing/`

**Prerequisites**: plan.md, spec.md (respecced: true per-garment crops), research.md, data-model.md, contracts/sharing.md, quickstart.md

**Tests**: Not requested — manual validation via `quickstart.md` (4 scenarios incl. migration + 005 regression sweep) plus zero-error `tsc`/lint gates.

**Organization**: Grouped by user story (US1 toggle, US2 share-a-garment, US3 migration). All paths relative to `apps/mobile/`. **One new dependency** (`expo-image-manipulator` — second dev-client rebuild of the workstream); sharing itself adds none.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (public toggle), US2 (share a garment), US3 (existing vaults keep working)

---

## Phase 1: Setup

**Purpose**: The one dependency and its API verification.

- [X] T001 Install the crop dependency: `cd apps/mobile && npx expo install expo-image-manipulator` (SDK-54-matched version in `package.json`), then rebuild the dev client (`npx expo run:ios`) — native module; nothing crop-related runs in the old client. **Keep one install with a pre-006 vault** for the US3 migration scenario before wiping anything
- [X] T002 Verify the installed manipulator API against its own types (AGENTS.md rule): confirm the context-API entry point and crop/render/save signatures in `node_modules/expo-image-manipulator/build/*.d.ts` before writing any code; record the verified signatures in a comment block atop `garment-crop.ts` when T013 creates it

---

## Phase 2: Foundational (Blocking Prerequisites — schema v2 + write-path grouping)

**Purpose**: The versioned schema, lossless migration, and the per-garment data that US2's sharing and US3's guarantees both stand on.

- [X] T003 Extend `src/types/vault.ts` to v2 per data-model.md: add `VaultGarment` (`id`, `category`, `boundingRegion` (reuse `BoundingRegion` from types/scan), `matches: ProductMatch[]`) and extend `VaultEntry` with `imageSize: { width: number; height: number } | null` and `garments: VaultGarment[]`; bump `VaultIndex` to `{ v: 2, entries: VaultEntry[] }` — strict types, no `any`
- [X] T004 Upgrade `src/services/vault-store.ts` (contract §1): `readEntries` accepts v1 AND v2 — v1 entries map losslessly to `{ ...entry, imageSize: null, garments: [] }` (invariant V5: migration happens in memory; only a successful full write persists v2 — why-comment); entry validation updated for v2 fields (v1-shaped records still validate via the mapping); add `addGarments(scanId, garments)` merging by garment id (never duplicates, FR-008); extend `mergeMatches(scanId, matches, garmentId?)` to append to the garment's own list AND the look aggregate, each deduped by `source_url`; `writeEntries` emits v2
- [X] T005 Write-path in `src/features/scan/hooks/useCreateScan.ts`: the `upsertEntry` at scan-ready now includes `imageSize: { width: photo.width, height: photo.height }` and `garments` mapped from `session.garments` (`{ id, category, boundingRegion, matches: [] }`) — single-person scans auto-populate; multi-person start empty
- [X] T006 [P] Write-path in `src/features/scan/hooks/useSegmentPerson.ts`: on `segmented`, fire-and-forget `addGarments(scanId, garments)` mapped from `result.data.garments` (multi-person looks gain their breakdown per selection)
- [X] T007 [P] Write-path in `src/features/scan/hooks/useGarmentMatches.ts`: the existing `mergeMatches(scanId, normalized)` call gains the `garmentId` argument — per-garment grouping is free here because the fetch already knows both ids (research §3)
- [X] T008 Foundational gate: `cd apps/mobile && npx tsc --noEmit && npx expo lint` — zero errors

**Checkpoint**: New scans persist garment-grouped data; old vaults read losslessly — both share stories can build.

---

## Phase 3: User Story 1 - Make the Vault Public (Priority: P1)

**Goal**: Spring-animated persisted visibility toggle; public arms the share affordances (animated in/out), private removes them; once-only honest explainer.

**Independent Test**: Flip/persist/relaunch the toggle; verify affordances present in public and absent in private; explainer appears exactly once (quickstart Scenario 1). Depends only on Phase 2's gate passing (no crop/schema use).

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `src/features/vault/hooks/useVaultVisibility.ts` (contract §5): `{ isPublic, isLoaded, toggle, explainerVisible, dismissExplainer }` over device-store key `satori.vault.visibility.v1` (`{ v: 1, isPublic, explainerShown }`); absent/corrupt ⇒ private + explainer unseen (FR-002 safe default, why-comment); `toggle()` persists then flips state so stored value and visuals can never disagree; first flip to public with `explainerShown: false` sets `explainerVisible`
- [X] T010 [P] [US1] Create `src/features/vault/components/VaultVisibilityToggle.tsx`: custom Pressable track + spring-translated knob (`withSpring`, retargets on rapid re-flip — RN `Switch` rejected per research §5) + crossfading "Public"/"Private" label; ≥44pt target; `{ isPublic, onToggle }` props — presentational only (Constitution VIII)
- [X] T011 [US1] Integrate in `src/features/vault/components/VaultSheet.tsx`: toggle in the header row via `useVaultVisibility`; once-only explainer (springified inline notice: "Sharing enabled — public style profiles are coming later") with dismiss; header share-state hint and per-card share affordances gated on `isPublic` with springified entering/exiting (FR-003 — affordance wiring lands fully in T017; here the gating scaffolding + header state)
- [ ] T012 [US1] US1 verification: gates zero-error; quickstart Scenario 1 on device (flip/interrupt/persist/relaunch, explainer once, affordances present↔absent)

**Checkpoint**: The vault has a real, persisted public mode — the sharing surface has its gate.

---

## Phase 4: User Story 2 - Share a Garment: Crop + Its Purchase Links (Priority: P1)

**Goal**: Share affordance → (picker when multi-garment) → native sheet with the garment's crop + only its match lines; whole-look and fallback paths included.

**Independent Test**: Fresh multi-garment scan → share a garment → verify crop + grouped links in Notes; single-garment skips the picker; cancel silent (quickstart Scenario 2).

### Implementation for User Story 2

- [X] T013 [P] [US2] Create `src/features/vault/utils/garment-crop.ts` — the ONLY expo-image-manipulator consumer (contract §2): `cropGarment(entry, garment): Promise<string | null>` — normalized region × `entry.imageSize` → pixel rect padded ~12%/side and clamped to bounds (aspect preserved, no resize), manipulator crop → saved file URI; returns null on ANY failure or when `imageSize` is null / image isn't `file://` (callers fall back — FR-010); verified-API comment block from T002
- [X] T014 [P] [US2] Create `src/features/vault/utils/share-payload.ts` (contract §3, FR-015): pure `composeSharePayload(entry, garment?, imageUri?)` → `{ message, imageUri }` — date header ("My {category} — spotted {date} with Satori"), ≤6 lines "• {title ≤60} — {price ·} {store}" + link (price segment omitted entirely when null — never "null"), "+{n} more finds" overflow, caption-only when zero matches; total function, never throws (FR-013)
- [X] T015 [US2] Create `src/features/vault/hooks/useShareLook.ts` (contract §4): routes share(entry) — `garments.length ≥ 2` → picker state; else direct; `shareGarment(entry, garment | 'look')` runs `cropGarment` (garment path) → `composeSharePayload` → RN `Share.share({ message, url: imageUri })`; crop null → look photo fallback; `dismissedAction` → silent; throw → `error` state for a gentle inline notice; one share in flight at a time (double-tap guard)
- [X] T016 [US2] Create `src/features/vault/components/GarmentSharePicker.tsx` (contract §6): modal card (001 sheet idiom, spring entrance) — one ≥56pt row per garment: lazy crop thumbnail (spinner until `cropGarment` resolves; falls back to the look photo thumb), category, match count or "no links yet"; plus a "Whole look" row; scrim tap cancels silently
- [X] T017 [US2] Wire the flow in `src/features/vault/components/VaultSheet.tsx` + `VaultEntryCard.tsx`: per-card share affordance (visible only when public, springified — completes T011's gating) → `useShareLook.share(entry)`; host `GarmentSharePicker` + the share-error inline notice in VaultSheet; card affordance ≥44pt and must not collide with the existing tap/long-press contract
- [ ] T018 [US2] US2 verification: gates zero-error; quickstart Scenario 2 (picker rows + thumbs, garment crop + grouped links verified via Notes, single-garment ≤2 taps, edge-region crop clamped, cancel silent)

**Checkpoint**: The publishable unit exists end-to-end — crop + links through the OS share sheet.

---

## Phase 5: User Story 3 - Existing Vaults Keep Working (Priority: P2)

**Goal**: v1 vaults migrate losslessly and share as whole looks; demo entries share text-first; nothing regresses.

**Independent Test**: Open a pre-006 vault after updating — all entries intact, shareable whole-look; new scans offer the picker (quickstart Scenario 3).

### Implementation for User Story 3

- [X] T019 [US3] Harden the garmentless paths in `src/features/vault/hooks/useShareLook.ts` + `garment-crop.ts`: migrated entries (`garments: []`, `imageSize: null`) and demo entries (remote `https` image) route straight to whole-look sharing — demo passes its remote URL as the share url (attaches where the platform allows, text stands alone otherwise); explicit why-comment that grouping is forward-only (spec assumption)
- [ ] T020 [US3] US3 verification: quickstart Scenario 3 on the preserved pre-006 install (migration intact, whole-look shares, demo text-first, corrupt preference → private)

**Checkpoint**: All three stories functional; old data honored.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T021 [P] Failure-mode + regression pass per quickstart Scenario 4: forced crop failure → look-photo fallback; share-error notice path; full 005 sweep (reveal gesture, grid, open/delete, persistence) unchanged (SC-006)
- [ ] T022 Full quickstart pass (Scenarios 1–4 in order) + final zero-error gates + `grep -rn "Easing.linear" src/` → zero matches; fix anything failing before marking complete
- [ ] T023 [P] `/lessons` entry if the manipulator's installed API diverged from expectations (the expo-file-system precedent) or the migration surfaced gotchas (Constitution: Local Retrospective)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002. T001's rebuild is the long pole — start it first.
- **Foundational (Phase 2)**: T003 → T004 → T005; T006 ∥ T007 after T004; T008 last. **Blocks US2/US3.**
- **US1 (Phase 3)**: needs only T008's gate (no schema/crop use). T009 ∥ T010 → T011 → T12. **Can run while the T001 rebuild bakes** (no new native code involved).
- **US2 (Phase 4)**: after Phase 2 + T011. T013 ∥ T014 → T015 → T016 → T017 → T018.
- **US3 (Phase 5)**: after T015 (same file). T019 → T020.
- **Polish (Phase 6)**: after all stories; T021 ∥ T023; T022 final.

### File-collision notes

`VaultSheet.tsx` is touched by T011 (US1) and T017 (US2) — sequence them. `useShareLook.ts` by T015 then T019.

---

## Parallel Example: while the dev-client rebuild bakes

```bash
# T001's build runs ~10 minutes; everything here needs no new native module:
Task: "vault types v2 in src/types/vault.ts (T003)"
Task: "useVaultVisibility in src/features/vault/hooks/useVaultVisibility.ts (T009)"
Task: "VaultVisibilityToggle in src/features/vault/components/VaultVisibilityToggle.tsx (T010)"
Task: "share-payload composer in src/features/vault/utils/share-payload.ts (T014)"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2 — schema v2 provable via relaunch + dev logs before any UI.
2. **US1** (T009–T012) — the toggle is demoable on its own and gates everything visible.
3. **US2** (T013–T018) — the headline: garment crop + links through the share sheet.
4. **US3** (T019–T020) — honors old data; mostly verification once T004 is right.
5. Polish (T021–T023).

### Incremental Delivery

Each checkpoint demos: public mode → a real shared garment in Notes/Messages → old vaults proven safe.

---

## Notes

- Total: **23 tasks** (T001–T023). Setup: 2 · Foundational: 6 · US1: 4 · US2: 6 · US3: 2 · Polish: 3.
- **Migration fixture**: preserve an install with a pre-006 vault before rebuilding — it's the only way to run Scenario 3 honestly.
- The manipulator is confined to `garment-crop.ts` and the share sheet to `useShareLook.ts` — one owner file per impure edge (house pattern).
- Educational why-comments are definition-of-done for T004 (V5 migration), T009 (private-safe default), T013 (region→pixel + fallback contract), T019 (forward-only grouping).
