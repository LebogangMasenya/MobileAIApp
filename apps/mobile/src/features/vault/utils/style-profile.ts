/**
 * Style Profile derivation (specs/007 US4, data-model §2, research R8) —
 * the pure function behind every "smart default" in the app.
 *
 * HONESTY IS THE ARCHITECTURE (SC-007): the profile is derived fresh from
 * the user's own stored looks and never persisted, so a personalization
 * claim can always be traced to the exact entries that earned it. The
 * `personalized` flag is what gates the micro-copy — cold-start users get
 * season copy, never a false "from your scans".
 *
 * Deliberately ABSENT: colors. VaultGarment carries no color data today, so
 * a "your most active colors" claim would be fabricated (R8). The optional
 * `colors` field below is the reserved seat for when garment color data
 * exists upstream — populate it, don't re-shape the type.
 */

import type { VaultEntry } from '@/types/vault';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface CategoryAffinity {
  category: string;
  /** Recency-weighted frequency, normalized so the top category is 1. */
  weight: number;
}

export interface StyleProfile {
  /** Descending by weight; empty for a cold-start user. */
  categories: CategoryAffinity[];
  season: Season;
  /** True iff derived from actual user history — the micro-copy gate. */
  personalized: boolean;
  /** RESERVED (research R8) — only populated when color data exists upstream. */
  colors?: string[];
}

/** Half-life for recency weighting: a scan from a month ago counts half. */
const HALF_LIFE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Northern-hemisphere meteorological seasons — good enough for copy tone. */
export function seasonOf(now: Date): Season {
  const month = now.getMonth(); // 0-based
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/**
 * Derive the profile from stored looks. Pure — (entries, now) in, profile
 * out — so it is directly testable without mocking storage or clocks
 * (Constitution VIII).
 */
export function deriveStyleProfile(entries: VaultEntry[], now: Date): StyleProfile {
  const weights = new Map<string, number>();

  for (const entry of entries) {
    // Exponential recency decay: 2^(-ageDays / halfLife). Yesterday's scan
    // speaks louder than last season's — "recent style profile" should mean
    // recent, or the smart default drifts toward who the user USED to be.
    const capturedMs = Date.parse(entry.capturedAt);
    const ageDays = Number.isNaN(capturedMs)
      ? HALF_LIFE_DAYS // unparseable date: count it, at half voice
      : Math.max(0, (now.getTime() - capturedMs) / MS_PER_DAY);
    const recency = Math.pow(2, -ageDays / HALF_LIFE_DAYS);

    // v1-migrated and demo entries have empty `garments` — they contribute
    // nothing rather than a fabricated category (honest absence, R8).
    for (const garment of entry.garments) {
      const category = garment.category.trim();
      if (!category) continue;
      weights.set(category, (weights.get(category) ?? 0) + recency);
    }
  }

  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 0;

  return {
    categories: ranked.map(([category, weight]) => ({
      category,
      weight: top > 0 ? weight / top : 0,
    })),
    season: seasonOf(now),
    personalized: ranked.length > 0,
  };
}
