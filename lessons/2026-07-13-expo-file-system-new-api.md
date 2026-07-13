# expo-file-system's SDK-54 API: synchronous, throwing, and move() mutates

**Date**: 2026-07-13 · **Feature**: 005-wardrobe-vault

Verified against the installed `expo-file-system ~19.0.23` types (per the
`apps/mobile/AGENTS.md` "read the installed docs first" rule). Three things
that differ from the old (`/legacy`) API most training examples show:

1. **The object API is the default import** — `File`, `Directory`, `Paths`
   from the package root; the old promise functions live at
   `expo-file-system/legacy`. `Paths.document` / `Paths.cache` are
   `Directory` instances, and constructors compose:
   `new File(Paths.document, 'vault', 'index.json')`.
2. **Most methods are SYNCHRONOUS and THROW** — `create()`, `write()`,
   `move()`, `delete()` are not promises; only `text()` (and downloads) are
   async. Every call needs try/catch if the caller must not crash;
   `create({ intermediates: true, idempotent: true })` makes directory
   bootstrapping repeat-safe.
3. **`move()` mutates the instance** — after `source.move(destination)`,
   `source.uri` points at the NEW location. Convenient (`return source.uri`)
   but surprising if you kept the old URI string around expecting it to stay
   valid.

House rule applied: exactly one module (`src/services/vault-store.ts`)
touches this API — the same one-seam-per-backend pattern as
`device-store.ts` for SecureStore — so the throw-happy surface is contained
behind non-throwing, discriminated results.
