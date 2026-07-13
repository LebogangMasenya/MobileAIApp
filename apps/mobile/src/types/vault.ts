/**
 * Wardrobe Vault types (specs/005-wardrobe-vault, data-model.md).
 * Everything device-local; matches stored in the canonical six-field
 * ProductMatch shape (feature 003) — see contracts §5 for the adapters.
 */

import type { ProductMatch } from '@/types/visual-search';

/** One saved look. */
export interface VaultEntry {
  /** Collision-safe random id — the record key. */
  id: string;
  /** Links camera-flow entries to their feature-001 scan session; null for demo entries. */
  scanId: string | null;
  /**
   * Permanent file:// URI under vault/images/ for camera entries; the hosted
   * demo-image https URL for demo entries (research §4 — camera entries carry
   * the hard offline guarantee).
   */
  imageUri: string;
  /** ISO 8601 — the grid sorts newest-first. */
  capturedAt: string;
  /** Deduped by source_url on merge (contract invariant V2). */
  matches: ProductMatch[];
  source: 'camera' | 'demo';
}

/**
 * Versioned envelope for vault/index.json, so a future storage migration
 * (SQLite/server) can detect and upgrade old payloads.
 */
export interface VaultIndex {
  v: 1;
  entries: VaultEntry[];
}
