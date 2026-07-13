/**
 * Match-shape adapters (specs/005 contracts §5) — the two edges of the
 * "canonical ProductMatch" decision (spec Assumptions, approved lossiness):
 *
 *   001's rich MatchedProduct/SimilarItem ──▶ ProductMatch      (at vault write)
 *   stored ProductMatch[] ──▶ GarmentMatchesState 'loaded'      (at vault read,
 *                                     feeding GarmentDetailModal unchanged)
 *
 * Both are pure and total: odd data degrades to nulls the consumers already
 * handle — an adapter that can throw is a crash smuggled across a type edge.
 */

import type { GarmentMatchesState } from '@/features/scan/hooks/useGarmentMatches';
import type { MatchedProduct, Price, SimilarItem } from '@/types/scan';
import type { ProductMatch } from '@/types/visual-search';

/** 001 → canonical: Price {amount, currency} flattens to a display string. */
export function matchedProductToProductMatch(product: MatchedProduct | SimilarItem): ProductMatch {
  return {
    id: product.id,
    title: product.title,
    source_url: product.ctaUrl,
    thumbnail: product.imageUrl,
    price: product.price ? `${product.price.currency}${product.price.amount}` : null,
    store_name: product.store.name,
  };
}

/**
 * Best-effort display-string → Price. "$79.99*" ⇒ { amount: 79.99,
 * currency: "$" }. Unparseable ⇒ null (the modal already renders null prices
 * gracefully) — never a fabricated number (FR-004 spirit).
 */
function parseDisplayPrice(display: string | null): Price | null {
  if (!display) return null;
  const numberMatch = display.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) return null;
  const amount = Number(numberMatch[1]);
  if (!Number.isFinite(amount)) return null;
  const currency = display.slice(0, display.indexOf(numberMatch[1]) === -1 ? 0 : display.search(/\d/)).trim();
  return { amount, currency: currency || '$' };
}

/** canonical → the modal's loaded state: every stored match as a similar-item card. */
export function productMatchesToModalState(matches: ProductMatch[]): GarmentMatchesState {
  const similarItems: SimilarItem[] = matches.map((match) => ({
    id: match.id,
    garmentId: 'vault',
    store: {
      id: safeHostname(match.source_url),
      name: match.store_name,
      regions: [],
      logoUrl: null,
    },
    title: match.title,
    imageUrl: match.thumbnail,
    price: parseDisplayPrice(match.price),
    ctaUrl: match.source_url,
    isExactMatch: false,
    similarityScore: 0,
    regionAvailable: true,
  }));

  return {
    phase: 'loaded',
    matches: { garmentId: 'vault', exactMatch: null, similarItems },
  };
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'store';
  }
}
