/**
 * price-anchor (specs/008 US3, CL-002, research R4) — pure savings math.
 *
 * THE ANCHOR IS A COMPARABLE, NOT AN MSRP: the reference price is the
 * highest-priced comparable match in THIS result set, and the rendered copy
 * says so ("less than comparable retail"). No external price database, no
 * fabricated original price — every percentage this function emits is
 * verifiable from two prices visible in the same result set (SC-005).
 *
 * CURRENCY PARTITIONING: arithmetic only ever happens inside ONE currency —
 * the modal (most common) currency of the priced matches. Comparing ¥12,000
 * against $80 would produce a spectacular and completely fabricated
 * discount; a mixed-currency set simply produces fewer (or zero) labels.
 *
 * Deterministic by construction: same matches in, same labels out — the
 * SC-005 audit depends on it.
 */

import type { ProductMatch } from '@/types/visual-search';

export interface SavingsLabel {
  matchId: string;
  /** Integer percent below anchor — e.g. 35 → "35% less than comparable retail". */
  percent: number;
}

interface PricedMatch {
  id: string;
  value: number;
  currency: string;
}

export function deriveSavings(matches: ProductMatch[]): SavingsLabel[] {
  // Only matches whose numeric price AND currency both arrived well-typed
  // (the normalizer guarantees the pair travels together — FR-013).
  const priced: PricedMatch[] = [];
  for (const match of matches) {
    if (
      typeof match.price_value === 'number' &&
      Number.isFinite(match.price_value) &&
      match.price_value > 0 &&
      typeof match.currency === 'string' &&
      match.currency.length > 0
    ) {
      priced.push({ id: match.id, value: match.price_value, currency: match.currency });
    }
  }

  // Modal currency: most priced entries win; ties break by first appearance
  // in result order — an arbitrary but STABLE rule (determinism over taste).
  const counts = new Map<string, number>();
  for (const entry of priced) {
    counts.set(entry.currency, (counts.get(entry.currency) ?? 0) + 1);
  }
  let modal: string | null = null;
  let modalCount = 0;
  for (const entry of priced) {
    const count = counts.get(entry.currency) ?? 0;
    if (count > modalCount) {
      modal = entry.currency;
      modalCount = count;
    }
  }

  const comparable = priced.filter((entry) => entry.currency === modal);
  // CL-002 floor: fewer than two priced comparables means there is nothing
  // to compare — no labels AT ALL, not a label against thin air.
  if (comparable.length < 2) return [];

  const anchor = Math.max(...comparable.map((entry) => entry.value));

  const labels: SavingsLabel[] = [];
  for (const entry of comparable) {
    // The anchor itself never carries a label (it IS the reference), and
    // sub-1% differences floor away to nothing — "0% less" is noise.
    if (entry.value >= anchor) continue;
    const percent = Math.floor(((anchor - entry.value) / anchor) * 100);
    if (percent >= 1) labels.push({ matchId: entry.id, percent });
  }
  return labels;
}
