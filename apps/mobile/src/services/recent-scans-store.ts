/**
 * Device-local recent-scans store (specs/002 contracts §6, research §5).
 *
 * Feature 001's backend keeps sessions in memory and anonymously — there is
 * no server-side per-user history yet. This small versioned JSON store is the
 * honest local stand-in: written by the scan flow on success, read by Home's
 * `useRecentScans`. When server-side history arrives, the hook is the single
 * swap point and this file retires.
 *
 * Failure policy (FR-016 / Constitution VII): reads NEVER throw — a corrupt
 * payload reports `failed: true` and empty scans so Home can show its retry
 * state; writes are best-effort and swallow their own errors (losing one rail
 * entry must never break a successful scan).
 */

import { readItem, writeItem } from '@/services/device-store';
import type { RecentScanSummary, RecentScansStore } from '@/types/auth';

const STORE_KEY = 'satori.scans.recent.v1';
/** Keep the payload SecureStore-friendly (see device-store.ts) — 20 per contract. */
const MAX_RECENT_SCANS = 20;

function isSummary(candidate: unknown): candidate is RecentScanSummary {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const record = candidate as Record<string, unknown>;
  return (
    typeof record.scanId === 'string' &&
    typeof record.thumbnailUri === 'string' &&
    typeof record.capturedAt === 'string' &&
    typeof record.garmentCount === 'number'
  );
}

function parseStore(raw: string): RecentScanSummary[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as RecentScansStore).v !== 1 ||
      !Array.isArray((parsed as RecentScansStore).scans)
    ) {
      return null;
    }
    return (parsed as RecentScansStore).scans.filter(isSummary);
  } catch {
    return null;
  }
}

export interface LoadRecentScansResult {
  /** Newest first (FR-013). */
  scans: RecentScanSummary[];
  /** True when a payload existed but could not be read — Home shows retry (FR-016). */
  failed: boolean;
}

export async function loadRecentScans(): Promise<LoadRecentScansResult> {
  const raw = await readItem(STORE_KEY);
  if (raw === null) return { scans: [], failed: false }; // absent ≠ broken: first run
  const scans = parseStore(raw);
  if (scans === null) return { scans: [], failed: true };
  return {
    scans: [...scans].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    failed: false,
  };
}

/** Prepends (or replaces, by scanId) a summary and trims to the newest 20. */
export async function appendRecentScan(summary: RecentScanSummary): Promise<void> {
  try {
    const raw = await readItem(STORE_KEY);
    const existing = raw === null ? [] : (parseStore(raw) ?? []); // corrupt store: start fresh
    const scans = [summary, ...existing.filter((scan) => scan.scanId !== summary.scanId)]
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .slice(0, MAX_RECENT_SCANS);
    await writeItem(STORE_KEY, JSON.stringify({ v: 1, scans } satisfies RecentScansStore));
  } catch {
    // Best-effort by design — see module comment.
  }
}

/**
 * Multi-person photos record 0 garments at scan time (001 defers segmentation
 * until a person is chosen); this bumps the count once segmentation lands.
 */
export async function updateRecentScanGarmentCount(scanId: string, garmentCount: number): Promise<void> {
  try {
    const raw = await readItem(STORE_KEY);
    if (raw === null) return;
    const existing = parseStore(raw);
    if (existing === null) return;
    const scans = existing.map((scan) => (scan.scanId === scanId ? { ...scan, garmentCount } : scan));
    await writeItem(STORE_KEY, JSON.stringify({ v: 1, scans } satisfies RecentScansStore));
  } catch {
    // Best-effort by design — see module comment.
  }
}
