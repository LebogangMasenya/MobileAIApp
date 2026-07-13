/**
 * garment-crop (specs/006 contract §2) — the ONLY expo-image-manipulator
 * consumer (one owner file per impure edge, house pattern).
 *
 * Verified against the installed expo-image-manipulator ~14.0.8 types (T002):
 * context API — `ImageManipulator.manipulate(uri)` → chainable context →
 * `.crop({ originX, originY, width, height })` (pixel rect) →
 * `renderAsync(): Promise<ImageRef>` → `ref.saveAsync(options): Promise<ImageResult>`
 * with `result.uri` as the saved file.
 *
 * FALLBACK CONTRACT (FR-010): returns null on ANY failure or precondition
 * miss (no imageSize, non-file image, degenerate region) — callers share the
 * whole look photo instead. Sharing never dead-ends on a cropping problem.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { VaultEntry, VaultGarment } from '@/types/vault';

/** Breathing room around the garment region — recognizable, not sliver-tight (FR-009). */
const PADDING_FRACTION = 0.12;

export async function cropGarment(entry: VaultEntry, garment: VaultGarment): Promise<string | null> {
  // Preconditions: pixel math needs the photo's dimensions, and the
  // manipulator needs a local file (demo/migrated entries short-circuit).
  if (!entry.imageSize || !entry.imageUri.startsWith('file:')) return null;

  try {
    const { width: imageWidth, height: imageHeight } = entry.imageSize;
    const region = garment.boundingRegion;

    // Normalized region → pixels, padded per side, clamped to image bounds.
    // Aspect is whatever the padded region is — crop only, never resize, so
    // nothing distorts (SC-003).
    const padX = region.width * PADDING_FRACTION;
    const padY = region.height * PADDING_FRACTION;
    const left = Math.max(0, (region.x - padX) * imageWidth);
    const top = Math.max(0, (region.y - padY) * imageHeight);
    const right = Math.min(imageWidth, (region.x + region.width + padX) * imageWidth);
    const bottom = Math.min(imageHeight, (region.y + region.height + padY) * imageHeight);

    const cropRect = {
      originX: Math.round(left),
      originY: Math.round(top),
      width: Math.round(right - left),
      height: Math.round(bottom - top),
    };
    if (cropRect.width <= 0 || cropRect.height <= 0) return null;

    const rendered = await ImageManipulator.manipulate(entry.imageUri).crop(cropRect).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    return saved.uri;
  } catch {
    return null;
  }
}
