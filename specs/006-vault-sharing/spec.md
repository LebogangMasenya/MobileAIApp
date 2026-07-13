# Feature Specification: Vault Sharing Groundwork (Public Toggle + Share a Garment)

**Feature Branch**: `006-vault-sharing`

**Created**: 2026-07-13

**Status**: Draft (respecced same day per user direction: **true per-garment crops**, schema extended as necessary) — approved for planning via user's `/speckit-plan` instruction

**Input**: User description: "Extend feature 005 to lay the groundwork for style sharing. (1) A visual 'Make Vault Public' toggle with Reanimated transitions. (2) A native sharing utility compiling local vault items into a clean shareable text payload with **cropped images** and purchase links. **Revision (2026-07-13)**: per-garment crops are required — extend the vault schema if necessary."

---

## Groundwork framing *(what "public" can honestly mean today)*

There is no server-side social layer yet — accounts are the device-local mock (feature 002) and vault data never leaves the phone (feature 005). This feature lays **groundwork**: the toggle is a real, persisted visibility preference with a designed animated presence, and its observable meaning today is that it **arms the sharing surface**. The share payload itself is the second half of the groundwork: a per-garment crop with that garment's purchase links — the exact unit a future public style profile will publish.

## The schema consequence *(user-approved)*

True per-garment crops require data the feature-005 vault does not hold: each garment's position in the photo, and which matches belong to which garment (the current store flattens all of a look's matches into one array). The vault record therefore extends to a versioned second shape: each saved look carries its **garments** — category, position region, and *that garment's own matches* — alongside the existing look-level data. Existing saved entries migrate losslessly (they simply have no garment breakdown and share as whole looks).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make the Vault Public (Priority: P1)

In the Wardrobe Vault's header area, the person finds a "Make Vault Public" toggle. Flipping it animates smoothly between states (never a hard swap), the choice persists across app restarts, and the vault visibly changes mode: public reveals share affordances on the header and on every look card; private hides them again.

**Why this priority**: The toggle gates the whole sharing surface — and the persisted preference is the groundwork future public profiles will read.

**Acceptance Scenarios**:

1. **Given** the vault open, **When** the user flips the toggle, **Then** the transition animates with spring physics (interruptible — flipping back mid-animation retargets smoothly, no snap), and a state label ("Public" / "Private") reflects the change.
2. **Given** the vault is public, **When** the grid renders, **Then** each look card carries a share affordance and the header shows the public state; **When** private, **Then** all share affordances are absent (not merely disabled), with the appearance/disappearance itself animated.
3. **Given** a toggle change, **When** the app is force-quit and relaunched, **Then** the vault reopens in the chosen state.
4. **Given** the very first toggle to public, **When** it flips, **Then** a one-line explanation sets expectations honestly (sharing is enabled now; public style profiles come later) — shown once, never again.

---

### User Story 2 - Share a Garment: Crop + Its Purchase Links (Priority: P1)

With the vault public, the person taps a look's share affordance. If the look has one garment (or none broken out), sharing proceeds directly; if it has several, a quick picker presents each garment (thumbnail crop + category) plus a "whole look" option. The native share sheet then opens with the **cropped image of that garment** and a tidy text block: a short header, then *that garment's* product matches as titled lines with price, store, and purchase link.

**Why this priority**: The per-garment crop-plus-links payload is the deliverable half of the groundwork — the publishable unit future social features reuse.

**Acceptance Scenarios**:

1. **Given** a multi-garment look, **When** share is tapped, **Then** a picker shows each garment (cropped thumbnail + category) and a "whole look" option; choosing a garment opens the native share sheet with that garment's cropped image attached (where the platform supports image+text) and only that garment's match lines.
2. **Given** a single-garment look, **When** share is tapped, **Then** the sheet opens directly with the garment crop + its matches — no unnecessary picker.
3. **Given** "whole look" is chosen (or the entry has no garment breakdown — e.g. pre-extension entries, demo entries), **When** the sheet opens, **Then** the full look photo attaches and the text block carries the look's matches.
4. **Given** a crop, **When** inspected, **Then** it frames the garment's stored region with sensible breathing room — recognizable, not sliver-tight, never distorted.
5. **Given** a match without a price, **When** the payload composes, **Then** its line renders gracefully without a price (never "null" or a fabricated value).
6. **Given** the share sheet is cancelled, **When** the user returns, **Then** the vault is exactly as they left it — no toast, no error.
7. **Given** crop generation fails (missing region, unreadable image), **When** sharing proceeds, **Then** it degrades to the full look photo + text — sharing never dead-ends on a cropping problem.

---

### User Story 3 - Existing Vaults Keep Working (Priority: P2)

A person with looks saved before this feature opens the vault after updating: everything is still there, everything still opens, and every old look is shareable as a whole look. New scans from now on carry the garment breakdown automatically.

**Acceptance Scenarios**:

1. **Given** a vault written under the previous schema, **When** the app updates and the vault opens, **Then** all entries render and open exactly as before (zero data loss), and sharing them offers the whole-look payload.
2. **Given** a new scan after the update, **When** it lands in the vault, **Then** its entry carries per-garment records (category, region, that garment's matches as they're fetched), and sharing offers the garment picker.

---

### Edge Cases

- **Platform payload differences**: some platforms' native share accepts an image + text; others text only. The text block must stand alone (links intact) when the image cannot ride along.
- **Demo entries** (remote image, no garment regions): always whole-look, text-first sharing; never an error about missing crops.
- **Garment with a region but zero fetched matches**: shareable as crop + short caption (no empty "matches" section); the picker shows it with a "no links yet" hint.
- **Very long titles / many matches**: lines truncate cleanly; match lines cap at the top N with an overflow note.
- **Rapid toggle flipping**: preference settles to the last state; animations retarget; the persisted value never disagrees with the visuals.
- **Corrupt/unreadable preference**: defaults to **private** (the safe direction for anything named "public").
- **Crop cache pressure**: generated crops are derived data — deletable/regenerable at any time, removed with their entry, never the only copy of anything.

## Requirements *(mandatory)*

### Functional Requirements

**Visibility toggle (US1)**

- **FR-001**: The vault MUST present a "Make Vault Public" toggle in its header; its state transition MUST be spring-animated and interruptible (Reanimated per explicit user directive — see Assumptions), never an instant swap.
- **FR-002**: The visibility preference MUST persist across restarts, defaulting to **private**; an unreadable stored value MUST also resolve to private.
- **FR-003**: Public state MUST reveal share affordances (header and per-card); private MUST remove them entirely; the affordances' appearance/disappearance MUST be animated.
- **FR-004**: The first flip to public MUST present a brief, honest, once-only explanation of what public means today.

**Schema extension & migration (US2/US3)**

- **FR-005**: The vault record MUST extend to carry, per saved look, a list of its garments — each with a stable id, category label, the garment's position region within the photo, and **that garment's own product matches** — while retaining the look-level image, timestamp, and aggregate match view the grid already uses.
- **FR-006**: The saved photo's pixel dimensions MUST be recorded with each new entry (region→pixels conversion needs them; they are known at capture).
- **FR-007**: The store MUST migrate previous-schema vaults losslessly and automatically on first read: existing entries remain intact, render identically, and are shareable as whole looks (no garment breakdown fabricated).
- **FR-008**: New scans MUST populate the garment records as data becomes available (garments at scan completion / person segmentation; each garment's matches as they are fetched) — merged, never duplicated.

**Per-garment crops (US2)**

- **FR-009**: Sharing a garment MUST attach a cropped image of that garment generated from the saved look photo and its stored region, framed with modest padding around the region (recognizable, aspect-preserved, never distorted).
- **FR-010**: Crops MUST be generated on demand and MAY be cached as derived data (regenerable, removed with their entry); crop generation failure MUST degrade to the full look photo — sharing never fails on a crop problem.

**Share flow & payload (US2)**

- **FR-011**: With the vault public, a look's share affordance MUST lead to: direct sharing (single/no garment breakdown) or a garment picker (multiple garments: cropped thumbnail + category each, plus "whole look").
- **FR-012**: The native share sheet MUST receive: the chosen image (garment crop or look photo, attached where the platform supports image+text) and a clean text block — a one-line header, then the chosen garment's (or look's) match lines: title (truncated sanely), price when present (cleanly omitted when null), store name, purchase link verbatim — capped at the top N (default 6) with an overflow note.
- **FR-013**: The payload MUST contain nothing beyond the composed content — no identifiers, raw structures, or debug fields.
- **FR-014**: A cancelled sheet MUST return silently to an unchanged vault; an OS-level failure MUST surface as a gentle inline notice, never a crash; zero-match targets MUST still share (image + short caption).
- **FR-015**: Payload composition MUST be a pure, testable function (entry + optional garment selection in → payload out) so future social features reuse it unchanged.

### Key Entities

- **VaultEntry v2** *(extends feature 005's record)*: adds `garments` (list of VaultGarment) and the photo's pixel dimensions; retains id, scan link, image, timestamp, aggregate matches, source. Versioned envelope bumps; v1 migrates losslessly with empty garment lists.
- **VaultGarment**: one garment within a saved look — stable id, category label, normalized position region within the photo, and its own ProductMatch list (merged as fetched). The shareable unit.
- **VaultVisibilityPreference**: the persisted public/private choice — device-local, default private.
- **VaultSharePayload**: the composed share content — chosen image reference (garment crop or look photo) + formatted text block. Pure derivation; never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Toggle flip → settled animated state in under 500ms, interruptible with zero snaps; persisted state survives force-quit/relaunch in 100% of trials.
- **SC-002**: From a public vault, sharing a garment takes ≤3 taps to a populated share sheet (affordance → picker → sheet; ≤2 when no picker), and the received payload (verified via Notes/Messages) shows the garment crop + only that garment's links — zero raw/debug fields, zero "null" price artifacts.
- **SC-003**: Crops are visually correct for 100% of sampled garments (garment recognizable and centered with padding, no distortion), including edge-of-photo regions.
- **SC-004**: A vault created before the update opens with 100% of entries intact and shareable as whole looks; new scans produce garment-level shares with per-garment link grouping verified against what the detail modal shows.
- **SC-005**: Share affordances present in 100% of public renders, absent in 100% of private renders; cancelled shares produce zero side effects; forced failures resolve to the designed notice.
- **SC-006**: Zero regressions in feature 005: reveal gesture, grid, entry open/delete, persistence all behave exactly as before.

## Assumptions

- **Named technologies** (Reanimated toggle transitions; the feature-005 surfaces by name): explicit user directive + constitution — documented exception, precedent 002–005.
- **Cropping requires a new image-manipulation dependency** (a native module — the second dev-client rebuild of this workstream, after feature 005's storage module). Accepted as the cost of the user's true-crops decision (2026-07-13); the specific package and its SDK-54 API surface are plan-phase, verified against installed types per house rule.
- **Native share = the platform share sheet** via the framework's built-in capability (no extra sharing dependency). iOS attaches image + text; Android's built-in path is text-only — the text block stands alone by design, and a richer cross-platform sharing module remains the recorded follow-up.
- **One image per share**: platform sheets reliably carry a single image, which is why the share unit is a garment (its crop) or the whole look — never a multi-image bundle. Multi-garment "collage" sharing is out of scope.
- **Match↔garment grouping** exists only for scans completed after this feature (the provider fetches matches per garment, so the grouping is natural going forward); historical entries cannot be retro-grouped and share as whole looks.
- **Demo entries** (feature 003): remote image, no regions — whole-look, text-first sharing.
- **Preference storage**: the app's existing small-settings mechanism; default private; nothing to sync to.
- **Scope bounds**: no share analytics, link shortening, collage composition, or social/profile surfaces — future features on this groundwork.
