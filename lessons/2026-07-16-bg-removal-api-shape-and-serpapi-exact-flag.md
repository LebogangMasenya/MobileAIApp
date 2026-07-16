# Verify-against-installed beats verify-against-plan: bg-removal's real API and SerpApi's real exact signal

**Date**: 2026-07-16 · **Feature**: 008 Smart Visual Search · **Tasks**: T001, T006, T010

Two planning-time assumptions were wrong in ways only implementation-time
verification (Constitution I's named duties R1/R3) could catch. Both were
absorbed without touching the architecture — which is exactly what the
one-seam and one-provider-file patterns are for.

## 1. `@six33/react-native-bg-removal` returns a URI, not a mask

The plan's seam contract assumed `liftSubject(uri) → { uri, bounds }`. The
installed 1.3.4 types say otherwise:

- `removeBackground(imageURI, { trim }) → Promise<string>` — **URI only, no
  mask bounds anywhere.**
- **The honest adaptation**: with `trim: true` (default), the output PNG is
  cropped to the subject's bounding box — so the *output image's pixel
  dimensions ARE the mask bounds* for the degenerate-sliver rule's purpose.
  `isDegenerateLift()` compares trimmed-output area to source area (<4% ⇒
  failure → manual crop). Measured via RN's promise overload
  `Image.getSize(uri): Promise<ImageSize>` (exists in RN 0.81 — check the
  installed `Image.d.ts`, older docs only show the callback form).
- **Simulator trap**: on iOS simulators the library "succeeds" by returning
  the ORIGINAL input URI unchanged (with a console.warn). If the seam didn't
  detect `result === input` and map it to `failed`, every simulator run
  would silently search the un-isolated photo — a wrong-but-green path. Real
  devices only for lift testing.
- iOS < 17 rejects with `Error('REQUIRES_API_FALLBACK')` → mapped to
  `unsupported` (different supportive copy than a per-photo failure).
- New Architecture: fine — TurboModule spec + `codegenConfig` present.

## 2. SerpApi Google Lens: exactness is a per-entry flag, not a section

The plan (R3) assumed exact matches arrive as a separate response section
under `type=all`. The live docs (verified 2026-07-16) say:

- `type=all` is valid — and is the **default**.
- There is **no `exact_matches` response section**. Exactness is a boolean
  `exact_matches: true` on individual `visual_matches` entries (plus a
  `serpapi_exact_matches_link` we ignore).
- Numeric price fields confirmed: `price.extracted_value` (float) +
  `price.currency` (string — a symbol like `"$"`, NOT an ISO code; the
  currency-partition logic treats it as an opaque grouping key, which is why
  that design survives).
- `thumbnail_width` / `thumbnail_height` confirmed as integers.

So the normalizer change was smaller than planned: same single pass over
`visual_matches`, `exact: true` set from the entry's own flag. CL-003's
"provider-flagged only" rule got *easier* to honor, not harder.

## 3. Vault `source` union extension has a silent kill switch

Adding `'lift'` to `VaultEntry.source` compiles fine — and then
`vault-store.ts`'s `isVaultEntry()` validator **drops every `'lift'` entry
on read** because it whitelists source values. Any future source value must
be added in BOTH places or entries vanish without an error anywhere. (This
was T005's verification step; it fired.)

## Takeaway

A recorded "verify against installed types / live docs at implementation
time" duty is not ceremony — all three findings above were invisible at
plan time and would each have shipped a silent defect. Write the duty into
the plan; discharge it before writing the dependent code.
