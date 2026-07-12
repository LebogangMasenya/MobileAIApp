/**
 * useCoordinateTransform (specs/004 T001) — hook ergonomics over the scan
 * geometry, shared by every scanning surface.
 *
 * This hook deliberately owns NO math. `containFrame` and `regionToLayout`
 * in `features/scan/utils/layout.ts` are the single source of coordinate
 * truth (Constitution IV) — every overlay that ever drew on a photo agrees
 * with them, and a second implementation is exactly how markers drift off
 * their garments. What the hook adds is the *ceremony* screens kept
 * hand-wiring: container measurement, the measured→frame derivation, and a
 * null-safe mapping function.
 */

import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { containFrame, regionToLayout, type LayoutRect, type Size } from '@/features/scan/utils/layout';
import type { BoundingRegion } from '@/types/scan';

export interface CoordinateTransform {
  /** Attach to the photo container's `onLayout`. */
  onContainerLayout: (event: LayoutChangeEvent) => void;
  /** Measured container size; null until the first layout pass. */
  containerSize: Size | null;
  /**
   * Where the contain-fit photo actually renders, in container pixels.
   * Null until BOTH the container is measured and the image size is valid —
   * callers render no overlays in that window instead of overlays at 0,0.
   */
  frame: LayoutRect | null;
  /** Normalized region → container pixels; null exactly when `frame` is null. */
  toLayout: (region: BoundingRegion) => LayoutRect | null;
}

export function useCoordinateTransform(imageSize: Size): CoordinateTransform {
  const [containerSize, setContainerSize] = useState<Size | null>(null);

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  // Depend on the dimensions, not the object: callers routinely pass inline
  // `{ width, height }` literals whose identity changes every render.
  const { width: imageWidth, height: imageHeight } = imageSize;
  const frame = useMemo<LayoutRect | null>(() => {
    if (!containerSize || imageWidth <= 0 || imageHeight <= 0) return null;
    return containFrame(containerSize, { width: imageWidth, height: imageHeight });
  }, [containerSize, imageWidth, imageHeight]);

  const toLayout = useCallback(
    (region: BoundingRegion): LayoutRect | null => (frame ? regionToLayout(region, frame) : null),
    [frame],
  );

  return { onContainerLayout, containerSize, frame, toLayout };
}
