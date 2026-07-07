---

description: "Task list for Camera Scan-to-Match Garment Identification"
---

# Tasks: Camera Scan-to-Match Garment Identification

**Input**: Design documents from `/specs/001-camera-scan-match/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/scan-api.md, quickstart.md

**Tests**: Not included — `spec.md` does not explicitly request automated tests or a TDD approach, so no dedicated test tasks were generated. `quickstart.md` (T035) is the manual, scenario-based validation instead. Add test tasks explicitly if you want them.

**Organization**: Tasks are grouped by user story (US1/US2/US3, per `spec.md` priorities) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in the same batch)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Constitution Gate Notice

**T006 is a hard blocker** (Constitution Principle II — Design-First Implementation, flagged in `plan.md`'s Constitution Check as the sole outstanding pre-implementation gate). No task that creates or modifies a UI component/layout may start until T006 is complete and approved. Those tasks say so explicitly in their description.

## Path Conventions

Per `plan.md`'s Project Structure: `apps/mobile/` (Expo client) and `apps/api/` (Next.js serverless backend) as sibling top-level directories.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — this is a greenfield repo, no app code exists yet.

- [ ] T001 Create top-level structure: `apps/mobile/`, `apps/api/`, and root `/lessons/` directories per `plan.md`
- [ ] T002 [P] Initialize `apps/mobile` as an Expo (managed workflow) TypeScript project with NativeWind and `react-native-reanimated` configured
- [ ] T003 [P] Initialize `apps/api` as a Next.js TypeScript project configured for Vercel Serverless Functions
- [ ] T004 [P] Configure shared ESLint + strict TypeScript compiler settings (`noImplicitAny`, no `any` escapes) across `apps/mobile` and `apps/api` per the constitution's Verification Rule
- [ ] T005 [P] Configure Expo custom Dev Client / prebuild setup in `apps/mobile` to support a native Swift module target (required for on-device vision in Phase 3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. T006 additionally blocks every UI-creating task in later phases individually (see Constitution Gate Notice above).

- [ ] T006 Complete Figma/MCP design review and UX critique for the camera capture screen, segmentation overlay, bubble markers, and garment detail modal; obtain user approval of the optimization plan before any UI task below proceeds (Constitution Principle II)
- [ ] T007 [P] Define shared TypeScript entity types (ScanSession, DetectedGarment, MatchedProduct, SimilarItem, Store) in `apps/mobile/src/types/scan.ts` per `data-model.md`
- [ ] T008 [P] Define shared TypeScript entity types (same entities) in `apps/api/src/types/scan.ts` per `data-model.md`
- [ ] T009 [P] Implement typed API client base with `ErrorResponse` handling in `apps/mobile/src/services/apiClient.ts` per `contracts/scan-api.md`
- [ ] T010 [P] Implement reusable `ScanErrorFallback` UI component (non-destructive fallback) in `apps/mobile/src/features/scan/components/ScanErrorFallback.tsx` (depends on T006 design review)
- [ ] T011 [P] Implement `useRegionPreference` hook (device locale inference + SecureStore override) in `apps/mobile/src/features/scan/hooks/useRegionPreference.ts`
- [ ] T012 Implement backend route skeleton (request validation, typed responses) for `POST /v1/scans` and `GET /v1/scans/:id/garments/:id/matches` in `apps/api/src/routes/scans.ts` (depends on T008)
- [ ] T013 [P] Implement vision dispatch service skeleton (platform-based on-device-vs-cloud routing per `research.md` §3) in `apps/api/src/services/vision/dispatch.ts`
- [ ] T014 [P] Implement matching service skeleton (external product-search integration point, server-side region filtering per `data-model.md`) in `apps/api/src/services/matching/matchService.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin (UI tasks remain individually gated on T006).

---

## Phase 3: User Story 1 - Capture or Import and Segment an Outfit (Priority: P1) 🎯 MVP

**Goal**: User captures or imports a photo; a spring-animated segmentation outline confirms the person was recognized; a bubble appears over each detected garment.

**Independent Test**: Using both a live-captured photo and an imported photo of a person wearing multiple garments, confirm the segmentation animation runs and one bubble appears per distinct garment, for both input paths (`quickstart.md` scenario 1).

### Implementation for User Story 1

- [ ] T015 [P] [US1] Build `CameraView` component (expo-camera live preview + capture control) in `apps/mobile/src/features/scan/components/CameraView.tsx` (depends on T006 design review)
- [ ] T016 [P] [US1] Build `ImportPicker` entry point (expo-image-picker) in `apps/mobile/src/features/scan/components/ImportPicker.tsx` (depends on T006 design review)
- [ ] T017 [US1] Implement `useCreateScan` hook (calls `POST /v1/scans`, try/catch + error-fallback wiring per Constitution Principle VII) in `apps/mobile/src/features/scan/hooks/useCreateScan.ts` (depends on T009, T010)
- [ ] T018 [US1] Implement `SegmentationOverlay` component (spring-driven glowing outline, Reanimated `withSpring` only — no `Easing.linear`) in `apps/mobile/src/features/scan/components/SegmentationOverlay.tsx` (depends on T006 design review)
- [ ] T019 [US1] Implement `BubbleMarker` component (positioned via `DetectedGarment.boundingRegion`, spring entrance animation) in `apps/mobile/src/features/scan/components/BubbleMarker.tsx` (depends on T006 design review)
- [ ] T020 [US1] Implement `ScanScreen` composing CameraView/ImportPicker → useCreateScan → SegmentationOverlay → BubbleMarker list in `apps/mobile/app/(tabs)/scan.tsx` (depends on T015, T016, T017, T018, T019)
- [ ] T021 [US1] Implement `POST /v1/scans` handler wiring the vision dispatch service and mapping results to `ScanSession` success/failure shape (FR-012) in `apps/api/src/routes/scans.ts` (depends on T012, T013)
- [ ] T022 [US1] Implement the on-device Apple Vision native module bridge (Swift) for iOS segmentation in `apps/mobile/modules/vision-segmentation/` (depends on T005)
- [ ] T023 [US1] Wire the cloud vision fallback path in the vision dispatch service for Android and low-confidence cases in `apps/api/src/services/vision/dispatch.ts` (depends on T013)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - View Garment Details and Store Matches (Priority: P1)

**Goal**: Tapping a bubble opens a modal with garment details, store matches with a call-to-action, and similar items.

**Independent Test**: On a segmented photo with at least one bubble, tap it and confirm the modal shows garment details, a working store call-to-action, and a similar-items list or explicit no-match state (`quickstart.md` scenario 2).

### Implementation for User Story 2

- [ ] T024 [P] [US2] Implement `useGarmentMatches` hook (calls `GET /v1/scans/:id/garments/:id/matches`, try/catch + error-fallback wiring) in `apps/mobile/src/features/scan/hooks/useGarmentMatches.ts` (depends on T009, T010)
- [ ] T025 [P] [US2] Implement `GarmentDetailModal` component (garment details, store list with CTA, similar items list) in `apps/mobile/src/features/scan/components/GarmentDetailModal.tsx` (depends on T006 design review)
- [ ] T026 [US2] Wire `BubbleMarker` tap → `GarmentDetailModal` open via `useGarmentMatches` in `apps/mobile/app/(tabs)/scan.tsx` (depends on T020, T024, T025)
- [ ] T027 [US2] Implement modal-dismiss behavior that preserves the segmented photo and bubble state (FR-014) in `apps/mobile/app/(tabs)/scan.tsx` (depends on T026)
- [ ] T028 [US2] Implement `GET /v1/scans/:id/garments/:id/matches` handler wiring the matching service (FR-013 no-match handling) in `apps/api/src/routes/scans.ts` (depends on T012, T014)
- [ ] T029 [US2] Implement store call-to-action outbound navigation in `apps/mobile/src/features/scan/components/GarmentDetailModal.tsx` (depends on T025)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Find a Regionally Available Alternative (Priority: P2)

**Goal**: Similar items are filtered to the user's region, with a user-overridable region preference and an explicit no-regional-match state.

**Independent Test**: Using a garment whose only known retailer is outside the user's region, confirm the similar items list surfaces a regionally available alternative, updates when the region preference changes, and shows an explicit empty state when no alternative exists (`quickstart.md` scenario 3).

### Implementation for User Story 3

- [ ] T030 [P] [US3] Implement region-based filtering in the matching service (`SimilarItem.regionAvailable` enforced server-side per `data-model.md`) in `apps/api/src/services/matching/matchService.ts` (depends on T014)
- [ ] T031 [P] [US3] Implement `RegionPreferenceSettings` UI (view/change the region override, FR-010a) in `apps/mobile/src/features/scan/components/RegionPreferenceSettings.tsx` (depends on T006 design review, T011)
- [ ] T032 [US3] Wire the active region value into `useCreateScan` and `useGarmentMatches` request payloads in `apps/mobile/src/features/scan/hooks/useCreateScan.ts` and `apps/mobile/src/features/scan/hooks/useGarmentMatches.ts` (depends on T011, T017, T024)
- [ ] T033 [US3] Implement the explicit "no regional match found" empty state in `GarmentDetailModal` (FR-011, US3 scenario 2) in `apps/mobile/src/features/scan/components/GarmentDetailModal.tsx` (depends on T025, T030)

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T034 [P] Create `/lessons/README.md` documenting the retrospective process (Constitution Retrospective Discipline)
- [ ] T035 [P] Run all `quickstart.md` validation scenarios end-to-end on an iOS device/simulator
- [ ] T036 Verify strict TypeScript compilation and lint pass with zero errors across `apps/mobile` and `apps/api` (Constitution Verification Rule)
- [ ] T037 [P] Inline why-comment review pass over custom hooks, the native vision module bridge, and state-holding logic (Constitution Principle VI — Educational Code Architecture)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories; T006 additionally blocks every individual UI task in later phases until it's done
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed) or sequentially in priority order (P1 → P1 → P2)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2); its UI wiring (T026, T027) depends on US1's `ScanScreen` (T020) existing, so in practice follows US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2); its wiring tasks (T032, T033) depend on US1's and US2's hooks/modal existing, so in practice follows US1 and US2

### Within Each User Story

- Backend route/service tasks can proceed in parallel with mobile UI tasks
- Composition tasks (e.g., T020, T026) depend on their constituent component/hook tasks being done first
- Story complete before moving to next priority, per Implementation Strategy below

### Parallel Opportunities

- All Setup tasks marked [P] (T002-T005) can run in parallel
- All Foundational tasks marked [P] (T007-T011, T013-T014) can run in parallel once T006 (for T010) and T008 (for T012) are satisfied
- Once Foundational completes, US1's component tasks (T015, T016) and backend tasks (T021-T023, once T012/T013 are done) can proceed in parallel
- US2's T024 and T025 can run in parallel; US3's T030 and T031 can run in parallel
- Different user stories can be worked on in parallel by different team members once Phase 2 is complete, keeping the US1→US2→US3 wiring dependencies above in mind

---

## Parallel Example: User Story 1

```bash
# Launch US1's independent component tasks together (after T006 and Phase 2 complete):
Task: "Build CameraView component in apps/mobile/src/features/scan/components/CameraView.tsx"
Task: "Build ImportPicker entry point in apps/mobile/src/features/scan/components/ImportPicker.tsx"
Task: "Implement SegmentationOverlay component in apps/mobile/src/features/scan/components/SegmentationOverlay.tsx"
Task: "Implement BubbleMarker component in apps/mobile/src/features/scan/components/BubbleMarker.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (including the T006 design-review gate)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `quickstart.md` scenario 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → validate via `quickstart.md` scenario 1 → Deploy/Demo (MVP!)
3. Add User Story 2 → validate via `quickstart.md` scenario 2 → Deploy/Demo
4. Add User Story 3 → validate via `quickstart.md` scenario 3 → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (including the T006 design-review gate)
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2 (hooks/backend can start early; UI wiring waits on US1's `ScanScreen`)
   - Developer C: User Story 3 (matching-service filtering can start early; UI wiring waits on US1/US2)
3. Stories complete and integrate along the dependencies noted above

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same batch
- [Story] label maps task to specific user story for traceability
- T006 (Figma/MCP design review) is a constitution-mandated gate, not a normal setup task — do not skip it to save time
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Verify `quickstart.md` scenarios pass before considering a story done
