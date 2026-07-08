/**
 * Mock vision provider — deterministic fake segmentation for local dev and
 * quickstart validation, so the full scan flow works before a real vision
 * vendor is wired up (user decision 2026-07-07: mock the vision API for now).
 *
 * Deliberately boring and predictable: the same input always produces the
 * same people/garments, because flaky mocks make every downstream bug look
 * like a mock bug. Multi-person behavior is controlled explicitly via
 * MOCK_PEOPLE_COUNT (default "1") rather than inferred from the photo, so
 * quickstart's multi-person scenario is a one-line env change.
 */

import type { BoundingRegion } from '../../types/scan';
import type { GarmentSegmentationResult, PersonDetectionResult, VisionProvider } from './dispatch';

/** Plausible single-subject framing: person centered, ~60% of frame height. */
const PERSON_ONE: BoundingRegion = { x: 0.3, y: 0.18, width: 0.4, height: 0.62 };
/** Second subject offset right, slightly smaller (background person). */
const PERSON_TWO: BoundingRegion = { x: 0.62, y: 0.26, width: 0.3, height: 0.5 };

/**
 * Garment regions expressed relative to the person box, then projected into
 * photo coordinates — mirrors how a real segmenter reports garments inside
 * a detected person, and keeps bubbles landing on the "body" wherever the
 * person box sits.
 */
const RELATIVE_GARMENTS: ReadonlyArray<{
  category: string;
  confidence: number;
  rel: BoundingRegion;
}> = [
  { category: 'jacket', confidence: 0.93, rel: { x: 0.1, y: 0.2, width: 0.8, height: 0.3 } },
  { category: 'pants', confidence: 0.88, rel: { x: 0.2, y: 0.52, width: 0.6, height: 0.34 } },
  { category: 'shoes', confidence: 0.81, rel: { x: 0.25, y: 0.88, width: 0.5, height: 0.12 } },
];

function project(person: BoundingRegion, rel: BoundingRegion): BoundingRegion {
  return {
    x: person.x + rel.x * person.width,
    y: person.y + rel.y * person.height,
    width: rel.width * person.width,
    height: rel.height * person.height,
  };
}

export class MockVisionProvider implements VisionProvider {
  // TS allows implementing with fewer params than the interface declares —
  // dropping the unused photo param is cleaner than an underscore-prefix.
  async detectPeople(): Promise<PersonDetectionResult> {
    const count = process.env.MOCK_PEOPLE_COUNT === '2' ? 2 : 1;
    return {
      people: count === 2
        ? [{ boundingRegion: PERSON_ONE }, { boundingRegion: PERSON_TWO }]
        : [{ boundingRegion: PERSON_ONE }],
    };
  }

  async segmentGarments(
    _photo: ArrayBuffer,
    person: BoundingRegion,
  ): Promise<GarmentSegmentationResult> {
    return {
      garments: RELATIVE_GARMENTS.map((g) => ({
        category: g.category,
        confidence: g.confidence,
        boundingRegion: project(person, g.rel),
      })),
    };
  }
}
