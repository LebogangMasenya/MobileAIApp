/**
 * Mock product-search provider — deterministic fake store listings for local
 * dev and quickstart validation (user decision 2026-07-07: mock the product
 * search API for now).
 *
 * The listing set is deliberately crafted to exercise every downstream rule:
 *  - one exact match in the requested region (FR-007 happy path)
 *  - several in-region similar items with descending similarity (FR-009 ranking)
 *  - one OUT-of-region listing that matchService MUST filter out — if it ever
 *    reaches a client, the server-side region filter (FR-010/FR-011) is broken
 *  - the "shoes" category returns nothing, giving quickstart a stable way to
 *    see the FR-013 "try another angle" state without stubbing anything.
 */

import type { DetectedGarment, Store } from '../../types/scan';

/** Mirrors matchService's ProviderListing/ProviderResponse wire shape. */
interface MockListing {
  id: string;
  title: string;
  imageUrl: string;
  price: { amount: number; currency: string } | null;
  ctaUrl: string;
  isExactMatch: boolean;
  similarityScore: number;
  store: Store;
}

function store(id: string, name: string, regions: string[]): Store {
  return { id, name, regions, logoUrl: null };
}

const CATEGORY_NO_MATCHES = 'shoes';

export function mockSearch(garment: DetectedGarment, region: string): { listings: MockListing[] } {
  if (garment.category === CATEGORY_NO_MATCHES) {
    return { listings: [] };
  }

  const upper = region.toUpperCase();
  const inRegionStore = store('store-local-1', 'Thread Local', [upper]);
  const inRegionStore2 = store('store-local-2', 'Wardrobe Hub', [upper, 'US']);
  // A region the requester is (almost certainly) not in — 'JP' unless the
  // requester IS JP, in which case 'FR'. Keeps the filter exercised for any
  // test region without special-casing.
  const elsewhere = upper === 'JP' ? 'FR' : 'JP';
  const outOfRegionStore = store('store-abroad-1', 'Tokyo Attire', [elsewhere]);

  const cat = garment.category;
  return {
    listings: [
      {
        id: `mock-${cat}-exact`,
        title: `Signature ${cat} — as seen`,
        imageUrl: `https://picsum.photos/seed/${cat}-exact/400/500`,
        price: { amount: 129.99, currency: 'USD' },
        ctaUrl: `https://example.com/store-local-1/${cat}-exact`,
        isExactMatch: true,
        similarityScore: 1,
        store: inRegionStore,
      },
      {
        id: `mock-${cat}-sim-1`,
        title: `Relaxed ${cat} in stone`,
        imageUrl: `https://picsum.photos/seed/${cat}-sim1/400/500`,
        price: { amount: 89.5, currency: 'USD' },
        ctaUrl: `https://example.com/store-local-1/${cat}-sim-1`,
        isExactMatch: false,
        similarityScore: 0.91,
        store: inRegionStore,
      },
      {
        id: `mock-${cat}-sim-2`,
        title: `Everyday ${cat} — slim cut`,
        imageUrl: `https://picsum.photos/seed/${cat}-sim2/400/500`,
        price: { amount: 74.0, currency: 'USD' },
        ctaUrl: `https://example.com/store-local-2/${cat}-sim-2`,
        isExactMatch: false,
        similarityScore: 0.84,
        store: inRegionStore2,
      },
      {
        id: `mock-${cat}-sim-3`,
        title: `Heritage ${cat} — limited`,
        imageUrl: `https://picsum.photos/seed/${cat}-sim3/400/500`,
        price: null,
        ctaUrl: `https://example.com/store-local-2/${cat}-sim-3`,
        isExactMatch: false,
        similarityScore: 0.78,
        store: inRegionStore2,
      },
      {
        // MUST be filtered out server-side — asserts the FR-010/FR-011 rule.
        id: `mock-${cat}-foreign`,
        title: `Imported ${cat} (not shippable to you)`,
        imageUrl: `https://picsum.photos/seed/${cat}-foreign/400/500`,
        price: { amount: 210.0, currency: 'USD' },
        ctaUrl: `https://example.com/store-abroad-1/${cat}-foreign`,
        isExactMatch: false,
        similarityScore: 0.95,
        store: outOfRegionStore,
      },
    ],
  };
}
