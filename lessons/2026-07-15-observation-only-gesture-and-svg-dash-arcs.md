# Observation-only gestures, and animating SVG arcs the cheap way

**Date**: 2026-07-15 · **Feature**: 007-ui-ux-overhaul

## Problem 1: card tilt that can NEVER steal scroll/tap/long-press

The obvious `Gesture.Pan()` tilt recipe competes in the gesture arena — the
classic failure where a tilting card hijacks the FlatList scroll and eats the
long-press-delete. Tuning `activeOffset`/`failOffset` thresholds trades one
glitch for another.

## Technique (see `TactileTiltCard.tsx`)

Use **`Gesture.Manual` as a pure observer**: implement
`onTouchesDown/Move/Up/Cancelled` to drive `rotateX/rotateY` shared values,
and **never call `activate()`**. A manual gesture that never activates never
competes in the arena, so:

- a vertical drag becomes the list's scroll exactly as before — the scroll's
  take-over fires `onTouchesCancelled`, which is your cue to spring to rest;
- taps and long-presses on the wrapped Pressable fire untouched;
- FR-level "never captures scroll" guarantees hold **by construction**, not
  by tuned thresholds.

Gotcha: `perspective` must be the FIRST entry in the transform array or the
rotations flatten into 2D skews.

## Problem 2: three gapped round-cap ring arcs that sweep closed

Border-radius tricks cannot draw a gapped, round-capped arc — this is what
finally justified the react-native-svg rebuild (reversing the 2026-07-12
"no SVG" decision; its stated condition arrived).

## Technique (see `DailyCycleRing.tsx`)

Each segment is a full `Circle` carrying
`strokeDasharray = [segmentLength, circumference]` — one dash, then blank
past a full lap, so exactly one arc is visible. Rotate each circle into its
120° slot, then animate `strokeDashoffset` (segmentLength → 0) through
`Animated.createAnimatedComponent(Circle)` + `useAnimatedProps`. The sweep
is a UI-thread prop update — the SVG equivalent of a transform, no per-frame
JS. Spring the offset and the arc *sweeps closed*.

Mount rule worth keeping: seed the shared value to its stored state on first
render and only animate changes that happen *while watching* — otherwise
every app launch replays (and re-haptics) yesterday's achievements.

## Reanimated 4 sweep

`runOnJS` is deprecated in v4 — worklet→JS hops are
`scheduleOnRN(fn)` from `react-native-worklets` (note: takes the function,
not `runOnJS(fn)()`-style currying). A repo-wide grep caught a pre-007
straggler in `GarmentDetailModal`; worth re-running after any animation work:
`grep -rn "runOnJS" src` should return comments only.
