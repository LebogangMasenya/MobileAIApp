/**
 * useSetupJourney (specs/007 US3, data-model §1) — the momentum engine
 * behind the vault welcome.
 *
 * THE design rule: the journey is a PURE DERIVATION of real state — auth
 * session, camera permission, vault count — recomputed every mount and
 * never persisted. That makes the "no zero state" framing honest *by
 * construction* (SC-007): a checked step cannot exist without the state
 * that earned it, and there is no stored progress number that could drift
 * from reality. The only thing we persist is a "celebration played" flag,
 * because "played once" is itself a real fact about the past.
 */

import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useState } from 'react';

import { useAuthSession } from '@/features/auth/providers/mock-auth-provider';
import { readItem, writeItem } from '@/services/device-store';

export type JourneyStepId = 'account' | 'camera' | 'firstScan';

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
  done: boolean;
}

export interface SetupJourney {
  steps: JourneyStep[];
  /** 0–1 — see deriveJourneyProgress for the honest-momentum math. */
  progress: number;
  /** firstScan done — the welcome framing retires (FR-010). */
  complete: boolean;
}

/** Once-only flag for the first-scan celebration (US3 scenario 3). */
const CELEBRATED_KEY = 'satori.journey.celebrated.v1';

/**
 * Progress math, exported pure for direct testing (Constitution VIII).
 *
 * Why not steps-done/steps-total: 2-of-3 would read 67% — inflated enough
 * to feel *finished*, which kills the pull toward the remaining step. The
 * setup steps together are worth ~22% (the goal-gradient sweet spot the
 * spec names: enough to feel underway, FR-009) and the first scan — the
 * actual product moment — carries the rest.
 */
export function deriveJourneyProgress(steps: JourneyStep[]): number {
  const done = (id: JourneyStepId) => steps.some((step) => step.id === id && step.done);
  if (done('firstScan')) return 1;
  const setupDone = ['account', 'camera'].filter((id) => done(id as JourneyStepId)).length;
  return setupDone * 0.11; // both setup steps checked ⇒ 0.22
}

export interface UseSetupJourneyResult {
  journey: SetupJourney;
  /**
   * True exactly once, when firstScan is done but the celebration flag is
   * not yet stored — the welcome plays its advance moment, then calls
   * `onCelebrated` to retire it permanently.
   */
  shouldCelebrate: boolean;
  onCelebrated: () => void;
}

export function useSetupJourney(entryCount: number): UseSetupJourneyResult {
  // Real state, straight from the owners — no copies to fall stale.
  const auth = useAuthSession();
  const [cameraPermission] = useCameraPermissions();
  // null = flag not read yet; celebration stays quiet until we KNOW it
  // hasn't played (failing quiet beats double-celebrating).
  const [celebrated, setCelebrated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readItem(CELEBRATED_KEY).then((raw) => {
      // A failed/absent read means "not celebrated" — the worst case is the
      // moment plays again on a reinstall, which is the harmless direction.
      if (!cancelled) setCelebrated(raw === 'true');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCelebrated = useCallback(() => {
    // Persist-before-state (the useVaultVisibility rule): storage and
    // visuals can never disagree about whether the moment played.
    void writeItem(CELEBRATED_KEY, 'true').then(() => setCelebrated(true));
  }, []);

  // Defensive derivation (Constitution VII): any source that errors or
  // hasn't loaded reads as "not done" — the honest, recoverable direction.
  const steps: JourneyStep[] = [
    { id: 'account', label: 'Account ready', done: auth.isLoaded && auth.isSignedIn },
    { id: 'camera', label: 'Camera calibrated', done: cameraPermission?.granted === true },
    { id: 'firstScan', label: 'Scan your first piece', done: entryCount > 0 },
  ];

  const journey: SetupJourney = {
    steps,
    progress: deriveJourneyProgress(steps),
    complete: entryCount > 0,
  };

  return {
    journey,
    shouldCelebrate: journey.complete && celebrated === false,
    onCelebrated,
  };
}
