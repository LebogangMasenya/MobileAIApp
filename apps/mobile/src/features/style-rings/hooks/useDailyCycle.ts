/**
 * useDailyCycle (specs/007 US5) — the ring's state engine, isolated from
 * every ring visual (Constitution VIII: the hook is testable by calling it,
 * the components below it are pure presenters).
 *
 * Focus-refresh is the rollover's delivery mechanism: tabs keep screens
 * mounted, so a mount-only load would show yesterday's ring to a user who
 * left the app open overnight. Reloading on focus makes the read-repair in
 * daily-cycle-store actually fire at day boundaries.
 *
 * Celebration protocol (interrupted-celebration edge case): `shouldCelebrate`
 * turns true whenever the ring is complete and today's record hasn't been
 * marked — including on a fresh mount after the app was killed mid-moment —
 * and the UI acknowledges with `onCelebrated()` AFTER playing it. Persist
 * happens inside the store before local state updates, so the flag and the
 * visuals can't disagree.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  isRingComplete,
  loadToday,
  markCelebrated,
  markSegment,
  type DailyCycleRecord,
  type SegmentId,
} from '@/services/daily-cycle-store';

export interface UseDailyCycleResult {
  /** Null while the first load is in flight — render a quiet placeholder, not a fake ring. */
  record: DailyCycleRecord | null;
  /** Mark a segment earned today (idempotent). Fire-and-forget safe. */
  complete: (id: SegmentId) => void;
  allDone: boolean;
  /** True while a full-ring celebration is owed for today. */
  shouldCelebrate: boolean;
  /** Call after the celebration finishes playing. */
  onCelebrated: () => void;
}

export function useDailyCycle(): UseDailyCycleResult {
  const [record, setRecord] = useState<DailyCycleRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadToday().then((loaded) => {
        if (!cancelled) setRecord(loaded);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const complete = useCallback((id: SegmentId) => {
    // Store persists before we mirror to state (contract §1) — and any
    // storage failure already degraded inside the store, never here.
    void markSegment(id).then(setRecord);
  }, []);

  const onCelebrated = useCallback(() => {
    void markCelebrated().then(setRecord);
  }, []);

  const allDone = record !== null && isRingComplete(record);

  return {
    record,
    complete,
    allDone,
    shouldCelebrate: allDone && record !== null && !record.celebrated,
    onCelebrated,
  };
}
