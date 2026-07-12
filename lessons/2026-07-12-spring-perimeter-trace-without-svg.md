# A seamless "path tracing" light without react-native-svg

**Date**: 2026-07-12 · **Feature**: 004-interactive-scan-overlay

## Problem

We wanted an SVG-style neon trace running around a region, but adding
react-native-svg means a native module + dev-client rebuild, and the
constitution bans `Easing.linear` — the obvious `withTiming` loop was out
twice over.

## Technique (see `NeonTracingOverlay.tsx`)

One shared value owns the whole circuit:

```ts
lap.value = withRepeat(
  withSequence(withSpring(1, S), withSpring(2, S), withSpring(3, S), withSpring(4, S)),
  -1, false,
);
```

- **One spring per edge** — each leg eases through its corner physically;
  no linear velocity anywhere.
- **Quarter ownership** — four absolutely-positioned "runner" bars each map
  `lap ∈ [start, start+1]` to a translate along their edge and fade out
  outside their quarter (`interpolate(local, [-0.08, 0.08, 0.92, 1.08], [0,1,1,0])`),
  so consecutive edges cross-fade through corners instead of blinking.
- **Seamless restart** — position at `lap = 4` is identical to `lap = 0`,
  so `withRepeat`'s hard reset is invisible.
- **Direction** — reverse the interpolation on the bottom/left legs or the
  light ping-pongs instead of circling.
- **Interruptible pause** — runner opacity multiplies by `(1 - settled.value)`
  where `settled` is itself spring-driven, so a mode change mid-lap fades the
  runner from wherever it is.

Cost: 4 transforms + 2 static translucent border layers (fake glow — no
native blur, which forces per-frame view snapshots).

## Limitation

The trace follows the region's **bounding rectangle**, not the garment
silhouette — true contour pathing still needs SVG/Skia. Recorded as the
follow-up in specs/004 plan.md.

## Bonus gotcha (same session)

`eslint-disable-next-line` comments naming a rule the installed plugin
doesn't define (`react-hooks/immutability`) are themselves lint **errors**
("Definition for rule … was not found"). Stale disables from another plugin
version must be deleted, not carried.
