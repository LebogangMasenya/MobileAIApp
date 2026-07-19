/**
 * Subject Lift seam (specs/008 contracts/pipeline.md §1) — the ONLY module
 * that imports `@six33/react-native-bg-removal` (the tactile.ts/device-store
 * precedent: one seam per hardware boundary, so "can this device lift?" has
 * exactly one answer site and a library swap is a one-file edit — research
 * R1 records the custom-Swift fallback plan this seam makes cheap).
 *
 * Failure philosophy (Constitution VII): this module NEVER throws. Every
 * library call is contained, and every failure mode maps to a typed
 * LiftOutcome the pipeline turns into the manual-crop fallback — an
 * isolation failure is a ROUTE, not an exception.
 *
 * Verified against the installed 1.3.4 types (008 T001, R1 duty):
 * - `removeBackground(uri, { trim })` resolves to a URI ONLY — no mask
 *   bounds. The degenerate check therefore compares the TRIMMED output's
 *   pixel area to the source photo's: trim crops to the subject's bounding
 *   box, so output dims ARE the mask bounds for this rule's purpose.
 * - iOS < 17 throws 'REQUIRES_API_FALLBACK' → `unsupported`.
 * - iOS SIMULATOR silently returns the ORIGINAL uri (a no-op "success") —
 *   detected below and mapped to `failed` so dev builds take the honest
 *   manual path instead of searching an un-isolated photo.
 * - TurboModule + codegen: New Architecture compatible with RN 0.81.
 */

import { Image, Platform } from 'react-native';

/**
 * Lazy library binding. A static `import` would run the library's
 * `TurboModuleRegistry.getEnforcing('BackgroundRemover')` the moment ANY
 * route importing this seam loads — and on a dev client built without the
 * pod (the 007/008 rebuild-pending state) that throws during module
 * evaluation, crashing route navigation before any try/catch here can run.
 * Deferring to a guarded require() maps "binary lacks the module" to the
 * `unsupported` outcome instead — an isolation failure is a ROUTE.
 */
type BgRemovalModule = typeof import('@six33/react-native-bg-removal');

let bgRemovalModule: BgRemovalModule | null | undefined;

function loadBgRemoval(): BgRemovalModule | null {
  if (bgRemovalModule === undefined) {
    try {
      bgRemovalModule = require('@six33/react-native-bg-removal') as BgRemovalModule;
    } catch {
      bgRemovalModule = null;
    }
  }
  return bgRemovalModule;
}

/** Pixel dimensions — kept local so the seam has zero feature imports. */
export interface SubjectSize {
  width: number;
  height: number;
}

/**
 * The transparent-background subject (008 data-model §1). Produced exactly
 * once per pipeline run — by this seam OR by the manual crop fallback —
 * and immutable afterward: retry never re-isolates (FR-009).
 */
export interface IsolatedGarment {
  /** file:// URI of the transparent-background PNG (trimmed). */
  uri: string;
  /** Pixel size of the trimmed image. */
  width: number;
  height: number;
  /** Which path produced it — drives copy and quickstart audits. */
  method: 'lift' | 'manual';
  /** Source photo URI (kept for retry-with-manual-crop and the vault entry). */
  sourceUri: string;
}

export type LiftOutcome =
  | { kind: 'ok'; garment: IsolatedGarment }
  | { kind: 'unsupported' } // no capability on this device/OS → manual crop
  | { kind: 'failed' } // capability exists but this photo failed → manual crop
  | { kind: 'degenerate' }; // sliver mask — a garbage result IS a failure

/**
 * Spec edge-case rule ("sliver mask"), exported pure so it is testable
 * without a device: a lift whose trimmed subject covers less than 4% of the
 * source photo's area is a failure, not a result — searching a 30px sliver
 * produces garbage matches that LOOK like the feature working badly.
 */
export const DEGENERATE_AREA_RATIO = 0.04;

export function isDegenerateLift(subject: SubjectSize, source: SubjectSize): boolean {
  const sourceArea = source.width * source.height;
  const subjectArea = subject.width * subject.height;
  if (sourceArea <= 0 || subjectArea <= 0) return true;
  return subjectArea / sourceArea < DEGENERATE_AREA_RATIO;
}

/**
 * Probe-once cache: capability is a device fact that cannot change while
 * the app runs, so the native round-trip is paid once and every later
 * caller (entry copy, pipeline start) answers synchronously-fast. The
 * promise itself is cached (not the boolean) so concurrent first callers
 * share one probe instead of racing two.
 */
let availabilityProbe: Promise<boolean> | null = null;

/**
 * Capability probe — deliberately NOT the library's
 * `isNativeBackgroundRemovalSupported()`. That helper calls the raw native
 * method with NO `options` argument; on the New Architecture the required
 * options struct then marshals from NSNull, and the ObjC bridge's
 * `options.trim()` read throws an uncaught NSException inside
 * `performMethodInvocation` — a hard native crash, not a catchable JS error
 * (observed as a device crash the moment the visual-search screen mounts).
 *
 * The safe route is the library's `removeBackground` JS wrapper, whose
 * default `{ trim: true }` always supplies the struct. Same semantics as the
 * upstream probe: a deliberately unloadable probe URI never reaches Vision —
 * iOS < 17 rejects with REQUIRES_API_FALLBACK (→ unsupported) before
 * touching the URI; any load/URL error means the native path exists (→
 * supported). Simulators "succeed" by echoing the input, which also lands in
 * the supported branch — liftSubject's no-op check catches that later.
 */
async function probeSupport(): Promise<boolean> {
  const lib = loadBgRemoval();
  if (!lib) return false; // binary lacks the module → manual-crop floor
  try {
    await lib.removeBackground('probe://capability-check', { trim: true });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUIRES_API_FALLBACK') {
      return false;
    }
    return true;
  }
}

export function isAvailable(): Promise<boolean> {
  // Web has no native module at all — decided before touching the library.
  if (Platform.OS === 'web') return Promise.resolve(false);
  if (!availabilityProbe) {
    availabilityProbe = probeSupport().catch(() => false);
  }
  return availabilityProbe;
}

/**
 * Isolate the dominant subject from a photo. `sourceSize` (known at capture
 * time from camera/picker metadata) anchors the degenerate check; when the
 * caller doesn't have it, it is measured here — a lift without the check
 * would let sliver masks through to the search.
 */
export async function liftSubject(
  sourceUri: string,
  sourceSize?: SubjectSize,
): Promise<LiftOutcome> {
  try {
    if (!(await isAvailable())) return { kind: 'unsupported' };
    const lib = loadBgRemoval();
    if (!lib) return { kind: 'unsupported' };

    // trim: true (the library default, stated explicitly because FR-004
    // depends on it): dead transparent margins are removed natively, so the
    // pipeline's payload is already tightened to the subject bounds and the
    // user never operates a crop tool on the happy path.
    const liftedUri = await lib.removeBackground(sourceUri, { trim: true });

    // Simulator no-op detection (R1 finding): the library "succeeds" with
    // the unmodified input on iOS simulators. Treating that as success would
    // ship the full busy-background photo to the provider — silently worse
    // results with no error anywhere. Failed → manual crop is the honest map.
    if (liftedUri === sourceUri) return { kind: 'failed' };

    const [lifted, source] = await Promise.all([
      Image.getSize(liftedUri),
      sourceSize ? Promise.resolve(sourceSize) : Image.getSize(sourceUri),
    ]);

    if (isDegenerateLift(lifted, source)) return { kind: 'degenerate' };

    return {
      kind: 'ok',
      garment: {
        uri: liftedUri,
        width: lifted.width,
        height: lifted.height,
        method: 'lift',
        sourceUri,
      },
    };
  } catch (error) {
    // The library's typed "this OS can't do it" signal — distinct from a
    // per-photo failure because the two get different supportive copy (FR-005).
    if (error instanceof Error && error.message === 'REQUIRES_API_FALLBACK') {
      return { kind: 'unsupported' };
    }
    return { kind: 'failed' };
  }
}
