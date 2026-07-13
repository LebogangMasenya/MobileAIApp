# GestureDetector needs a GestureHandlerRootView — expo-router won't give you one

**Date**: 2026-07-13 · **Feature**: 005-wardrobe-vault (build error on device)

## Symptom

First launch after adding the vault pull gesture:

```text
Error: GestureDetector must be used as a descendant of GestureHandlerRootView.
```

Thrown at mount of the first `GestureDetector` in the main view hierarchy.

## The two rules

1. **The app root needs one** `GestureHandlerRootView` (ours now lives at the
   top of `src/app/_layout.tsx`). expo-router does **not** wrap the tree for
   you — don't assume a framework provides it until the error proves it did.
2. **Every RN `Modal` needs its own** — a Modal creates a separate native
   view hierarchy, so the root-level wrapper doesn't reach inside it.
   `GarmentDetailModal` (feature 001) already did this correctly, which is
   why its pan-to-dismiss worked for weeks while the app root had no wrapper:
   the requirement only surfaces where a detector actually mounts.

## Bonus (same session)

Reanimated 4 deprecates `runOnJS` — worklet→JS calls go through
`scheduleOnRN` from `react-native-worklets` (the codebase already used it in
the splash overlay; the vault container now matches).
