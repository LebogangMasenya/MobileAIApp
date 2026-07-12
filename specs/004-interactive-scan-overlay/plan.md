# Implementation Plan: Interactive Scan Overlay (Shared Neon Trace + Hotspots)

**Branch**: `main` (no feature branch in use) | **Date**: 2026-07-12 | **Spec**: none — tasks-first sprint per explicit user direction (2026-07-12); this lean plan records the decisions a spec would have carried

**User direction**: Break the interactive camera overlay + coordinate transformation work into itemized steps across three explicit files — `useCoordinateTransform.ts` (layout math), `NeonTracingOverlay.tsx` (tracing visual), `InteractionHotspot.tsx` (animated target nodes) — and track them in tasks.md. Decisions taken 2026-07-12: **shared across both surfaces** (001 camera scan flow and 003 demo-scan screen) and **zero new dependencies** (no react-native-svg — Reanimated view layers stand in for SVG pathing).

## Summary

Extract and upgrade the scan-visual layer into one shared module, `src/features/scan-overlay/`, consumed by both scanning surfaces:

- **`useCoordinateTransform.ts`** — hook ergonomics over the existing single-source geometry (`features/scan/utils/layout.ts` `containFrame`/`regionToLayout`): container measurement + frame + normalized→pixel mapping in one place, so screens stop hand-wiring `onLayout` + math.
- **`NeonTracingOverlay.tsx`** — the "SVG pathing" effect, dependency-free: a neon light that *runs the perimeter* of a region (four edge segments animated in sequence with springs) over stacked translucent glow layers (no blur passes — Constitution III). Modes `tracing` (searching/segmenting) and `settled` (results present), spring-interpolated like the current SegmentationOverlay.
- **`InteractionHotspot.tsx`** — pressable animated target node (pulsing core + expanding ring), ≥44pt, staggered springified entrance — the generalized successor to 001's `BubbleMarker`.

Adoption swaps the current visuals in `(app)/demo-scan.tsx` (glow → neon trace) and `(app)/(tabs)/scan.tsx` (glow → neon trace; bubbles → hotspots) while preserving 001's placement math (`resolveBubblePlacements`) and all existing behavior contracts.

## Technical Context

**Dependencies**: none added — react-native-reanimated ~4.1 + NativeWind 4 only (user decision: no react-native-svg, no dev-client rebuild)

**Testing**: manual — 001 quickstart scan scenarios + 003 quickstart Scenario 2 re-run after adoption; `tsc --noEmit` + `expo lint` zero-error gates

**Constraint carried from the no-SVG decision**: the trace follows the region's **bounding rectangle**, not the garment's silhouette — true contour tracing needs path rendering (SVG/Skia) and is the recorded follow-up if the rectangle trace isn't premium enough on device.

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Clarity Over Assumption | ✅ PASS | Both scope-critical ambiguities (target surface, SVG dependency) halted on and answered by the user 2026-07-12; the rectangle-not-silhouette limitation is documented above, not discovered later. |
| II | Design-First Implementation | ✅ PASS | Evolves the approved 001 scanning language (glow → neon trace, bubbles → hotspots); no new screens; palette from existing tokens. |
| III | Performance First | ✅ PASS | All motion as UI-thread worklets; glow via stacked translucent layers, never native blur; perimeter trace is 4 transforms, not per-frame layout. |
| IV | Anti-Abstraction Mandate | ✅ PASS | `useCoordinateTransform` *wraps* the existing layout.ts math (no duplicate geometry); components replace like-for-like visuals rather than adding a layer over them. |
| V | Native-Grade Fluid Motion | ✅ PASS | Perimeter run = `withRepeat(withSequence(withSpring…))`; mode changes spring between levels; no `Easing.linear`. |
| VI | Educational Code Architecture | ✅ PASS | Why-comments mandated: why rectangle-perimeter instead of SVG paths, why the geometry stays single-source, why hotspots keep 001's placement math. |
| VII | Defensive Error Scaffolding | ✅ PASS | Pure-visual components — zero-size frames render nothing (layout.ts already guards); no new failure surfaces. |
| VIII | State Isolation | ✅ PASS | Components stay presentational (mode/region/frame props); measurement state lives in the hook; screens keep owning *when* to show what. |

## Structure (new/changed files)

```text
apps/mobile/src/features/scan-overlay/        # NEW shared module (both surfaces import from here)
├── hooks/useCoordinateTransform.ts           # NEW
└── components/
    ├── NeonTracingOverlay.tsx                # NEW
    └── InteractionHotspot.tsx                # NEW

apps/mobile/src/app/(app)/demo-scan.tsx       # MODIFIED: adopt hook + NeonTracingOverlay
apps/mobile/src/app/(app)/(tabs)/scan.tsx     # MODIFIED: adopt hook + NeonTracingOverlay + InteractionHotspot
apps/mobile/src/features/scan/components/     # SegmentationOverlay + BubbleMarker retired after parity
```

## Complexity Tracking

No violations — table intentionally empty.
