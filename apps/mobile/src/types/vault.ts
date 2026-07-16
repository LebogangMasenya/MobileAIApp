/**
 * Wardrobe Vault types (specs/005-wardrobe-vault, data-model.md).
 * Everything device-local; matches stored in the canonical six-field
 * ProductMatch shape (feature 003) — see contracts §5 for the adapters.
 */

import type { BoundingRegion } from '@/types/scan';
import type { ProductMatch } from '@/types/visual-search';

/**
 * One garment within a saved look — THE shareable unit (feature 006).
 * Stores the region (facts), never crop files (derivable cache).
 */
export interface VaultGarment {
  /** Feature-001 garment id — the merge key; re-segmentation never duplicates. */
  id: string;
  /** Category label — picker row + share header. */
  category: string;
  /** Normalized (0–1) position within the look photo; crop source. */
  boundingRegion: BoundingRegion;
  /** THAT garment's matches, deduped by source_url, growing as fetched. */
  matches: ProductMatch[];
}

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
  /**
   * The AGGREGATE match view (all garments) — the grid count and detail
   * modal read this; per-garment lists below are additive (feature 006).
   */
  matches: ProductMatch[];
  /**
   * Which flow saved the look. 'lift' (feature 008) is additive: a completed
   * Subject Lift search writes one entry with the SOURCE photo (durable) and
   * empty garments — the demo-entry precedent, no region data on this path.
   */
  source: 'camera' | 'demo' | 'lift';
  /**
   * Photo pixel dimensions, known at capture — required for region→pixel
   * crop math. Null on v1-migrated and demo entries (blocks cropping only;
   * such entries share as whole looks).
   */
  imageSize: { width: number; height: number } | null;
  /** Per-garment breakdown; empty on v1-migrated and demo entries. */
  garments: VaultGarment[];
}

/**
 * Versioned envelope for vault/index.json. v2 (feature 006) adds per-garment
 * records + imageSize; v1 files are migrated losslessly on read (store V5).
 */
export interface VaultIndex {
  v: 2;
  entries: VaultEntry[];
}
