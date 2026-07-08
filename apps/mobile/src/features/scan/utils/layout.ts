/**
 * Shared geometry for the scan feature.
 *
 * The API returns normalized (0–1) bounding regions; the photo is rendered
 * contain-fit (letterboxed) inside whatever space the screen gives it. Every
 * overlay (person tap targets, segmentation outline, bubbles) must agree on
 * the exact same pixel mapping or they visibly drift apart — so the math
 * lives here once instead of being re-derived per component.
 */

import type { BoundingRegion, DetectedGarment } from '../../../types/scan';

export interface Size {
  width: number;
  height: number;
}

/** Absolute pixel rect within the photo container's coordinate space. */
export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a contain-fit ("letterboxed") image actually renders inside its
 * container. Overlays must offset by this frame, not the container itself,
 * or markers land on the black bars instead of the photo.
 */
export function containFrame(container: Size, image: Size): LayoutRect {
  if (container.width <= 0 || container.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  // Contain-fit scales by whichever axis is the tighter constraint.
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

/** Map a normalized region onto the rendered photo frame, in container pixels. */
export function regionToLayout(region: BoundingRegion, frame: LayoutRect): LayoutRect {
  return {
    x: frame.x + region.x * frame.width,
    y: frame.y + region.y * frame.height,
    width: region.width * frame.width,
    height: region.height * frame.height,
  };
}

export interface BubblePlacement {
  garment: DetectedGarment;
  /** Bubble center in container pixels. */
  center: { x: number; y: number };
}

/**
 * Compute one bubble center per garment, keeping every bubble individually
 * tappable (SC-002 "clearly visible, distinct"):
 *
 * 1. Anchor at the garment region's center.
 * 2. Clamp inside the photo frame so no bubble hangs half off the image.
 * 3. Nudge bubbles that land closer than one diameter apart down the
 *    vertical axis — adjacent garments (shirt under jacket) routinely share
 *    a horizontal center, so vertical separation is the natural direction.
 */
export function resolveBubblePlacements(
  garments: DetectedGarment[],
  frame: LayoutRect,
  diameter: number,
): BubblePlacement[] {
  const radius = diameter / 2;
  const clampX = (x: number) => Math.min(Math.max(x, frame.x + radius), frame.x + frame.width - radius);
  const clampY = (y: number) => Math.min(Math.max(y, frame.y + radius), frame.y + frame.height - radius);

  // Process top-to-bottom so collision nudges cascade downward predictably
  // instead of depending on API response order.
  const ordered = [...garments].sort(
    (a, b) => (a.boundingRegion.y + a.boundingRegion.height / 2) - (b.boundingRegion.y + b.boundingRegion.height / 2),
  );

  const placed: BubblePlacement[] = [];
  for (const garment of ordered) {
    const rect = regionToLayout(garment.boundingRegion, frame);
    let center = { x: clampX(rect.x + rect.width / 2), y: clampY(rect.y + rect.height / 2) };

    // Push down until we clear every already-placed bubble. Bounded by the
    // garment count, so no risk of an unbounded loop.
    for (let pass = 0; pass < ordered.length; pass += 1) {
      const collision = placed.find(
        (other) => Math.hypot(other.center.x - center.x, other.center.y - center.y) < diameter,
      );
      if (!collision) break;
      center = { x: center.x, y: clampY(collision.center.y + diameter) };
      // If clamping pinned us to the bottom edge, shift sideways as a last
      // resort so two bottom-edge garments don't stack exactly.
      if (center.y === collision.center.y) {
        center = { x: clampX(center.x + diameter), y: center.y };
      }
    }
    placed.push({ garment, center });
  }
  return placed;
}
