/**
 * Product matching — resolves a detected garment to store listings via an
 * external product-search provider (research.md §6: no first-party catalog
 * in v1; the vendor is a swappable integration point behind this module).
 *
 * The one rule this module owns outright, regardless of vendor: region
 * filtering happens HERE, server-side (T033 / data-model.md). The client
 * never receives an item it can't buy — an empty `similarItems` array *is*
 * the "no regional match" state (FR-011), which keeps the mobile rendering
 * logic to a single length check.
 */

import type { DetectedGarment, MatchedProduct, SimilarItem, Store } from '../../types/scan';
import { UpstreamUnavailableError } from '../vision/dispatch';

export interface MatchResult {
  exactMatch: MatchedProduct | null;
  similarItems: SimilarItem[];
}

/** Raw listing shape from the product-search vendor, before our filtering. */
interface ProviderListing {
  id: string;
  title: string;
  imageUrl: string;
  price: { amount: number; currency: string } | null;
  ctaUrl: string;
  isExactMatch: boolean;
  similarityScore: number;
  store: Store;
}

interface ProviderResponse {
  listings: ProviderListing[];
}

/**
 * Similar items are capped so the modal stays scannable — an unbounded list
 * buries the best matches and slows the response payload for nothing.
 */
const MAX_SIMILAR_ITEMS = 12;

async function queryProvider(
  garment: DetectedGarment,
  region: string,
): Promise<ProviderResponse> {
  const url = process.env.PRODUCT_SEARCH_API_URL;
  if (!url) {
    throw new UpstreamUnavailableError('PRODUCT_SEARCH_API_URL is not configured');
  }
  let response: Response;
  try {
    response = await fetch(`${url}/search`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.PRODUCT_SEARCH_API_KEY
          ? { authorization: `Bearer ${process.env.PRODUCT_SEARCH_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ category: garment.category, region }),
    });
  } catch (cause) {
    throw new UpstreamUnavailableError(`Product search unreachable: ${String(cause)}`);
  }
  if (!response.ok) {
    throw new UpstreamUnavailableError(`Product search responded ${response.status}`);
  }
  return (await response.json()) as ProviderResponse;
}

/**
 * Resolve matches for one garment in one region.
 *
 * Even though the provider is asked for region-scoped results, we re-check
 * `store.regions` ourselves — the vendor's region handling is outside our
 * control, and shipping a user a listing they can't buy breaks the app's
 * core promise. Defense in depth over vendor trust.
 */
export async function findMatches(
  garment: DetectedGarment,
  region: string,
): Promise<MatchResult> {
  const { listings } = await queryProvider(garment, region);

  const regionEligible = listings.filter((listing) =>
    listing.store.regions.includes(region),
  );

  // First exact match wins; the provider's own ranking already ordered by
  // relevance, so we don't re-sort exact matches ourselves.
  const exact = regionEligible.find((listing) => listing.isExactMatch);

  const similarItems: SimilarItem[] = regionEligible
    .filter((listing) => !listing.isExactMatch)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, MAX_SIMILAR_ITEMS)
    .map((listing) => ({
      id: listing.id,
      garmentId: garment.id,
      store: listing.store,
      title: listing.title,
      imageUrl: listing.imageUrl,
      price: listing.price,
      ctaUrl: listing.ctaUrl,
      isExactMatch: false,
      similarityScore: listing.similarityScore,
      // Guaranteed by the regionEligible filter above; the field exists so
      // the contract is self-describing rather than relying on out-of-band
      // knowledge that filtering already happened.
      regionAvailable: true,
    }));

  return {
    exactMatch: exact
      ? {
          id: exact.id,
          garmentId: garment.id,
          store: exact.store,
          title: exact.title,
          imageUrl: exact.imageUrl,
          price: exact.price,
          ctaUrl: exact.ctaUrl,
          isExactMatch: true,
        }
      : null,
    similarItems,
  };
}
