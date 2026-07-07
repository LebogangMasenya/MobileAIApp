<!--
Sync Impact Report
==================
Version change: 2.0.0 → 2.0.1

Rationale: PATCH. User confirmed "Design-First Implementation" (Principle II)
should be kept — no principle content changed, this only resolves the
pending confirmation TODO from v2.0.0 into a settled decision. Clarification-
only change per the versioning policy.

--- History: 1.0.0 → 2.0.0 ---
MAJOR bump. The user supplied an explicit, detailed constraint set
that redefines the substance of nearly every existing principle (not just
wording) — e.g. "Resilient by Default" is replaced by "Defensive Error
Scaffolding" with a stricter, named-surface requirement (Camera/Filesystem/
network boundaries specifically); "Atomic & Reusable Components" is replaced
by "State Isolation" with an added testability mandate; motion guidance now
explicitly bans `Easing.linear` rather than just requiring springs; the type
system gains a hard "no `any`" rule; styling gains a hard NativeWind-first
rule restricting `StyleSheet.create`. These are backward-incompatible
redefinitions per the versioning policy, so this is not a MINOR addition.

Modified principles (old title → new title):
- Clarity Over Assumption → Clarity Over Assumption (NON-NEGOTIABLE)
  [unchanged in substance, now explicitly names /speckit.clarify as the halt
  mechanism per user's Governance & AI Behavior Rules]
- Native-Grade Motion (Apple Design Philosophy) → Native-Grade Fluid Motion
  (Apple Fluid Motion Bar) [tightened: explicit ban on Easing.linear,
  interruptibility without visual clipping now a named requirement]
- Educational Code Delivery → Educational Code Architecture [scope narrowed
  to complex layouts/custom native hooks/state engines specifically]
- Resilient by Default → Defensive Error Scaffolding [scope narrowed to
  named hardware/network boundaries; "Error Boundaries" now explicit, not
  just try/catch]
- Atomic & Reusable Components → State Isolation (Atomic Components & Modular
  Hooks) [added: hooks must be independently testable]

Added principles:
- Performance First (Zero Layout Stutter) — new, no main-thread blocking for
  visual ops, native optimization preferred over JS-side processing
- Anti-Abstraction Mandate — new, use direct framework APIs, no wrapper-of-
  wrapper layers

Retained unchanged from v1.0.0, and explicitly confirmed by the user in this
amendment (still active in CLAUDE.md's "Figma & MCP Pre-Flight Pipeline"
directive):
- Design-First Implementation

Added sections: None (still Core Principles / Technology Stack & Conventions /
Development Workflow & Quality Gates / Governance) — content within each was
substantially rewritten.

Removed sections: None

Templates requiring updates:
- .specify/templates/plan-template.md ✅ no changes needed (Constitution
  Check gate is dynamically populated per-feature from this file at plan
  time — it will pick up the stricter principles automatically)
- .specify/templates/spec-template.md ✅ no changes needed (generic)
- .specify/templates/tasks-template.md ✅ no changes needed (generic)
- .specify/templates/checklist-template.md ✅ no changes needed (generic)
- .specify/templates/commands/*.md — directory does not exist, skipped
- README.md — does not exist, skipped

Follow-up TODOs: None — prior confirmation item resolved.
-->

# Fashion Shazam Constitution
<!-- Anti-Gatekeeping Mobile App: AI-powered garment segmentation, identification, and e-commerce matching -->

## Core Principles

### I. Clarity Over Assumption (NON-NEGOTIABLE)
The agent is strictly forbidden from guessing architecture or data shapes
that are missing or ambiguous at the Figma/design or specification phase. If
a constraint is omitted or unclear, the agent MUST halt and request explicit
human clarification via `/speckit.clarify` rather than proceeding on an
assumed shape. Before presenting a final solution, the agent MUST reason
through domain-specific edge cases (e.g., missing image data, connection
dropouts mid-search, garments that fail to scan or segment).
**Rationale**: This app inspects unpredictable real-world input (user
photos) and integrates third-party vision/affiliate APIs; a guessed data
shape or requirement compounds into user-facing failures that are expensive
to trace back to their origin.

### II. Design-First Implementation
Before writing code for any new view or layout, the agent MUST invoke
available Figma/MCP design tools or request Figma layout screenshots/tokens
from the user, then critique the design for UX pitfalls, mobile ergonomics
(thumb-reach zones, one-handed use), and implementation bottlenecks, and
present an optimization plan for user approval before executing code
changes.
**Rationale**: Retrofitting ergonomics and animation feasibility after a
screen is built is costlier than catching them at the design-review stage.

### III. Performance First (Zero Layout Stutter)
Heavy visual operations, masking, or canvas operations MUST NOT block the
main JS thread. Native optimization MUST be preferred over heavy JS-side
processing whenever both approaches are viable.
**Rationale**: This is a high-fidelity visual search application — the
product's core interaction is real-time camera/segmentation feedback, and a
stuttering main thread breaks that experience at its most visible point.

### IV. Anti-Abstraction Mandate
Code MUST use direct, well-documented APIs and libraries rather than
building wrappers around wrappers. If a native framework (e.g., Apple
Vision) or a framework primitive (e.g., Reanimated Shared Values) can
accomplish the task cleanly on its own, it MUST be used directly rather than
through an intermediate abstraction layer.
**Rationale**: Extra indirection between the app and the native/animation
primitives it depends on adds debugging surface and performance overhead
without a corresponding benefit at this project's scale.

### V. Native-Grade Fluid Motion (Apple Fluid Motion Bar)
Linear animation curves (`Easing.linear`) are explicitly banned for
structural layout updates or gestural transitions. All active UI transitions
MUST use non-linear spring physics powered by `react-native-reanimated`,
with `mass`, `stiffness`, and `damping` configured to produce genuine,
organic tactile feedback. Layout morphing (e.g., a camera button expanding
into a search loader) MUST be fully interruptible and gesture-friendly,
without visual clipping or sudden state jumps.
**Rationale**: The product's differentiator is a native-grade, camera-driven
UX; linear or non-interruptible motion undermines the premium, Apple-like
feel the app is designed to deliver.

### VI. Educational Code Architecture
Every complex layout, custom native hook, or state engine generated MUST
include clean, concise inline comments explaining the *why* behind the
architectural choice — not the *what* — acting as an educational guide for a
growing full-stack developer.
**Rationale**: This project is an explicit mentorship context; code quality
is measured by whether it builds the developer's own capability, not only by
whether it runs.

### VII. Defensive Error Scaffolding
Any operation involving hardware interfaces (Camera, Filesystem) or network
boundary layers (cloud backend endpoints, vision/affiliate APIs) MUST be
wrapped in strict Error Boundaries and try/catch handlers with beautiful,
non-destructive UI fallbacks. Failures MUST degrade gracefully — never a
blank screen or unhandled crash.
**Rationale**: Vision APIs, on-device inference, and affiliate networks are
external dependencies outside this app's control; reliability is defined by
how well the app survives their failure modes.

### VIII. State Isolation (Atomic Components & Modular Hooks)
UI components MUST remain atomic and presentation-focused. Business logic,
API calls, and heavy device state transformations MUST be extracted into
modular custom React Hooks that are independently testable, rather than
embedded in component bodies.
**Rationale**: The hybrid AI/vision backend is expected to evolve (see
Technology Stack below); logic embedded directly in components would need to
be re-threaded every time the vision strategy changes.

## Technology Stack & Conventions

- **Mobile Environment**: React Native via managed Expo SDK. Code MUST be
  cleanly isolated so it can run via standard Expo prebuild workflows or via
  custom dev clients when custom native Swift modules are linked.
- **Languages**: Strict TypeScript typing throughout. `any` type escapes are
  NOT permitted. Every component prop, state tree, and API payload MUST have
  a concrete interface or type definition.
- **Styling Architecture**: NativeWind (Tailwind CSS) utility classes are
  mandatory for layout and visual styling. Raw `StyleSheet.create` objects
  are restricted to edge-case utility overrides that cannot be easily
  expressed via Tailwind primitives.
- **Vision & AI Strategy (Hybrid-Flexible)**: The segmentation and search
  pipeline MUST remain modular. Code MUST handle a fluid boundary between
  local on-device processing (Apple Vision Framework / CoreML) and external
  visual search APIs, with the on-device-vs-cloud tradeoff evaluated
  explicitly on latency and payload efficiency, and that evaluation recorded
  in the feature's plan (Technical Context or research.md).

## Development Workflow & Quality Gates

- **Planning Mode Execution**: For any multi-file task, the agent MUST
  compile an explicit Markdown plan containing the affected directory tree,
  state mutations, and type definitions, and present it for user approval
  before editing code. This is enforced via the Constitution Check gate in
  `plan-template.md`.
- **Verification Rule**: Code MUST NOT be flagged as complete unless it
  passes strict linter checks and TypeScript compilation with zero errors.
- **Code Review Alignment**: Every plan and PR MUST be checked against the
  Core Principles above before implementation begins (Phase 0) and
  re-checked after design (Phase 1), per the Constitution Check gate.
- **Retrospective Discipline**: The root `/lessons` folder MUST be updated
  whenever a non-obvious debugging breakthrough occurs (build tooling,
  native-module conflicts, platform-specific quirks).
- **Complexity Justification**: Any deviation from the principles above
  (e.g., a linear/non-interruptible transition, an untyped payload, an `any`
  escape, a component holding business logic) MUST be recorded in the plan's
  Complexity Tracking table with the specific reason a simpler, compliant
  alternative was rejected.

## Governance

This constitution supersedes ad hoc practices described elsewhere, including
conflicting guidance in CLAUDE.md, when the two disagree — CLAUDE.md MUST be
kept consistent with this document, and discrepancies MUST be resolved by
amending one or the other explicitly, not by silent deviation.

**Assumption Block**: Per Principle I, the agent MUST NOT guess architecture
or data shapes that are missing or ambiguous in the Figma or specification
phase. If a constraint is omitted, the agent MUST halt and request
clarification via `/speckit.clarify` before proceeding.

**Amendment procedure**: Amendments are proposed via the `/speckit-constitution`
command, which regenerates this file, computes a semantic version bump, and
emits a Sync Impact Report (prepended as an HTML comment at the top of this
file) documenting what changed and which dependent templates were checked.

**Versioning policy**: Semantic versioning applies to this document — MAJOR
for backward-incompatible governance/principle removals or redefinitions,
MINOR for new principles or materially expanded guidance, PATCH for
clarifications and non-semantic wording fixes.

**Compliance review**: Every `/speckit-plan` run MUST evaluate the feature
against the Constitution Check gate before Phase 0 research and again after
Phase 1 design. Any unresolved violation MUST be justified in the plan's
Complexity Tracking table or the plan MUST be revised to comply.

**Version**: 2.0.1 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-07-07
