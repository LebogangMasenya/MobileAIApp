/**
 * Ephemeral upload store (specs/008 contracts/search-api.md §2, research R2,
 * data-model §6) — holds an isolated-garment PNG in memory JUST long enough
 * for the URL-only visual-matching provider to fetch it back from this
 * deployment's own public origin.
 *
 * PRIVACY IS THE ARCHITECTURE: user photos NEVER touch a durable store
 * server-side. No disk writes, no cloud bucket, no database — a plain
 * in-process Map with a short TTL and an LRU cap. When this process
 * restarts, every pending upload is gone by design; the mobile client
 * degrades that to its designed UPSTREAM_FAILED retry state.
 *
 * Known constraint (accepted in research R2): in-memory means SINGLE
 * INSTANCE. True on Render free/starter (one process). If this API ever
 * scales horizontally, the provider's fetch could land on an instance that
 * never saw the upload — this module is the one seam to swap for a shared
 * store at that point.
 */

import { randomBytes } from 'node:crypto';

export interface StoredUpload {
  /** Unguessable token — the ONLY handle; there is no listing/enumeration. */
  id: string;
  bytes: Uint8Array;
  contentType: 'image/png';
  /** Epoch ms after which get() behaves as if the upload never existed. */
  expiresAt: number;
}

/**
 * ~5 minutes: the provider fetches within the same request window (seconds),
 * so TTL is a safety net against leaks, not a correctness window.
 */
const TTL_MS = 5 * 60 * 1000;
/** LRU cap — bounds worst-case memory at roughly cap × max upload size. */
const MAX_ENTRIES = 20;

/**
 * Map iteration order is insertion order, which makes it a free LRU queue:
 * the first key is always the oldest entry. (Gets don't refresh position —
 * uploads are fetched once, so recency-on-read buys nothing here.)
 */
const uploads = new Map<string, StoredUpload>();

function sweepExpired(now: number): void {
  for (const [id, upload] of uploads) {
    if (upload.expiresAt <= now) uploads.delete(id);
  }
}

/** Store bytes; returns the unguessable id used in the public image URL. */
export function putUpload(bytes: Uint8Array): string {
  const now = Date.now();
  // Sweep on write (not a timer): with a 20-entry cap a periodic timer is
  // pure overhead, and write-time sweeping keeps this module dependency-
  // and lifecycle-free (nothing to clean up on shutdown).
  sweepExpired(now);
  while (uploads.size >= MAX_ENTRIES) {
    const oldest = uploads.keys().next().value;
    if (oldest === undefined) break;
    uploads.delete(oldest);
  }
  // 16 random bytes = 128 bits — unguessable by construction (contract §2).
  const id = randomBytes(16).toString('hex');
  uploads.set(id, { id, bytes, contentType: 'image/png', expiresAt: now + TTL_MS });
  return id;
}

/** Fetch bytes by id; null after expiry/eviction — the route maps that to 404. */
export function getUpload(id: string): StoredUpload | null {
  const upload = uploads.get(id);
  if (!upload) return null;
  if (upload.expiresAt <= Date.now()) {
    uploads.delete(id);
    return null;
  }
  return upload;
}
