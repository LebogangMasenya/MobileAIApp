/**
 * useVaultVisibility (specs/006 contract §5) — the settings seam for the
 * "Make Vault Public" preference and its once-only explainer.
 *
 * SAFE DEFAULT: absent or corrupt storage resolves to PRIVATE with the
 * explainer unseen — for anything named "public", failing closed is the only
 * acceptable failure direction (FR-002). `toggle()` persists BEFORE flipping
 * state, so the stored value and the visuals can never disagree (spec edge
 * case "rapid flipping").
 */

import { useCallback, useEffect, useState } from 'react';

import { readItem, writeItem } from '@/services/device-store';

const VISIBILITY_KEY = 'satori.vault.visibility.v1';

interface StoredVisibility {
  v: 1;
  isPublic: boolean;
  explainerShown: boolean;
}

const SAFE_DEFAULT: StoredVisibility = { v: 1, isPublic: false, explainerShown: false };

function parseStored(raw: string | null): StoredVisibility {
  if (!raw) return SAFE_DEFAULT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as StoredVisibility).v === 1 &&
      typeof (parsed as StoredVisibility).isPublic === 'boolean' &&
      typeof (parsed as StoredVisibility).explainerShown === 'boolean'
    ) {
      return parsed as StoredVisibility;
    }
    return SAFE_DEFAULT;
  } catch {
    return SAFE_DEFAULT;
  }
}

export interface UseVaultVisibilityResult {
  isPublic: boolean;
  /** False until the stored preference has been read (render the toggle inert until then). */
  isLoaded: boolean;
  toggle: () => Promise<void>;
  /** True exactly once: the first flip to public (FR-004). */
  explainerVisible: boolean;
  dismissExplainer: () => void;
}

export function useVaultVisibility(): UseVaultVisibilityResult {
  const [stored, setStored] = useState<StoredVisibility>(SAFE_DEFAULT);
  const [isLoaded, setIsLoaded] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readItem(VISIBILITY_KEY).then((raw) => {
      if (cancelled) return;
      setStored(parseStored(raw));
      setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async () => {
    const flippingPublic = !stored.isPublic;
    const showExplainer = flippingPublic && !stored.explainerShown;
    const next: StoredVisibility = {
      v: 1,
      isPublic: flippingPublic,
      explainerShown: stored.explainerShown || showExplainer,
    };
    // Persist first, then flip — see module comment.
    await writeItem(VISIBILITY_KEY, JSON.stringify(next));
    setStored(next);
    if (showExplainer) setExplainerVisible(true);
  }, [stored]);

  const dismissExplainer = useCallback(() => setExplainerVisible(false), []);

  return { isPublic: stored.isPublic, isLoaded, toggle, explainerVisible, dismissExplainer };
}
