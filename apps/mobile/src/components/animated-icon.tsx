import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 600;
const SHIMMER_TRACK_WIDTH = 168;
const SHIMMER_BAR_WIDTH = 56;

/**
 * The Satori splash airlock (specs/002 FR-001/FR-002, contracts §5 row 1).
 *
 * Holds a branded full-screen overlay while `ready` is false (session
 * restoration in flight), then spring-morphs away to reveal whichever route
 * group the gate mounted. Three deliberate properties:
 *
 * - INDETERMINATE shimmer, not a progress bar: restoration has no meaningful
 *   progress fraction, and faking one is the exact pattern critique D8 killed.
 * - INTERRUPTIBLE dismissal: the exit is a `withSpring` on shared values, so
 *   if the app backgrounds mid-morph the spring simply keeps settling from
 *   its current position — springs retarget, Keyframes don't. That's why the
 *   old Keyframe exit was replaced.
 * - NEVER blocks input after `ready`: pointerEvents flips to "none" the same
 *   frame the dismissal starts, so a slow settle can't eat the user's taps.
 */
export function AnimatedSplashOverlay({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);
  // 0 = holding (opaque), 1 = fully dismissed. Owned by a spring, never a clock.
  const dismissal = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // Loop the highlight across the track forever; unmount cleans it up.
    // withTiming's default inOut easing gives the shimmer a breathing feel —
    // Easing.linear is banned outright (Constitution V).
    shimmer.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [shimmer]);

  useEffect(() => {
    if (!ready) return;
    dismissal.value = withSpring(1, { mass: 0.8, damping: 18, stiffness: 160 }, (finished) => {
      'worklet';
      // Only unmount once the spring truly settled — an interrupted spring
      // reports finished=false and keeps the overlay until it re-settles.
      if (finished) scheduleOnRN(setVisible, false);
    });
  }, [ready, dismissal]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - dismissal.value,
    // Slight zoom-through as it clears — the "door opening" half of the morph.
    transform: [{ scale: 1 + dismissal.value * 0.08 }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissal.value * -24 }, { scale: 1 - dismissal.value * 0.06 }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmer.value,
          [0, 1],
          [-SHIMMER_BAR_WIDTH, SHIMMER_TRACK_WIDTH],
        ),
      },
    ],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[styles.splashOverlay, overlayStyle]}
      onLayout={() => {
        // First overlay frame is up → safe to drop the native splash beneath it.
        SplashScreen.hideAsync();
      }}>
      <Animated.View style={[styles.wordmarkBlock, wordmarkStyle]}>
        <Text style={styles.wordmark}>Satori</Text>
        <Text style={styles.tagline}>SCAN · STYLE · SHOP</Text>
      </Animated.View>

      <View style={styles.shimmerTrack}>
        <Animated.View style={[styles.shimmerBar, shimmerStyle]} />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// AnimatedIcon — feature-001 hero icon, unchanged behavior (still used by the
// interim Home content until the 002 dashboard replaces it).
// ---------------------------------------------------------------------------

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: 8 }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

// StyleSheet here (not NativeWind): the overlay mixes animated styles with
// statics on the same nodes, and the splash must not depend on the Tailwind
// pipeline being alive during the very first frames of the app.
const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    // absoluteFillObject (not absoluteFill): the latter is an opaque registered
    // style whose spread is a type error under strict TS.
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#191524', // tailwind `header` token — keep in sync
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  wordmarkBlock: {
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: 'ui-serif',
    fontSize: 56,
    fontWeight: '600',
    color: '#F6F2FB', // `on-header`
  },
  tagline: {
    fontSize: 13,
    letterSpacing: 4,
    color: '#B9AFD1', // `on-header-muted`
  },
  shimmerTrack: {
    position: 'absolute',
    bottom: 96,
    width: SHIMMER_TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(246, 242, 251, 0.14)',
  },
  shimmerBar: {
    width: SHIMMER_BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(246, 242, 251, 0.85)',
  },
});
