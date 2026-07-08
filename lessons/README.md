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
| _(none yet)_ | | |

Keep the index table above updated as lessons are added.
