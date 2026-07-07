/**
 * Region preference: inferred from device locale by default, explicitly
 * overridable by the user, override always wins once set (FR-010/FR-010a).
 *
 * Lives in a hook (not a component) per Constitution Principle VIII —
 * SecureStore I/O and locale inference are device-state concerns the UI
 * should only ever see as `{ preference, setRegion, clearOverride }`.
 */

import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import type { RegionPreference } from '../../../types/scan';

/**
 * SecureStore over AsyncStorage: region alone isn't a secret, but it's
 * user-profile-adjacent data and SecureStore's API is identical in cost —
 * choosing the encrypted option by default means never having to migrate
 * later when genuinely sensitive preferences join it.
 */
const OVERRIDE_KEY = 'scan.regionOverride';

/** Last-resort default when the device reports no usable locale region. */
const FALLBACK_REGION = 'US';

function inferRegionFromLocale(): string {
  // getLocales() is ordered by user preference; the first entry with a
  // region code is the closest thing the device has to "where am I shopping".
  for (const locale of getLocales()) {
    if (locale.regionCode) {
      return locale.regionCode;
    }
  }
  return FALLBACK_REGION;
}

export interface UseRegionPreferenceResult {
  /** null only during the initial async read — render a loading state, not FALLBACK. */
  preference: RegionPreference | null;
  /** Persist an explicit user override (ISO 3166-1 alpha-2). */
  setRegion: (region: string) => Promise<void>;
  /** Drop the override and fall back to the inferred device-locale region. */
  clearOverride: () => Promise<void>;
}

export function useRegionPreference(): UseRegionPreferenceResult {
  const [preference, setPreference] = useState<RegionPreference | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Async because SecureStore reads hit the platform keychain. The
    // `cancelled` flag prevents a state update if the consuming screen
    // unmounts before the read resolves — a classic RN memory-leak warning.
    (async () => {
      let stored: string | null = null;
      try {
        stored = await SecureStore.getItemAsync(OVERRIDE_KEY);
      } catch {
        // A keychain read failure must never block scanning — degrade to
        // the inferred region (Defensive Error Scaffolding).
        stored = null;
      }
      if (cancelled) return;
      setPreference(
        stored !== null
          ? { region: stored, source: 'user_override' }
          : { region: inferRegionFromLocale(), source: 'inferred' },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setRegion = useCallback(async (region: string): Promise<void> => {
    // Optimistic update: the UI reflects the choice immediately; persistence
    // failing just means the override won't survive a restart, which is a
    // strictly better failure mode than a frozen settings screen.
    setPreference({ region, source: 'user_override' });
    try {
      await SecureStore.setItemAsync(OVERRIDE_KEY, region);
    } catch {
      // Swallow: see optimistic-update note above.
    }
  }, []);

  const clearOverride = useCallback(async (): Promise<void> => {
    setPreference({ region: inferRegionFromLocale(), source: 'inferred' });
    try {
      await SecureStore.deleteItemAsync(OVERRIDE_KEY);
    } catch {
      // Swallow: next launch re-reads the stale override, but setRegion or a
      // successful future clear self-heals it.
    }
  }, []);

  return { preference, setRegion, clearOverride };
}
