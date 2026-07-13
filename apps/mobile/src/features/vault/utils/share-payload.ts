/**
 * share-payload (specs/006 contract §3, FR-015) — the PURE composer.
 * entry (+ optional garment, + optional pre-cropped image) in → payload out.
 * Total function: never throws, no raw/debug fields ever (FR-013). This is
 * the reuse contract future social features build on — keep it free of any
 * UI or platform concern.
 */

import type { ProductMatch } from '@/types/visual-search';
import type { VaultEntry, VaultGarment } from '@/types/vault';

export interface VaultSharePayload {
  message: string;
  /** Garment crop when provided, else the look photo (file:// or https). */
  imageUri: string;
}

const MAX_LINES = 6;
const MAX_TITLE = 60;

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'recently'
    : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function matchLine(match: ProductMatch): string {
  const title = match.title.length > MAX_TITLE ? `${match.title.slice(0, MAX_TITLE - 1)}…` : match.title;
  // Null price ⇒ the whole price segment is omitted — never "null" (SC-003).
  const priceSegment = match.price ? `${match.price} · ` : '';
  return `• ${title} — ${priceSegment}${match.store_name}\n  ${match.source_url}`;
}

export function composeSharePayload(
  entry: VaultEntry,
  garment?: VaultGarment,
  imageUri?: string,
): VaultSharePayload {
  const subject = garment ? `My ${garment.category.toLowerCase()}` : 'My look';
  const header = `${subject} — spotted ${formatDay(entry.capturedAt)} with Satori`;

  const matches = garment ? garment.matches : entry.matches;
  const lines = matches.slice(0, MAX_LINES).map(matchLine);
  const overflow = matches.length > MAX_LINES ? [`+${matches.length - MAX_LINES} more finds`] : [];

  const body =
    matches.length === 0
      ? ['Scanned with Satori — the world is your wardrobe.'] // caption-only (FR-014)
      : [...lines, ...overflow];

  return {
    message: [header, '', ...body].join('\n'),
    imageUri: imageUri ?? entry.imageUri,
  };
}
