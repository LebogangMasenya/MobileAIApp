/**
 * useSegmentPerson (T021) — per-person garment segmentation for multi-person
 * photos (FR-016/FR-017).
 *
 * Separate from useCreateScan because their lifecycles genuinely differ:
 * a scan happens once per photo, while person segmentation can run several
 * times within the same scan as the user explores different people (FR-017).
 * Folding both into one machine would force every re-selection to reason
 * about scan-level states it can't be in.
 */

import { useCallback, useRef, useState } from 'react';

import { segmentPerson } from '../../../services/apiClient';
import { updateRecentScanGarmentCount } from '../../../services/recent-scans-store';
import type { DetectedGarment } from '../../../types/scan';

export type SegmentPersonState =
  | { phase: 'idle' }
  | { phase: 'segmenting'; personId: string }
  | { phase: 'segmented'; personId: string; garments: DetectedGarment[] }
  /** Business failure for this specific person (FR-018-adjacent) — pick again or rescan. */
  | { phase: 'personFailed'; personId: string; reason: string }
  | { phase: 'error'; message: string; retryable: boolean; personId: string };

export interface UseSegmentPersonResult {
  state: SegmentPersonState;
  segment: (scanId: string, personId: string) => Promise<void>;
  /** Clear back to idle — used when re-opening the person selector (FR-017). */
  reset: () => void;
}

export function useSegmentPerson(): UseSegmentPersonResult {
  const [state, setState] = useState<SegmentPersonState>({ phase: 'idle' });
  // Same stale-response guard as useCreateScan: tapping person B while
  // person A's request is in flight must never show A's garments over B.
  const requestToken = useRef(0);

  const segment = useCallback(async (scanId: string, personId: string) => {
    const token = ++requestToken.current;
    setState({ phase: 'segmenting', personId });
    try {
      const result = await segmentPerson(scanId, personId);
      if (token !== requestToken.current) return;

      switch (result.kind) {
        case 'ok':
          if (result.data.status === 'failed') {
            setState({
              phase: 'personFailed',
              personId,
              reason: result.data.failureReason ?? 'We could not process this person. Try selecting them again.',
            });
          } else {
            setState({ phase: 'segmented', personId, garments: result.data.garments });
            // Feature 002 integration: multi-person scans recorded 0 garments
            // at creation; reflect this person's results on the Home rail.
            void updateRecentScanGarmentCount(scanId, result.data.garments.length);
          }
          return;
        case 'api':
          setState({ phase: 'error', message: result.error.message, retryable: result.retryable, personId });
          return;
        case 'network':
          setState({
            phase: 'error',
            message: 'You appear to be offline. Reconnect and select the person again.',
            retryable: true,
            personId,
          });
          return;
      }
    } catch {
      if (token !== requestToken.current) return;
      setState({
        phase: 'error',
        message: 'Something unexpected went wrong. Please try again.',
        retryable: true,
        personId,
      });
    }
  }, []);

  const reset = useCallback(() => {
    requestToken.current += 1;
    setState({ phase: 'idle' });
  }, []);

  return { state, segment, reset };
}
