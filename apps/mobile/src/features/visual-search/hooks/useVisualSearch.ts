/**
 * useVisualSearch — owns the demo search lifecycle (specs/003 data-model.md).
 *
 * Discriminated-union state machine (001's hook idiom): impossible
 * combinations like "searching AND failed" cannot type-check. Note there is
 * NO separate "empty" phase — `done` with zero matches IS the no-matches
 * state (US2), so "empty" and "failed" can never be conflated (SC-004).
 */

import { useCallback, useRef, useState } from 'react';

import { runVisualSearch } from '@/services/apiClient';
import { upsertEntry } from '@/services/vault-store';
import type { ProductMatch } from '@/types/visual-search';

/**
 * Public copy of the demo image for the vault entry's grid thumbnail — the
 * on-screen demo image is a bundled asset (not a movable file), so demo
 * entries reference the hosted copy instead (specs/005 research §4 caveat:
 * camera entries carry the hard offline guarantee, demo entries render when
 * the image is reachable/cached).
 */
const DEMO_IMAGE_PUBLIC_URL =
  'https://drive.usercontent.google.com/download?id=1vCke7S07VlvTgoVD9HZDncTwfqGY9H3r&export=view';

export type VisualSearchState =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'done'; matches: ProductMatch[] } // matches may be [] — that IS the US2 state
  | { phase: 'failed'; message: string; retryable: boolean };

export interface UseVisualSearchResult {
  state: VisualSearchState;
  /** Starts a search. Ignored while one is in flight (double-trigger guard). */
  run: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useVisualSearch(): UseVisualSearchResult {
  const [state, setState] = useState<VisualSearchState>({ phase: 'idle' });
  // Monotonic token (001 pattern): a stale response must never overwrite the
  // state of a newer run after the user retried.
  const requestToken = useRef(0);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    // Spec edge case "double-tap": one search at a time, extras ignored.
    if (inFlight.current) return;
    inFlight.current = true;
    const token = ++requestToken.current;
    setState({ phase: 'searching' });
    try {
      // Empty params: the SERVER resolves the public demo image URL — the
      // bundled asset this screen displays is unreachable by the provider.
      const result = await runVisualSearch();
      if (token !== requestToken.current) return;

      switch (result.kind) {
        case 'ok':
          setState({ phase: 'done', matches: result.data.matches });
          // Feature 005: record the demo run in the vault. ONE stable id —
          // repeat demo runs replace the entry instead of spamming the grid.
          if (result.data.matches.length > 0) {
            void upsertEntry({
              id: 'vlt_demo',
              scanId: null,
              imageUri: DEMO_IMAGE_PUBLIC_URL,
              capturedAt: new Date().toISOString(),
              matches: result.data.matches,
              source: 'demo',
            });
          }
          return;
        case 'api':
          setState({ phase: 'failed', message: result.error.message, retryable: result.retryable });
          return;
        case 'network':
          setState({
            phase: 'failed',
            message: 'You appear to be offline. Reconnect and try again.',
            retryable: true,
          });
          return;
      }
    } catch {
      // apiClient never throws by design; this survives if that ever breaks.
      if (token === requestToken.current) {
        setState({ phase: 'failed', message: 'Something unexpected went wrong. Please try again.', retryable: true });
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  return { state, run, retry: run };
}
