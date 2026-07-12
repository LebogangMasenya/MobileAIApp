/**
 * CameraView (T015) — live capture surface for the scan flow.
 *
 * Uses `expo-camera` directly (no wrapper SDK — Constitution: Anti-Abstraction
 * Mandate). All capture-flow *state* still belongs to the parent via
 * `onCapture`; this component only owns what is inseparable from the camera
 * hardware itself: permission handling, facing, and the shutter interaction.
 */

import {
  CameraView as ExpoCameraView,
  useCameraPermissions,
} from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ScanErrorFallback } from './ScanErrorFallback';

/** What the parent needs to submit + lay out overlays later. */
export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface CameraViewProps {
  onCapture: (photo: CapturedPhoto) => void;
  /** Disable the shutter while a scan is already in flight upstream. */
  disabled?: boolean;
  /**
   * Slot for the import entry point (FR-002a). The camera owns the bottom
   * action row's *layout* (thumb-zone ergonomics from the approved T006
   * plan: import left, shutter center, flip right), but not the import
   * behavior — that stays in ImportPicker so each stays atomic.
   */
  bottomLeftAccessory?: React.ReactNode;
}

/**
 * Shutter press-in: stiff and quick so the button feels mechanically direct
 * under the finger; release springs back with slight overshoot for tactility.
 */
const PRESS_SPRING = { mass: 0.6, damping: 12, stiffness: 320 };
/** Shutter → loader morph: softer, so the shape change reads as fluid. */
const MORPH_SPRING = { mass: 1, damping: 16, stiffness: 160 };

export function CameraView({ onCapture, disabled = false, bottomLeftAccessory }: CameraViewProps) {
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);

  const pressScale = useSharedValue(1);
  /** 0 = shutter circle, 1 = compact loader pill (interruptible morph). */
  const morph = useSharedValue(0);

  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * (1 - morph.value * 0.25) }],
    // Morphing radius/opacity via springs keeps the transition interruptible:
    // if capture resolves mid-morph the reverse spring picks up from the
    // current value with no jump (Constitution Principle V).
    opacity: 1 - morph.value * 0.15,
  }));

  const takePhoto = useCallback(async () => {
    // Guard against double-fire: a second tap during capture would submit
    // two scans and race their results.
    if (disabled || capturing || !cameraRef.current) return;
    setCapturing(true);
    // Reanimated shared values are mutable by design; event-handler writes are the documented API
    morph.value = withSpring(1, MORPH_SPRING);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      onCapture({ uri: photo.uri, width: photo.width, height: photo.height });
    } catch {
      // Hardware capture can fail (camera claimed by a call, low storage) —
      // degrade to the shared fallback, never a silent dead shutter.
      setCaptureError(true);
    } finally {
      setCapturing(false);
      morph.value = withSpring(0, MORPH_SPRING);
    }
  }, [disabled, capturing, morph, onCapture]);

  // Permission object is null for one frame while expo-camera reads it.
  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    // FR-015: denial is a first-class state with a clear message and a
    // recovery path, not a black screen. `canAskAgain === false` means the
    // OS will silently ignore another request — Settings is the only way.
    return (
      <View className="flex-1 bg-black">
        <ScanErrorFallback
          title="Camera access needed"
          message="Fashion Shazam uses the camera to capture outfits so their garments can be identified. You can also import an existing photo instead."
          primaryLabel={permission.canAskAgain ? 'Allow camera access' : 'Open Settings'}
          onPrimary={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}
        />
        {bottomLeftAccessory ? (
          <View className="absolute bottom-10 left-8">{bottomLeftAccessory}</View>
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <ExpoCameraView ref={cameraRef} facing={facing} style={{ flex: 1 }} />

      {/* Bottom action row lives entirely in the one-handed thumb zone. */}
      <View className="absolute bottom-10 left-0 right-0 flex-row items-center justify-between px-8">
        <View className="w-14 items-center">{bottomLeftAccessory}</View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
          disabled={disabled || capturing}
          onPressIn={() => {
            pressScale.value = withSpring(0.88, PRESS_SPRING);
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, PRESS_SPRING);
          }}
          onPress={takePhoto}>
          <Animated.View
            style={shutterStyle}
            className="h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white/90 bg-white/25">
            {capturing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View className="h-14 w-14 rounded-full bg-white" />
            )}
          </Animated.View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
          className="h-14 w-14 items-center justify-center rounded-full bg-white/20 active:bg-white/35">
          <Text className="text-xl text-white">⟲</Text>
        </Pressable>
      </View>

      {captureError ? (
        <ScanErrorFallback
          title="Couldn't take the photo"
          message="Something interrupted the camera. Please try capturing again."
          primaryLabel="Try again"
          onPrimary={() => setCaptureError(false)}
        />
      ) : null}
    </View>
  );
}
