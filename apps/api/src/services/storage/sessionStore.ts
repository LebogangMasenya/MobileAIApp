/**
 * Scan session storage.
 *
 * WHY THIS EXISTS: POST /v1/scans creates a session that later requests
 * (per-person segmentation, per-garment matches) look up by id — some state
 * has to live *somewhere* between requests, even though the plan mandates
 * no first-party database for v1.
 *
 * WHY AN INTERFACE: on Vercel, each serverless invocation may run in a
 * different isolate, so a plain in-memory Map silently loses sessions in
 * production — one of the classic serverless pitfalls. The interface below
 * is the seam where a Redis/Vercel-KV implementation drops in without
 * touching route handlers. The in-memory implementation is correct for
 * local `next dev` (single process) and for tests.
 */

import type { ScanSession } from '../../types/scan';

export interface SessionStore {
  get(id: string): Promise<ScanSession | undefined>;
  put(session: ScanSession): Promise<void>;
}

/**
 * Sessions are transient by design (spec assumption: results don't persist
 * beyond the current session), so we also evict aggressively — this is a
 * working buffer, not a history feature.
 */
const TTL_MS = 30 * 60 * 1000;

interface Entry {
  session: ScanSession;
  expiresAt: number;
}

class InMemorySessionStore implements SessionStore {
  private readonly entries = new Map<string, Entry>();

  async get(id: string): Promise<ScanSession | undefined> {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(id);
      return undefined;
    }
    return entry.session;
  }

  async put(session: ScanSession): Promise<void> {
    // Opportunistic sweep on write keeps the Map bounded without a timer —
    // serverless isolates can be frozen between requests, so `setInterval`
    // cleanup is unreliable there.
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < Date.now()) this.entries.delete(key);
    }
    this.entries.set(session.id, { session, expiresAt: Date.now() + TTL_MS });
  }
}

/**
 * Module-scope singleton: Next.js route handlers import this file once per
 * isolate, so all routes in the same isolate share one store — which is
 * exactly the scope an in-memory implementation can honestly serve.
 */
export const sessionStore: SessionStore = new InMemorySessionStore();
