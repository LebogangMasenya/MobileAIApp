# Research — 008 Smart Visual Search & Background Isolation

All unknowns from Technical Context resolved. Each entry: Decision /
Rationale / Alternatives considered. Repo facts verified 2026-07-15.

## R1 — On-device isolation engine

**Decision**: `@six33/react-native-bg-removal` (v1.3.4, verified live on
npm 2026-07-15) as the isolation engine, consumed through a NEW one-seam
module `services/subject-lift.ts` (the tactile.ts/device-store precedent) —
the only file importing the library. The seam exposes a capability probe
(`isAvailable()`), `liftSubject(uri) → { uri, bounds } | failure`, and maps
every library failure to a typed fallback signal.

**Rationale**: The package does exactly what the Master Guide intends —
iOS 17+ Vision (`VNGenerateForegroundInstanceMaskRequest` family) AND
Android MLKit Subject Segmentation, with API fallback support — so both
platforms get native-speed isolation from one dependency, which a custom
Swift Expo module would not give us (iOS-only, larger scope). Native module
⇒ dev-client rebuild; **batch with 007's still-pending rebuild (007 T002 has
not run — ios/Podfile.lock predates expo-haptics/svg/linear-gradient), so
one rebuild carries all four modules.**

**Verification duty (Constitution I / vault-store precedent)**: at
implementation time verify against installed types: Expo dev-client +
RN 0.81/New-Architecture compatibility, exact result shape (mask bounds
availability), and `trim` behavior. If the library proves incompatible, the
recorded fallback is a minimal custom Expo Module (Swift, iOS-only v1) with
Android using the manual-crop path — the seam means the swap touches one
file.

**Alternatives**: custom Swift Expo module (iOS-only, more scope, no
Android story); `@imgly/background-removal` (browser/ONNX — wrong runtime);
server-side removal on the API (ships the full photo off-device — worse
privacy/latency, and Render free tier has no GPU).

## R2 — Getting the isolated image to the matching provider

**Decision**: Extend the visual-search API with an upload flow. New
`POST /v1/visual-search` handling `multipart/form-data` (field `photo`,
PNG): the route stores the bytes in an in-process ephemeral store
(`services/visualSearch/uploadStore.ts`, TTL ≈ 5 min, LRU-capped), exposes
them at `GET /v1/visual-search/images/[id]` (public by construction on the
deployed origin — the 003 self-origin trick), passes that URL to the
provider, and returns matches in the same response. The existing
JSON `imageUrl` body remains supported (feature 003 demo path unbroken).

**Rationale**: The provider's lens engine only accepts a **publicly
fetchable URL** — it cannot ingest bytes — and the isolated PNG exists only
on the device. The deployed API (Render) is already a public origin, so
hosting the bytes for the provider's fetch window needs zero new
infrastructure. Ephemeral + tokened + TTL keeps user photos out of any
durable store (privacy: the image lives server-side for minutes, not
forever).

**Constraints acknowledged**: in-memory store assumes a single instance
(true on Render free/starter); a restart mid-request degrades to a designed
UPSTREAM_FAILED retry. Free-tier cold starts (~50s) surface as the designed
timeout/retry state, not a hang — the mobile pipeline copy must stay honest
during it (FR-008).

**Alternatives**: cloud object storage (new infra + secrets for a 5-minute
need — out of scope per spec); base64 into the provider (unsupported);
keeping URL-only API and uploading to third-party image hosts (sends user
photos to an uncontracted party — trust violation).

## R3 — The exactness signal (CL-003 made concrete)

**Decision**: Request the provider's lens engine with the section that
includes **exact matches** (`type=all` — the current provider module pins
`type=visual_matches`), and normalize provider-flagged exact results into
an `exact: true` field on ProductMatch. Only this flag may trigger the
US5 jackpot.

**Rationale**: CL-003 requires a provider-verifiable signal; the provider
exposes an exact-match result class distinct from visual matches. The
normalizer keeps its drop rules; `exact` defaults false.

**Verification duty**: confirm the exact response section name/shape
against the provider's live docs at implementation (the 003 "verified
against live docs" precedent) — if the account/engine tier doesn't return
an exact section, the jackpot stays dormant per FR-016 (a valid steady
state, by spec).

**Alternatives**: local title/brand heuristics — rejected by CL-003 (a
wrong jackpot is a trust defect); a second provider call per search just
for exactness — rejected: quota cost for data the single call can carry.

## R4 — Numeric prices for savings math (CL-002 made concrete)

**Decision**: Normalizer additionally reads the provider's numeric price
fields (`price.extracted_value`, `price.currency`) into optional
`price_value: number` / `currency: string` on ProductMatch; the verbatim
display string stays untouched. Savings math (pure util
`utils/price-anchor.ts`): anchor = highest `price_value` among matches
**sharing the modal currency of the result set**; label only when a match
is below anchor AND both prices are same-currency; anchor card and
<2-priced-match sets get no labels (FR-012/013).

**Rationale**: The current normalizer keeps only the display string —
doing arithmetic on `"$79.99*"` would be fabrication-by-parsing. The
provider ships numeric values; reading them keeps every percentage
arithmetically checkable (SC-005). Currency partitioning prevents nonsense
like 60%-off-because-yen.

**Alternatives**: parsing display strings — brittle, locale-dependent;
median anchor — rejected by CL-002.

## R5 — Staged progress that never lies (FR-006..008)

**Decision**: The pipeline hook (`useLiftSearch`) is a discriminated-union
state machine with four honest stages — `isolating` (on-device lift),
`preparing` (trim/encode), `matching` (upload + provider), `assembling`
(parse/first render) — driving a segmented progress bar: each segment
fills with a spring ONLY when its stage genuinely completes; the active
segment carries a breathing pulse (the 007 ScanPulseWave under-glow idiom)
so motion never stops while work is in flight, without faking percentages.

**Rationale**: The guide's `0–25% / 26–50%…` mapping invites a lying bar
(a stalled upload creeping to 50%). Segment-per-stage + in-stage breathing
satisfies the 1.5s never-static law (SC-001) with zero fabricated progress
(FR-008, SC-005). Springs per Constitution V; bar is transform-only
(Constitution III; the 007 VaultWelcomeJourney translateX-fill precedent).

**Alternatives**: continuous 0–100 bar eased across stages — rejected:
optimistic progress is dishonest progress; indeterminate spinner per stage
— rejected by FR-006 outright.

## R6 — The lasso trace (what can honestly be drawn before a mask exists)

**Decision**: While `isolating`, run the proven perimeter-trace treatment
(feature 004 NeonTracingOverlay idiom — spring-driven runner, stacked
translucent borders, no SVG path) around the photo card; the **lift
moment** (FR-003) fires on isolation completion: background layer fades
out under the isolated PNG while the subject springs to scale 1.05 with
one `confirm()` beat. True mask-contour tracing is recorded as a follow-up
(the 004 lesson's standing limitation).

**Rationale**: The guide's "dashed SVG mask path outlining the detected
object *while processing*" is impossible honestly — the mask doesn't exist
until isolation finishes. Perimeter trace is real feedback with a proven
60fps implementation. Mask→vector extraction (marching squares) is
main-thread JS work (Constitution III) for a decoration — deferred.

**Alternatives**: animate a fake blob outline — fabricated feedback,
rejected; post-isolation contour glow via SVG — possible now that
react-native-svg is installed, but costs a bitmap→path pass; recorded as
the same follow-up, not v1.

## R7 — Masonry cascade without a new dependency

**Decision**: Two-column masonry via a pure column-splitting function
(`utils/masonry-split.ts`: greedy shortest-column assignment using
thumbnail aspect ratio when the provider supplies dimensions, 1:1.2
default otherwise) rendering two vertical stacks inside the existing
scroll; cards enter with the house `FadeInDown.springify()` stagger,
per-card delay capped so cumulative stagger ≤ 640ms (FR-010) regardless of
result count.

**Rationale**: A masonry library (FlashList masonry etc.) is a new
dependency for one screen (Constitution IV); a greedy split is ~20 lines
of independently testable pure logic (Constitution VIII). Entering
animations don't reflow surrounding content — layout shift zero by
construction (SC-003).

**Alternatives**: `@shopify/flash-list` masonry — capable but a new native
dep + list rewrite for one surface; uniform FlatList grid — loses the
waterfall the spec's US2 asks for.

## R8 — Harmony score derivation (honest with the data we have)

**Decision**: Pure `utils/harmony.ts`: `harmonyScore(match, profile)` over
the existing 007 `deriveStyleProfile` output — components: category
affinity (match title/category tokens vs profile category weights) and
category complementarity (a small static complement table: e.g. tops ↔
bottoms/outerwear), normalized 0–100, deterministic. Rendered by a compact
`HarmonyRing` (single-arc variant of the 007 dash-offset idiom) that
springs to value on viewport entry. Gated: renders ONLY when
`profile.personalized` (FR-014); copy says "matches your recent scans",
never color claims (007 R8 precedent — colors stay a reserved field).

**Rationale**: Reuses the derivation the vault already trusts; identical
inputs → identical score (spec US4); empty/uncategorized vault → no ring
at all (honest absence).

**Alternatives**: color-profile comparison — no color data exists
upstream, would violate SC-005; server-side scoring — needless network for
a device-local derivation.

## R9 — Jackpot shimmer within the motion constitution

**Decision**: Shimmer = the 007 TactileTiltCard sheen mechanic promoted to
a border treatment: an `expo-linear-gradient` band inside the card's own
stacking context, translateX driven by a `withRepeat(withSequence(
withSpring…))` loop, playing a **bounded number of sweeps (~3)** on first
exposure then settling to a static "Exact match" badge; `celebrate()` beat
once per result set (tracked by result-set id). Reduce-motion: static
badge + the one-shot beat (information survives, rhythm doesn't).

**Rationale**: Constitution V bans linear offset loops; the spring-loop
sweep is the established house equivalent. Bounded sweeps keep the
"jackpot" a moment, not a strobe — and make "fires once per result set"
(spec US5) structural.

**Alternatives**: infinite shimmer loop — decoration that never ends
competes with every other card; Lottie confetti — new dep, non-interruptible.

## R10 — Manual crop fallback surface

**Decision**: `ManualCropMarquee` — a draggable/resizable rect overlay
(react-native-gesture-handler pan on corners/body, springs on release)
over the photo, cropping via the already-installed `expo-image-manipulator`
(~14.0.8); output joins the pipeline at `preparing` exactly like an
automatic lift (same IsolatedGarment shape, `method: 'manual'`). Entered
when: capability probe fails, isolation errors, or isolation returns a
degenerate result (mask bounds < 4% of image area — the spec's sliver
rule). Supportive copy per FR-005.

**Rationale**: expo-image-manipulator is installed (006) and rides the
same pending rebuild; a marquee is the universal floor for every platform/
OS the native lift doesn't reach. Gesture must ACTIVATE here (unlike 007's
observer tilt) — it's the surface's primary interaction, no arena conflict.

**Alternatives**: fixed center-crop with nudge buttons — imprecise,
frustrating (the guide's own critique of manual tools argues for direct
manipulation); skipping fallback (iOS 17+ only) — abandons Android and
older-iOS users entirely, violates FR-005.

## R11 — Hero presentation & where glass is allowed

**Decision**: The isolated garment renders on a solid dark elevated card
(`bg-header`-family token, rounded-3xl, native shadow ~offset {0,6} /
opacity 0.25) — NOT blur/glass. No glass anywhere on this surface.

**Rationale**: 007 motion-tactility §4 confines glass to camera-overlay
chrome over controlled dark backdrops; this results scene is an app
surface (lavender `bg-surface`), where glass is explicitly banned. A solid
dark card gives the transparent PNG its worst-case-proof contrast
(SC-008) at zero per-frame cost (Constitution III: no blur in a scene
with entering animations).

**Alternatives**: `backdrop-blur` frosted container (the guide's literal
recipe) — banned over `bg-surface` and blur-in-motion is a snapshot-per-
frame cost; light card — a white/transparent garment PNG dissolves on it.

## R12 — Route placement (CL-001 made concrete)

**Decision**: New full-screen route `app/(app)/visual-search.tsx` (the
demo-scan substack precedent — fullscreen routes live beside `(tabs)`),
entered from the existing Home card (DemoScanCard evolves into the
visual-search entry). The screen offers capture/import (expo-image-picker
+ expo-camera, both installed) AND a "try the sample" affordance that
preserves feature 003's demo behavior (empty-body request, server resolves
the demo image). `demo-scan.tsx` route is superseded by the new surface;
demo FRs stay honored through the sample path. Completed real searches
write a vault entry with a NEW `source: 'lift'` value (union extended in
both type copies).

**Rationale**: CL-001 chose the standalone surface evolving the demo
route; the substack layout for fullscreen flows is the recorded 2026-07-09
lesson. Extending the `source` union is additive (existing entries
unaffected; vault code switches on it nowhere destructively — verify at
implementation).

**Alternatives**: new tab — tab-bar real estate for an unproven surface;
embedding in scan flow — rejected by CL-001.
