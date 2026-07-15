/**
 * useCreateScan (T017) — owns the POST /v1/scans lifecycle.
 *
 * Modeled as a discriminated-union state machine rather than separate
 * `loading`/`error`/`data` booleans: with booleans, impossible combinations
 * (loading AND errored) type-check fine and become runtime bugs; with a
 * union, the screen's `switch` can only render states that can actually
 * exist (Constitution Principle VIII — logic in hooks, and provably so).
 */

import { useCallback, useRef, useState } from 'react';

import { createScan } from '../../../services/apiClient';
import { markSegment } from '../../../services/daily-cycle-store';
import { appendRecentScan } from '../../../services/recent-scans-store';
import { upsertEntry } from '../../../services/vault-store';
import type { ScanSession, ScanSource } from '../../../types/scan';
import type { CapturedPhoto } from '../components/CameraView';

export type CreateScanState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  /** Segmentation succeeded — people (and maybe garments) are available. */
  | { phase: 'ready'; session: ScanSession }
  /**
   * Business-level failure (FR-012/FR-018): the request worked, the photo
   * just had nothing usable. Kept distinct from `error` because the recovery
   * is always "new photo", never "retry the same request".
   */
  | { phase: 'scanFailed'; reason: string }
  | { phase: 'error'; message: string; retryable: boolean };

export interface UseCreateScanResult {
  state: CreateScanState;
  submit: (photo: CapturedPhoto, source: ScanSource, region: string) => Promise<void>;
  /** Back to idle — used by "New photo" and retry-with-new-photo paths. */
  reset: () => void;
}

export function useCreateScan(): UseCreateScanResult {
  const [state, setState] = useState<CreateScanState>({ phase: 'idle' });
  // Monotonic token: if the user resets and resubmits while a stale request
  // is still in flight, the stale response must not overwrite the new state.
  const requestToken = useRef(0);

  const submit = useCallback(async (photo: CapturedPhoto, source: ScanSource, region: string) => {
    const token = ++requestToken.current;
    setState({ phase: 'submitting' });
    try {
      const result = await createScan({ photoUri: photo.uri, source, region });
      if (token !== requestToken.current) return;

      switch (result.kind) {
        case 'ok': {
          const session = result.data.scanSession;
          if (session.status === 'failed') {
            setState({
              phase: 'scanFailed',
              // The API contract guarantees failureReason on failed sessions,
              // but we never trust the wire blindly (strict-TS discipline).
              reason: session.failureReason ?? 'We could not process this photo. Please try another one.',
            });
          } else {
            setState({ phase: 'ready', session });
            // Feature 002 integration: record the scan for Home's "Recently
            // scanned" rail. Fire-and-forget — the store is best-effort and a
            // write failure must never disturb a successful scan. Since
            // feature 005, photo.uri is already the PERMANENT vault URI
            // (moved at capture hand-off), so rail thumbnails are durable.
            void appendRecentScan({
              scanId: session.id,
              thumbnailUri: photo.uri,
              capturedAt: session.createdAt,
              // Multi-person photos start at 0 (garments arrive per person);
              // useSegmentPerson bumps the count when segmentation lands.
              garmentCount: session.garments.length,
            });
            // Feature 005: the scan becomes a Vault entry (matches merge in
            // later via useGarmentMatches). Deterministic id per session so
            // repeat writes replace, never duplicate. Feature 006: imageSize
            // (crop math) + garment breakdown — single-person scans populate
            // here; multi-person garments arrive via useSegmentPerson.
            void upsertEntry({
              id: `vlt_${session.id}`,
              scanId: session.id,
              imageUri: photo.uri,
              capturedAt: session.createdAt,
              matches: [],
              source: 'camera',
              imageSize: { width: photo.width, height: photo.height },
              garments: session.garments.map((garment) => ({
                id: garment.id,
                category: garment.category,
                boundingRegion: garment.boundingRegion,
                matches: [],
              })),
            });
            // Feature 007 US5 'log' fulfillment (contracts/daily-cycle §2): a
            // look reaching the vault today closes the ring's first segment.
            // Fire-and-forget beside the upsert — the ring is a bystander to
            // the scan flow and must never block or break it (Constitution VII).
            void markSegment('log');
          }
          return;
        }
        case 'api':
          setState({ phase: 'error', message: result.error.message, retryable: result.retryable });
          return;
        case 'network':
          setState({
            phase: 'error',
            message: 'You appear to be offline. Your photo is safe — reconnect and try again.',
            retryable: true,
          });
          return;
      }
    } catch {
      // apiClient never throws by design, but Defensive Error Scaffolding
      // demands the hook survives even if that invariant breaks someday.
      if (token !== requestToken.current) return;
      setState({ phase: 'error', message: 'Something unexpected went wrong. Please try again.', retryable: true });
    }
  }, []);

  const reset = useCallback(() => {
    requestToken.current += 1; // Invalidate any in-flight request.
    setState({ phase: 'idle' });
  }, []);

  return { state, submit, reset };
}
