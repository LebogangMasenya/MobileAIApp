/**
 * MatchWall (specs/008 US2, contracts/match-presentation.md §2) — the
 * two-column cascading waterfall.
 *
 * ZERO LAYOUT SHIFT BY CONSTRUCTION (SC-003): the column split is computed
 * from estimated heights BEFORE anything renders (pure masonry-split), so a
 * card entering never moves a neighbor — entrance animations are transforms
 * over already-final layout, and there is no measure-then-reflow pass at all
 * (research R7's argument against a masonry list library).
 *
 * THE 640ms LAW (FR-010): per-card delay = min(index × 80, 480). The step
 * gives the waterfall its rhythm; the cap guarantees the LAST card starts
 * within 480ms and its spring settles inside the 640ms cumulative budget —
 * for a 6-card set and a 20-card set alike. Index is RESULT order (not
 * column order) so the cascade pours down both columns together.
 *
 * Reduce-motion: plain fades, no stagger, identical information (SC-006).
 * Cards animate on first appearance only — two plain column Views inside
 * the parent scroll never recycle, so `entering` can only ever fire once.
 */

import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { MatchCard } from '@/features/visual-search/components/MatchCard';
import { harmonyScore } from '@/features/visual-search/utils/harmony';
import { splitIntoColumns, type MasonryItem } from '@/features/visual-search/utils/masonry-split';
import { deriveSavings } from '@/features/visual-search/utils/price-anchor';
import type { StyleProfile } from '@/features/vault/utils/style-profile';
import type { ProductMatch } from '@/types/visual-search';

/** Gap between and around columns. */
const GUTTER = 12;
/** Cascade rhythm per card... */
const STAGGER_STEP_MS = 80;
/** ...capped so cumulative stagger + spring settle stays inside 640ms. */
const STAGGER_CAP_MS = 480;

/** House entrance spring (the FadeInDown family every surface uses). */
const ENTER = { mass: 0.8, damping: 18, stiffness: 160 };

export interface MatchWallProps {
  matches: ProductMatch[];
  /**
   * 007 style profile, or null to disable harmony entirely (e.g. while the
   * vault is still loading — no ring is better than a ring that flickers).
   */
  profile: StyleProfile | null;
  /** useLiftSearch's once-per-result-set jackpot claim (US5). */
  claimJackpot: () => boolean;
}

export function MatchWall({ matches, profile, claimJackpot }: MatchWallProps) {
  const reducedMotion = useReducedMotion();
  const [wallWidth, setWallWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWallWidth(event.nativeEvent.layout.width);
  };

  const columnWidth = wallWidth > 0 ? (wallWidth - GUTTER) / 2 : 0;

  const columns = useMemo(
    () => (columnWidth > 0 ? splitIntoColumns(matches, columnWidth) : { left: [], right: [] }),
    [matches, columnWidth],
  );

  // Savings labels for the WHOLE set at once (the anchor is a set-level
  // fact — deriving per-card would recompute the same partition N times).
  const savingsById = useMemo(() => {
    const map = new Map<string, number>();
    for (const label of deriveSavings(matches)) map.set(label.matchId, label.percent);
    return map;
  }, [matches]);

  const renderItem = (item: MasonryItem) => (
    <Animated.View
      key={item.match.id}
      entering={
        reducedMotion
          ? FadeIn.duration(220) // calm equivalent: fade, no stagger, no travel
          : FadeInDown.delay(Math.min(item.index * STAGGER_STEP_MS, STAGGER_CAP_MS))
              .springify()
              .mass(ENTER.mass)
              .damping(ENTER.damping)
              .stiffness(ENTER.stiffness)
      }>
      <MatchCard
        match={item.match}
        columnWidth={columnWidth}
        savingsPercent={savingsById.get(item.match.id) ?? null}
        harmony={profile ? harmonyScore(item.match, profile) : null}
        claimJackpot={claimJackpot}
      />
    </Animated.View>
  );

  return (
    <View onLayout={onLayout} className="flex-row" style={{ gap: GUTTER }}>
      {columnWidth > 0 ? (
        <>
          <View className="flex-1" style={{ gap: GUTTER }}>
            {columns.left.map(renderItem)}
          </View>
          <View className="flex-1" style={{ gap: GUTTER }}>
            {columns.right.map(renderItem)}
          </View>
        </>
      ) : null}
    </View>
  );
}
