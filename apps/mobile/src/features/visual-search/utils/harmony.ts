/**
 * harmony (specs/008 US4, research R8) — pure 0–100 wardrobe-coordination
 * score over the 007 style profile.
 *
 * HONESTY RULES (FR-014): the score derives ONLY from the user's actual
 * stored garments (via deriveStyleProfile) and the match's own title tokens;
 * identical inputs always produce the identical score; and a profile that
 * isn't genuinely personalized — or a title that yields no taxonomy tokens —
 * produces NULL, meaning "render nothing", never a fabricated number.
 *
 * DELIBERATELY ABSENT: color. No color data exists upstream (007 R8 keeps
 * `colors` a reserved field), so this scores CATEGORY coordination only and
 * the UI copy must claim exactly that.
 */

import type { StyleProfile } from '@/features/vault/utils/style-profile';
import type { ProductMatch } from '@/types/visual-search';

/** Canonical garment families — the taxonomy both sides normalize into. */
type Family = 'tops' | 'bottoms' | 'outerwear' | 'footwear' | 'dresses' | 'accessories';

/**
 * Word → family lexicon. Small and explicit on purpose: an unknown word maps
 * to NOTHING (and contributes nothing) rather than being guessed — the same
 * "honest absence" rule the rest of the feature runs on.
 */
const TOKEN_FAMILY: Record<string, Family> = {
  // tops
  shirt: 'tops', tshirt: 'tops', tee: 'tops', top: 'tops', blouse: 'tops',
  sweater: 'tops', hoodie: 'tops', sweatshirt: 'tops', cardigan: 'tops',
  polo: 'tops', tank: 'tops', knit: 'tops', jumper: 'tops', pullover: 'tops',
  // bottoms
  pants: 'bottoms', trousers: 'bottoms', jeans: 'bottoms', shorts: 'bottoms',
  skirt: 'bottoms', leggings: 'bottoms', joggers: 'bottoms', chinos: 'bottoms',
  // outerwear
  jacket: 'outerwear', coat: 'outerwear', blazer: 'outerwear', parka: 'outerwear',
  vest: 'outerwear', windbreaker: 'outerwear', overcoat: 'outerwear', puffer: 'outerwear',
  // footwear
  shoes: 'footwear', shoe: 'footwear', sneakers: 'footwear', sneaker: 'footwear',
  boots: 'footwear', boot: 'footwear', heels: 'footwear', loafers: 'footwear',
  trainers: 'footwear', sandals: 'footwear',
  // dresses
  dress: 'dresses', gown: 'dresses', jumpsuit: 'dresses',
  // accessories
  bag: 'accessories', handbag: 'accessories', hat: 'accessories', cap: 'accessories',
  scarf: 'accessories', belt: 'accessories', sunglasses: 'accessories', watch: 'accessories',
};

/**
 * What coordinates with what — a small static complement table (R8).
 * Symmetry is intentional where it holds; dresses pair with layers and
 * shoes, not with other one-piece garments.
 */
const COMPLEMENTS: Record<Family, Family[]> = {
  tops: ['bottoms', 'outerwear'],
  bottoms: ['tops', 'outerwear', 'footwear'],
  outerwear: ['tops', 'bottoms', 'dresses'],
  footwear: ['bottoms', 'dresses'],
  dresses: ['outerwear', 'footwear', 'accessories'],
  accessories: ['dresses', 'tops'],
};

/** Same-family affinity vs cross-family complementarity weighting. */
const AFFINITY_WEIGHT = 0.55;
const COMPLEMENT_WEIGHT = 0.45;

function familiesOf(text: string): Family[] {
  const found = new Set<Family>();
  // Lowercased alpha tokens — "Slim-Fit Denim Jeans" → [slim, fit, denim, jeans].
  for (const token of text.toLowerCase().split(/[^a-z]+/)) {
    const family = TOKEN_FAMILY[token];
    if (family) found.add(family);
  }
  return [...found];
}

/**
 * Score one match against the profile. Null (render NOTHING) when the
 * profile isn't personalized or the title carries no recognizable garment
 * vocabulary — the app never scores coordination against a wardrobe or an
 * item it does not actually understand.
 */
export function harmonyScore(match: ProductMatch, profile: StyleProfile): number | null {
  if (!profile.personalized) return null;

  const matchFamilies = familiesOf(match.title);
  if (matchFamilies.length === 0) return null;

  // Profile categories are free strings ('jacket', 'pants'…) — normalize
  // them through the same lexicon so both sides speak Family. Weights are
  // already recency-normalized to [0,1] by deriveStyleProfile.
  const profileWeights = new Map<Family, number>();
  for (const { category, weight } of profile.categories) {
    for (const family of familiesOf(category)) {
      profileWeights.set(family, Math.max(profileWeights.get(family) ?? 0, weight));
    }
  }
  if (profileWeights.size === 0) return null; // vocabulary the lexicon can't read

  // Affinity: "you scan things like this" — strongest same-family weight.
  let affinity = 0;
  // Complementarity: "this pairs with what you scan" — strongest weight
  // among families whose complement list contains a match family.
  let complement = 0;
  for (const matchFamily of matchFamilies) {
    affinity = Math.max(affinity, profileWeights.get(matchFamily) ?? 0);
    for (const [profileFamily, weight] of profileWeights) {
      if (COMPLEMENTS[profileFamily].includes(matchFamily)) {
        complement = Math.max(complement, weight);
      }
    }
  }

  const score = Math.round(100 * (AFFINITY_WEIGHT * affinity + COMPLEMENT_WEIGHT * complement));
  return Math.min(100, Math.max(0, score));
}
