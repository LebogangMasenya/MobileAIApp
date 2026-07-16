# Quickstart — 008 Smart Visual Search (device verification)

Motion/haptic/gesture/isolation acceptance runs on a **real iPhone**
(iOS 17+ for the lift path; keep one older device or the simulator for the
fallback pass). Contracts: [pipeline](./contracts/pipeline.md),
[search-api](./contracts/search-api.md),
[match-presentation](./contracts/match-presentation.md).

## Prerequisites (one-time)

```bash
cd apps/mobile
npx expo install @six33/react-native-bg-removal   # or npm i — verify Expo compat first (R1)
npx expo run:ios --device   # ONE rebuild — also carries 007's still-pending native modules
```

- API side: deploy/run apps/api with `SERPAPI_API_KEY` set (mock providers
  do not serve this feature's provider — the visual-search route calls the
  real provider; budget quota for ~30 searches across these passes).
- Physical-device note: point `EXPO_PUBLIC_API_URL` at a reachable API (the
  Render deployment, or the LAN IP dev setup).
- Quality gate before any pass: `npm run lint` + `npx tsc --noEmit` in BOTH
  apps/mobile and apps/api — zero errors.

## Pass 1 — Subject Lift & pipeline (US1 → SC-001, SC-002, SC-007)

1. Home → visual-search card → capture a garment against a busy background.
2. During isolation: perimeter trace runs (no static spinner); on
   completion the background drops, the garment pops ~5% with ONE medium
   beat, then settles on the dark hero card.
3. Watch the 4-segment bar: segments fill ONLY as stages complete; the
   active segment breathes; stage copy matches the four contract strings;
   nothing static >1.5s while in flight (SC-001) across 10 scans including
   one throttled-network run.
4. First visible feedback <1s from initiating; median time to first match
   <10s on normal network (SC-002).
5. Kill the network during `matching`: designed retryable failure, and
   retry does NOT replay the trace/lift (garment preserved, FR-009).
6. Photo of a plain wall: "nothing to lift" → manual crop path offered.
7. SC-007 spot check: for 10 test garments, compare match relevance of the
   isolated-image search vs the same photo un-isolated (temporary dev
   toggle or manual URL search) — isolated wins by majority judgment.

## Pass 2 — Fallback floor (US1 → SC-004)

1. On a device/sim WITHOUT the capability (Android emulator, older iOS, or
   probe force-failed via dev toggle): initiating search lands on the
   manual crop marquee with the supportive copy — never a crash.
2. Marquee: drag body, resize corners (fingers, not pixels — 44pt), rect
   clamps to image, release settles with a spring; confirm → pipeline
   continues from `preparing`; cancel → back to capture, nothing marked.
3. 20 attempts through the manual path: 100% complete or fail gracefully
   (SC-004).
4. Web (`npm run web`): probe reports unavailable; import + manual crop
   (or import-only) works; zero crashes.

## Pass 3 — Cascade & hero (US2 → SC-003, SC-008)

1. Search returning ≥8 matches: two-column waterfall entry, cumulative
   stagger ≤640ms, zero shift of already-visible content (watch the hero
   and progress bar during entry) — 10 result sets of varied sizes
   (SC-003).
2. Hero contrast: white garment, black garment, busy-pattern garment — all
   legible on the dark hero card in bright light (SC-008).
3. Zero matches (obscure object): designed no-matches state, not a blank
   wall; scroll performance stays smooth on a 20-match wall.

## Pass 4 — Savings labels (US3 → SC-005)

1. Result set with ≥2 priced matches: cheaper cards show "{X}% less than
   comparable retail"; hand-verify the arithmetic on 5 cards against the
   two displayed prices (SC-005 audit).
2. The highest-priced (anchor) card carries NO label.
3. A set with <2 priced matches (or mixed currencies only): zero labels
   anywhere.
4. A match with a display price but no numeric value: renders its price
   string, never a savings claim.

## Pass 5 — Harmony ring (US4 → SC-005)

1. With a vault of ≥5 categorized looks: match cards show the ring
   springing to value on first viewport entry; number equals arc fill; a
   complementary-category match scores higher than an unrelated one; same
   result set re-rendered → identical scores.
2. Fresh install (empty vault): NO ring, NO coordination copy anywhere
   (honest absence).
3. Copy audit: nothing claims color intelligence.

## Pass 6 — Perfect match (US5)

1. Search a mass-market recognizable item (likely to return provider exact
   matches): exact card(s) show the badge; the shimmer plays ~3 sweeps and
   settles; ONE celebrate beat for the whole result set on first exposure.
2. Scroll away and back: badge persists, shimmer/beat do NOT re-fire.
3. A result set with no provider exact section: no jackpot anywhere —
   dormant is correct (CL-003).

## Pass 7 — Reduce-motion & accessibility sweep (SC-006)

Reduce Motion ON, re-run passes 1–6 abbreviated: trace → static boundary;
segment breathing off (copy + discrete fills remain); lift scale flourish
off but confirm beat present; cascade → plain fades; ring static at value;
shimmer → static badge + celebrate beat. Every flow completable with
equivalent information; zero repeating animations.

## Cross-check

- Zero `Easing.linear`, zero `runOnJS` (v4 — `scheduleOnRN` only), zero
  haptics imports outside services/tactile.ts, zero bg-removal imports
  outside services/subject-lift.ts, zero hex literals in new components.
- API: uploaded image GET 404s after TTL; nothing written to disk on the
  server; SERPAPI key never logged.
- Update /lessons on any rebuild/native-module/provider-shape breakthrough
  (Retrospective Discipline).
