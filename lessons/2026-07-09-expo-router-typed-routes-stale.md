# Expo Router typed routes go stale when you add/rename route files

**Date**: 2026-07-09 · **Feature**: 002-entry-funnel-dashboard

## Symptom

After restructuring `src/app/` into `(auth)`/`(app)` route groups, `tsc` failed
with errors like:

```text
error TS2322: Type '"/account"' is not assignable to type '... | "/explore" | "/" | "/scan" | ...'
```

The route *files* were correct — the app would have run fine — but TypeScript
rejected every `router.push('/sign-in')` / `href="/account"` referencing the
new routes, while happily accepting the **deleted** `/explore`.

## Cause

With `experiments.typedRoutes` enabled, expo-router generates the `Href` union
into `.expo/types/router.d.ts`. That file is only regenerated **while the dev
server runs** (`expo start` / `expo export`). Static checks (`tsc --noEmit`)
read whatever was generated last, so adding, moving, or deleting route files
without a running dev server leaves the types describing the *old* route tree.

## Fix / workflow rule

Regenerate before type-checking whenever the route tree changed. Briefly
booting the dev server is enough — the types are written within seconds of
startup:

```bash
npx expo start --offline   # wait a few seconds, Ctrl-C
npx tsc --noEmit
```

(In this session, scripted as: start `expo start` in the background, poll
`.expo/types/router.d.ts` for a new route name, kill the server.)

## Rule of thumb

If `tsc` rejects a route string that you can see exists under `src/app/`,
suspect stale typegen before suspecting the route — especially right after a
route-group restructure, when *every* path looks "wrong" to the checker.
