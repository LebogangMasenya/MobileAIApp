# Feature Specification: Smart Visual Search & Background Isolation — Subject Lift, Live Pipeline & Match Presentation

**Feature Branch**: `008-smart-visual-search`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Smart Visual Search & Background Isolation Master Guide — on-device Subject Lift garment segmentation, cloud visual-matching pipeline, staged progress feedback, cascading match presentation, price contrast anchoring, Harmony Score, Perfect Match jackpot, glass presentation of isolated garments, and graceful degradation to manual cropping on unsupported devices."

## Scope note *(how this relates to what already exists)*

The app already has (a) a person-outfit scan flow that detects people and
garments in a photo and fetches store matches per garment, and (b) a
visual-search backend demo (feature 003) that sends one image to a visual
matching provider and returns product results. This feature adds the missing
middle: the garment is **visually isolated from its background on the device
itself** before matching, the whole pipeline becomes **visible and alive**
instead of a spinner, and the results become a **designed shopping moment**
(cascade, price framing, wardrobe harmony, exact-match celebration) instead
of a plain list.

The Master Guide's literal implementation recipes (specific animation
libraries/curves, a specific background-removal package, raw haptic calls)
are treated as **intent, not instruction** — this spec captures the intended
user experience; implementation idioms are resolved at the plan/research
phase against the house motion and haptic contracts already in force
(features 004/007 precedent).

## Clarifications

### Session 2026-07-15

- **CL-001** (flow placement): Standalone surface — its own entry point
  evolving the feature-003 demo route into the real end-to-end experience;
  the person-outfit scan flow is untouched. → FR-017
- **CL-002** (retail anchor): Savings labels anchor to the highest-priced
  comparable match in the returned set, with copy that says so honestly;
  no fabricated MSRP. → FR-012
- **CL-003** (exact-match signal): The jackpot fires only on an explicit
  provider exact-match flag; no local similarity heuristic; tier stays
  dormant if the signal is absent. → FR-016

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subject Lift & Visible Match Pipeline (Priority: P1) 🎯 MVP

A user points the app at a garment (or imports a photo of one). The garment
is visually "lifted" out of its background right on their device — a moving
outline traces the detected subject while isolation runs, and at the instant
the background drops away the garment separates with a small physical
emphasis (subtle scale + a felt confirmation). The isolated garment is then
matched against global visual catalogs, and the user watches the pipeline
progress through named, truthful stages — never a frozen spinner — until
matches arrive.

**Why this priority**: This is the feature's reason to exist: isolation +
visible matching is the new capability everything else decorates. It is
independently shippable and delivers the core "found it" value alone.

**Independent Test**: On a supported device, photograph a garment against a
busy background: the outline traces during isolation, the lift moment lands
with a felt beat, stage copy advances through the pipeline phases, and
product matches appear. On failure at any stage, the user gets a designed
recovery path — never a crash or a dead end.

**Acceptance Scenarios**:

1. **Given** a supported device and a photo containing a clear garment,
   **When** the user initiates visual search, **Then** a moving outline
   appears around the detected subject while isolation runs, and the
   isolated garment visibly separates from its background with a single
   confirmation beat at the moment of separation.
2. **Given** isolation has completed, **When** the matching pipeline runs,
   **Then** the user sees stage-specific progress copy that advances with
   the actual pipeline phases (isolating → preparing image → matching
   catalogs → assembling results), and no visual state remains unchanged
   for more than 1.5 seconds while work is in flight.
3. **Given** the isolated garment image, **When** it is prepared for
   matching, **Then** dead space around the subject is trimmed automatically
   and the framing tightens to the garment bounds — the user never operates
   a manual cropping tool on the happy path.
4. **Given** a device where on-device isolation is unavailable or isolation
   fails on a particular photo, **When** the user initiates visual search,
   **Then** the app switches to a manual crop selection with supportive
   copy (e.g., "Using manual precision crop for optimal visual matching")
   and the pipeline continues from the manual selection — never a crash,
   never a silent dead end.
5. **Given** a network drop mid-pipeline, **When** a stage cannot complete,
   **Then** the user sees a designed, retryable failure state that preserves
   the isolated garment so retry does not repeat the isolation work.

---

### User Story 2 - The Cascading Match Wall (Priority: P2)

When matches arrive, they do not pop in all at once or shove the layout
around. Cards cascade onto the screen in a smooth, staggered waterfall, and
the isolated garment itself is presented on a high-contrast, elevated
surface so a transparent-background image never washes out against whatever
is behind it.

**Why this priority**: Presentation is the trust moment — results that jump
and shift read as broken, and an isolated garment that visually dissolves
into the backdrop undermines the "lift" the user just watched.

**Independent Test**: Trigger a search returning ≥8 matches: cards enter as
a staggered cascade that finishes within the stagger budget, with zero
layout shift of already-visible content; the isolated garment reads clearly
against light, dark, and image-rich backdrops.

**Acceptance Scenarios**:

1. **Given** a set of returned matches, **When** results render, **Then**
   cards enter with a staggered cascade whose cumulative stagger never
   exceeds 640ms, and previously visible content does not shift or reflow
   as cards arrive.
2. **Given** an isolated garment displayed over an image-rich backdrop,
   **When** the results scene renders, **Then** the garment sits on a
   high-contrast dark translucent surface with a visible elevation cue, and
   remains clearly legible over worst-case backgrounds.
3. **Given** the system reduce-motion setting is ON, **When** results
   render, **Then** cards appear with the calm equivalent (simple fades, no
   staggered motion) and all information remains identical.

---

### User Story 3 - Price-Advantage Framing (Priority: P3)

Matched products that cost less than the reference price for the scanned
garment are framed as smart shopping wins — "Alternative found for X% less
than retail" — turning a plain product list into a savings story.

**Why this priority**: It is the emotional hook on top of working search —
valuable, but meaningless until US1/US2 exist.

**Independent Test**: With matches whose prices and a reference price are
both known, cheaper matches carry a percentage-savings label whose math is
verifiable; matches without trustworthy price data carry no claim at all.

**Acceptance Scenarios**:

1. **Given** a match with a known price below the garment's reference
   price, **When** its card renders, **Then** it shows a relative savings
   label whose percentage is arithmetically correct for the two prices
   shown.
2. **Given** a match with no reliable price data (or no reference price is
   determinable), **When** its card renders, **Then** no savings claim
   appears — absence of data is never dressed up as a deal.

---

### User Story 4 - Wardrobe Harmony Score (Priority: P4)

Each match card can show how well the item coordinates with the user's
existing saved wardrobe — a 0–100 "Harmony" ring that fills as the card
enters view, giving the user a personal reason to explore matches beyond
price.

**Why this priority**: Retention/exploration mechanic that depends on both
working search (US1/US2) and an established vault history to be meaningful.

**Independent Test**: With a vault containing several categorized looks, a
match in a complementary category shows a higher harmony value than an
unrelated one; with an empty vault, no harmony claim is shown at all.

**Acceptance Scenarios**:

1. **Given** a user with saved wardrobe history, **When** a match card
   enters the viewport, **Then** its harmony ring animates to a score
   derived only from that user's actual stored garments, with the
   derivation stable for identical inputs.
2. **Given** a user with an empty or uncategorized vault, **When** match
   cards render, **Then** no harmony score appears — the app never scores
   coordination against a wardrobe it does not know.

---

### User Story 5 - The Perfect Match Moment (Priority: P5)

When a returned match is an exact duplicate of the scanned garment, the card
gets a jackpot treatment — a shimmering border moment and a distinct success
haptic on first exposure — making a true find feel like hitting the jackpot.

**Why this priority**: Pure delight layered on established mechanics; last
because it needs a trustworthy "exactness" signal before it can ever fire.

**Independent Test**: Force a known exact-duplicate result: the jackpot
treatment plays once on first card exposure with the success haptic; ordinary
close matches never trigger it.

**Acceptance Scenarios**:

1. **Given** a match that qualifies as an exact duplicate, **When** its card
   first becomes visible, **Then** the shimmer moment plays and a success
   haptic fires exactly once per result set — repeat scrolling past the same
   card does not re-fire it.
2. **Given** the reduce-motion setting is ON, **When** an exact match
   appears, **Then** the card carries a static "Exact match" distinction and
   the one-shot success haptic still fires (information, not decoration).

---

### Edge Cases

- Photo contains no detectable garment/subject at all → isolation reports an
  honest "nothing to lift" state offering the manual crop path or a new
  photo, never an empty result.
- Photo contains multiple garments → isolation targets the dominant subject;
  the manual path remains one tap away for the user who wanted the other
  item.
- Isolation succeeds but produces a degenerate result (sliver mask, near-
  empty image) → treated as isolation failure: manual crop fallback, not a
  garbage search.
- App backgrounded or interrupted mid-pipeline → pipeline either resumes or
  fails to the designed retry state; the isolated garment is not lost.
- Zero matches returned → a designed "no matches" result (feature 003
  precedent: no matches is a result, not an error).
- Provider outage / rate limit mid-search → graceful upstream-failure state
  distinct from the user's own network failure, with retry.
- Very slow network → staged progress keeps moving between stages honestly;
  the stage copy never claims a phase that has not actually begun.
- Reduce-motion ON end-to-end → every flow completable with equivalent
  information; repeating/rhythmic effects (outline trace, shimmer, pulsing
  ring) replaced by calm static equivalents; one-shot confirmation beats
  remain.
- Device storage/permission failure while preparing the image → designed
  failure state, scanning surface never crashes.

## Requirements *(mandatory)*

### Functional Requirements

**Isolation (Subject Lift)**

- **FR-001**: On capable devices, the system MUST visually isolate the
  dominant garment/subject from a photo's background on the device itself,
  producing a transparent-background image of the subject.
- **FR-002**: While isolation runs, the system MUST display a moving outline
  tracing the detected subject region, replaced by a calm static boundary
  treatment when reduce-motion is on.
- **FR-003**: At the moment the background visually drops away, the system
  MUST land the "lift" with a single physical emphasis: a subtle scale-up of
  the isolated subject synchronized with one confirmation haptic beat.
- **FR-004**: Before matching, the system MUST automatically trim empty
  margins around the isolated subject and tighten framing to the subject
  bounds, so the user performs no manual cropping on the happy path.
- **FR-005**: On devices where on-device isolation is unavailable, or when
  isolation fails or produces a degenerate result, the system MUST fall back
  to a manual crop selection with supportive micro-copy, and the remainder
  of the pipeline MUST work identically from the manual selection.

**Pipeline visibility (the "never freeze" law)**

- **FR-006**: The system MUST replace generic indeterminate spinners with
  staged progress mapped to the actual pipeline phases (isolating →
  preparing image → matching catalogs → assembling results), with
  stage-specific copy.
- **FR-007**: While work is in flight, no progress visual MAY remain
  visually unchanged for more than 1.5 seconds; progress motion MUST be
  smooth (no stuttering jumps between stages).
- **FR-008**: Stage copy MUST be truthful: a stage is only announced when
  that phase has genuinely begun, and a stalled or failed phase MUST resolve
  to a designed failure state rather than optimistic progress.
- **FR-009**: A failure after isolation MUST preserve the isolated garment
  so that retry re-runs only the failed remote phases.

**Match presentation**

- **FR-010**: Match results MUST enter as a staggered cascade with a
  cumulative stagger budget of at most 640ms per result set, and arriving
  results MUST NOT shift or reflow content already on screen.
- **FR-011**: Isolated (transparent-background) garment imagery MUST always
  be presented on a high-contrast dark translucent surface with an elevation
  cue when shown over image-rich or unpredictable backdrops, and MUST remain
  legible over worst-case backgrounds.

**Price-advantage framing**

- **FR-012**: When a match's price is reliably known and falls below the
  scanned garment's reference price, the system MUST label the match with a
  relative savings statement whose percentage is arithmetically correct.
  The reference ("retail" anchor) price is the **highest-priced comparable
  match in the returned result set** (CL-002, 2026-07-15), and the label
  copy MUST reflect that honestly (savings relative to comparable retail,
  never a claimed MSRP of the original garment). The anchor item itself
  never carries a savings label, and a result set with fewer than two
  reliably-priced matches produces no savings labels at all.
- **FR-013**: No savings, price, or comparison claim MAY appear for a match
  whose price data is missing or unreliable — absence of data produces
  absence of claim.

**Wardrobe harmony**

- **FR-014**: The system MUST compute a 0–100 harmony score for a match only
  from the user's actual stored wardrobe data, with identical inputs always
  producing the identical score; users with no usable wardrobe history see
  no harmony indicator at all.
- **FR-015**: The harmony indicator MUST render as a partial ring that
  animates to its value when the card enters view (calm non-animated
  equivalent under reduce-motion), and its visual fill MUST match the
  numeric score.

**Perfect match**

- **FR-016**: The system MUST apply a distinct celebration treatment
  (shimmering border moment + one-shot success haptic) to a match that
  qualifies as an exact duplicate of the scanned garment, firing at most
  once per result set on first exposure. A match qualifies as exact **only
  when the matching provider explicitly flags it as the same product**
  (e.g., an exact-match result class distinct from similar items) — never
  from a locally-invented similarity heuristic (CL-003, 2026-07-15). If the
  provider offers no such signal, the jackpot tier remains dormant: no
  celebration is a valid steady state, a fabricated one is a defect.

**Placement & platform**

- **FR-017**: The Subject Lift visual search MUST be a **standalone
  surface** with its own entry point (evolving the feature-003 demo route
  into the real end-to-end experience), leaving the existing person-outfit
  scan flow untouched (CL-001, 2026-07-15). Integration into the scan flow
  or the garment detail modal is explicitly deferred to a future feature
  once this surface is proven.
- **FR-018**: All haptic moments in this feature MUST use the app's existing
  semantic beat vocabulary and rules (one-shot information beats survive
  reduce-motion; rhythmic/repeating effects do not).
- **FR-019**: All failure surfaces in this feature MUST degrade gracefully
  per the app's established patterns: designed fallback states for camera,
  filesystem, isolation, and network/provider failures; a crash or blank
  screen anywhere in the flow is a defect.

### Key Entities

- **Isolated Garment Image**: The transparent-background subject produced by
  isolation (or by the manual crop fallback); carries its subject bounds and
  which path produced it (automatic vs manual). Exists on-device; is the
  payload for matching and the hero of the results scene.
- **Pipeline Stage**: A named phase of the search pipeline (isolating,
  preparing, matching, assembling) with truthful entry/exit — drives the
  staged progress and its copy.
- **Visual Match**: One returned product candidate: source/store, title,
  image, price (optional, may be absent), link, and an exactness signal (per
  FR-016 resolution). Extends the existing product-match shape used by prior
  features.
- **Reference Price (Anchor)**: The price a match is compared against for
  savings framing (per FR-012 resolution); never displayed as fact when it
  is an estimate.
- **Harmony Score**: A derived 0–100 coordination value computed from the
  user's stored wardrobe (categories/taxonomy today; color reserved for when
  garment color data exists) — never persisted, always recomputable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During any in-flight search, the interface never presents a
  visually static state for more than 1.5 seconds — verified across 10
  scans including slow-network runs.
- **SC-002**: From initiating a search on an already-taken photo, users see
  the first live pipeline feedback (outline or stage copy) within 1 second,
  and median time to first visible match is under 10 seconds on a normal
  connection.
- **SC-003**: Result entry completes its cascade within the 640ms stagger
  budget and causes zero layout shift of already-visible content, verified
  over 10 result sets of varied sizes.
- **SC-004**: 100% of search attempts on devices without on-device isolation
  complete (or fail gracefully) through the manual crop path — zero crashes
  in a 20-attempt device pass.
- **SC-005**: Every user-facing claim in the results scene (savings %,
  harmony score, exact-match badge) traces to verifiable data in that
  session — a manual audit of 20 rendered cards finds zero fabricated or
  unverifiable claims.
- **SC-006**: With reduce-motion enabled, every flow in this feature is
  completable with equivalent information: zero repeating animations, all
  one-shot confirmation beats present.
- **SC-007**: In a side-by-side comparison on 10 test garments, searches
  using the auto-trimmed isolated image return visibly more relevant match
  sets than searches on the unprocessed photo (majority-vote human
  judgment), validating the isolation step's value.
- **SC-008**: The isolated garment remains clearly legible over light, dark,
  and busy image backdrops in a device check of all three (contrast
  treatment verified in bright-light conditions).

## Out of Scope (Deferred; boundaries binding on this feature)

- **Real MSRP / retail-price database integration** — the anchor mechanism
  is limited to what FR-012's resolution defines; no external price-history
  service in this feature.
- **Garment color extraction** — harmony scoring uses taxonomy/category
  data only until color data exists upstream (established 007 precedent);
  the score's copy must not claim color intelligence.
- **On-device isolation for platforms without native support** — such
  devices use the manual crop path; building a custom cross-platform
  segmentation model is out of scope.
- **Affiliate link monetization mechanics** — match cards link out as they
  do today; revenue attribution is its own feature.
- **Wardrobe-wide outfit generation from matches** — the harmony score
  informs a single card; composing outfits from matches belongs to the
  future coordinate-generator feature.
- **Scan-flow and detail-modal integration of Subject Lift** (CL-001) —
  this feature ships the standalone surface only; wiring the lift into the
  person-outfit scan or the garment detail modal is a follow-up feature.

## Assumptions

- The existing visual-search backend surface (feature 003: one image in,
  product matches out, mock-able provider) is reused and extended — this
  feature does not stand up a new matching service.
- The existing motion and haptic contracts (feature 007: spring-only
  structural motion, semantic beat vocabulary, reduce-motion matrix, glass
  only over controlled dark backdrops) bind every treatment in this feature;
  the Master Guide's literal recipes (specific animation library version,
  linear-curve loops, raw haptic calls, a named background-removal package)
  are superseded by those contracts and resolved at plan/research time.
- On-device isolation targets modern devices; capability is detected at
  runtime and the manual crop fallback is the universal floor (covering
  older OS versions and platforms without the native capability).
- The isolated image is uploaded to the existing cloud pipeline for
  matching; payload preparation (transparency, trimming) happens before
  upload so the network payload is minimal.
- Search sessions are anonymous/device-local consistent with current app
  behavior; no new account or server-side user state is introduced.
- The vault (features 005–007) is the source of wardrobe history for
  harmony scoring; entries without garment categorization simply contribute
  nothing (honest absence).
