# Feature Specification: Entry Funnel & Home Dashboard

**Feature Branch**: `002-entry-funnel-dashboard`

**Created**: 2026-07-08

**Status**: Approved 2026-07-08 · **Amended 2026-07-09**: authentication is served by an on-device **simulated (mock) provider** for this release; real managed-provider integration is deferred to a follow-up (user decision — see Assumptions and FR-022..FR-025)

**Input**: User description: "Expand the app architecture to include the complete entry funnel and main dashboard: analyze the Figma design PDF (root directory), focusing on the Splash Screen, Login/Auth Flow, and Home Page plus any component that improves UI/UX. High-fidelity implementation with Principal-Mobile-UX-Designer improvements (layout, thumb-reach ergonomics, empty states). Enforce the Constitution: NativeWind for all views; Splash-to-Login and Login-to-Home transitions via react-native-reanimated with fluid, interruptible, Apple-tier spring mechanics. Educational requirement: outline how routing state securely handles the Auth Stack → Main App Stack transition."

---

## Design Reference & UX Critique *(Principal Mobile UX Designer review of `figma.pdf`)*

The 12-page Figma export was reviewed page by page. Screens in scope: **Splash** (p1), **Welcome/Get-Started** (p2, p11), **Home dashboard** (p3), **Account hub** (p4). Pages 5–9 (Analyse Fit flow) are already covered by feature `001-camera-scan-match`. Page 12 is a "demo video" placeholder (no requirements).

### Findings adopted as requirements

| # | Finding | Severity | Resolution in this spec |
|---|---------|----------|-------------------------|
| D1 | **No login or registration form screens exist in the PDF.** Page 2 shows only "Create account" / "Login" entry buttons; the flows behind them are undesigned. | Blocker | Sign-In, Create-Account, and Password-Reset screens are specified here, matching the PDF's visual language (lavender surface, plum primary buttons, serif/grotesque type pairing). |
| D2 | Page 10 (product detail) is an **unedited design-kit template** — copy reads "View 231 Restaurants", "Add to my itinerary", "12 mins from hotel". | Blocker | Page 10 is explicitly **out of scope**; garment detail already exists in feature 001. It must not be implemented as drawn. |
| D3 | Page 11 primary button reads **"Get Startef"** (typo). | Minor | Corrected to "Get Started". |
| D4 | Tab bar labels are **inconsistent across pages**: "Analyse Outfit" (p3) vs "Analyse Fit" (p4–9). | Major | Standardized to **"Scan"** — shortest, clearest, and matches the existing app tab. |
| D5 | Home "Recently scanned" carousel has **no empty state** — a brand-new user sees an empty rail. | Major | First-run empty state specified (US3): friendly illustration + "Scan your first outfit" CTA routing to the Scan tab. |
| D6 | "Hello user" greeting is a placeholder. | Minor | Personalized greeting with the account's first name; time-of-day fallback ("Good evening") when the name is unavailable. |
| D7 | Page 2 "Login" text link is a **sub-44pt tap target** in the thumb's dead zone. | Major | Secondary action rendered as a full-width ghost button directly under the primary CTA, ≥48pt tall, inside the natural thumb arc. |
| D8 | Splash shows a **determinate-looking progress bar** ("Loading personalized experience") that no real progress signal backs. | Minor | Replaced with an indeterminate shimmer tied to actual session-restore work; splash dismisses the moment bootstrap completes. |
| D9 | "What you will love" marketing rows permanently occupy prime dashboard space, even for established users. | Major | Rows shown only while the user has zero scans (they double as onboarding); replaced by scan history once content exists. |
| D10 | Welcome pages 2 and 11 are near-duplicates (same subcopy, different headline/CTA). | Minor | Merged into a single Welcome screen: page 11's stronger headline ("The world is your wardrobe…"), page 2's dual-CTA layout. |
| D11 | Auth forms (once designed) risk keyboard occlusion of the submit button on small devices. | Major | Forms specified with bottom-anchored, keyboard-avoiding primary CTA and top-aligned fields. |

### Ergonomic ground rules applied throughout

- All primary actions live in the bottom 40% of the screen (one-handed thumb arc); destructive/rare actions (sign out) sit at list bottom, visually separated.
- Every tappable target ≥ 44×44 pt; list rows ≥ 56 pt.
- Dark-header-over-light-content contrast from p3 is kept, with status-bar legibility guaranteed in both themes.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an Account or Sign In and Land on Home (Priority: P1)

A signed-out person opens the app, watches a brief branded splash resolve into the Welcome screen, chooses "Create account" (or "Log in"), completes a short form — or uses one-tap Apple/Google sign-in — and glides into the Home dashboard on a fluid animated transition. No abrupt screen snapping anywhere in the funnel.

**Why this priority**: Nothing else in the product is reachable without an account and a working entry funnel; this is the front door.

**Independent Test**: From a fresh install with no stored session, complete both the registration path and the sign-in path through to the Home dashboard; verify each transition is animated, interruptible, and never dead-ends.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the app launches, **Then** the branded splash appears and transitions into the Welcome screen with a continuous spring animation (no hard cut), and the Welcome screen presents "Create account" (primary) and "Log in" (secondary) both within the thumb arc.
2. **Given** the Welcome screen, **When** the user taps "Create account" and submits a valid email + password, **Then** an account is created, a session is established, and the app transitions to Home with a spring animation; the auth screens are not reachable via back-gesture afterwards.
3. **Given** the Sign-In screen, **When** the user authenticates with valid credentials (or Apple/Google), **Then** they land on Home and see a greeting with their first name.
4. **Given** the Sign-In screen, **When** the user submits invalid credentials, **Then** an inline, non-blocking error explains the problem, the entered email is preserved, and the user can retry immediately.
5. **Given** any auth form, **When** the keyboard opens, **Then** the submit button remains visible and reachable (never hidden under the keyboard).
6. **Given** the "Forgot password?" link, **When** the user submits their email, **Then** they receive a confirmation state telling them a reset link was sent (identical response whether or not the account exists).

---

### User Story 2 - Returning User Skips the Funnel (Priority: P1)

A person who previously signed in reopens the app and goes straight from splash to their Home dashboard — no Welcome screen, no login form, no signed-out flash.

**Why this priority**: This is every session after the first; a funnel that re-prompts returning users daily would make the app feel broken.

**Independent Test**: Sign in, kill the app, relaunch — verify the app lands directly on Home. Sign out, relaunch — verify it lands on Welcome.

**Acceptance Scenarios**:

1. **Given** a valid stored session, **When** the app launches, **Then** the splash resolves directly into Home (Welcome/login are never shown, not even for a frame).
2. **Given** an expired or invalid stored session, **When** the app launches, **Then** the splash resolves into Welcome with a gentle "please sign in again" notice — never a crash or blank screen.
3. **Given** a signed-in user on any screen, **When** they sign out from the Account screen, **Then** all locally stored session data is removed and the app returns to Welcome; the back gesture cannot re-enter any authenticated screen.

---

### User Story 3 - Personalized Home Dashboard (Priority: P2)

A signed-in person lands on Home and sees a personalized greeting, their recently scanned outfits in a horizontally swipeable rail, and a clear path to their next scan. A brand-new user with no scans sees an inviting first-run state instead of an empty rail.

**Why this priority**: Home is the daily re-entry point and the router into the app's core value (scanning); it depends on the funnel existing first.

**Independent Test**: View Home as (a) a user with zero scans and (b) a user with several scans; verify the empty state, the populated rail, and that every card/CTA navigates correctly.

**Acceptance Scenarios**:

1. **Given** a signed-in user with previous scans, **When** Home loads, **Then** it shows a personalized greeting, a "Recently scanned" rail of their latest scans (newest first), and a "See all" affordance.
2. **Given** a signed-in user with zero scans, **When** Home loads, **Then** the rail area shows a first-run invitation with a "Scan your first outfit" action that opens the Scan tab, and the "What you will love" feature-highlight rows are visible.
3. **Given** a user with at least one scan, **When** Home loads, **Then** the marketing rows are replaced by content (per critique D9).
4. **Given** a tap on any recently-scanned card, **When** the card opens, **Then** the user is taken to that scan's results view (from feature 001).
5. **Given** Home fails to load recent scans (network/service failure), **When** the failure occurs, **Then** cached/last-known content or a graceful retry state is shown — never a blank region or crash.

---

### User Story 4 - Account Hub (Priority: P3)

A signed-in person opens the Account tab and sees their profile (avatar, name), grouped entry points (Contact Info, Preferences, Privacy Settings), and a clearly separated Sign Out action.

**Why this priority**: Required for a complete funnel (sign-out closes the loop) and matches the designed tab structure, but the sub-screens behind each row can arrive later.

**Independent Test**: Open the Account tab, verify profile data renders, all rows are ≥56pt with chevrons, and Sign Out returns the app to Welcome with the session fully cleared.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the Account tab, **Then** they see their avatar (or initials fallback), display name, and the grouped settings rows from the design.
2. **Given** the Account screen, **When** the user taps Sign Out, **Then** a confirmation is requested, and on confirm the app clears the session and returns to Welcome (US2 scenario 3).
3. **Given** rows whose destination screens are not yet built (Contact Info, Privacy, Preferences), **When** tapped, **Then** they present a graceful "coming soon" state rather than a dead tap or crash.

---

### Edge Cases

- **Auth service unreachable** (offline or outage): forms disable submission with a clear offline notice; retry is possible without losing typed input; never an unhandled error screen. *(With the simulated provider this path cannot occur organically; the offline UI ships now and its end-to-end exercise moves to the provider-integration follow-up.)*
- **Cancelled social sign-in** (user dismisses the Apple/Google sheet): the app returns to the auth screen in its prior state, with no error toast for a deliberate cancel.
- **Session expires while the app is in use**: on the next authenticated request the user is returned to Welcome with a "session expired" notice; in-progress scan data is not silently destroyed.
- **Deep link to a protected screen while signed out**: the link is intercepted, the user authenticates, then lands on the originally requested screen (see Navigation State outline below).
- **Rapid double-tap on CTAs**: submissions are idempotent — one tap, one request; buttons enter a busy state.
- **Very long names** in the Home greeting and Account header: truncate gracefully, never wrap into layout shift.
- **Extremely slow session restore** (>3s): splash shows its indeterminate shimmer and remains interruptible by OS gestures; the app never appears frozen.
- **Mid-transition interruption**: if the user gestures (e.g., back-swipe) during the Login→Home spring transition, the animation redirects smoothly from its current position — no clipping, no jump-cut (Constitution Principle V).

## Requirements *(mandatory)*

### Functional Requirements

**Splash & bootstrap**

- **FR-001**: On every cold launch the app MUST present a branded splash (Project Satori wordmark + "Scan · Style · Shop" motif per p1) that remains until session restoration completes, then resolves into either Welcome (no valid session) or Home (valid session) via a continuous animated transition — never a hard cut or intermediate flash of the wrong screen.
- **FR-002**: The splash loading indicator MUST be indeterminate (shimmer/pulse) and MUST NOT imply fake determinate progress (critique D8).

**Welcome & auth funnel**

- **FR-003**: A single Welcome screen MUST merge PDF pages 2 and 11 (critique D10): headline "The world is your wardrobe. Spot it. Scan it. Satori it.", supporting copy, primary "Create account" button and secondary "Log in" button — both ≥48pt tall, stacked in the lower thumb arc (critiques D3, D7).
- **FR-004**: The app MUST provide account creation with email + password, including inline validation (email format, minimum password strength) shown as the user types, not only on submit.
- **FR-005**: The app MUST provide sign-in with email + password, plus one-tap Sign in with Apple and Google entry points (flows simulated end-to-end while the provider mock is in place — see FR-023).
- **FR-006**: The app MUST provide a password-reset request flow that responds identically whether or not the submitted email has an account (no account enumeration).
- **FR-007**: Auth screens MUST keep the primary action visible and tappable while the keyboard is open (critique D11), and MUST preserve user input across failed attempts and transient errors.
- **FR-008**: Authentication failures MUST render inline, human-readable messages (wrong credentials, weak password, network failure) — never raw provider errors, never a blocking full-screen error.

**Session & security**

- **FR-009**: Session credentials MUST be stored exclusively in the device's secure hardware-backed storage, never in plain application storage, and MUST be fully purged on sign-out.
- **FR-010**: After authentication completes, the auth screens MUST be removed from navigation history — the back gesture from Home can never re-enter the funnel; after sign-out, the same guarantee applies in reverse (no back-navigation into authenticated screens).
- **FR-011**: All navigation between the signed-out and signed-in areas MUST be driven by a single session-state source of truth, so that a session change anywhere (expiry, sign-out, sign-in) re-routes the whole app consistently (see Navigation State outline).

**Home dashboard**

- **FR-012**: Home MUST show a personalized greeting using the account's first name, with a time-of-day fallback when no name exists (critique D6).
- **FR-013**: Home MUST show a horizontally scrollable "Recently scanned" rail (newest first, cards per p3's visual language) with a "See all" affordance, sourcing scan history from feature 001's scan sessions.
- **FR-014**: When the user has zero scans, Home MUST show a first-run empty state with a "Scan your first outfit" CTA that activates the Scan tab (critique D5), alongside the "What you will love" feature rows; once ≥1 scan exists the feature rows are replaced by content (critique D9).
- **FR-015**: Tapping a recently-scanned card MUST open that scan's existing results experience (feature 001); this feature MUST NOT implement the p10 template screen (critique D2).
- **FR-016**: Home data failures MUST degrade to cached content or a friendly retry state (Constitution Principle VII) — never a blank rail or crash.

**Tab structure & Account**

- **FR-017**: The signed-in app MUST present three tabs — Home, Scan, Account — replacing the current Explore tab with Account and standardizing the middle tab's label to "Scan" (critique D4).
- **FR-018**: The Account tab MUST show the user's avatar (with initials fallback), display name, grouped rows (Contact Info, Privacy Settings, Preferences, Link Social Media, Settings) at ≥56pt row height, and a visually separated Sign Out action requiring confirmation.
- **FR-019**: Account rows without built destinations MUST present a graceful "coming soon" state (no dead taps).

**Motion & styling (Constitution mandates V + Technology Stack)**

- **FR-020**: The Splash→Welcome, Welcome→Auth, and Auth→Home transitions MUST use non-linear spring physics (configured mass/stiffness/damping) via `react-native-reanimated`, MUST be interruptible mid-flight without visual clipping or state jumps, and MUST NOT use linear easing (Constitution Principle V). *(Framework named per explicit user directive and constitution — see Assumptions.)*
- **FR-021**: All views in this feature MUST be styled with NativeWind utility classes; raw style objects are limited to edge cases NativeWind cannot express (Constitution Technology Stack). *(Named per explicit user directive — see Assumptions.)*

**Provider simulation (this release — amendment of 2026-07-09)**

- **FR-022**: All authentication behaviors (FR-004..FR-010) MUST be served by an **on-device simulated auth provider** that faithfully reproduces a managed provider's observable behavior: account creation persists a device-local account registry; sign-in validates against that registry so unknown-account and wrong-password attempts produce the real FR-008 error states; password reset shows the enumeration-safe confirmation (FR-006) without sending mail; sessions persist, restore on relaunch, and purge on sign-out exactly per FR-009/FR-010.
- **FR-023**: The Apple and Google sign-in buttons MUST render and simulate their flows (brief busy state → signed in as a recognizable demo identity, e.g., "Demo User"), so the complete funnel UI and motion are testable with zero provider credentials; a simulated cancel path MUST exercise the silent-return edge case.
- **FR-024**: Screens MUST consume session state and auth operations through **one narrow session contract** (the same single source of truth as FR-011) such that swapping the simulated provider for the managed provider later requires no changes to any screen or navigation code — only the provider implementation behind the contract.
- **FR-025**: The simulated provider MUST be clearly confined as a development scaffold (unambiguous naming and location); shipping it as production authentication is out of bounds — managed-provider integration is a blocking prerequisite for any public release.

### Key Entities

- **UserAccount**: A person's identity with the managed auth provider — unique id, email, display name, optional avatar; created at registration, referenced everywhere a user is shown.
- **AuthSession**: The proof that a user is signed in — opaque tokens, expiry, and refresh material; lives only in secure storage; its presence/absence is the single routing source of truth.
- **UserProfile**: Display-facing attributes (first name, avatar) consumed by Home's greeting and the Account hub; derived from UserAccount.
- **RecentScanSummary**: A lightweight card-level view of a feature-001 ScanSession (thumbnail, date, garment count) powering the Home rail; links back to the full scan result.

## Navigation State: Auth Stack → Main App Stack *(educational outline, per explicit user request)*

How the routing layer keeps the signed-out and signed-in worlds securely separated — the *why* behind the architecture the plan will implement:

1. **Two route groups, one gate.** The app is split into a signed-out group (Welcome, Sign In, Create Account, Reset) and a signed-in group (the three tabs). Neither group ever contains the other's screens. A single guard — driven by session state — decides which group is mounted. Because the decision is *declarative* (the guard re-evaluates whenever session state changes) rather than imperative (`navigate('Home')` calls scattered around), there is no code path that can accidentally leave both worlds reachable at once.
2. **Session state is the only key.** The guard reads one source of truth: "is there a valid AuthSession in secure storage?" Sign-in writes it, sign-out deletes it, expiry invalidates it — and in all three cases the same guard re-runs and re-routes the entire app. This is why FR-011 demands a single source of truth: two flags that can disagree is how apps end up showing a dashboard to a signed-out user.
3. **Replace, don't push.** Crossing the gate *replaces* the navigation tree instead of pushing onto it. The auth screens are unmounted and removed from history, which is what makes FR-010's back-gesture guarantee structural (the screens no longer exist to go back to) instead of a fragile "disable the back button" patch.
4. **Tokens ride in the vault, not in params.** Navigation params are serializable, loggable, and restorable — exactly where secrets must never live. Tokens stay in hardware-backed secure storage (Keychain); screens ask "am I signed in?" through the session state, never by receiving a token as a prop or route param.
5. **The splash is the airlock.** The app holds on the splash until session restoration finishes, then opens exactly one door. This prevents the classic flash-of-signed-out-screen (Welcome appearing for 200ms before Home) — the guard never renders *anything* until it knows the answer.
6. **Deep links queue at the gate.** A deep link into a protected screen while signed out is captured as an intended destination, the funnel runs, and on success the user is delivered to the original target. The link never bypasses the guard because the protected group simply isn't mounted while signed out.
7. **Interruptible motion across the gate.** The gate transition animates with springs (FR-020); because the guard is state-driven, an interrupted animation can't strand the user "between" stacks — the mounted group is always unambiguous even mid-flight.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user completes the full funnel — first launch to Home dashboard — in under 90 seconds including form entry, with no dead ends or unexplained errors.
- **SC-002**: A returning user with a valid session reaches Home in under 3 seconds from cold launch, with zero signed-out screens flashed on the way.
- **SC-003**: 100% of funnel and dashboard transitions run as smooth, interruptible animations — no frame where an interrupted transition clips, jumps, or shows both worlds at once — verified across the quickstart's manual scenarios.
- **SC-004**: After sign-out, 0 authenticated screens are reachable via any gesture, and 0 session artifacts remain in local storage (verified by inspection).
- **SC-005**: A user with zero scans always sees a first-run invitation on Home (never an empty rail), and 95%+ of testers can reach their first scan from that state in one tap.
- **SC-006**: Every failure mode exercised (wrong/unknown credentials, simulated cancelled social sheet, expired session, dashboard data failure) resolves to a designed, recoverable state — zero blank screens or crashes. *(Offline-auth exercise moves to the provider-integration follow-up per the 2026-07-09 amendment.)*
- **SC-007**: All interactive targets in the new screens measure ≥44×44pt, with primary CTAs in the bottom 40% of the viewport (audited against the ergonomic ground rules).

## Assumptions

- **Auth provider**: Per the user's decision of 2026-07-08 the long-term target is a **managed auth provider** (Clerk was selected at plan time). **Amended 2026-07-09 (user decision)**: for this release the provider is **mocked on-device** — no provider account, dashboard setup, API keys, or provider SDK are required to build and validate the funnel. The mock reproduces the provider's observable contract (FR-022..FR-025); real-provider integration is a small follow-up feature that replaces only the implementation behind the session contract.
- **What the mock cannot prove**: real credential verification, actual reset emails, genuine Apple/Google identity, cross-device sessions, and offline/outage behavior. These are explicitly deferred to the provider-integration follow-up; everything user-visible in this spec's scenarios remains testable.
- **Named technologies in a spec**: FR-020/FR-021 and the Navigation State outline intentionally name `react-native-reanimated`, NativeWind, and routing concepts because the user's directive and the project constitution mandate them explicitly (Principles V + Technology Stack). This is a deliberate, documented exception to the "no implementation details" spec rule.
- **Tab restructure**: The design's three-tab layout (Home / Scan / Account) supersedes the current Home / Scan / Explore layout; Explore's content is retired or folded into Home. If Explore must survive, that is a scope change to raise at plan review.
- **Splash asset**: The existing animated icon/splash overlay (feature 001's `AnimatedSplashOverlay`) is evolved to the Satori-branded splash rather than built from scratch.
- **Account sub-screens** (Contact Info, Privacy, Preferences, Link Social Media, Settings detail): out of scope; only the hub screen with graceful placeholders ships in this feature.
- **Page 10 of the PDF** is treated as an unedited template artifact, not a requirement (critique D2).
- **Sign in with Apple** is required by App Store policy whenever third-party social sign-in (Google) is offered on iOS; both ship together.
- **Profile editing/avatar upload** is out of scope; avatar renders from provider data or initials.
