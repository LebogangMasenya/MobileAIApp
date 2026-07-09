# NativeTabs can't host non-tab routes — nest a (tabs) group inside a Stack

**Date**: 2026-07-09 · **Feature**: 003-visual-search-api

## Symptom (caught at design time)

Feature 003 needed `/demo-scan` — a full-screen route in the signed-in area
that is **not** a tab. The signed-in group's layout was `NativeTabs` directly
(`src/app/(app)/_layout.tsx` → `<AppTabs />`), and `NativeTabs` renders only
the routes declared as `<NativeTabs.Trigger>` children. Dropping
`demo-scan.tsx` next to the tab screens would leave it undeclared — hidden or
broken, and definitely not a full-screen push over the tab bar.

## Fix — one extra nesting level

```text
src/app/(app)/
├── _layout.tsx          # Stack: screens "(tabs)" and "demo-scan"
├── (tabs)/
│   ├── _layout.tsx      # <AppTabs /> (NativeTabs) — moved down one level
│   ├── index.tsx        # Home
│   ├── scan.tsx
│   └── account.tsx
└── demo-scan.tsx        # full-screen sibling — pushes OVER the tab bar
```

Because route **groups don't affect URLs**, `/`, `/scan`, and `/account` are
unchanged — deep links, `router.push('/scan')` calls, and the root gate's
allowlist all kept working without edits. Only the typed-routes file needed
regenerating (see `2026-07-09-expo-router-typed-routes-stale.md`).

## Rule of thumb

If a screen should cover the tab bar (detail views, modals, flows), it must
be a **Stack sibling of the tab group**, not a file inside it. Plan the
`Stack → (tabs)` nesting from the start whenever a tabbed app will ever need
full-screen routes — retrofitting it is three `git mv`s and a typegen, but
only if you catch it before shipping paths elsewhere.
