/**
 * Google Cloud Vision provider — the first REAL implementation of the
 * VisionProvider seam (research.md §3; vendor decision 2026-07-19).
 *
 * One vendor operation serves both contract operations: OBJECT_LOCALIZATION
 * returns every localized object in the photo ("Person" AND apparel) in a
 * single response, so this module annotates a photo ONCE and answers
 * `detectPeople` and `segmentGarments` from the same result. The memo is a
 * WeakMap keyed by the photo's ArrayBuffer identity: every call path in
 * routes/scans.ts (create-scan's inline segmentation, and the later
 * person-selection route reading from photoCache) passes the SAME buffer
 * object, so a scan costs exactly one billed Vision call — and the entry
 * dies with the buffer, so the memo can never outlive photoCache eviction.
 *
 * Style contract (matches serpApiProvider): plain fetch, no SDK, the wire
 * parsed from `unknown` and never trusted to match types. Failures map to
 * UpstreamUnavailableError so route handlers reuse the retryable-503 path.
 */

import type { BoundingRegion } from '../../types/scan';
import {
  UpstreamUnavailableError,
  type GarmentSegmentationResult,
  type PersonDetectionResult,
  type VisionProvider,
} from './dispatch';

/** Same abort budget philosophy as the SerpApi provider (FR-008). */
const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Vision object names → the app's garment categories (the strings users see
 * on bubbles and in the detail modal, so they're friendly-lowercase).
 * Names outside this map are not garments (Person, Bicycle, …) and are
 * dropped — an unknown label on a bubble would read as a glitch.
 */
const APPAREL_CATEGORIES: Record<string, string> = {
  Top: 'top',
  Shirt: 'shirt',
  'T-shirt': 't-shirt',
  Sweater: 'sweater',
  Hoodie: 'hoodie',
  Outerwear: 'outerwear',
  Jacket: 'jacket',
  Coat: 'coat',
  Blazer: 'blazer',
  Suit: 'suit',
  Dress: 'dress',
  Skirt: 'skirt',
  Pants: 'pants',
  Jeans: 'jeans',
  Shorts: 'shorts',
  Swimwear: 'swimwear',
  Shoe: 'shoes',
  Footwear: 'shoes',
  Boot: 'boots',
  Sandal: 'sandals',
  'High heels': 'heels',
  Sneakers: 'sneakers',
  Hat: 'hat',
  'Sun hat': 'hat',
  Scarf: 'scarf',
  Tie: 'tie',
  Belt: 'belt',
  Glove: 'gloves',
  Sock: 'socks',
  Sunglasses: 'sunglasses',
  Handbag: 'handbag',
  Backpack: 'backpack',
  Watch: 'watch',
};

/**
 * A garment belongs to a person when at least half of its box lies inside
 * that person's box. Looser than full containment on purpose: real boxes
 * bleed (a shoe's box pokes below the person's), and losing a real garment
 * hurts more than occasionally attributing a bystander's sleeve.
 */
const MIN_PERSON_OVERLAP_RATIO = 0.5;

/** One localized object, already normalized into the app's coordinate model. */
interface LocalizedObject {
  name: string;
  score: number;
  region: BoundingRegion;
}

/** Raw wire shapes — every field unknown until proven (serpApi precedent). */
interface RawVertex {
  x?: unknown;
  y?: unknown;
}

interface RawAnnotation {
  name?: unknown;
  score?: unknown;
  boundingPoly?: { normalizedVertices?: unknown };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Vision reports normalized polygons; the app's model is axis-aligned boxes,
 * so the polygon collapses to its bounding box. Vertices omit x/y when the
 * value is 0 (proto3 default-elision) — a missing coordinate IS 0.
 */
function toRegion(vertices: RawVertex[]): BoundingRegion | null {
  if (vertices.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const vertex of vertices) {
    const x = clamp01(typeof vertex.x === 'number' ? vertex.x : 0);
    const y = clamp01(typeof vertex.y === 'number' ? vertex.y : 0);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  // Zero-area boxes are unplaceable (no bubble position) — drop at the edge.
  if (width <= 0 || height <= 0) return null;
  return { x: minX, y: minY, width, height };
}

function parseAnnotations(body: unknown): LocalizedObject[] {
  if (typeof body !== 'object' || body === null) return [];
  const responses = (body as { responses?: unknown }).responses;
  if (!Array.isArray(responses) || responses.length === 0) return [];
  const first = responses[0] as {
    localizedObjectAnnotations?: unknown;
    error?: { message?: unknown };
  };
  // A per-image error (bad bytes, unsupported format) arrives inside a 200 —
  // surfaced as upstream trouble so the client gets its retryable state.
  if (first.error) {
    throw new UpstreamUnavailableError(
      `Vision annotation error: ${typeof first.error.message === 'string' ? first.error.message : 'unknown'}`,
    );
  }
  const annotations = first.localizedObjectAnnotations;
  if (!Array.isArray(annotations)) return [];

  const objects: LocalizedObject[] = [];
  for (const raw of annotations) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { name, score, boundingPoly } = raw as RawAnnotation;
    if (typeof name !== 'string' || typeof score !== 'number') continue;
    const vertices = boundingPoly?.normalizedVertices;
    if (!Array.isArray(vertices)) continue;
    const region = toRegion(vertices as RawVertex[]);
    if (!region) continue;
    objects.push({ name, score, region });
  }
  return objects;
}

/** intersection(garment, person) / area(garment) — the attribution test. */
function overlapRatio(garment: BoundingRegion, person: BoundingRegion): number {
  const left = Math.max(garment.x, person.x);
  const top = Math.max(garment.y, person.y);
  const right = Math.min(garment.x + garment.width, person.x + person.width);
  const bottom = Math.min(garment.y + garment.height, person.y + person.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const garmentArea = garment.width * garment.height;
  return garmentArea > 0 ? intersection / garmentArea : 0;
}

/**
 * The single-annotate-per-photo memo. The cached value is the PROMISE, not
 * the result, so create-scan's back-to-back detectPeople + segmentGarments
 * share one in-flight request instead of racing two. A rejected annotate is
 * evicted so a retry after transient upstream trouble re-attempts.
 */
const annotateMemo = new WeakMap<ArrayBuffer, Promise<LocalizedObject[]>>();

export class GoogleVisionProvider implements VisionProvider {
  private async fetchAnnotations(photo: ArrayBuffer): Promise<LocalizedObject[]> {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      throw new UpstreamUnavailableError('GOOGLE_VISION_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: Buffer.from(photo).toString('base64') },
                features: [{ type: 'OBJECT_LOCALIZATION', maxResults: 50 }],
              },
            ],
          }),
          signal: controller.signal,
        });
      } catch (cause) {
        throw new UpstreamUnavailableError(`Vision service unreachable: ${String(cause)}`);
      }
      if (!response.ok) {
        // Status only, never the body — error bodies can echo the request
        // (including the key in the URL) back at us (serpApi log hygiene).
        throw new UpstreamUnavailableError(`Vision service responded ${response.status}`);
      }
      return parseAnnotations(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }

  private annotate(photo: ArrayBuffer): Promise<LocalizedObject[]> {
    let pending = annotateMemo.get(photo);
    if (!pending) {
      pending = this.fetchAnnotations(photo);
      annotateMemo.set(photo, pending);
      // Evict failures so "try again" reaches the vendor instead of replaying
      // a cached rejection for the lifetime of the photo bytes.
      pending.catch(() => annotateMemo.delete(photo));
    }
    return pending;
  }

  async detectPeople(photo: ArrayBuffer): Promise<PersonDetectionResult> {
    const objects = await this.annotate(photo);
    return {
      people: objects
        .filter((object) => object.name === 'Person')
        .map((object) => ({ boundingRegion: object.region })),
    };
  }

  async segmentGarments(
    photo: ArrayBuffer,
    person: BoundingRegion,
  ): Promise<GarmentSegmentationResult> {
    const objects = await this.annotate(photo);
    return {
      garments: objects
        .filter(
          (object) =>
            object.name in APPAREL_CATEGORIES &&
            overlapRatio(object.region, person) >= MIN_PERSON_OVERLAP_RATIO,
        )
        .map((object) => ({
          category: APPAREL_CATEGORIES[object.name],
          confidence: object.score,
          boundingRegion: object.region,
        })),
    };
  }
}
