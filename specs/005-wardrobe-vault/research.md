# Research: Wardrobe Vault + Hotspot Rendering Fix

**Date**: 2026-07-12 · **Feature**: 005-wardrobe-vault

## 1. Hotspot regression — root-cause hypothesis (FR-003)

- **Static evidence (code inspected)**: `InteractionHotspot` declares no `zIndex` anywhere; the hotspot layer's visibility relies entirely on **sibling render order** (hotspots are rendered after the trace in JSX). No ancestor on the scan screen declares `overflow`, and platform defaults differ (Android clips absolutely-positioned children outside parent bounds; iOS doesn't).
- **Primary hypothesis**: RN 0.81 runs the **New Architecture (Fabric)** by default on SDK 54. Under Fabric, siblings that animate `transform`/`opacity` (the neon trace's glow layer does both, continuously) get promoted in ways that can paint them **above later siblings that lack an explicit `zIndex`** — implicit document-order stacking is not a contract there. The hotspots also *start at opacity 0* (spring-driven entrance), so any stacking mis-order during their entrance window reads as "never appeared".
- **Secondary hypothesis**: on Android, edge-clamped hotspots' sonar rings (scaling to ~1.9×) extend past the container and are clipped; combined with the primary issue this makes hotspots invisible or partial.
- **Decision**: implement the user-directed hardening as the fix *and* the structural correction: explicit `zIndex` bands for the overlay stack — trace low (z-10 equivalent), hotspot layer high (z-50 per directive) — plus explicit `overflow: 'visible'`/non-clipping wrappers on every ancestor between screen root and the hotspot layer. On-device confirmation (which hypothesis actually reproduced) is a quickstart step; the retrospective entry records the confirmed cause.
- **Alternatives considered**: reordering JSX only — rejected: it's the fragile implicit contract that broke; explicit z-bands make stacking a stated invariant.

## 2. expo-file-system — the one new dependency

- **Decision**: install `expo-file-system` via `npx expo install expo-file-system` (SDK-54-matched version) and use the **new object API** (`File`, `Directory`, `Paths` from the package root — SDK 54 made this the default; the old functional API moved to `expo-file-system/legacy`). Per `apps/mobile/AGENTS.md`, the installed package's own types/docs are verified at implementation time before any code is written.
- **Consequences**: native module → **dev-client rebuild required** (`npx expo run:ios`) — explicitly accepted by the user in the spec. This deliberately ends the zero-new-deps streak.
- **Layout**: `Paths.document/vault/images/<id>.jpg` for image files; `Paths.document/vault/index.json` for metadata. Document storage is the OS-purge-safe, backed-up location; caches are exactly what we're escaping (FR-004).
- **Alternatives considered**: keep abusing SecureStore (002/003 pattern) — rejected: ~2KB Android ceiling can't hold match arrays, and images can't live there at all; expo-sqlite — rejected: a query engine for a newest-first list is over-machinery (Anti-Abstraction); AsyncStorage — not installed, no file support, solves nothing SecureStore doesn't.

## 3. Metadata store shape

- **Decision**: one versioned JSON index (`{ v: 1, entries: VaultEntry[] }`) read/written whole, entries embedding their `ProductMatch[]`. Reads never throw (corrupt file ⇒ designed error state, per-entry validation drops bad records); writes are read-modify-write with the image durably placed **before** its metadata lands (FR-007's no-half-entries rule).
- **Rationale**: scale honesty — a personal scan history is tens-to-hundreds of small records; whole-file JSON with runtime guards is the same proven pattern as the recent-scans store, minus its size ceiling. When entries someday need pagination/search, that's the SQLite upgrade moment, and `useVaultEntries` is the single swap point (Constitution VIII).
- **ID generation**: collision-safe random id (timestamp + random base36 — the established `randomId` pattern from the mock auth provider); satisfies the spec's "UUID" intent without adding expo-crypto.

## 4. Write-path integration (when entries are born and grow)

- **Decision — move at capture-hand-off**: the scan screen persists the photo **before submission**: `submitPhoto` moves the temp capture/import file into the vault images directory and proceeds with the permanent URI everywhere (display, upload, Home-rail summary, vault entry). This makes FR-004's "move, not copy-and-forget" trivially true, and fixes the latent dangling-thumbnail bug (the Home rail currently stores temp-cache URIs).
  - Scan fails / user resets without a completed session → best-effort delete of the moved file (no entry was written, so no orphan record; the file cleanup keeps the directory honest).
- **Entry creation**: on scan `ready`, alongside the existing `RecentScanSummary` write. **Match merging**: `useGarmentMatches` success (001 flow) normalizes results and merges them into the entry by scan id (FR-005); the demo flow (003) merges its `ProductMatch[]` on `done`.
- **Demo-scan entries**: the demo image is a bundled asset, not a movable file, and `expo-asset` is not installed (verified) — so demo entries store the **publicly hosted demo image URL** as their image reference. expo-image disk-caches it after first render; the hard offline guarantee (SC-002 airplane test) is stated for camera entries. Recorded as a documented caveat rather than adding a dependency for one demo case.
- **Alternatives considered**: moving at scan-`ready` inside the hook — rejected: the screen still holds the temp URI for display/retry, and a hook can't swap screen state (the mid-session URI split is exactly how subtle bugs are born).

## 5. Match-shape adapters (the canonical-ProductMatch decision, spec Assumptions)

- **Decision**: two small pure adapters in the vault feature:
  - `matchedProductToProductMatch` (001 → canonical): `title`, `ctaUrl → source_url`, `imageUrl → thumbnail`, `store.name → store_name`, `Price {amount, currency} → display string` (`"$79.99"` — currency is a symbol in 001's data), null-safe.
  - `productMatchesToModalState` (canonical → `GarmentDetailModal`'s expected matches-state): all entries as similar-item cards with best-effort display; the modal's retry affordance is not wired for vault entries (there is nothing to refetch — data is local).
- **Rationale**: the modal is the user-mandated reuse surface; adapters at the edges keep both existing type systems untouched. Lossiness (rich 001 fields dropped at write; display-string price not re-parsed) was accepted at spec review.

## 6. Vault reveal gesture architecture

- **Decision**: the vault lives **inside the scan tab** as an overlay pair managed by one `VaultRevealContainer` around the scan screen's capture state: the vault sheet sits above the viewport (translateY −100%), a `Gesture.Pan` (react-native-gesture-handler, already installed) on the top pull-affordance strip drives a `progress` shared value 0→1 tracking the finger 1:1; release springs to open/closed judged on **position + velocity**; the same pan (inverted) and a close affordance dismiss. Scan content subtly scales/dims with progress for depth (Shazam's parallax cue).
- **Arming rule (FR-011)**: the pan handler is attached only in the capture phase (`photo == null`, no modal/failure overlay); review-phase gestures and camera controls are untouched — the affordance strip sits above the camera controls' safe area.
- **Interruptibility**: position is gesture/spring-owned the whole time (`VaultRevealState` is the shared value, never a boolean) — a re-catch mid-flight follows from the current position (Constitution V; the same state-owns-position principle as the 002 gate).
- **Alternatives considered**: a `/vault` route with a custom transition — rejected: router transitions don't hand mid-flight control back to the finger the way a local pan does, and the spec's Shazam feel is precisely that hand-off; a fourth tab — rejected by spec assumption (tab structure unchanged).

## 7. Grid performance (SC-005)

- **Decision**: `FlatList` two-column grid with fixed-size cells; expo-image with explicit cell-size styles (it downsamples decoded bitmaps to the rendered size) + `recyclingKey`; entrance stagger capped (first ~6 cells) exactly like the 003 card list.
- **Alternatives considered**: ScrollView grid — rejected: no virtualization at 50+ entries; generating separate thumbnail files — deferred: expo-image's downsampling covers SC-005 without a second file pipeline.

## Sources

- Code inspection 2026-07-12: `InteractionHotspot.tsx`, `NeonTracingOverlay.tsx`, `scan.tsx` (no zIndex/overflow declarations — the regression grounding)
- Expo SDK 54 changelog / expo-file-system docs — new `File`/`Directory`/`Paths` API default, legacy import path (to be re-verified against the installed package's own `.d.ts` per `apps/mobile/AGENTS.md`)
- Dependency-tree checks 2026-07-12: `expo-file-system` absent (install required), `expo-asset` absent (demo-entry decision §4)
- Feature 001 `GarmentDetailModal`/`useGarmentMatches` and 002 `recent-scans-store` — reuse surfaces and store-pattern precedent
