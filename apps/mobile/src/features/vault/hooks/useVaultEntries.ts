/**
 * useVaultEntries — the vault's read seam (specs/005 contracts §2).
 * Loads on demand (the reveal calls `retry`/initial load), not on an
 * app-wide poll. THE single swap point if the store ever graduates from the
 * JSON index to SQLite or server history (Constitution VIII).
 */

import { useCallback, useEffect, useState } from 'react';

import { deleteEntry, loadEntries } from '@/services/vault-store';
import type { VaultEntry } from '@/types/vault';

export interface UseVaultEntriesResult {
  /** Newest first. */
  entries: VaultEntry[];
  isLoading: boolean;
  /** Human copy when the index existed but couldn't be read (FR-006). */
  error: string | null;
  retry: () => void;
  /** Delete an entry (record + image) and refresh the list. */
  remove: (id: string) => Promise<void>;
}

export function useVaultEntries(): UseVaultEntriesResult {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await loadEntries();
    setEntries(result.entries);
    if (result.failed) setError("We couldn't read your vault.");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    async (id: string) => {
      await deleteEntry(id);
      await load();
    },
    [load],
  );

  return { entries, isLoading, error, retry, remove };
}
