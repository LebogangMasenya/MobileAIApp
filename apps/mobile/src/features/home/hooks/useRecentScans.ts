/**
 * useRecentScans — Home's read model over the device-local scan store
 * (FR-013/FR-016). THE single swap point when scan history moves server-side
 * (Constitution VIII / research §5): the return shape stays, the source goes.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadRecentScans } from '@/services/recent-scans-store';
import type { RecentScanSummary } from '@/types/auth';

export interface UseRecentScansResult {
  /** Newest first. */
  scans: RecentScanSummary[];
  isLoading: boolean;
  /** Human copy when the store existed but couldn't be read (FR-016). */
  error: string | null;
  retry: () => void;
}

export function useRecentScans(): UseRecentScansResult {
  const [scans, setScans] = useState<RecentScanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loadRecentScans().then((result) => {
      if (cancelled) return;
      setScans(result.scans);
      if (result.failed) {
        setError("We couldn't load your recent scans.");
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reload on FOCUS, not just mount: the user returns to Home from the Scan
  // tab with a brand-new entry, and the rail must already know about it.
  useFocusEffect(load);

  const retry = useCallback(() => {
    load();
  }, [load]);

  return { scans, isLoading, error, retry };
}
