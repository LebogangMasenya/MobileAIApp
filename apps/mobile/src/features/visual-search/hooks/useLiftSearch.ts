/**
 * useLiftSearch (specs/008 US1, contracts/pipeline.md §2) — the full Subject
 * Lift pipeline as a discriminated-union stage machine.
 *
 * THE HONESTY ARCHITECTURE (FR-006..008): each phase value is set at the
 * moment its real work BEGINS and nothing else may set stage copy — the
 * progress bar and stage strings derive from `state.phase` alone, so a
 * stage that never started can never be announced, and a stalled stage
 * reads as its own designed failure instead of optimistic progress. This is
 * why the machine is a union and not a percentage: a number can lie by
 * drifting; a phase can only lie if the code that starts the work lies.
 *
 * FR-009: `failed` carries the IsolatedGarment whenever one exists, and
 * retry() re-enters AT the failed stage — the expensive on-device isolation
 * never re-runs because its product is preserved across failures.
 */

import { useCallback, useRef, useState } from 'react';

import { runLiftSearch } from '@/services/apiClient';
import type { IsolatedGarment, SubjectSize } from '@/services/subject-lift';
import { persistImage, upsertEntry } from '@/services/vault-store';
import type { LiftSearchResult, ProductMatch } from '@/types/visual-search';

import { useSubjectLift } from './useSubjectLift';

/** Why the pipeline detoured to the marquee — drives supportive copy (FR-005). */
export type ManualCropReason = 'unsupported' | 'liftFailed' | 'degenerate';

export type LiftSearchStage = 'isolating' | 'preparing' | 'matching' | 'assembling';

export type LiftSearchState =
  | { phase: 'idle' }
  | { phase: 'isolating'; sourceUri: string } // on-device lift
  | { phase: 'manualCrop'; sourceUri: string; reason: ManualCropReason }
  | { phase: 'preparing'; garment: IsolatedGarment } // trim/encode
  | { phase: 'matching'; garment: IsolatedGarment } // upload + provider
  | { phase: 'assembling'; garment: IsolatedGarment } // parse → first render
  | { phase: 'done'; garment: IsolatedGarment; result: LiftSearchResult }
  | {
      phase: 'failed';
      /** null only for pre-isolation failures — then retry restarts the lift. */
      garment: IsolatedGarment | null;
      failedStage: LiftSearchStage;
      message: string;
      retryable: boolean;
    };

export interface LiftPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface UseLiftSearchResult {
  state: LiftSearchState;
  /** Begin the full pipeline from a captured/imported photo. */
  start: (photo: LiftPhoto) => Promise<void>;
  /** Manual-crop confirm: joins the pipeline at `preparing` (contract §2). */
  continueFromManualCrop: (garment: IsolatedGarment) => Promise<void>;
  /** Re-enter at the failed stage; isolation is never repeated (FR-009). */
  retry: () => Promise<void>;
  /** Back to idle (new photo). */
  reset: () => void;
  /**
   * US5 once-per-result-set guard: returns true exactly once per
   * resultSetId — the first exact card to expose itself claims the jackpot
   * beat, structurally preventing a re-fire on scroll-back (FR-016).
   */
  claimJackpot: () => boolean;
}

function randomToken(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The vault write is fire-and-forget (vault-store V4 rule): a completed
 * search with matches records one look, and no storage failure may ever
 * surface into the results scene. The SOURCE photo persists (durable,
 * viewable); the transparent PNG stays session-local by design.
 */
async function recordLiftEntry(
  garment: IsolatedGarment,
  matches: ProductMatch[],
  sourceSize: SubjectSize | null,
): Promise<void> {
  if (matches.length === 0) return;
  const persisted = await persistImage(garment.sourceUri);
  if (!persisted) return; // no durable image → no entry (never a broken record)
  await upsertEntry({
    id: randomToken('vlt_lift'),
    scanId: null,
    imageUri: persisted,
    capturedAt: new Date().toISOString(),
    matches,
    source: 'lift',
    imageSize: sourceSize,
    garments: [], // no region data on this path — honest absence (demo precedent)
  });
}

export function useLiftSearch(): UseLiftSearchResult {
  const { lift } = useSubjectLift();
  const [state, setState] = useState<LiftSearchState>({ phase: 'idle' });

  // Monotonic token (001/003 hook idiom): a stale async completion from an
  // abandoned run must never overwrite a newer run's state.
  const requestToken = useRef(0);
  /** Source photo of the CURRENT run — retry-from-isolating needs it. */
  const photoRef = useRef<LiftPhoto | null>(null);
  /** resultSetIds whose jackpot beat has already fired this session. */
  const jackpotFiredRef = useRef<Set<string>>(new Set());

  /**
   * Remote half of the pipeline (preparing → matching → assembling → done).
   * Shared by the lift path, the manual-crop join, and retry — which is
   * exactly what makes FR-009 structural: re-running remote phases is one
   * call that takes the preserved garment as input.
   */
  const runRemotePhases = useCallback(async (garment: IsolatedGarment, token: number) => {
    // `preparing` is the encode step. The PNG is already subject-trimmed
    // (seam/marquee), and in RN the multipart body streams the file natively
    // during upload — so preparation is genuinely brief here. A segment that
    // completes fast is honest ("that work WAS quick"); what FR-008 forbids
    // is announcing a stage whose work never ran, not one that ran quickly.
    setState({ phase: 'preparing', garment });

    if (token !== requestToken.current) return;
    setState({ phase: 'matching', garment });
    const result = await runLiftSearch(garment.uri);
    if (token !== requestToken.current) return;

    switch (result.kind) {
      case 'ok': {
        setState({ phase: 'assembling', garment });
        // Local resultSetId (contract §1): the wire stays 003's `{matches}`;
        // the once-per-result-set key is derived here, where the set is born.
        const searchResult: LiftSearchResult = {
          matches: result.data.matches,
          resultSetId: randomToken('rs'),
        };
        void recordLiftEntry(
          garment,
          searchResult.matches,
          photoRef.current ? { width: photoRef.current.width, height: photoRef.current.height } : null,
        );
        if (token !== requestToken.current) return;
        // Zero matches is a RESULT (003 rule) — `done` with an empty array,
        // never `failed`; the route renders the designed no-matches state.
        setState({ phase: 'done', garment, result: searchResult });
        return;
      }
      case 'api': {
        // The wire can carry visual-search codes beyond the scan-flow's
        // ApiErrorCode union — widen before comparing (the wire is never
        // trusted to match a narrower type than it actually speaks).
        const code: string = result.error.code;
        setState({
          phase: 'failed',
          garment,
          failedStage: 'matching',
          // Honest cold-start copy (pipeline contract §6): a free-tier API
          // sleeps, and "waking up" is what is actually happening.
          message:
            code === 'UPSTREAM_FAILED' || code === 'UPSTREAM_TIMEOUT'
              ? 'The search service may still be waking up — give it another try.'
              : result.error.message,
          retryable: result.retryable,
        });
        return;
      }
      case 'network':
        setState({
          phase: 'failed',
          garment,
          failedStage: 'matching',
          message: 'You appear to be offline. Reconnect and try again — your garment is ready to go.',
          retryable: true,
        });
        return;
    }
  }, []);

  const start = useCallback(
    async (photo: LiftPhoto) => {
      const token = ++requestToken.current;
      photoRef.current = photo;
      // `isolating` is announced here because the lift genuinely starts here.
      setState({ phase: 'isolating', sourceUri: photo.uri });
      const outcome = await lift(photo.uri, { width: photo.width, height: photo.height });
      if (token !== requestToken.current) return;

      switch (outcome.kind) {
        case 'ok':
          await runRemotePhases(outcome.garment, token);
          return;
        // Every non-ok outcome is a ROUTE to the universal fallback floor,
        // never a dead end (FR-005) — reason picks the supportive copy.
        case 'unsupported':
          setState({ phase: 'manualCrop', sourceUri: photo.uri, reason: 'unsupported' });
          return;
        case 'failed':
          setState({ phase: 'manualCrop', sourceUri: photo.uri, reason: 'liftFailed' });
          return;
        case 'degenerate':
          setState({ phase: 'manualCrop', sourceUri: photo.uri, reason: 'degenerate' });
          return;
      }
    },
    [lift, runRemotePhases],
  );

  const continueFromManualCrop = useCallback(
    async (garment: IsolatedGarment) => {
      const token = ++requestToken.current;
      await runRemotePhases(garment, token);
    },
    [runRemotePhases],
  );

  const retry = useCallback(async () => {
    if (state.phase !== 'failed' || !state.retryable) return;
    const token = ++requestToken.current;
    if (state.garment) {
      // FR-009 made concrete: the garment survives the failure, so retry is
      // ONLY the remote phases — the trace/lift moment never replays.
      await runRemotePhases(state.garment, token);
      return;
    }
    // Pre-isolation failure: only a full restart makes sense (nothing to keep).
    const photo = photoRef.current;
    if (photo) await start(photo);
  }, [state, runRemotePhases, start]);

  const reset = useCallback(() => {
    requestToken.current += 1; // invalidate anything still in flight
    photoRef.current = null;
    setState({ phase: 'idle' });
  }, []);

  const claimJackpot = useCallback((): boolean => {
    if (state.phase !== 'done') return false;
    const { resultSetId } = state.result;
    if (jackpotFiredRef.current.has(resultSetId)) return false;
    jackpotFiredRef.current.add(resultSetId);
    return true;
  }, [state]);

  return { state, start, continueFromManualCrop, retry, reset, claimJackpot };
}
