# Feature Specification: Wardrobe Vault (Scan History) + Hotspot Rendering Fix

**Feature Branch**: `005-wardrobe-vault`

**Created**: 2026-07-12

**Status**: Draft — awaiting user approval before planning

**Input**: User description: "Implement the 'Wardrobe Vault' history feature, UI/UX inspired by Shazam's playbook, while fixing a rendering regression in the scan layer: (1) hotspots not appearing during active scan/result states — ensure high z-indexing (z-50) on InteractionHotspot and a non-clipping parent wrapper; (2) a swipe-down gesture from the primary scan screen smoothly reveals the Vault (react-native-reanimated); (3) a local data engine using expo-file-system moving scanned garment images from temp caches into permanent document storage, with metadata (UUID, local URI, timestamp, SerpApi ProductMatch array) in structured local storage; (4) an image-dominant Vault grid with micro-interactions, where tapping a historical card opens the existing GarmentDetailModal."

---

## Design Reference *(the Shazam playbook, translated)*

Shazam's core loop the Vault borrows: the app opens ready to capture (the listen/scan screen IS home base), history lives one **downward swipe** away rather than behind a tab, every past capture is a rich visual card, and re-opening a card replays the full result — instantly, offline, because results were saved the moment they were found. Translated here: Scan stays the hero screen; the Vault peeks from above it; every completed scan becomes a permanent, offline-readable "look" card; tapping a card reopens the shopping results with zero re-searching.

**Grounding for the bugfix (code inspected 2026-07-12)**: `InteractionHotspot.tsx` currently declares no stacking order at all, and neither the scan screen's photo container nor the overlay components declare clipping behavior — which platform defaults treat differently (absolute children outside parent bounds clip on Android by default, not on iOS). The user reports hotspots not appearing during active scan/result states; the directed hardening plus a verified root cause are both in scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Garment Hotspots Visibly Anchor on Results (Priority: P1) 🔴 regression fix

A person completes a scan and sees the interaction hotspots pop onto each detected garment — above the photo, above the neon trace, never hidden, never clipped at the photo edges — and can tap any of them to open that garment's matches.

**Why this priority**: The hotspots are the product's tap targets; while they don't render, scanning is decorative. A regression outranks all new work.

**Acceptance Scenarios**:

1. **Given** a completed single-person scan with detected garments, **When** results render, **Then** every hotspot is visible above the photo and the neon trace overlay, at its garment's position, and tappable.
2. **Given** a garment whose region sits at the photo's edge, **When** its hotspot renders (clamped inside the frame), **Then** no part of the hotspot or its sonar ring is clipped by any ancestor container.
3. **Given** the fix, **When** the stacking is inspected, **Then** hotspots carry an explicit elevated stacking order (per user directive: high z-index, z-50 class equivalent) and every ancestor between the hotspot layer and the screen root is verified non-clipping for absolutely-positioned children.
4. **Given** the regression's root cause, **When** the fix lands, **Then** the actual cause is identified and documented (not just papered over) so the same class of bug is preventable.

---

### User Story 2 - Every Scan Is Saved to the Vault, Permanently (Priority: P1)

Every completed scan quietly becomes a Vault entry: the photo is moved out of temporary cache into permanent app storage (it survives app restarts and OS cache purges), and the entry records when it happened and every product match found — so the whole look is re-openable later, offline, with no re-searching.

**Why this priority**: The persistence engine is the Vault's foundation; the gesture and the grid are only worth building on top of durable data. It also fixes a latent loss bug: scan photos currently live in temp cache paths the OS may purge, which would leave the Home rail's thumbnails dangling.

**Acceptance Scenarios**:

1. **Given** a scan completes with results, **When** the entry is written, **Then** the image file resides in permanent app document storage (not a temp/cache path) and the entry's metadata records a unique id, the permanent image location, the capture timestamp, and the product-match array in the app's canonical six-field match shape.
2. **Given** the app is force-quit and relaunched (or the OS purges caches), **When** the Vault is opened, **Then** every previously saved entry renders fully — image and matches — from local storage alone.
3. **Given** a scan whose photo move or metadata write fails mid-way, **When** the failure occurs, **Then** the scan experience itself is unaffected (saving is best-effort and never blocks or crashes the scan), and no half-written entry appears in the Vault.
4. **Given** airplane mode, **When** a saved entry is opened, **Then** its matches render completely from the stored data.

---

### User Story 3 - Swipe Down from Scan to Reveal the Vault (Priority: P2)

From the scan screen's ready-to-capture state, the person drags downward and the viewport follows their finger — the scan screen slides away as the Wardrobe Vault surfaces from above, exactly like pulling down Shazam's history. Release past the threshold and it springs open; release early and it springs back. An upward swipe (or the close affordance) returns to scanning with the same physics.

**Why this priority**: This is the signature interaction that makes history feel like part of the scanning ritual rather than a buried screen; it depends on US2's data existing.

**Acceptance Scenarios**:

1. **Given** the scan screen in its capture state, **When** the user drags down from the top region (a visible pull affordance marks it), **Then** the transition tracks the finger 1:1, is cancellable mid-gesture, and settles open or closed with spring physics based on release position and velocity — never a hard cut (Constitution V).
2. **Given** the Vault is open, **When** the user swipes up or taps the close affordance, **Then** the viewport returns to the scan screen with the same interruptible physics.
3. **Given** an in-progress capture/review (photo taken, results on screen), **When** the user interacts, **Then** the vault gesture does not hijack review-phase gestures — it is armed only in the capture state.
4. **Given** a mid-transition interruption (finger re-catches the surface), **Then** the surface follows from its current position with no jump.

---

### User Story 4 - Browse the Vault, Reopen Any Look (Priority: P2)

The Vault presents scan history as an image-dominant grid of look cards — photo-first, newest at top, with capture date and match count as quiet metadata — with tactile micro-interactions (staggered entrance, press-down feedback). Tapping a card reopens that look's product matches in the existing garment detail experience, instantly, from stored data.

**Why this priority**: The consumption surface for everything US2 saved; ships after the data and the door exist.

**Acceptance Scenarios**:

1. **Given** saved entries, **When** the Vault opens, **Then** entries render as a photo-dominant grid, newest first, each card showing its image, capture date, and match count; cards enter with a staggered spring and give pressed-state feedback.
2. **Given** a card tap, **When** the look opens, **Then** the existing garment detail experience presents that entry's stored matches (store links tappable) with no network fetch required.
3. **Given** an empty Vault, **When** it opens, **Then** a designed first-run state invites the user to scan (never a blank grid).
4. **Given** an entry whose image file is missing or whose record is corrupt, **When** the Vault renders, **Then** that entry degrades gracefully (placeholder or exclusion + retryable state) — never a crash or a broken grid.
5. **Given** dozens of entries, **When** scrolling, **Then** the grid stays smooth (no jank from full-size images in cells).

---

### Edge Cases

- **Hotspot regression scope**: the fix must hold on both scanning surfaces (camera flow and demo scan) and in both trace states (tracing/settled).
- **Storage pressure**: image files accumulate; the Vault must expose total footprint honestly (entry count at minimum) and deletion of an entry must remove both metadata and its image file — no orphaned files.
- **Duplicate saves**: re-viewing matches for an already-saved scan updates the existing entry (by scan id), never duplicates it.
- **Migration**: existing Home-rail summaries (feature 002's store) reference temp-cache URIs that may already be dead; the Vault does not import them (fresh start) — the rail keeps working as-is until consolidation (see Assumptions).
- **Gesture conflicts**: the pull-down must not fight the camera's own controls (shutter, import, settings) or system edge gestures; the arming region and affordance make it discoverable without stealing taps.
- **Very first launch**: no entries + gesture discoverability — the pull affordance and the empty state teach the mechanic.
- **Deletion mid-view**: deleting an entry whose detail modal is open closes gracefully.

## Requirements *(mandatory)*

### Functional Requirements

**Hotspot rendering fix (regression — US1)**

- **FR-001**: Interaction hotspots MUST render above the photo and all overlay layers on both scanning surfaces, with an explicit elevated stacking order (user directive: z-50-class stacking) rather than relying on sibling render order.
- **FR-002**: Every ancestor container between the screen root and the hotspot layer MUST be verified non-clipping for absolutely-positioned children (explicit overflow-visible where platform defaults differ), so edge-adjacent hotspots and their sonar rings render whole.
- **FR-003**: The root cause of the disappearance MUST be identified and recorded (retrospective entry) as part of the fix — the directed hardening (FR-001/FR-002) ships regardless, but not as an unexamined patch.

**Vault persistence engine (US2)**

- **FR-004**: On scan completion, the system MUST move (not copy-and-forget) the scanned image from temporary cache into permanent per-app document storage, and MUST reference only the permanent location thereafter.
- **FR-005**: Each Vault entry MUST record: a unique identifier (UUID), the permanent local image URI, the capture timestamp, and the array of product matches in the app's canonical six-field match shape (`id`, `title`, `source_url`, `thumbnail`, `price`, `store_name`); matches found after entry creation (per-garment lookups) MUST merge into the same entry by scan id — no duplicates.
- **FR-006**: Entry metadata MUST live in a structured, versioned local store that survives app restarts and OS cache purges, is readable with zero network, and degrades to a designed error state (never a crash) when unreadable.
- **FR-007**: Vault writes MUST be best-effort and non-blocking: a failed image move or metadata write never disturbs the scan experience, and partial failures never produce half-entries (write metadata only after the image is durably placed).
- **FR-008**: Deleting an entry MUST remove both its metadata record and its image file atomically from the user's perspective (no orphaned images, no dangling records).

**Vault reveal gesture (US3)**

- **FR-009**: The scan screen's capture state MUST offer a visible pull-down affordance; dragging it (or the arming region) MUST translate the viewport 1:1 with the finger, revealing the Vault from above.
- **FR-010**: Release MUST settle open or closed via spring physics using both position and velocity thresholds; the transition MUST be interruptible mid-flight in both directions with no jumps or clipping (Constitution V; named `react-native-reanimated` per standing user directive/constitution — see Assumptions).
- **FR-011**: The gesture MUST be armed only in the capture state (never during photo review or while a modal/failure overlay is presented) and MUST NOT capture taps intended for camera controls.
- **FR-012**: The Vault MUST be dismissible by upward swipe and by an explicit close affordance, returning to the exact scan state the user left.

**Vault presentation (US4)**

- **FR-013**: The Vault MUST render entries as an image-dominant grid (photo-first cards, newest first) showing capture date and match count per card, with staggered spring entrances and pressed-state feedback; scrolling MUST remain smooth with dozens of entries (thumbnail-scaled rendering, not full-resolution images in cells).
- **FR-014**: Tapping a card MUST open the existing garment detail experience presenting that entry's stored matches — link-out taps included — entirely from local data (no refetch).
- **FR-015**: The empty Vault MUST show a designed first-run invitation; unreadable entries or missing image files MUST degrade per-entry (placeholder/exclusion) without breaking the grid (Constitution VII).

### Key Entities

- **VaultEntry**: One saved look — UUID, permanent local image URI, capture timestamp (ISO), match count, and the ProductMatch array (canonical six-field shape). Created at scan completion; merged into by later per-garment match fetches (keyed by scan id); deleted as a unit with its image.
- **VaultIndex**: The structured, versioned local metadata store enumerating entries (newest first) — the single read source for the grid; entries embed or reference their match arrays.
- **ProductMatch** *(existing, feature 003)*: unchanged six-field shape; the Vault's canonical stored match format — matches from the camera flow's per-garment lookups are normalized into it at write time (see Assumptions).
- **VaultRevealState**: The gesture-driven position of the scan↔vault surface (closed ↔ open), owned by gesture/physics — never a boolean toggle mid-flight.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On both scanning surfaces, 100% of detected garments present a visible, tappable hotspot in result states — verified across edge-positioned garments and both trace modes; zero clipped or hidden hotspots.
- **SC-002**: 100% of completed scans appear in the Vault with image + matches intact after force-quit/relaunch, and a sampled entry opens fully in airplane mode.
- **SC-003**: The pull-down reveal tracks the finger with no perceptible lag, settles with spring physics in under 600ms from release, and survives mid-gesture reversal with zero visual jumps — at 60fps with the perf monitor on.
- **SC-004**: From the scan screen, a returning user reaches a past look's shopping results in ≤2 gestures (pull down, tap card) and <3 seconds, with zero network.
- **SC-005**: Vault scrolling with 50 entries shows no dropped-frame stutter; deleting an entry leaves zero orphaned image files (verified by inspecting the storage directory).
- **SC-006**: Zero regressions in the existing scan flow: capture, segmentation, hotspot tap → detail modal, and failure overlays all behave exactly as before the vault gesture was added.

## Assumptions

- **Named technologies** (`react-native-reanimated` for the gesture physics, `expo-file-system` for the storage engine, `GarmentDetailModal` and `InteractionHotspot` by name, z-50 stacking): explicit user directive + standing constitution mandates — the documented exception to the no-implementation-details rule, as in features 002–004.
- **expo-file-system is not currently installed** and is a native module: adding it requires a dependency install and a dev-client rebuild (`npx expo run:ios`). This deliberately ends the zero-new-deps streak per the user's explicit direction.
- **Canonical match shape**: the Vault stores matches as feature 003's six-field `ProductMatch`. The camera flow's per-garment results (feature 001's `MatchedProduct`/`SimilarItem`, which carry richer fields) are normalized into that shape at write time; the richer originals remain available in-session as today. If loss-less storage of 001's shape matters, that is a plan-review flag.
- **Entry granularity**: one Vault entry per completed scan ("look"), with all of that scan's garment matches merged into one array — matching the directive's "image + ProductMatch array" model. Demo-scan runs are also saved (they produce real matches) and are indistinguishable from camera scans in the Vault.
- **Home rail relationship**: feature 002's recent-scans store (capped summaries in secure storage) keeps powering the Home rail unchanged this feature; consolidating the rail onto the Vault (richer, uncapped, durable) is the natural follow-up. No migration of old rail entries — their temp-cache URIs may already be dead.
- **Vault reveal surface**: the vault presents over/above the scan screen within the scan tab's context (Shazam-style), not as a new tab — the three-tab structure (Home/Scan/Account) is unchanged.
- **Retention**: no automatic cap or expiry on entries this feature (user's device, user's storage); entry deletion is user-initiated. A storage-management surface beyond per-entry delete is out of scope.
- **Detail reuse**: the existing garment detail experience is fed stored matches directly (its refresh/retry affordance may be disabled or hidden for offline vault entries — plan decision).
