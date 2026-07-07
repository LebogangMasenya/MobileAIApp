# Feature Specification: Camera Scan-to-Match Garment Identification

**Feature Branch**: `001-camera-scan-match`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Specify the core camera scan-to-match flow for garment identification. The user would open the camera section of the app, point to a person wearing an outfit, then click capture. First there would be a IOS26-27 animation around the person of a glowing outline showing the person is segmented, then on the same photo, bubble icons pop up on the different clothing items. Clicking on a bubble icon would open a popup modal with details of the clothing item and a list of stores to find them with a CTA to go to the store. It would show items similar to that item as well included within the list. An example flow would be a user sees a post of an influencer with a nice jacket but the influencer mentions it is from a store in a different country altogether, the app would then be able to find something similar online but within the region or preferences of the user."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture or Import and Segment an Outfit (Priority: P1)

A user opens the camera section of the app and either points the live camera
at a person wearing an outfit and taps capture, or imports an existing photo
(e.g., a photo library image or a screenshot of a social media post). The
app visually confirms it has recognized and segmented the person by
animating a glowing outline around them on the photo, then surfaces a
tappable bubble icon over each distinct clothing item it detected.

**Why this priority**: This is the foundational "magic moment" of the
product. If segmentation and item detection don't work reliably and feel
instant, no downstream matching or monetization value can be delivered.

**Independent Test**: Using both a live-captured photo and an imported photo
of a person wearing multiple distinct garments (e.g., jacket, pants, shoes),
confirm the segmentation outline animates around the person, followed by one
bubble icon appearing over each distinct garment, for both input paths.

**Acceptance Scenarios**:

1. **Given** the camera is open and a person wearing an outfit is in frame,
   **When** the user taps capture, **Then** a glowing outline animation
   traces the segmented person on the captured photo.
2. **Given** the user chooses to import an existing photo instead of using
   the live camera, **When** the photo is selected, **Then** the same
   glowing outline segmentation animation runs on the imported photo.
3. **Given** a photo (captured or imported) has finished segmenting, **When**
   segmentation completes, **Then** a bubble icon appears positioned over
   each distinct clothing item detected on the photo.
4. **Given** a person is wearing only one recognizable garment, **When** the
   photo is captured or imported and segmented, **Then** exactly one bubble
   icon appears (no bubbles are placed over non-garment regions).

---

### User Story 2 - View Garment Details and Store Matches (Priority: P1)

A user taps a bubble icon on a segmented photo and sees a modal with the
identified garment's details, a list of stores where it (or something very
close to it) can be found, a call-to-action to visit each store, and a list
of visually similar items.

**Why this priority**: This is where the app delivers on its core value
proposition — turning an identified garment into a purchase opportunity —
and is the basis of the app's affiliate monetization model.

**Independent Test**: On a segmented photo with at least one bubble, tap the
bubble and confirm the modal displays garment details, at least one store
listing with a working call-to-action, and a non-empty similar items list
(or an explicit no-match state).

**Acceptance Scenarios**:

1. **Given** a segmented photo with identified garment bubbles, **When** the
   user taps a bubble, **Then** a modal opens showing that garment's details
   (e.g., type/description) and a list of stores offering it or a close
   match.
2. **Given** the store list is shown in the modal, **When** the user taps a
   store's call-to-action, **Then** the app directs the user toward that
   store's listing for the item.
3. **Given** the modal is open, **When** the user views the similar items
   section, **Then** each entry shown is visually similar to the tapped
   garment and sourced from a store consistent with the user's region or
   preferences.
4. **Given** the detail modal is open, **When** the user dismisses it,
   **Then** the segmented photo and its bubbles remain available so the user
   can tap a different bubble.

---

### User Story 3 - Find a Regionally Available Alternative (Priority: P2)

A user identifies a garment (for example, from a photo of an influencer)
whose only known source is a store outside their region. The app surfaces
visually similar items that are actually available to the user, based on
their region or stated preferences.

**Why this priority**: This is the app's core "anti-gatekeeping"
differentiator, but it builds on User Stories 1 and 2 being functional — it
adds regional-availability awareness on top of basic matching.

**Independent Test**: Using a photo of a garment whose only known retailer is
outside the user's configured region, open its bubble's detail modal and
confirm the similar items list includes at least one item available from a
retailer within the user's region, or an explicit message if none exists.

**Acceptance Scenarios**:

1. **Given** a detected garment whose only known retailer is outside the
   user's region, **When** the user opens its detail modal, **Then** the
   similar items list includes at least one item available from a retailer
   within the user's region.
2. **Given** no regionally available similar item exists for a detected
   garment, **When** the user views its detail modal, **Then** the app
   clearly states that no regional match was found rather than showing an
   empty or broken list.

---

### Edge Cases

- What happens when the captured photo contains no identifiable person or
  clothing items? The app must show a clear, friendly failure state that
  invites the user to retry rather than presenting a blank or broken result.
- How does the system handle multiple people in the same captured frame?
- What happens when segmentation succeeds for a garment but no store or
  similar item can be found for it?
- What happens when camera permission is denied or no camera is available on
  the device? (The import path remains available as a fallback.)
- What happens when the user denies photo library access while attempting to
  import a photo?
- What happens when an imported photo is low-resolution, heavily cropped, or
  otherwise unsuitable for reliable segmentation?
- What happens when network connectivity is lost after capture, while store
  or similar-item results are being retrieved?
- What happens when a garment is heavily occluded or only partially visible
  (e.g., behind another person or object, or cropped at the frame edge)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated camera section where the user
  can activate the device camera to view a live preview before capturing.
- **FR-002**: System MUST allow the user to capture a still photo from the
  live camera preview when a person is in frame.
- **FR-002a**: System MUST also allow the user to import an existing photo
  (e.g., a photo library image or a screenshot of a social media post) as an
  alternative entry point to the same segmentation and matching flow used
  for live captures.
- **FR-003**: System MUST display a segmentation animation (a glowing
  outline) around the detected person on the captured photo before any item
  bubbles appear.
- **FR-004**: System MUST detect and distinguish each individual clothing
  item worn by the segmented person in the captured photo.
- **FR-005**: System MUST display a tappable bubble icon positioned over each
  detected clothing item on the captured photo.
- **FR-006**: System MUST open a detail view showing the identified garment's
  information when its bubble is tapped.
- **FR-007**: The detail view MUST list one or more stores where the
  identified item, or a closely matching item, can be found.
- **FR-008**: Each store listing in the detail view MUST include a
  call-to-action that directs the user toward completing a purchase at that
  store.
- **FR-009**: The detail view MUST show a list of items visually similar to
  the selected garment.
- **FR-010**: The similar items list MUST prioritize items available for
  purchase within the user's region, determined by an inferred default
  (device locale) that the user can explicitly override with a stated
  preference at any time.
- **FR-010a**: System MUST let the user view and change their region
  preference, and MUST use the overridden value in place of the inferred
  default once set.
- **FR-011**: When the identified garment's only known source is unavailable
  to the user's region, the system MUST surface regionally available similar
  alternatives instead.
- **FR-012**: System MUST show a clear, non-technical failure state when a
  captured photo contains no identifiable person or clothing items.
- **FR-013**: System MUST show a clear failure state when no store or similar
  item can be found for a specific detected garment.
- **FR-014**: Dismissing the detail modal MUST preserve the segmented photo
  and its bubbles so the user can select a different bubble afterward.
- **FR-015**: If camera or photo library access is denied, the system MUST
  guide the user to the remaining available input path (import or live
  capture, respectively) rather than presenting a dead end.

### Key Entities *(include if feature involves data)*

- **Scan Session**: A single capture event; holds the captured photo, its
  capture timestamp, and the set of garments detected within it.
- **Detected Garment**: One segmented clothing item within a Scan Session;
  has a position on the photo (for bubble placement), a category/type, and a
  detection confidence.
- **Matched Product**: A specific store listing identified as matching, or
  closely matching, a Detected Garment; includes the offering store, region
  availability, and the destination for its call-to-action.
- **Similar Item**: A Matched Product identified as visually similar (but not
  identical) to a Detected Garment, ranked by similarity and regional
  availability.
- **Store**: A retailer that offers Matched Products, associated with the
  region(s) it serves.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users see item bubbles appear on a captured photo within 5
  seconds of tapping capture, for a typical single-person outfit.
- **SC-002**: At least 90% of clearly visible, distinct clothing items in a
  captured photo receive a corresponding bubble.
- **SC-003**: Users can go from tapping a bubble to viewing store and similar
  item options within 2 seconds.
- **SC-004**: When a garment's primary source is outside the user's region,
  the app surfaces at least one regionally available similar item in at
  least 80% of such cases.
- **SC-005**: In usability testing, 90% of users can independently go from
  capturing a photo to reaching a store call-to-action for a garment of
  their choice, without assistance.

## Assumptions

- The scan flow supports two equally valid entry points: live camera capture
  and importing an existing photo (e.g., photo library or a social media
  screenshot); both feed the same segmentation and matching pipeline.
- The user's region defaults to an inferred value (device locale) and can be
  explicitly overridden by the user at any time; the override, once set,
  takes precedence for similar-item ranking.
- No user account or login is required to use the core scan-to-match flow;
  results are not assumed to persist beyond the current session unless a
  future amendment specifies otherwise.
- A captured frame may contain multiple garments worn by one person, and all
  clearly visible distinct garments receive their own bubble; handling of
  multiple distinct people in a single frame is treated as an edge case
  rather than a primary scenario for this initial scope.
- Store call-to-actions may route through affiliate-tracked links consistent
  with the project's affiliate monetization model; this spec does not
  mandate a specific tracking mechanism.
