/**
 * Daily Wardrobe Cycle store (specs/007 US5, data-model §3, contracts/
 * daily-cycle §1) — three booleans with a calendar, kept honest.
 *
 * One record per day in device-store (the useVaultVisibility pattern:
 * versioned JSON, safe default on any parse failure, persist-BEFORE-state
 * at the hook layer so storage and the ring can never disagree).
 *
 * The rollover is a READ-REPAIR, not a scheduled job: whoever loads the
 * record first on a new local date gets a fresh one. Comparing local date
 * STRINGS (not timestamps) is what gives the spec's timezone rule for free —
 * a mid-day timezone change that lands on the same local date keeps every
 * earned segment; only an actual date change resets.
 *
 * What fulfills each segment lives at the CALL SITES (contract §2) — this
 * module only knows ids, which is exactly what lets future features (real
 * wear log, harmony engine, AI generator) re-bind fulfillment without
 * touching the ring.
 */

import { readItem, writeItem } from '@/services/device-store';

export type SegmentId = 'log' | 'harmony' | 'coordinate';

export const SEGMENT_IDS: SegmentId[] = ['log', 'harmony', 'coordinate'];

export interface DailyCycleRecord {
  v: 1;
  /** Device-local calendar date 'YYYY-MM-DD' — THE rollover key. */
  date: string;
  /** Absent = not done. Value = ISO completion timestamp (SC-007 audit trail). */
  segments: Partial<Record<SegmentId, string>>;
  /** Full-ring celebration already played for `date` (interrupted-celebration edge case). */
  celebrated: boolean;
}

const STORE_KEY = 'satori.dailycycle.v1';

/** Device-LOCAL date string — `toISOString()` would be UTC and break the spec's rollover rule. */
export function localDateString(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function freshRecord(now: Date): DailyCycleRecord {
  return { v: 1, date: localDateString(now), segments: {}, celebrated: false };
}

function isRecord(candidate: unknown): candidate is DailyCycleRecord {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const record = candidate as Record<string, unknown>;
  const segments = record.segments as Record<string, unknown> | null;
  return (
    record.v === 1 &&
    typeof record.date === 'string' &&
    typeof record.celebrated === 'boolean' &&
    typeof segments === 'object' &&
    segments !== null &&
    Object.entries(segments).every(
      ([key, value]) => (SEGMENT_IDS as string[]).includes(key) && typeof value === 'string',
    )
  );
}

/**
 * The rollover rule, exported PURE so the day-boundary/timezone cases are
 * directly testable with plain dates (Constitution VIII).
 */
export function resolveRollover(record: DailyCycleRecord, now: Date): DailyCycleRecord {
  return record.date === localDateString(now) ? record : freshRecord(now);
}

async function persist(record: DailyCycleRecord): Promise<void> {
  // Best-effort: a failed write degrades to session-only ring state — the
  // ring may forget overnight, but it never crashes or blocks (V-II).
  await writeItem(STORE_KEY, JSON.stringify(record));
}

/** Load today's record — read-repairing across day boundaries. Never throws. */
export async function loadToday(now: Date = new Date()): Promise<DailyCycleRecord> {
  try {
    const raw = await readItem(STORE_KEY);
    if (!raw) return freshRecord(now);
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return freshRecord(now); // corrupt ⇒ safe default
    const repaired = resolveRollover(parsed, now);
    // Persist the repair so a crash right after midnight can't resurrect
    // yesterday's completed ring.
    if (repaired !== parsed) await persist(repaired);
    return repaired;
  } catch {
    return freshRecord(now);
  }
}

/**
 * Mark a segment done today — idempotent (contract §1): re-marking keeps the
 * FIRST completion timestamp, so "did it today" can't be gamed by repeats.
 * Returns the resulting record for the caller's state update.
 */
export async function markSegment(id: SegmentId, now: Date = new Date()): Promise<DailyCycleRecord> {
  const record = await loadToday(now);
  if (record.segments[id]) return record; // already earned — no-op
  const updated: DailyCycleRecord = {
    ...record,
    segments: { ...record.segments, [id]: now.toISOString() },
  };
  await persist(updated);
  return updated;
}

/** Record that today's full-ring celebration has played (once per date). */
export async function markCelebrated(now: Date = new Date()): Promise<DailyCycleRecord> {
  const record = await loadToday(now);
  if (record.celebrated) return record;
  const updated: DailyCycleRecord = { ...record, celebrated: true };
  await persist(updated);
  return updated;
}

export function isRingComplete(record: DailyCycleRecord): boolean {
  return SEGMENT_IDS.every((id) => Boolean(record.segments[id]));
}
