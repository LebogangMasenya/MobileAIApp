/**
 * useGarmentMatches (T027) — lazy per-garment store/similar-item lookup,
 * fired on bubble tap (SC-003: results ≤2s after the tap).
 *
 * Successful responses are memoized per garment for the life of the scan:
 * re-tapping a bubble reopens the modal instantly instead of re-paying the
 * network round trip, and match results for a fixed photo+region are stable
 * enough that staleness isn't a real concern within one session.
 */

import { useCallback, useRef, useState } from 'react';

import { getGarmentMatches } from '../../../services/apiClient';
import type { GarmentMatchesResponse } from '../../../types/scan';

export type GarmentMatchesState =
  | { phase: 'idle' }
  | { phase: 'loading'; garmentId: string }
  | { phase: 'loaded'; matches: GarmentMatchesResponse }
  | { phase: 'error'; message: string; retryable: boolean; garmentId: string };

export interface UseGarmentMatchesResult {
  state: GarmentMatchesState;
  fetchMatches: (scanId: string, garmentId: string) => Promise<void>;
  /** Called on modal close so the next open starts clean. Cache survives. */
  reset: () => void;
  /** Drop memoized results — used when a new scan replaces the session. */
  clearCache: () => void;
}

export function useGarmentMatches(): UseGarmentMatchesResult {
  const [state, setState] = useState<GarmentMatchesState>({ phase: 'idle' });
  const cache = useRef(new Map<string, GarmentMatchesResponse>());
  // Guards against a slow response for garment A landing after the user has
  // already closed A's modal and opened garment B's.
  const requestToken = useRef(0);

  const fetchMatches = useCallback(async (scanId: string, garmentId: string) => {
    const token = ++requestToken.current;

    const cached = cache.current.get(garmentId);
    if (cached) {
      setState({ phase: 'loaded', matches: cached });
      return;
    }

    setState({ phase: 'loading', garmentId });
    try {
      const result = await getGarmentMatches(scanId, garmentId);
      if (token !== requestToken.current) return;

      switch (result.kind) {
        case 'ok':
          cache.current.set(garmentId, result.data);
          setState({ phase: 'loaded', matches: result.data });
          return;
        case 'api':
          setState({ phase: 'error', message: result.error.message, retryable: result.retryable, garmentId });
          return;
        case 'network':
          setState({
            phase: 'error',
            message: 'You appear to be offline. Reconnect to see store matches for this item.',
            retryable: true,
            garmentId,
          });
          return;
      }
    } catch {
      if (token !== requestToken.current) return;
      setState({
        phase: 'error',
        message: 'Something unexpected went wrong. Please try again.',
        retryable: true,
        garmentId,
      });
    }
  }, []);

  const reset = useCallback(() => {
    requestToken.current += 1;
    setState({ phase: 'idle' });
  }, []);

  const clearCache = useCallback(() => {
    cache.current.clear();
    requestToken.current += 1;
    setState({ phase: 'idle' });
  }, []);

  return { state, fetchMatches, reset, clearCache };
}
