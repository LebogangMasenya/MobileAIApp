/**
 * masonry-split (specs/008 US2, research R7) — pure greedy shortest-column
 * assignment for the two-column match wall.
 *
 * WHY A 20-LINE FUNCTION AND NOT A LIST LIBRARY (Constitution IV): a masonry
 * package is a new native dependency for exactly one screen, and its
 * measure-then-reflow lifecycle is precisely what FR-010 forbids. Computing
 * the split BEFORE render from estimated heights means the layout is fixed
 * the moment cards exist — zero layout shift by construction (SC-003), and
 * the split is independently testable with no React in sight
 * (Constitution VIII).
 */

import type { ProductMatch } from '@/types/visual-search';

export interface MasonryItem {
  match: ProductMatch;
  /** Position in the ORIGINAL result order — drives the cascade delay. */
  index: number;
  /** Estimated rendered card height at the given column width. */
  estimatedHeight: number;
}

export interface MasonryColumns {
  left: MasonryItem[];
  right: MasonryItem[];
}

/**
 * Fallback thumbnail aspect (height / width) when the provider sends no
 * dims: 1.2 — portrait-ish, the shape most product shots take.
 */
const DEFAULT_ASPECT = 1.2;
/** Height of the text block under the image (title 2 lines + store + price). */
const INFO_BLOCK_HEIGHT = 96;

/**
 * Exported so MatchCard sizes its image with the SAME aspect the split
 * estimated with — two implementations of this ratio is exactly how
 * estimated and rendered heights would drift apart (layout-shift risk).
 */
export function thumbnailAspect(match: ProductMatch): number {
  // Provider dims only when BOTH are present and positive — a partial pair
  // would fabricate a shape (same honesty rule as every optional field).
  if (
    typeof match.thumbnail_width === 'number' &&
    typeof match.thumbnail_height === 'number' &&
    match.thumbnail_width > 0 &&
    match.thumbnail_height > 0
  ) {
    return match.thumbnail_height / match.thumbnail_width;
  }
  return DEFAULT_ASPECT;
}

/**
 * Greedy shortest-column: each card, in result order, joins whichever column
 * is currently shorter. Greedy is optimal enough for ≤20 items and — unlike
 * balancing after the fact — preserves result order top-to-bottom, which is
 * what makes the provider's ranking still readable on the wall.
 */
export function splitIntoColumns(matches: ProductMatch[], columnWidth: number): MasonryColumns {
  const left: MasonryItem[] = [];
  const right: MasonryItem[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  matches.forEach((match, index) => {
    const estimatedHeight = columnWidth * thumbnailAspect(match) + INFO_BLOCK_HEIGHT;
    const item: MasonryItem = { match, index, estimatedHeight };
    if (leftHeight <= rightHeight) {
      left.push(item);
      leftHeight += estimatedHeight;
    } else {
      right.push(item);
      rightHeight += estimatedHeight;
    }
  });

  return { left, right };
}
