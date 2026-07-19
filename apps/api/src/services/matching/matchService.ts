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

import sharp from 'sharp';

import type { DetectedGarment, MatchedProduct, SimilarItem, Store } from '../../types/scan';
import { UpstreamUnavailableError } from '../vision/dispatch';
import { putUpload } from '../visualSearch/uploadStore';
import { searchByImage } from '../visualSearch/serpApiProvider';
import { mockSearch } from './mockProvider';

/**
 * The scan photo's bytes are gone (isolate recycled / cache evicted), so the
 * garment can no longer be cropped for visual search. Routes map this to the
 * same honest "rescan" answer the person-selection route gives — it is a
 * session-lifetime fact, NOT upstream trouble, so it must not look retryable.
 */
export class ScanPhotoExpiredError extends Error {
  constructor() {
    super('The scan photo is no longer available for matching.');
    this.name = 'ScanPhotoExpiredError';
  }
}

/** What the visual-search path needs beyond the garment itself. */
export interface MatchContext {
  /** Original scan photo bytes from routes/scans.ts's photoCache, if alive. */
  photoBytes: ArrayBuffer | undefined;
  /** This deployment's public origin — the self-origin image-hosting trick. */
  origin: string;
}

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

/**
 * Padding around the garment's bounding box when cropping (fraction of each
 * box dimension per side). Detection boxes hug the garment tightly; a sliver
 * of surrounding context measurably helps Lens recognize the item, while too
 * much re-admits the busy background the crop exists to remove.
 */
const CROP_PADDING_RATIO = 0.1;

/**
 * Crop the garment's region out of the scan photo → PNG bytes for hosting.
 * BoundingRegion is normalized [0,1]; sharp wants integer pixels, so the
 * region is scaled by the decoded dimensions and clamped to the frame
 * (padding may push past an edge — clamp, don't fail).
 */
async function cropGarment(photoBytes: ArrayBuffer, garment: DetectedGarment): Promise<Uint8Array> {
  const input = Buffer.from(photoBytes);
  // .rotate() with no args = apply EXIF orientation FIRST: phone photos are
  // often stored rotated with an orientation tag, and the vision provider
  // reported regions against the *oriented* pixels — cropping the raw sensor
  // orientation would cut the wrong region. sharp's pipeline applies this
  // rotation before the extract below regardless of source orientation.
  const image = sharp(input).rotate();

  // metadata() reports PRE-rotation dimensions; EXIF orientations 5–8 are
  // the 90°-rotated family, where the oriented frame has them swapped.
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) {
    throw new UpstreamUnavailableError('Scan photo could not be decoded for matching');
  }
  const quarterTurned = (meta.orientation ?? 1) >= 5;
  const width = quarterTurned ? meta.height : meta.width;
  const height = quarterTurned ? meta.width : meta.height;

  const { boundingRegion: box } = garment;
  const padX = box.width * CROP_PADDING_RATIO;
  const padY = box.height * CROP_PADDING_RATIO;
  const left = Math.max(0, Math.floor((box.x - padX) * width));
  const top = Math.max(0, Math.floor((box.y - padY) * height));
  const right = Math.min(width, Math.ceil((box.x + box.width + padX) * width));
  const bottom = Math.min(height, Math.ceil((box.y + box.height + padY) * height));
  if (right - left < 1 || bottom - top < 1) {
    throw new UpstreamUnavailableError('Garment region is degenerate — nothing to crop');
  }

  const png = await image
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

async function queryProvider(
  garment: DetectedGarment,
  region: string,
  context: MatchContext,
): Promise<ProviderResponse> {
  // Same selection rule as the vision dispatch: explicit mock wins, mock is
  // the automatic dev fallback when unconfigured, production stays loud.
  const useMock =
    process.env.PRODUCT_SEARCH_PROVIDER === 'mock' ||
    (!process.env.SERPAPI_API_KEY && process.env.NODE_ENV !== 'production');
  if (useMock) {
    return mockSearch(garment, region);
  }

  if (!context.photoBytes) {
    throw new ScanPhotoExpiredError();
  }

  // The 008 visual-search pipeline, reapplied to one garment: crop → host
  // ephemerally on our own origin → Google Lens by URL. A decode/crop
  // failure is indistinguishable from upstream trouble as far as the user's
  // options go (retry / rescan), so it rides the same retryable error.
  let crop: Uint8Array;
  try {
    crop = await cropGarment(context.photoBytes, garment);
  } catch (error) {
    if (error instanceof UpstreamUnavailableError) throw error;
    throw new UpstreamUnavailableError(`Garment crop failed: ${String(error)}`);
  }

  const uploadId = putUpload(crop);
  const imageUrl = `${context.origin}/v1/visual-search/images/${uploadId}`;

  const result = await searchByImage({ imageUrl, country: region });
  if (result.kind !== 'ok') {
    throw new UpstreamUnavailableError(`Product search ${result.kind}`);
  }

  // Adapt Lens matches onto the listing shape the selection logic below
  // consumes. Rank encodes similarity (Lens orders by relevance, exposes no
  // score), and the store's region is the one we scoped the search to —
  // which keeps the defense-in-depth region filter meaningful without
  // fabricating global availability claims.
  return {
    listings: result.matches.map((match, index) => ({
      id: match.id,
      title: match.title,
      imageUrl: match.thumbnail,
      price:
        typeof match.price_value === 'number' && typeof match.currency === 'string'
          ? { amount: match.price_value, currency: match.currency }
          : null,
      ctaUrl: match.source_url,
      isExactMatch: match.exact === true,
      similarityScore: 1 - index / Math.max(1, result.matches.length),
      store: {
        id: new URL(match.source_url).hostname,
        name: match.store_name,
        regions: [region],
        logoUrl: null,
      },
    })),
  };
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
  context: MatchContext,
): Promise<MatchResult> {
  const { listings } = await queryProvider(garment, region, context);

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
