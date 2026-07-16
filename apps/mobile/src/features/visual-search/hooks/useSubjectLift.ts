/**
 * useSubjectLift (specs/008 US1) — hook ergonomics over the subject-lift
 * seam: the capability probe as React state, and the lift call as a stable
 * callback. It owns NO pipeline phases — that is useLiftSearch's machine —
 * so this hook stays independently testable as "the isolation lifecycle"
 * and nothing else (Constitution VIII).
 */

import { useCallback, useEffect, useState } from 'react';

import { isAvailable, liftSubject, type LiftOutcome, type SubjectSize } from '@/services/subject-lift';

export interface UseSubjectLiftResult {
  /**
   * null while the probe is in flight; then a stable device fact. Screens
   * use it to decide entry copy BEFORE a photo exists (an unsupported
   * device's flow starts at manual crop, and honest copy says so up front).
   */
  supported: boolean | null;
  /** Isolate a photo's subject. Never throws — outcomes are the contract. */
  lift: (sourceUri: string, sourceSize?: SubjectSize) => Promise<LiftOutcome>;
}

export function useSubjectLift(): UseSubjectLiftResult {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    // The seam caches the probe promise, so this costs one native round-trip
    // per app run no matter how many screens mount the hook.
    void isAvailable().then((result) => {
      if (mounted) setSupported(result);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const lift = useCallback(
    (sourceUri: string, sourceSize?: SubjectSize) => liftSubject(sourceUri, sourceSize),
    [],
  );

  return { supported, lift };
}
