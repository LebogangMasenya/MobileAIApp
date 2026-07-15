# Research — 007 UI/UX Overhaul

All unknowns from Technical Context resolved. Each entry: Decision /
Rationale / Alternatives considered.

## R1 — Reanimated version reality (guide says v3, repo runs v4)

**Decision**: Implement everything with Reanimated **4.1** idioms:
`scheduleOnRN` from `react-native-worklets` (never `runOnJS`),
`useAnimatedProps` for SVG, `useReducedMotion()` + `ReduceMotion` config,
`withRepeat(withSequence(withSpring…))` loops.

**Rationale**: `package.json` pins `react-native-reanimated ~4.1.1` +
`react-native-worklets 0.5.1`; VaultRevealContainer already documents the
`runOnJS` deprecation. The Master Guide's v3 recipes (`FadeInDown.springify()`
etc.) carry over API-compatible, but worklet→JS calls do not.

**Alternatives**: Downgrading to v3 to match the guide — rejected outright;
the guide adapts to the repo, not vice versa.

## R2 — New native dependencies (one rebuild, three modules)

**Decision**: Add `expo-haptics`, `react-native-svg`, `expo-linear-gradient`
via `npx expo install`, in **one** dev-client rebuild batched with feature
006's already-scheduled `expo-image-manipulator` rebuild if that hasn't run
yet.

**Rationale**:
- `expo-haptics` is non-negotiable: FR-003/005/013 require haptics; RN core's
  `Vibration` API cannot express impact styles and is banned-quality UX.
- `react-native-svg` reverses the recorded 2026-07-12 "no SVG / no rebuild"
  decision (NeonTracingOverlay header). That decision's stated condition has
  arrived: we now need true arc geometry (three rounded ring segments with
  gaps, animated `strokeDashoffset`) that border-tricks cannot fake, and the
  same install unlocks the recorded feature-004 follow-up (true contour
  tracing). Since a rebuild is required for haptics anyway, the rebuild cost
  argument that motivated "no SVG" is void.
- `expo-linear-gradient` gives the card sheen its white→transparent band; RN
  core has no gradients.

**Alternatives**:
- Ring without SVG (two rotated half-circle Views + overflow clipping) —
  rejected: cannot render 3 gapped, round-capped segments; brittle on
  ProMotion; unreadable code.
- `@shopify/react-native-skia` — rejected: heavyweight dependency for one
  ring; SVG is the minimal sufficient tool (Constitution IV).
- Sheen via animated translucent white View without gradient — rejected: a
  hard-edged band reads as a glitch, not light.

## R3 — Scan wave rendering (SVG not needed here)

**Decision**: Build `ScanPulseWave` from plain stacked `Animated.View` rings
(border + fill), each looping scale 0.8→2.5 with opacity 1→0, staggered;
plus a breathing under-glow. No SVG in this component.

**Rationale**: The guide suggested "SVG radar wave", but concentric circles
are exactly what Views with `borderRadius: 999` already are. This matches the
NeonTracingOverlay precedent (glow faked with stacked translucent borders, no
blur, UI-thread transforms only) and keeps the scan overlay SVG-free —
important because it renders over a live camera/photo surface where every
layer counts (Constitution III).

**Alternatives**: SVG circles — no visual gain, extra native layer; Lottie —
new dep + non-interruptible baked timing (Constitution V violation).

## R4 — Loop timing: springs, not sine

**Decision**: Drive the wave loop and breathing pulse with
`withRepeat(withSequence(withSpring…))` pairs (the NeonTracingOverlay
PULSE_SPRING pattern), not the guide's `Math.sin(elapsed / 1000)` frame
callback.

**Rationale**: Constitution V mandates spring physics for active UI motion;
the house already has a proven, seamless-restart spring-loop idiom. A
`useFrameCallback` sine runs per-frame JS-adjacent work for no visual gain.

**Alternatives**: `useFrameCallback` + sine (guide's recipe) — rejected: house
style violation and needless per-frame math; `withTiming` + easing curves —
rejected: timing curves for structural motion are constitutionally banned.

## R5 — Haptic bloom-peak sync

**Decision**: A `useAnimatedReaction` watches the lead ring's loop phase;
when it crosses the peak threshold it calls `scheduleOnRN(tick)` where `tick`
is `tactile.ts`'s light beat. The reaction is gated by (a) scan-active, (b)
`useReducedMotion() === false`, (c) tactile availability.

**Rationale**: The VaultRevealContainer already models exactly this pattern
(animated reaction → `scheduleOnRN` for a JS side-effect); beats are ~0.5Hz —
discrete events, zero per-frame JS traffic (Constitution III).

**Alternatives**: `setInterval` on the JS thread — rejected: drifts from the
UI-thread animation under load, producing the exact desync the spec's
"synchronized to that peak" scenario forbids.

## R6 — Card tilt gesture architecture (the FR-008 guarantee)

**Decision**: `TactileTiltCard` uses **`Gesture.Manual` as a pure
observer** — it tracks `onTouchesDown/Move/Up/Cancelled` to drive
rotateX/rotateY/sheen shared values but **never calls `activate()`**, so it
never competes in the gesture arena. FlatList scroll, card tap, and
long-press-delete behave byte-for-byte as today; a beginning scroll cancels
the touches → the card springs to rest. Perspective via
`transform: [{ perspective: 800 }, { rotateX }, { rotateY }]`, springs with
high damping / low stiffness per the guide.

**Rationale**: The guide's `Gesture.Pan()` recipe *competes* with scroll —
the classic tilt-hijacks-list failure. An observer gesture makes FR-008
("tilt never captures scroll or suppresses tap") true **by construction**
rather than by tuned thresholds, and long-press delete (an existing vault
affordance the guide didn't know about) survives untouched.

**Alternatives**: `Gesture.Pan().activateAfterLongPress(…)` — rejected:
collides with long-press delete and adds an activation delay to the tilt;
`Pressable` events — rejected: no move coordinates; `simultaneousWithExternalGesture(scrollRef)`
— rejected: requires threading list refs through props (coupling) and still
enters arena negotiations.

## R7 — Where FR-011 (smart defaults) actually lands

**Decision**: Build the **vault category filter rail** (new surface,
`VaultFilterRail`) with Style-Profile-driven preselection + truthful
micro-copy. Manual garment categorization gets **no** surface in 007 —
categories are assigned by the API today; there is nothing to pre-fill.
The Style Profile util is written so a future manual-categorization/editing
feature consumes it unchanged.

**Rationale**: Grounded reality check: no categorization step and no filters
exist anywhere in the codebase. The rail is the smallest honest surface that
satisfies "vault filters MUST arrive pre-filled". Documented here per
Constitution I instead of silently guessing; **surfaced for user approval
with this plan**.

**Alternatives**: Building a manual categorization editor just to have
something to pre-fill — rejected: scope invention beyond the spec;
pre-filling the share picker — rejected: sharing is feature 006's surface and
"defaults" there could mis-ship a look.

## R8 — Style Profile contents (colors are not in the data)

**Decision**: v1 Style Profile = **category frequencies (recency-weighted) +
season inference from capture dates**. No color dimension: `VaultGarment`
carries no color data, and inventing client-side color extraction is out of
scope. The profile type reserves an optional `colors` field documented as
"populated when garment color data exists".

**Rationale**: The guide's "most active colors" is unimplementable honestly
today (SC-007: every personalization claim must trace to genuine state).
Micro-copy will say what is true: "Smart-selected from your recent scans."

**Alternatives**: On-device pixel sampling of stored look photos — rejected:
main-thread image work (Constitution III) for a nice-to-have; claiming color
smarts without data — rejected: violates SC-007 and the trust guardrail.

## R9 — Daily cycle segment fulfillment (stand-ins, per spec assumption)

**Decision**: `DailyCycleRecord` keys segments by stable ids
`'log' | 'harmony' | 'coordinate'`; the store only exposes
`markSegment(id)` — *what fulfills a segment is the caller's contract*,
re-bindable by future features without touching the ring. v1 bindings:

| Segment | v1 fulfilling action | Call site |
|---------|---------------------|-----------|
| `log` | A look is saved to the vault today (scan completes) | scan.tsx post-`upsertEntry` |
| `harmony` | User opens a saved look's matches today (wardrobe engagement) | VaultSheet detail open |
| `coordinate` | User taps "Style me" on the ring card → local suggestion sheet composes an outfit from stored garments | CoordinateSuggestionSheet confirm |

**Rationale**: Spec US5 scenario 4 + the "Ring segment 3 stand-in"
assumption explicitly bless stand-in actions; the id-keyed contract is what
makes the ring "agnostic to which action fulfills the segment". The
suggestion sheet is deliberately minimal (grouped picks from existing vault
crops/categories — pure local composition, no AI call) — it exists to make
segment 3 completable, not to preempt the future generator feature.

**Storage**: versioned JSON at `satori.dailycycle.v1` in `device-store`
(SecureStore) — the exact `useVaultVisibility` pattern; payload « 2KB.
Rollover: stored `date` (device-local `YYYY-MM-DD`) ≠ today ⇒ read-repair to
a fresh record. Timezone change mid-day: earned segments persist (spec
assumption) because repair triggers only on date *string* mismatch.

**Alternatives**: A generic event-bus achievement engine — rejected:
architecture astronautics for three booleans (Constitution IV); storing in a
new file-based store — rejected: device-store is the established small-flag
seam and the payload is tiny.

## R10 — Reduce-motion + glass constraints

**Decision**: Every animated component reads Reanimated's
`useReducedMotion()` directly (no wrapper hook) and renders its documented
calm equivalent (contracts/motion-tactility.md matrix); repeating haptics
gate on the same flag inside the component; one-shot confirmation beats
remain (they are information, not decoration). Glass (`expo-glass-effect` /
blur) appears **only** on dark camera-overlay chrome (e.g., the scan status
pill) — never on the lavender `bg-surface` vault/home surfaces — always with
`border border-white/20` and AA-verified text, per FR-014.

**Rationale**: Direct hook use per Constitution IV; the glass constraint set
comes straight from the spec and the installed-but-unused `expo-glass-effect`
gives it a native iOS implementation with zero new deps.

**Alternatives**: A custom `useMotionProfile` abstraction — rejected
(wrapper-of-a-wrapper); `expo-blur` — not installed, unnecessary given
glass-effect + the no-blur-in-loops rule.

## R11 — Expo docs pointer discrepancy

**Decision**: Treat installed package versions (`expo ~54.0.0`, RN 0.81) as
the API source of truth, verified against installed TypeScript types at
implementation time (the vault-store T002 precedent). `apps/mobile/AGENTS.md`
points at v57 docs — likely tracking `@expo/ui@^57`; flag to the user to
reconcile AGENTS.md separately. **No SDK upgrade inside this feature.**

**Alternatives**: Upgrading Expo to match the docs pointer — rejected: an SDK
migration is its own feature with its own risk budget.

### R11 verification note (T003, 2026-07-15)

API surfaces verified against installed TypeScript types via a clean
`tsc --noEmit` over the implemented feature code:

- `expo-haptics` ~15.0.8 — `impactAsync(ImpactFeedbackStyle.Light|Medium|Heavy)`
  and `notificationAsync(NotificationFeedbackType.Success)` match the plan's
  assumed signatures (consumed only in `services/tactile.ts`).
- `react-native-svg` 15.12.1 — `Animated.createAnimatedComponent(Circle)` +
  `useAnimatedProps` on `strokeDashoffset` type-check and interop with
  Reanimated 4.1 as assumed (`DailyCycleRing`). `originX/originY/rotation`
  props used for per-segment arc rotation.
- `expo-linear-gradient` ~15.0.8 — `colors`/`start`/`end`/`locations` props as
  assumed (`TactileTiltCard` sheen).
- No deviations from plan assumptions found. NOTE: the modules are installed
  in package.json but `ios/Podfile.lock` predates them — the T002 dev-client
  rebuild (`npx expo run:ios --device`) is still required before any
  on-device pass.
