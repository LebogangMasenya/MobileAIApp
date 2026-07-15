# /lessons — Local Retrospective Log

This folder is the project's retrospective discipline in action (Constitution
v2.0.1, "Development Workflow & Quality Gates → Retrospective Discipline").
It preserves hard-won debugging context so a breakthrough never has to be
re-derived from scratch in a future development cycle.

## What belongs here

Document a lesson whenever a **non-obvious** breakthrough occurs, especially:

- **Build tooling**: Expo prebuild failures, Metro bundler quirks, EAS build
  surprises, Next.js/Vercel deployment gotchas.
- **Native-module conflicts**: CocoaPods version clashes, Swift module
  bridging errors (e.g., the `vision-segmentation` module), custom dev client
  linking issues.
- **Platform-specific quirks**: iOS-vs-Android behavioral differences,
  simulator-vs-device divergence, permission-flow edge cases.

Routine fixes (typos, obvious type errors, documented API usage) do **not**
belong here — the bar is "would a future developer plausibly lose an hour
rediscovering this?"

## How to write a lesson

Create one Markdown file per lesson, named `YYYY-MM-DD-short-slug.md`, using
this structure:

```markdown
# <One-line title of the breakthrough>

**Date**: YYYY-MM-DD
**Area**: build-tooling | native-modules | platform-quirk | api | animation | other

## Symptom
What was observed — exact error messages, misbehavior, affected commands.

## Root cause
The actual underlying cause once found (not the first theory).

## Fix
The concrete change that resolved it, with file paths / commands.

## Why it was non-obvious
What made this hard to diagnose — misleading errors, doc gaps, tool
version coupling. This is the part that saves the next person time.
```

## Index

| Date | Lesson | Area |
|------|--------|------|
| 2026-07-09 | [Expo Router typed routes go stale](2026-07-09-expo-router-typed-routes-stale.md) | build-tooling |
| 2026-07-09 | [Native tabs need a substack for fullscreen routes](2026-07-09-native-tabs-need-a-substack-for-fullscreen-routes.md) | platform-quirk |
| 2026-07-12 | [Spring perimeter trace without SVG](2026-07-12-spring-perimeter-trace-without-svg.md) | animation |
| 2026-07-13 | [expo-file-system new API](2026-07-13-expo-file-system-new-api.md) | api |
| 2026-07-13 | [Gesture handler root view](2026-07-13-gesture-handler-root-view.md) | native-modules |
| 2026-07-15 | [Observation-only gestures & SVG dash arcs](2026-07-15-observation-only-gesture-and-svg-dash-arcs.md) | animation |

Keep the index table above updated as lessons are added.
