# Research: Camera Scan-to-Match Garment Identification

**Input**: `plan.md` Technical Context, `spec.md`, `.specify/memory/constitution.md` v2.0.1, and user-directed stack: Expo, NativeWind, React Native Reanimated, hybrid cloud/edge AI layer.

## 1. Camera & photo-import APIs

**Decision**: Use `expo-camera` for the live capture surface and `expo-image-picker` for the import path, called directly from feature hooks — no custom wrapper SDK around either module.

**Rationale**: Constitution Principle IV (Anti-Abstraction Mandate) requires using a framework primitive directly when it can accomplish the task cleanly. Both modules are first-class in the Expo managed workflow (no custom dev client needed just for capture/import), which keeps the mobile environment on the standard Expo prebuild path per the Technology Stack & Conventions section — the custom dev client is only pulled in later for the native vision module (see §3).

**Alternatives considered**:
- `react-native-vision-camera` — richer frame-processor API, but requires a custom dev client immediately and duplicates capability `expo-camera` already covers for a single still-photo capture use case. Rejected for v1; revisit only if live frame-by-frame segmentation preview (not just post-capture) becomes a requirement.
- A shared internal `useMediaSource()` wrapper around both modules — rejected as an unnecessary abstraction layer over two already-simple, stable APIs (Anti-Abstraction Mandate).

## 2. Animation approach for segmentation outline, bubbles, and modal

**Decision**: All motion (glowing outline trace, bubble entrance/exit, modal open/close, camera-button → loader morph) is built with `react-native-reanimated` shared values and `useAnimatedStyle`, driven by `withSpring` configured per-transition (`mass`, `damping`, `stiffness`), never `withTiming`/`Easing.linear`, per Constitution Principle V.

**Rationale**: Directly mandated by the constitution; also keeps all motion on the UI thread (worklets), supporting Principle III (Performance First — no main-thread JS blocking during a visual operation).

**Alternatives considered**:
- React Native's built-in `Animated` API — rejected outright; cannot satisfy the non-linear, interruptible requirement as cleanly and runs primarily on the JS thread.
- A third-party animation wrapper (e.g., Moti) — rejected under Anti-Abstraction Mandate; Reanimated primitives are sufficient and Moti would add an indirection layer for no functional gain here.

**Note on NativeWind interplay**: `useAnimatedStyle` return values are plain style objects, not Tailwind classes — this is an inherent, expected exception to "NativeWind for styling," not a constitution violation, since animated interpolated values cannot be expressed as static utility classes. No Complexity Tracking entry needed; documented here for clarity.

## 3. Vision & segmentation strategy (hybrid on-device / cloud)

**Decision**: Split by platform and confidence:
- **iOS (primary target)**: On-device segmentation via a native Swift module wrapping Apple's Vision Framework (`VNGeneratePersonSegmentationRequest` + a garment-classification pass). Requires a custom Expo Dev Client (native module present), not Expo Go.
- **Android / fallback**: Cloud-based vision API call (per CLAUDE.md's flexible cloud options — e.g., a lightweight cloud vector/segmentation service) invoked from the backend, since no first-party on-device equivalent is assumed available.
- Both paths return the same client-facing shape (see `data-model.md` — Detected Garment), so the mobile app's rendering and matching logic is identical regardless of which path served the request.

**Rationale**: Constitution's Technology Stack & Conventions section mandates that the on-device-vs-cloud tradeoff be evaluated explicitly on latency, monetary cost, and segment accuracy, and recorded here:
- **Latency**: On-device avoids a network round-trip for the most latency-sensitive step (SC-001: bubbles within 5s of capture), and works with no/poor connectivity for the segmentation step itself.
- **Monetary cost**: On-device incurs no per-call vision API cost; cloud calls do, so preferring on-device where available caps a variable cost as usage scales.
- **Segment accuracy**: Apple Vision's person/body segmentation is mature and free; garment-level classification on top of it is the newer part and will need accuracy validation against a cloud vision baseline during implementation — flagged as a build-time validation task, not a spec blocker.

**Alternatives considered**:
- Cloud-only for all platforms — simpler (one code path), but rejected as the primary path because it fails the constitution's explicit latency/cost tradeoff mandate and undermines SC-001 on poor connections.
- On-device-only (no cloud fallback) — rejected because it would leave Android entirely unsupported and provide no fallback if on-device confidence is low.

## 4. Backend architecture

**Decision**: Node.js + TypeScript deployed as Next.js Serverless Functions on Vercel.

**Rationale**: CLAUDE.md offers Express-on-a-scalable-host or Next.js-serverless-on-Vercel as the two sanctioned options without mandating one. Serverless scale-to-zero fits a pre-launch mobile app with spiky, capture-driven traffic (no idle server cost), and keeps deploy/ops minimal for a small team. This is a reversible choice — the API surface is defined as plain typed HTTP contracts (see `contracts/`), so a later move to Express would not change the mobile client.

**Alternatives considered**:
- Express.js on a persistent host — rejected for v1 due to unnecessary always-on infrastructure and scaling policy overhead for a feature with no confirmed steady-state load yet (Scale/Scope is not yet specified — see Technical Context).

## 5. Region/preference determination

**Decision**: Default region is inferred from device locale (`expo-localization`) at first use; an explicit override, once set by the user, is persisted locally (`expo-secure-store` or `AsyncStorage`) and always takes precedence. No account/login and no server-side profile are needed for this (spec Assumptions: no login required for v1).

**Rationale**: Matches the user-confirmed answer to Clarification Q2 (hybrid: inferred default + user override) with the smallest viable implementation given "no account required" is already an explicit spec assumption.

**Alternatives considered**:
- IP-based geolocation server-side — rejected as a redundant second inference source when device locale already provides a reasonable default and raises additional privacy-review surface for no clear accuracy gain at this stage.

## 6. Product/store data source

**Decision**: No first-party product database for v1. Matched Products and Similar Items are resolved at request time by the backend querying an external visual/product search provider (per CLAUDE.md's cloud vision layer options), with a short-lived response cache (edge/CDN cache keyed on garment signature + region) to help meet SC-003 (<2s from bubble tap to results).

**Rationale**: Avoids building and maintaining a product catalog before there's evidence it's needed; keeps the matching pipeline swappable as CLAUDE.md's "dynamic hybrid model" directive anticipates the vision/search vendor choice may change.

**Alternatives considered**:
- Own product database seeded via periodic retailer scraping/feeds — rejected for v1 as premature infrastructure; revisit if a specific retailer partnership requires guaranteed catalog freshness.

## Resolved Technical Context

| Field | Resolution |
|---|---|
| Language/Version | TypeScript (strict mode), latest stable |
| Primary Dependencies | Expo SDK (managed, custom dev client for the native vision module), `expo-camera`, `expo-image-picker`, `expo-localization`, NativeWind, `react-native-reanimated`; backend: Node.js + TypeScript on Next.js Serverless (Vercel) |
| Storage | N/A (no first-party database for v1); short-lived edge cache for match responses only |
| Testing | Jest + React Native Testing Library (components/hooks); contract/integration tests against the serverless API handlers |
| Target Platform | iOS 17+ (on-device segmentation) as primary target; Android 13+ via cloud-vision fallback path, both via Expo managed workflow + custom dev client |
| Project Type | Mobile app + API (two deployable units) |
| Performance Goals | Bubbles visible ≤5s post-capture (SC-001); match results ≤2s post-bubble-tap (SC-003); 60fps UI-thread animation, zero main-JS-thread blocking during segmentation (Constitution Principle III) |
| Constraints | Strict TypeScript, no `any` escapes; NativeWind-first styling; capture must work offline, matching requires connectivity (surfaced via Defensive Error Scaffolding fallback UI) |
| Scale/Scope | Not yet specified — MVP is single-session, no-auth; concurrent-user/load targets deferred to a future operational-readiness feature |
