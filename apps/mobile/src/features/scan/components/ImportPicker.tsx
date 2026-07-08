/**
 * ImportPicker (T016) — the photo-import entry point (FR-002a).
 *
 * `expo-image-picker` is called directly (Anti-Abstraction Mandate). Errors
 * are reported to the parent via `onError` rather than rendered here: the
 * parent owns the screen's single failure surface (ScanErrorFallback), and
 * two competing error overlays would fight for the same space.
 */

import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import type { CapturedPhoto } from './CameraView';

export interface ImportPickerProps {
  onPicked: (photo: CapturedPhoto) => void;
  /** FR-015: surfaced when access is denied or the picker fails. */
  onError: (message: string) => void;
  disabled?: boolean;
}

export function ImportPicker({ onPicked, onError, disabled = false }: ImportPickerProps) {
  const [opening, setOpening] = useState(false);

  const pickImage = useCallback(async () => {
    if (disabled || opening) return;
    setOpening(true);
    try {
      // The system picker (PHPicker / Android photo picker) doesn't require
      // broad library permission on modern OS versions, but restricted or
      // managed-device setups can still deny it — hence the catch below.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled) return; // User backing out is not an error state.
      const asset = result.assets[0];
      if (!asset) {
        onError('No photo was returned. Please try picking a photo again.');
        return;
      }
      onPicked({ uri: asset.uri, width: asset.width, height: asset.height });
    } catch {
      // FR-015: a clear, user-facing message — never a silent no-op button.
      onError(
        'Photos access was denied or unavailable. Allow photo access in Settings, or capture with the camera instead.',
      );
    } finally {
      setOpening(false);
    }
  }, [disabled, opening, onPicked, onError]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Import a photo"
      disabled={disabled || opening}
      onPress={pickImage}
      className="h-14 w-14 items-center justify-center rounded-full bg-white/20 active:bg-white/35">
      {opening ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        // Text glyph keeps this dependency-free across iOS/Android; the
        // approved design only requires a recognizable "gallery" affordance.
        <Text className="text-xl text-white">🖼</Text>
      )}
    </Pressable>
  );
}
