/**
 * useShareLook (specs/006 contract §4) — the impure share orchestration:
 * route (picker vs direct) → crop → compose → native sheet.
 *
 * Routing honesty (T019): garment grouping is FORWARD-ONLY — v1-migrated and
 * demo entries have `garments: []` (matches were never garment-tagged in
 * storage before this feature and can't be retro-grouped), so they route
 * straight to whole-look sharing. Demo entries pass their remote https URL
 * as the share image: it attaches where the platform allows and the text
 * block stands alone otherwise (spec edge case).
 */

import { useCallback, useRef, useState } from 'react';
import { Share } from 'react-native';

import { cropGarment } from '@/features/vault/utils/garment-crop';
import { composeSharePayload } from '@/features/vault/utils/share-payload';
import type { VaultEntry, VaultGarment } from '@/types/vault';

export interface UseShareLookResult {
  /** Entry awaiting a garment choice, or null (picker hidden). */
  pickerFor: VaultEntry | null;
  /** Entry point from a card's share affordance. */
  share: (entry: VaultEntry) => Promise<void>;
  /** Picker choice (or the direct path): a garment, or the whole look. */
  shareGarment: (entry: VaultEntry, garment: VaultGarment | 'look') => Promise<void>;
  dismissPicker: () => void;
  /** Human copy for the gentle inline notice; null when clear (FR-014). */
  error: string | null;
  clearError: () => void;
}

export function useShareLook(): UseShareLookResult {
  const [pickerFor, setPickerFor] = useState<VaultEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One share in flight at a time — double-taps must not stack OS sheets.
  const inFlight = useRef(false);

  const present = useCallback(async (entry: VaultEntry, garment?: VaultGarment) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      // Crop for garment shares; null (failure/precondition) falls back to
      // the look photo — sharing never dead-ends on a crop (FR-010).
      const cropUri = garment ? await cropGarment(entry, garment) : null;
      const payload = composeSharePayload(entry, garment, cropUri ?? undefined);
      // iOS attaches url (file/https) alongside message; Android shares the
      // message alone — the text block stands alone by design (contract §4).
      const result = await Share.share({ message: payload.message, url: payload.imageUri });
      // dismissedAction = deliberate cancel = silent (FR-014).
      void result;
    } catch {
      setError("Couldn't open sharing. Please try again.");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const share = useCallback(
    async (entry: VaultEntry) => {
      if (entry.garments.length >= 2) {
        setPickerFor(entry); // multi-garment: the user picks the piece
        return;
      }
      // Single garment: share it directly; none (migrated/demo): whole look.
      await present(entry, entry.garments[0]);
    },
    [present],
  );

  const shareGarment = useCallback(
    async (entry: VaultEntry, garment: VaultGarment | 'look') => {
      setPickerFor(null);
      await present(entry, garment === 'look' ? undefined : garment);
    },
    [present],
  );

  const dismissPicker = useCallback(() => setPickerFor(null), []);
  const clearError = useCallback(() => setError(null), []);

  return { pickerFor, share, shareGarment, dismissPicker, error, clearError };
}
