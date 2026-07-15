# Contract — Motion & Tactility Language (cross-cutting)

Binds every surface in 007 and, per the spec's Out of Scope section, every
future UI feature (pack ritual, paywall, chat inherit this file).

## §1 Motion rules (FR-001, Constitution V)

- Springs only for active motion; `Easing.linear` banned; `withTiming`
  permitted solely for non-structural decorative fades where a spring is
  physically meaningless.
- Every transition MUST be interruptible: springs launch from current shared
  value; loops stop by springing to rest from wherever they are (never
  `cancelAnimation` + snap).
- Named spring presets live beside their component (house style:
  `SETTLE_SPRING`-like consts with mass/damping/stiffness and a why-comment).
- Loops run on the UI thread as transform/opacity only — no per-frame layout,
  no blur inside loops, no per-frame JS crossings (Constitution III).

## §2 Haptic beat vocabulary (FR-003) — `services/tactile.ts`

The ONLY module importing `expo-haptics` (one-seam rule). Exposes semantic
beats, not raw impact calls:

| Beat | expo-haptics mapping | Used by |
|------|---------------------|---------|
| `tick()` | `impactAsync(Light)` | US1 wave bloom peaks |
| `confirm()` | `impactAsync(Medium)` | US5 segment close; US3 journey advance |
| `celebrate()` | `notificationAsync(Success)` then `impactAsync(Heavy)` (spaced beats, never a buzz) | US5 full-ring; US3 first-scan moment |

Rules:
- Additive-only: no state may be knowable *only* via a beat.
- Every call is fire-and-forget inside try/catch → silent no-op on
  unsupported hardware / web / errors (Constitution VII).
- Repeating beats (only `tick`) MUST stop with their visual loop and MUST be
  suppressed under reduce-motion; one-shot beats survive reduce-motion (they
  are information, not decoration).
- Worklet call sites go through `scheduleOnRN(beat)` — never call the seam
  from the UI thread directly.

## §3 Reduce-motion matrix (FR-002)

Source: Reanimated `useReducedMotion()`, read directly per component (R10).

| Treatment | Normal | Reduce-motion equivalent |
|-----------|--------|--------------------------|
| Scan pulse wave (US1) | Looping bloom + breathing + ticks | Static soft double-ring + "Searching…" label; no loop, no ticks |
| Card tilt + sheen (US2) | Touch-tracking 3D tilt | No tilt; standard `active:opacity` press feedback only |
| Journey advance (US3) | Springy progress sweep | Cross-fade to new value |
| Ring segment close (US5) | Spring arc sweep + `confirm()` | Fade segment to closed + `confirm()` |
| Full-ring celebration (US5) | Scaled celebration moment + `celebrate()` | Static congratulation card + `celebrate()` |
| Card entrance staggers (existing) | `FadeInDown.springify()` | Plain fade (Reanimated respects system setting via `ReduceMotion.System` on entrances) |

Verification: SC-008 — with reduce-motion ON, every flow completable with
equivalent information.

## §4 Glass constraints (FR-014)

- Glass (`expo-glass-effect`, already installed) ONLY over controlled dark /
  high-contrast backdrops — in 007 that means camera-overlay chrome (scan
  status pill). NEVER over `bg-surface` (lavender) content areas.
- Always: hairline inner border (`border border-white/20`), text ≥ 4.5:1
  against worst-case backdrop (verify over a white garment in bright light).
- Fallback where glass/blur is unavailable (Android/web): solid
  high-contrast pill (`bg-black/70` — the current busy pill's proven
  treatment), same layout.
- No glass/blur inside animation loops (Constitution III — snapshot-per-frame).

## §5 Z-band additions (extends specs/005 US1 contract)

| Layer | Band |
|-------|------|
| ScanPulseWave (US1) | z-10 (with the trace — below chrome z-20/30, hotspots z-50, failures z-60) |
| Card sheen overlay (US2) | inside the card's own stacking context only (no global z) |
| RingCelebration (US5) | Home-local overlay; MUST NOT mount into the scan z-band |

## §6 Scan lifecycle hand-off (FR-004/006)

Wave is mounted while `scan.phase === 'submitting'` OR
`seg.phase === 'segmenting'` (the windows currently showing the
ActivityIndicator pill at scan.tsx:252). On phase exit the loop springs to
rest and the component fades within one beat (~≤400ms spring settle) —
verified by SC-002's zero-zombie-wave pass. The wave coexists with
NeonTracingOverlay during `segmenting` (wave = searching heartbeat, trace =
region focus); both already share the z-10 band.
