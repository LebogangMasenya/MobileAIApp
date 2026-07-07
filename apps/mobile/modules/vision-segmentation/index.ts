/**
 * Typed JS bridge for the on-device Apple Vision module (iOS only).
 *
 * Callers should treat this as an optimization layer, not a dependency:
 * every function can throw (Android, Expo Go, missing CoreML model), and the
 * correct reaction is always "fall back to the cloud path via the backend"
 * (research.md §3's hybrid dispatch). That fallback contract is why the
 * exports here never pretend to be universally available.
 */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { BoundingRegion } from '../../src/types/scan';

interface VisionSegmentationNativeModule {
  detectPeople(photoUri: string): Promise<BoundingRegion[]>;
  segmentGarments(
    photoUri: string,
    personRegion: BoundingRegion,
  ): Promise<Array<{ category: string; confidence: number; boundingRegion: BoundingRegion }>>;
}

/**
 * Lazy + guarded: `requireNativeModule` throws immediately if the native
 * side isn't linked (Expo Go, Android). Resolving it on first use instead of
 * at import time means merely importing this file never crashes a platform
 * that will only ever use the cloud path.
 */
let cached: VisionSegmentationNativeModule | null = null;

export function isOnDeviceVisionAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    cached ??= requireNativeModule<VisionSegmentationNativeModule>('VisionSegmentation');
    return true;
  } catch {
    return false;
  }
}

export async function detectPeopleOnDevice(photoUri: string): Promise<BoundingRegion[]> {
  if (!isOnDeviceVisionAvailable() || cached === null) {
    throw new Error('On-device vision is not available on this platform/build');
  }
  return cached.detectPeople(photoUri);
}

export async function segmentGarmentsOnDevice(
  photoUri: string,
  personRegion: BoundingRegion,
): Promise<Array<{ category: string; confidence: number; boundingRegion: BoundingRegion }>> {
  if (!isOnDeviceVisionAvailable() || cached === null) {
    throw new Error('On-device vision is not available on this platform/build');
  }
  return cached.segmentGarments(photoUri, personRegion);
}
