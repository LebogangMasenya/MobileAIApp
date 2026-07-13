/**
 * Vault storage service (specs/005 contracts §1) — the ONLY module that
 * touches expo-file-system for vault purposes (the device-store.ts precedent:
 * one seam per storage backend).
 *
 * Verified against the installed expo-file-system ~19.0.23 types (T002):
 * the SDK-54 object API — `Paths.document: Directory`; `new File(...uris)` /
 * `new Directory(...uris)`; synchronous, THROWING `create/write/move/delete`
 * (move updates `.uri` in place); async `text()`. Every throw is contained
 * here — contract invariant V4: no vault failure ever surfaces as a
 * scan-flow error, so every scan-path-facing function catches and degrades.
 *
 * Write-order invariant (V1): an entry's image is durably placed by
 * `persistImage` BEFORE `upsertEntry` writes its record — a crash between
 * the two leaves an orphaned file (swept opportunistically), never a record
 * pointing at nothing. Half-entries are structurally impossible.
 */

import { Directory, File, Paths } from 'expo-file-system';

import type { ProductMatch } from '@/types/visual-search';
import type { VaultEntry, VaultIndex } from '@/types/vault';

function imagesDir(): Directory {
  return new Directory(Paths.document, 'vault', 'images');
}

function indexFile(): File {
  return new File(Paths.document, 'vault', 'index.json');
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function ensureDirs(): void {
  // idempotent: true — repeat calls (every write path) succeed silently.
  imagesDir().create({ intermediates: true, idempotent: true });
}

function isVaultEntry(candidate: unknown): candidate is VaultEntry {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const record = candidate as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (typeof record.scanId === 'string' || record.scanId === null) &&
    typeof record.imageUri === 'string' &&
    typeof record.capturedAt === 'string' &&
    Array.isArray(record.matches) &&
    (record.source === 'camera' || record.source === 'demo')
  );
}

/** Read the raw entry list — salvaging valid entries from partial corruption (V3). */
async function readEntries(): Promise<{ entries: VaultEntry[]; failed: boolean }> {
  try {
    const file = indexFile();
    if (!file.exists) return { entries: [], failed: false }; // absent ≠ broken: first run
    const parsed: unknown = JSON.parse(await file.text());
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as VaultIndex).v !== 1 ||
      !Array.isArray((parsed as VaultIndex).entries)
    ) {
      return { entries: [], failed: true };
    }
    // Per-entry validation: one bad record never poisons the rest.
    return { entries: (parsed as VaultIndex).entries.filter(isVaultEntry), failed: false };
  } catch {
    return { entries: [], failed: true };
  }
}

function writeEntries(entries: VaultEntry[]): void {
  ensureDirs();
  const file = indexFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify({ v: 1, entries } satisfies VaultIndex));
}

// ---------------------------------------------------------------------------
// Public surface (contract §1)
// ---------------------------------------------------------------------------

/**
 * MOVE a temp capture/import file into permanent vault storage (FR-004 —
 * move, not copy-and-forget). Returns the permanent file:// URI, or null on
 * any failure — the caller proceeds with the temp URI and scanning is never
 * blocked (V4).
 */
export async function persistImage(sourceUri: string): Promise<string | null> {
  try {
    ensureDirs();
    const source = new File(sourceUri);
    if (!source.exists) return null;
    const destination = new File(imagesDir(), `${randomId('img')}.jpg`);
    source.move(destination); // updates source.uri to the new location
    return source.uri;
  } catch {
    return null;
  }
}

/** Delete a persisted image that never got an entry (failed/abandoned scan). */
export async function discardImage(permanentUri: string): Promise<void> {
  try {
    const file = new File(permanentUri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort — an orphaned file is swept later, never a user-facing error.
  }
}

/** Create or replace an entry by id. The image must already be durably placed (V1). */
export async function upsertEntry(entry: VaultEntry): Promise<void> {
  try {
    const { entries } = await readEntries();
    writeEntries([entry, ...entries.filter((existing) => existing.id !== entry.id)]);
  } catch {
    // V4 — vault writes are fire-and-forget from the scan path's perspective.
  }
}

/** Merge matches into the entry linked to scanId — dedupe by source_url (V2). No-op if absent. */
export async function mergeMatches(scanId: string, matches: ProductMatch[]): Promise<void> {
  if (matches.length === 0) return;
  try {
    const { entries } = await readEntries();
    const target = entries.find((entry) => entry.scanId === scanId);
    if (!target) return;
    const known = new Set(target.matches.map((match) => match.source_url));
    const merged = [...target.matches, ...matches.filter((match) => !known.has(match.source_url))];
    writeEntries(entries.map((entry) => (entry.id === target.id ? { ...entry, matches: merged } : entry)));
  } catch {
    // V4.
  }
}

export interface LoadVaultResult {
  /** Newest first. */
  entries: VaultEntry[];
  /** True when an index existed but could not be read — the grid shows retry (FR-006). */
  failed: boolean;
}

export async function loadEntries(): Promise<LoadVaultResult> {
  const result = await readEntries();
  return {
    entries: [...result.entries].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    failed: result.failed,
  };
}

/**
 * Remove record + image file. Record removal is never blocked by a file
 * failure (FR-008 — no dangling records; a stranded file is the recoverable
 * half of the failure and gets swept on a later write).
 */
export async function deleteEntry(id: string): Promise<void> {
  try {
    const { entries } = await readEntries();
    const target = entries.find((entry) => entry.id === id);
    writeEntries(entries.filter((entry) => entry.id !== id));
    if (target?.imageUri.startsWith('file:')) {
      await discardImage(target.imageUri);
    }
  } catch {
    // V4.
  }
}
