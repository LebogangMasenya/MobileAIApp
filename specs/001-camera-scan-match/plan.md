# Implementation Plan: Camera Scan-to-Match Garment Identification

**Branch**: `001-camera-scan-match` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-camera-scan-match/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Users capture or import a photo of an outfit, watch a spring-animated segmentation
outline confirm the person was recognized, then tap bubble icons over each detected
garment to see store matches and region-appropriate similar items with a purchase
call-to-action. Technical approach: an Expo-managed mobile client (NativeWind +
Reanimated) talks to a Node/TypeScript serverless API that runs a hybrid
on-device/cloud vision pipeline (Apple Vision on iOS, cloud vision fallback
elsewhere) and resolves matches from an external product-search provider rather
than an owned catalog, per `research.md`.

## Technical Context

**Language/Version**: TypeScript (strict mode), latest stable

**Primary Dependencies**: Expo SDK (managed workflow + custom dev client for the
native vision module), `expo-camera`, `expo-image-picker`, `expo-localization`,
NativeWind, `react-native-reanimated`; backend: Node.js + TypeScript on Next.js
Serverless Functions (Vercel)

**Storage**: N/A for v1 (no first-party database); short-lived edge cache for
match responses only (see `research.md` §6)

**Testing**: Jest + React Native Testing Library for components/hooks; contract
and integration tests against the serverless API handlers

**Target Platform**: iOS 17+ (on-device segmentation, primary target) and
Android 13+ (cloud-vision fallback path), both via Expo managed workflow with a
custom dev client for the native vision module

**Project Type**: Mobile app + API (two deployable units)

**Performance Goals**: Item bubbles visible ≤5s after capture (SC-001); match
results ≤2s after a bubble tap (SC-003); 60fps UI-thread animation with zero
main-JS-thread blocking during segmentation (Constitution Principle III)

**Constraints**: Strict TypeScript, no `any` escapes; NativeWind-first styling
(animated style objects from Reanimated are an inherent, documented exception,
see `research.md` §2); capture must work offline, matching requires connectivity
and must degrade via the Defensive Error Scaffolding fallback UI when it doesn't

**Scale/Scope**: Not yet specified — MVP is single-session, no-auth; concurrent-
user/load targets are deferred to a future operational-readiness feature

All Technical Context unknowns are resolved in `research.md` (see §1–6 and the
Resolved Technical Context table); nothing here remains marked NEEDS CLARIFICATION.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v2.0.1:

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Clarity Over Assumption | ✅ PASS | Both spec-phase ambiguities (input source, region determination) were resolved with the user before this plan was written; no open `[NEEDS CLARIFICATION]` markers in `spec.md` or this plan. |
| II | Design-First Implementation | ⚠️ BLOCKED FOR IMPLEMENTATION | No Figma design has been reviewed yet for the camera screen, segmentation overlay, bubble markers, or detail modal. This plan (research/data-model/contracts) may proceed, but `/speckit-tasks` output for any new view/layout MUST NOT be implemented until a Figma/MCP design review and UX critique has been completed and approved, per this principle. Tracked as a pre-implementation gate, not a Complexity Tracking violation. |
| III | Performance First (Zero Layout Stutter) | ✅ PASS (by design) | Segmentation runs server-side/native (not JS-thread-bound); animations are Reanimated worklets on the UI thread (research.md §2); match fetches are split by endpoint so no heavy per-garment work blocks initial bubble rendering (contracts/scan-api.md). |
| IV | Anti-Abstraction Mandate | ✅ PASS (by design) | `expo-camera`/`expo-image-picker` and Reanimated shared values used directly; no wrapper SDK introduced (research.md §1–2). |
| V | Native-Grade Fluid Motion | ✅ PASS (by design) | All transitions specified as `withSpring`-driven; `Easing.linear` explicitly excluded (research.md §2). |
| VI | Educational Code Architecture | ➡️ DEFERRED TO IMPLEMENTATION | Not a design-artifact concern; enforced when `/speckit-tasks` code is written (inline why-comments on custom hooks/state engines). |
| VII | Defensive Error Scaffolding | ✅ PASS (by design) | Error/failure states are first-class in the data model (`ScanSession.status`, `matchStatus`) and contracts (`ErrorResponse`, retryable vs. non-retryable codes) rather than bolted on later. |
| VIII | State Isolation | ✅ PASS (by design) | Planned hooks (`useCreateScan`, `useGarmentMatches`, `useRegionPreference`) keep API calls and device-state logic out of components; see Project Structure below. |

**Gate result**: PASS to proceed with Phase 0/1 design artifacts, with Principle II
recorded as a hard prerequisite that MUST be satisfied before `/speckit-tasks`
output is implemented (not before it is generated).

**Post-Phase-1 re-check**: Confirmed against the completed `research.md`,
`data-model.md`, and `contracts/scan-api.md` — no new violations were
introduced by the detailed design (error states, hook boundaries, and
animation approach all landed as planned above). Gate remains PASS; Principle
II remains the sole outstanding pre-implementation blocker.

## Project Structure

### Documentation (this feature)

```text
specs/001-camera-scan-match/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── scan-api.md       # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md   # /speckit-specify output
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This is a greenfield repository (no app code exists yet). This feature
establishes the initial two-deployable-unit layout described in the
constitution's Technology Stack & Conventions section: an Expo mobile client
and a Node/TypeScript API, kept as sibling top-level apps rather than a single
merged project so the mobile client's Expo tooling and the API's serverless
tooling don't have to share a build config.

```text
apps/
├── mobile/                      # Expo-managed React Native client
│   ├── app/                     # Expo Router screens (camera tab, etc.)
│   ├── src/
│   │   ├── features/
│   │   │   └── scan/
│   │   │       ├── components/  # CameraView, SegmentationOverlay,
│   │   │       │                # BubbleMarker, GarmentDetailModal — atomic,
│   │   │       │                # presentation-only (Principle VIII)
│   │   │       └── hooks/       # useCreateScan, useGarmentMatches,
│   │   │                        # useRegionPreference — API calls + device
│   │   │                        # state live here, not in components
│   │   ├── services/            # typed API client (contracts/scan-api.md)
│   │   └── types/                # shared TS interfaces (data-model.md)
│   └── tests/
│       ├── unit/
│       └── integration/
└── api/                          # Node.js + TypeScript on Next.js Serverless
    ├── src/
    │   ├── routes/                # POST /v1/scans, GET /v1/scans/:id/garments/:id/matches
    │   ├── services/
    │   │   ├── vision/            # on-device-vs-cloud dispatch (research.md §3)
    │   │   └── matching/          # product-search provider integration (research.md §6)
    │   └── types/                 # shared TS interfaces (data-model.md)
    └── tests/
        ├── contract/
        └── integration/
```

**Structure Decision**: Option 3 (Mobile + API), adapted for the Expo/Next.js
stack specified in the constitution and by the user for this plan — `apps/mobile`
and `apps/api` as sibling top-level directories rather than nested
`ios/`/`android/` platform folders, since Expo's managed workflow abstracts the
native platform split for us. `/lessons` (constitution Retrospective
Discipline) stays at the repo root, outside `apps/`, since it documents
tooling/build breakthroughs that can span both apps.

## Complexity Tracking

No constitution violations were identified for this feature — this section is
intentionally left without entries. The one apparent tension (NativeWind vs.
Reanimated animated styles) is not a violation; see `research.md` §2 for why.
