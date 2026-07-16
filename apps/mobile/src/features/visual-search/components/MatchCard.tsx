/**
 * MatchCard (specs/008 US2–US5, contracts/match-presentation.md §3–§5) —
 * one masonry cell on the match wall. Extends the ProductMatchCard idiom
 * (six contract fields, in-app browser link-out, "Price unavailable" keeps
 * layout stable) into the waterfall shape, plus three strictly-gated extras:
 *
 * - Savings pill (US3): rendered ONLY from deriveSavings output passed down
 *   by the wall — this component cannot invent a discount; it can only
 *   display one that pure math already verified. The word "comparable" in
 *   the copy is contractual (CL-002 — the anchor is a comparable match,
 *   never the original garment's MSRP).
 * - Harmony ring (US4): rendered ONLY when the wall computed a non-null
 *   score (personalized profile + readable taxonomy).
 * - Jackpot (US5): `match.exact === true` is the ONLY trigger (CL-003).
 *   Every exact card carries the static badge; the shimmer + celebrate()
 *   beat play once per RESULT SET — the wall's claim callback decides which
 *   single card wins them, so scroll-backs and sibling exacts can never
 *   turn the jackpot into a drum roll.
 *
 * The shimmer is 007's TactileTiltCard sheen promoted to a border moment:
 * a gradient band inside this card's own stacking context, translateX
 * driven by withRepeat(withSequence(withSpring…)) for a BOUNDED ~3 sweeps
 * (research R9 — a moment, not a strobe), settling into the badge.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HarmonyRing } from '@/features/visual-search/components/HarmonyRing';
import { thumbnailAspect } from '@/features/visual-search/utils/masonry-split';
import { celebrate } from '@/services/tactile';
import type { ProductMatch } from '@/types/visual-search';

/** One sweep — brisk enough to sparkle, springy enough to stay in-house. */
const SWEEP_SPRING = { mass: 0.9, damping: 20, stiffness: 60 };
/** Bounded jackpot: exactly this many sweeps, then the static badge owns it. */
const SWEEP_COUNT = 3;

export interface MatchCardProps {
  match: ProductMatch;
  /** Rendered column width — image height derives from the shared aspect. */
  columnWidth: number;
  /** Verified savings percent from deriveSavings, or null → no claim at all. */
  savingsPercent: number | null;
  /** Verified harmony score, or null → no ring, no coordination copy. */
  harmony: number | null;
  /**
   * Once-per-result-set claim: an exact card calls this on first exposure;
   * `true` means THIS card plays the shimmer + beat. Undefined for sets
   * with no jackpot wiring.
   */
  claimJackpot?: () => boolean;
}

function JackpotShimmer({ width }: { width: number }) {
  /** 0→1 = one full left-to-right sweep. */
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      // duration:0 reset is an instant repositioning, not motion — the
      // visible travel is pure spring (Constitution V).
      withSequence(withTiming(0, { duration: 0 }), withSpring(1, SWEEP_SPRING)),
      SWEEP_COUNT,
      false,
    );
  }, [sweep]);

  const style = useAnimatedStyle(() => ({
    // Fade at both ends so each sweep is born/dies invisible — the repeat
    // seam never blinks.
    opacity: interpolate(sweep.value, [0, 0.15, 0.85, 1], [0, 0.9, 0.9, 0], 'clamp'),
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-width, width]) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width }, style]}>
      <LinearGradient
        colors={['transparent', 'rgba(255, 255, 255, 0.75)', 'transparent']}
        start={{ x: 0, y: 0.25 }}
        end={{ x: 1, y: 0.75 }}
        locations={[0.3, 0.5, 0.7]}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

export function MatchCard({ match, columnWidth, savingsPercent, harmony, claimJackpot }: MatchCardProps) {
  const reducedMotion = useReducedMotion();
  /** Set once on first exposure; a re-render must never re-ask the claim. */
  const claimAsked = useRef(false);
  const [playShimmer, setPlayShimmer] = useState(false);

  useEffect(() => {
    if (!match.exact || claimAsked.current || !claimJackpot) return;
    claimAsked.current = true;
    if (claimJackpot()) {
      // The beat is one-shot INFORMATION ("a true find") and survives
      // reduce-motion; the shimmer is rhythm and does not (007 §2 rule).
      celebrate();
      if (!reducedMotion) setPlayShimmer(true);
    }
  }, [match.exact, claimJackpot, reducedMotion]);

  const imageHeight = Math.round(columnWidth * thumbnailAspect(match));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.title}, ${match.price ?? 'price unavailable'}, at ${match.store_name}${match.exact ? ', exact match' : ''}`}
      onPress={() => {
        // Fire-and-forget: a failed browser open is a no-op tap, not a crash.
        void WebBrowser.openBrowserAsync(match.source_url).catch(() => undefined);
      }}
      // overflow-hidden keeps the shimmer inside this card's own rounded
      // bounds — no global z, no neighbor bleed (the TactileTiltCard rule).
      className={`overflow-hidden rounded-2xl bg-surface-card active:opacity-80 ${match.exact ? 'border border-primary' : ''}`}>
      <Image
        source={{ uri: match.thumbnail }}
        style={{ width: '100%', height: imageHeight }}
        contentFit="cover"
        accessibilityLabel="Product photo"
      />

      <View className="gap-1 p-3">
        {match.exact ? (
          // The static badge is what EVERY exact card keeps after (or
          // instead of) the shimmer — information outlives decoration.
          <View className="self-start rounded-full bg-primary px-2.5 py-0.5">
            <Text className="text-xs font-semibold text-on-primary">Exact match</Text>
          </View>
        ) : null}

        <Text numberOfLines={2} className="text-sm font-semibold text-ink">
          {match.title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-ink-muted">
          {match.store_name}
        </Text>

        <View className="flex-row items-center justify-between">
          <Text className={`text-sm font-semibold ${match.price ? 'text-primary' : 'text-ink-muted'}`}>
            {match.price ?? 'Price unavailable'}
          </Text>
          {harmony !== null ? <HarmonyRing score={harmony} /> : null}
        </View>

        {savingsPercent !== null ? (
          // A quiet pill, not a siren (contract §3) — the claim is precise,
          // so the presentation can afford to be calm.
          <View className="self-start rounded-full bg-primary/10 px-2.5 py-1">
            <Text className="text-xs font-semibold text-primary">
              {savingsPercent}% less than comparable retail
            </Text>
          </View>
        ) : null}
      </View>

      {playShimmer ? <JackpotShimmer width={columnWidth} /> : null}
    </Pressable>
  );
}
