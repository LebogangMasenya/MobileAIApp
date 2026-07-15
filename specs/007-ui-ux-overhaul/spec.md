# Feature Specification: UI/UX Overhaul — Kinetic Polish, Behavioral Loops & Style Rings

**Feature Branch**: `007-ui-ux-overhaul`

**Created**: 2026-07-14

**Status**: Draft (scope resolved 2026-07-14: Option C — US1–US5 in scope; pack ritual, paywall, AI chat deferred)

**Input**: User description: "UI/UX Overhaul Master Guide — translates five core video analyses of top mobile app trends, cognitive psychology, and motion mechanics (from Revolut, Duolingo, Strava, and Phantom) into programmatic rules for the Speckit codebase: (1) Kinetic polish & motion choreography — living scan wave with rhythmic tactile feedback, tactile 3D garment cards that catch light under the finger; (2) Behavioral UX — no-zero-state momentum framing, relative price anchoring against wardrobe value, smart defaults with acknowledgment micro-copy; (3) Gamification — Style Rings daily completion drive, variable-reward style pack reveal ritual; (4) Accessible liquid glass constraints and emotionally intelligent AI chat entrance behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Living Scan (Priority: P1)

While a user is scanning a garment, the scan surface feels alive: a soft wave
repeatedly blooms outward from the scan focus and fades as it expands, with a
subtler breathing pulse underneath that communicates "actively searching."
Each wave bloom is accompanied by a light, synchronized tactile tick, so the
user feels the search working even when glancing away from the screen. The
rhythm stops decisively the moment the scan resolves (success or failure), so
the state change is unmistakable.

**Why this priority**: Scanning is Speckit's core interaction and its first
"magic moment." A static reticle reads as frozen or broken during the multi-
second identification window; a living rhythm sustains trust exactly where
abandonment risk is highest.

**Independent Test**: Start a garment scan on a physical device and observe
the full search window: the wave loops fluidly, the tactile tick lands on
each bloom peak, and both halt immediately on scan resolution. Delivers value
alone — no other story required.

**Acceptance Scenarios**:

1. **Given** an active scan in progress, **When** the identification search is
   running, **Then** the scan focus displays a continuously looping outward
   wave (growing and fading) plus a subtler secondary pulse, with no visible
   hitching or rhythm breaks.
2. **Given** the wave loop is running, **When** each wave reaches its
   expansion peak, **Then** the user feels one light tactile tick synchronized
   to that peak — never a continuous buzz.
3. **Given** an active scan animation, **When** the scan resolves (match found
   or scan failed), **Then** the wave and tactile rhythm stop within one
   perceivable beat and hand off smoothly to the result state with no hard cut.
4. **Given** the device has "reduce motion" enabled, **When** a scan runs,
   **Then** the looping wave is replaced with a calm non-moving "searching"
   treatment and repeating haptics are suppressed, with no loss of status
   information.

---

### User Story 2 - Tactile Garment Cards (Priority: P2)

When browsing the Wardrobe Vault, each garment card responds physically to
touch: pressing and dragging a finger across a card tilts it subtly toward
the touch point in three dimensions, and a soft band of light sweeps across
its surface as it tilts — like a physical card catching light. Releasing
lets the card spring gently back to rest.

**Why this priority**: The vault is where users spend recurring time with
their own clothes. Physical, light-catching cards transform a utility grid
into a possession-pride experience — the emotional core of the overhaul — but
it depends on the vault already being reachable, hence P2 behind the scan.

**Independent Test**: Open the vault on a physical device, press and drag on
any garment card, and verify tilt-toward-finger with a moving light sheen and
a soft spring return on release, without breaking scrolling or card taps.

**Acceptance Scenarios**:

1. **Given** a garment card at rest, **When** the user presses and moves a
   finger across it, **Then** the card tilts toward the touch point within a
   bounded, subtle range (never flipping or clipping neighbors) and a light
   sheen tracks the tilt direction.
2. **Given** a card mid-tilt, **When** the user releases, **Then** the card
   settles back to rest with a soft, natural spring — no snap or linear glide.
3. **Given** the vault grid, **When** the user scrolls the list, **Then**
   scrolling wins over card-tilt: vertical drags scroll normally and tilt only
   engages on a sustained press, so browsing is never hijacked.
4. **Given** a card mid-tilt, **When** the user releases without dragging
   away, **Then** the card's normal tap action (opening garment detail) still
   fires reliably.

---

### User Story 3 - Momentum-Framed Welcome (No Zero State) (Priority: P3)

A new user arriving at the Wardrobe Vault for the first time never sees a
cold "0 garments" dead end. Instead, the welcome surface frames the setup
work they have already genuinely completed (account created, camera access
granted) as finished steps in a visible progress journey, so the progress
indicator already shows real momentum — and the single remaining step is
clear: scan your first piece.

**Why this priority**: First-session abandonment is decided at the empty
vault. Momentum framing is high-leverage retention, but it only matters after
the core surfaces feel premium (P1/P2).

**Independent Test**: Wipe app data, complete onboarding, open the vault
before any scan, and verify the welcome shows non-zero progress derived from
actually-completed setup steps with a single clear call to action.

**Acceptance Scenarios**:

1. **Given** a first-time user with no scanned garments, **When** they open
   the vault, **Then** the surface never displays a raw zero count; it shows a
   progress journey with completed setup steps checked off and progress
   visibly started (roughly one-fifth to one-quarter complete).
2. **Given** the welcome progress display, **When** the user inspects the
   completed steps, **Then** every checked step corresponds to something the
   user genuinely did (e.g., account ready, camera calibrated) — progress is
   never fabricated.
3. **Given** the momentum welcome, **When** the user completes their first
   scan, **Then** the progress journey advances with a rewarding animated
   transition and the welcome framing retires in favor of the populated vault.

---

### User Story 4 - Smart Defaults Everywhere (Priority: P4)

When a user categorizes a freshly scanned garment or opens vault filters, the
choices are already intelligently pre-filled from their own behavior (their
most common categories, most active colors, seasonally likely garment types),
with a short acknowledgment line telling them the selection was smart-picked
for them. They can accept in one tap or change anything.

**Why this priority**: Reduces per-scan friction that compounds across the
whole wardrobe, but it needs scan history to feed on, so it lands after the
core loop is polished.

**Independent Test**: With a vault containing several categorized garments,
scan a new garment and open the categorization step — verify a plausible
pre-selection appears with acknowledgment micro-copy, and that filters open
with behavior-derived pre-fills.

**Acceptance Scenarios**:

1. **Given** a user with scan history, **When** the garment categorization
   step appears, **Then** category and attributes arrive pre-selected from
   that user's own patterns, accompanied by micro-copy acknowledging the
   smart pre-fill.
2. **Given** any smart pre-fill, **When** the user wants something different,
   **Then** changing the selection takes no more steps than it would without
   a pre-fill.
3. **Given** a brand-new user with no history, **When** defaults cannot be
   personalized, **Then** sensible season-aware general defaults appear
   instead, and the micro-copy does not falsely claim personalization.

---

### User Story 5 - Style Rings Daily Cycle (Priority: P5)

Each day, the user sees a circular three-segment ring representing their
Daily Wardrobe Cycle: (1) log what they wore, (2) get a color-harmony read on
it, (3) generate a style coordinate. Partially completed rings visibly ache
to be closed; completing a segment animates it shut with a satisfying
spring, and closing the full ring delivers a celebratory moment.

**Why this priority**: This is the retention engine. It introduces new
daily-cycle mechanics (including a lightweight wear-log action) on top of the
polished core — it must not gate the P1–P4 experience work.

**Independent Test**: On a fresh day, perform each of the three cycle actions
in turn and verify each ring segment animates closed with spring physics, the
partial ring persists across app sessions within the same day, and full
completion triggers a celebration.

**Acceptance Scenarios**:

1. **Given** a new day, **When** the user views their cycle ring, **Then** it
   shows three distinct segments with today's genuine completion state — the
   ring resets daily.
2. **Given** a partially complete ring, **When** the user completes another
   cycle action, **Then** that segment sweeps closed with springy, organic
   motion and a tactile confirmation.
3. **Given** two segments complete, **When** the user closes the final
   segment, **Then** a celebratory full-ring moment plays (motion + tactile),
   clearly bigger than a single-segment close.
4. **Given** the third ring action (coordinate generated) whose full
   generation flow is a future feature, **When** the user completes this
   feature's stand-in action for it, **Then** the segment closes identically —
   the ring mechanic does not depend on the future generator's internals.

---

### Edge Cases

- **Reduce Motion / accessibility settings**: Every looping or springing
  treatment (scan wave, card tilt, ring sweeps) must define a calm,
  static-or-fade equivalent; repeating haptic rhythms must be suppressed.
- **Haptics unavailable or disabled** (silent/low-power mode, unsupported
  hardware): all tactile beats must be purely additive — no state information
  may exist only in a vibration.
- **Low battery / thermal throttling**: continuous loops (scan wave) must not
  visibly degrade into stutter; if the device cannot sustain them, they
  degrade to the reduce-motion treatment rather than janking.
- **Scan resolves mid-wave or fails instantly**: the living-scan rhythm must
  hand off cleanly from any point in its loop — no completed-scan screen with
  a zombie wave still pulsing behind it.
- **Gesture conflicts**: card tilt vs. vault scroll vs. card tap vs. the
  existing vault pull-to-reveal gesture must have explicit, tested
  precedence; no interaction may become unreachable.
- **Empty or tiny vaults**: smart defaults with no history and a welcome
  journey for a user who denied camera permission — every behavioral mechanic
  needs a defined cold-start behavior that never exposes a broken zero or a
  falsely-checked step.
- **Day boundaries and timezones**: the Daily Wardrobe Cycle must define when
  "today" rolls over (device-local midnight assumed) and what happens to a
  ring mid-completion at rollover, including a device timezone change mid-day.
- **Dishonest-progress guardrail**: momentum framing and pre-fill
  acknowledgments must never claim something false (fabricated progress,
  fake personalization) — trust is the asset being built.
- **Glass surfaces over unpredictable content**: translucent panels may sit
  over camera feeds and garment photos of any brightness; the standard must
  guarantee legibility even over a white garment on a bright background.
- **Interrupted celebrations**: app backgrounded mid ring celebration must
  resume or resolve to the final state — never a stuck half-closed segment.

## Requirements *(mandatory)*

### Functional Requirements

**Motion language (cross-cutting — binds this feature and all future UI work)**

- **FR-001**: All structural transitions and gestural interactions introduced
  by this overhaul MUST use organic, physics-feeling motion (no hard cuts, no
  constant-speed glides) and MUST be interruptible mid-flight without visual
  clipping or state jumps, consistent with the project constitution.
- **FR-002**: Every animated treatment MUST honor the platform "reduce
  motion" accessibility setting with a defined calm equivalent conveying the
  same information.
- **FR-003**: Tactile (haptic) feedback MUST be additive-only (never the sole
  carrier of state), rhythm-limited (discrete beats, never continuous buzz),
  and MUST silently no-op where unsupported or disabled.

**Living scan (US1)**

- **FR-004**: During an active identification search, the scan surface MUST
  display a continuously looping outward-blooming wave plus a subtler
  secondary "breathing" pulse, replacing any static-only reticle.
- **FR-005**: Each wave bloom peak MUST emit one light tactile tick
  synchronized to the visual peak.
- **FR-006**: Scan resolution (success or failure) MUST terminate the wave
  and tactile rhythm within one beat and transition smoothly into the result
  state.

**Tactile cards (US2)**

- **FR-007**: Vault garment cards MUST tilt toward the user's touch point
  within a bounded subtle range while pressed, with a light sheen that tracks
  the tilt, and MUST spring softly back to rest on release.
- **FR-008**: Card tilt MUST NOT capture vertical scroll gestures or suppress
  card tap actions; gesture precedence (scroll > tap > tilt engagement) MUST
  be explicit and verified on device.

**Momentum framing (US3)**

- **FR-009**: The first-run vault surface MUST NOT display a raw zero garment
  count; it MUST present a progress journey whose completed steps map only to
  genuinely completed user actions, initialized visibly non-zero (~20–25%).
- **FR-010**: Completing the first scan MUST advance the journey with a
  rewarding transition and retire the welcome framing.

**Smart defaults (US4)**

- **FR-011**: Garment categorization and vault filters MUST arrive pre-filled
  from the user's own history where available, or season-aware general
  defaults otherwise, always accompanied by truthful acknowledgment
  micro-copy and changeable in no more steps than an unfilled control.

**Style Rings (US5)**

- **FR-012**: The system MUST track a three-part Daily Wardrobe Cycle
  (wear/log, color harmony, coordinate generated) that resets at device-local
  day rollover, persists across sessions within a day, and renders as a
  segmented ring reflecting genuine completion state.
- **FR-013**: Segment completion MUST animate closed with spring motion and a
  tactile confirmation; full-ring completion MUST trigger a visibly larger
  celebration.

**Glass surface standard (cross-cutting — binds this feature and all future UI work)**

- **FR-014**: Translucent "glass" panels MUST appear only over controlled
  dark or high-contrast neutral backdrops, MUST carry a hairline
  semi-transparent inner border, MUST use a strong background blur (with an
  equivalent-legibility fallback where true blur is unavailable), and all
  text on glass MUST meet WCAG AA contrast (4.5:1) over worst-case content
  behind it.

### Key Entities

- **Style Profile**: A per-user summary derived from their own scan and
  categorization history — most-used categories, most active colors, seasonal
  patterns. Feeds smart defaults; personalization claims must be traceable to
  it.
- **Daily Wardrobe Cycle**: Per-user, per-day record of the three ring
  segments (wear logged, color harmony viewed, coordinate generated), with a
  defined daily reset boundary.
- **Setup Journey**: The ordered first-run steps (account ready, camera
  calibrated, first scan) with per-step genuine completion state, powering
  the no-zero-state welcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During scans and vault browsing on target physical devices, all
  animated treatments sustain the device's native refresh rate with no
  user-perceptible hitching across a 60-second continuous interaction.
- **SC-002**: In hands-on testing, 100% of scans end with the living-scan
  rhythm terminating within one beat of resolution — zero "zombie wave"
  occurrences.
- **SC-003**: Vault gesture precedence verified on device: 0 instances of
  card tilt hijacking scroll or suppressing tap across a scripted 20-gesture
  pass.
- **SC-004**: New users who reach the momentum-framed vault welcome complete
  their first scan in the same session at a rate of ≥60%.
- **SC-005**: ≥70% of garment categorizations are completed by accepting the
  smart default without modification.
- **SC-006**: Among daily active users, ≥40% close at least one Style Ring
  segment per active day, and users who close the full ring return the next
  day at a measurably higher rate than those who don't.
- **SC-007**: Every user-facing claim of progress or personalization is
  traceable to a genuine underlying state (audited: zero fabricated-progress
  instances).
- **SC-008**: All text over glass surfaces measures ≥4.5:1 contrast against
  worst-case backdrops; with reduce-motion enabled, 100% of flows remain
  completable with equivalent information.

## Out of Scope (Deferred to Future Features)

Resolved via CL-001 (Option C, 2026-07-14). The following Master Guide
mechanics are **not built by feature 007**. Their experiential rules are
recorded here as binding design requirements that the future features which
build these surfaces MUST inherit (alongside cross-cutting FR-001–FR-003 and
FR-014):

- **Style Pack Reveal Ritual** (coordinate generation surface): results
  reveal sequentially with springy card-flips and subtle glow; rare/
  highly-rated matches receive escalated glow + a distinct celebratory
  tactile burst; the ritual is always skippable and resolves to final state
  if interrupted.
- **Value-Anchored Premium Framing** (paywall surface): price is never shown
  in isolation; anchor against the user's estimated wardrobe value (sourced
  from e-commerce match data, framed as an estimate) with a qualitative
  fallback when value data is absent — never a "$0" anchor or bare price.
- **Calm AI Response Entrances** (AI chat surface): incoming AI messages
  enter with a soft spring settle without shoving existing content;
  in-progress generations show structure-shaped shimmer placeholders, never
  generic spinners.

## Assumptions

- **Honest momentum**: The no-zero-state rule is implemented with genuinely
  completed steps (account creation, camera permission) — never fabricated
  progress — treating user trust as a hard constraint over persuasion tactics.
- **Style profile is local and behavioral**: Smart defaults derive from the
  user's own on-device scan/categorization history; no third-party profiling
  data is introduced by this feature.
- **Ring segment 3 stand-in**: The "coordinate generated" ring segment is
  completable via this feature's stand-in action (whatever coordinate-like
  output the current app can produce, e.g., a color-harmony-based suggestion)
  until the full generator feature ships; the ring contract is agnostic to
  which action fulfills the segment.
- **Day rollover**: The Daily Wardrobe Cycle resets at device-local midnight;
  a timezone change mid-day keeps already-earned segments.
- **Referenced imagery**: The guide's embedded "Tactile Micro-Interactions &
  Glow Maps" image was not available; glass and glow rules are specified from
  the guide's textual rules only.
- **Physical-device verification**: All motion, gesture, and haptic
  acceptance is verified on real iPhones (per project practice), not
  simulators.
