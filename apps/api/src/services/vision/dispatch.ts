/**
 * Vision dispatch — the hybrid on-device/cloud seam (research.md §3).
 *
 * The tradeoff this file encodes: iOS clients will eventually run person
 * detection on-device (Apple Vision, zero latency/cost) and could submit
 * results alongside the photo; every other caller needs the cloud path.
 * Route handlers never know which path served them — they call `dispatch`
 * and get the same typed shapes either way, which is what keeps the
 * client-facing contract identical across platforms (plan.md).
 */

import type { BoundingRegion, DetectedGarment, DetectedPerson } from '../../types/scan';
import { MockVisionProvider } from './mockProvider';

/**
 * Thrown when the upstream vision service can't be reached or isn't
 * configured. Route handlers map this to the contract's UPSTREAM_UNAVAILABLE
 * code — the one clients treat as retryable.
 */
export class UpstreamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamUnavailableError';
  }
}

/** Detection results for a whole photo: every distinguishable person. */
export interface PersonDetectionResult {
  people: Array<{ boundingRegion: BoundingRegion }>;
}

/** Garment segmentation results for one selected person. */
export interface GarmentSegmentationResult {
  garments: Array<{
    category: string;
    confidence: number;
    boundingRegion: BoundingRegion;
  }>;
}

/**
 * The provider contract both paths implement. Kept to exactly the two
 * operations the routes need — a broader "vision toolkit" interface would
 * be speculative abstraction (Constitution: Anti-Abstraction Mandate).
 */
export interface VisionProvider {
  detectPeople(photo: ArrayBuffer): Promise<PersonDetectionResult>;
  segmentGarments(photo: ArrayBuffer, person: BoundingRegion): Promise<GarmentSegmentationResult>;
}

/**
 * Garments below this confidence are dropped entirely rather than shown as
 * low-confidence bubbles — the user never sees a bubble the system already
 * doubts (data-model.md rule supporting SC-002). Tuning parameter, not a
 * spec value; adjust against real-world accuracy data.
 */
const MIN_GARMENT_CONFIDENCE = 0.5;

/**
 * Cloud vision provider (research.md §3 — the Android/fallback path, and
 * the only server-side path until on-device results are accepted from iOS
 * clients). Speaks to whichever vision vendor VISION_API_URL points at;
 * the vendor choice is deliberately swappable behind this class.
 */
class CloudVisionProvider implements VisionProvider {
  private endpoint(): string {
    const url = process.env.VISION_API_URL;
    if (!url) {
      // Unconfigured is indistinguishable from unreachable as far as the
      // user experience goes, so it maps to the same retryable error.
      throw new UpstreamUnavailableError('VISION_API_URL is not configured');
    }
    return url;
  }

  private async call<T>(path: string, body: BodyInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.endpoint()}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          ...(process.env.VISION_API_KEY
            ? { authorization: `Bearer ${process.env.VISION_API_KEY}` }
            : {}),
        },
        body,
      });
    } catch (cause) {
      throw new UpstreamUnavailableError(`Vision service unreachable: ${String(cause)}`);
    }
    if (!response.ok) {
      throw new UpstreamUnavailableError(`Vision service responded ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async detectPeople(photo: ArrayBuffer): Promise<PersonDetectionResult> {
    return this.call<PersonDetectionResult>('/detect-people', photo);
  }

  async segmentGarments(
    photo: ArrayBuffer,
    person: BoundingRegion,
  ): Promise<GarmentSegmentationResult> {
    // The person region rides in a header so the photo bytes stream through
    // unmodified — re-encoding the image just to embed four floats would
    // burn CPU on every request for nothing.
    let response: Response;
    try {
      response = await fetch(`${this.endpoint()}/segment-garments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-person-region': JSON.stringify(person),
          ...(process.env.VISION_API_KEY
            ? { authorization: `Bearer ${process.env.VISION_API_KEY}` }
            : {}),
        },
        body: photo,
      });
    } catch (cause) {
      throw new UpstreamUnavailableError(`Vision service unreachable: ${String(cause)}`);
    }
    if (!response.ok) {
      throw new UpstreamUnavailableError(`Vision service responded ${response.status}`);
    }
    return (await response.json()) as GarmentSegmentationResult;
  }
}

/**
 * Provider selection: explicit VISION_PROVIDER=mock wins; otherwise mock is
 * the automatic dev fallback when no real endpoint is configured outside
 * production. In production an unconfigured endpoint stays a loud
 * UPSTREAM_UNAVAILABLE — silently mocking real user traffic would be worse
 * than failing.
 */
function selectProvider(): VisionProvider {
  if (process.env.VISION_PROVIDER === 'mock') return new MockVisionProvider();
  if (!process.env.VISION_API_URL && process.env.NODE_ENV !== 'production') {
    return new MockVisionProvider();
  }
  return new CloudVisionProvider();
}

const visionProvider: VisionProvider = selectProvider();

/**
 * Detect every distinguishable person in a photo, assigning ids and the
 * "pending" status that gates multi-person segmentation on user selection
 * (FR-016 — see data-model.md's DetectedPerson state rule).
 */
export async function detectPeople(photo: ArrayBuffer): Promise<DetectedPerson[]> {
  const result = await visionProvider.detectPeople(photo);
  return result.people.map((person) => ({
    id: crypto.randomUUID(),
    boundingRegion: person.boundingRegion,
    segmentationStatus: 'pending',
  }));
}

/**
 * Segment garments for one selected person, applying the confidence floor
 * and stamping ids/ownership. Same provider path serves Android and the
 * low-confidence retry cases (T026); iOS on-device results will bypass this
 * entirely once the client-submission seam lands.
 */
export async function segmentGarments(
  photo: ArrayBuffer,
  person: DetectedPerson,
): Promise<DetectedGarment[]> {
  const result = await visionProvider.segmentGarments(photo, person.boundingRegion);
  return result.garments
    .filter((garment) => garment.confidence >= MIN_GARMENT_CONFIDENCE)
    .map((garment) => ({
      id: crypto.randomUUID(),
      personId: person.id,
      category: garment.category,
      confidence: garment.confidence,
      boundingRegion: garment.boundingRegion,
      matchStatus: 'unresolved' as const,
    }));
}
