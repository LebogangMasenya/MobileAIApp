/**
 * Visual search contract types (specs/003-visual-search-api contracts §2;
 * extended by specs/008-smart-visual-search contracts/search-api.md §4).
 *
 * A near-identical copy lives in apps/api/src/types/visual-search.ts —
 * the two MUST stay in sync. Deliberately duplicated instead of extracted
 * into a shared package: at two consumers a package adds versioning/publish
 * overhead that outweighs a copy-paste diff check (Constitution:
 * Anti-Abstraction Mandate — same precedent as types/scan.ts).
 */

/**
 * One shoppable result. The six required fields are feature 003's contract;
 * the optional fields below are feature 008's additive extension — each is
 * present ONLY when the provider supplied a well-typed value, so absence of
 * data stays absence of claim (008 FR-013). The normalizer still strips
 * everything else the provider sends (003 FR-004): the mobile client must
 * never grow a dependency on an un-contracted provider field.
 */
export interface ProductMatch {
  /** Provider rank position as a string — stable within one response only. */
  id: string;
  title: string;
  /** Product page link (http/https). */
  source_url: string;
  /** Product image URL. */
  thumbnail: string;
  /**
   * Provider's display string verbatim (e.g. "$79.99*"), or null when the
   * provider reports no price — never fabricated, never an empty string.
   */
  price: string | null;
  store_name: string;
  /**
   * Numeric price for savings arithmetic (008 US3) — never displayed raw;
   * the verbatim `price` string above remains the only displayed price.
   */
  price_value?: number;
  /** Currency marker accompanying price_value (provider-native, e.g. "$"). */
  currency?: string;
  /**
   * True ONLY when the provider explicitly flags this result as the same
   * product (008 CL-003) — never set from a local similarity heuristic.
   */
  exact?: boolean;
  /** Thumbnail pixel dims when provided — feeds the masonry split (008 US2). */
  thumbnail_width?: number;
  thumbnail_height?: number;
}

/**
 * One completed lift search (008 data-model §3). `resultSetId` is derived
 * LOCALLY on the device per response — the wire envelope stays exactly
 * feature 003's `{ matches }`. It exists so once-per-result-set moments
 * (the US5 jackpot beat) have a structural key instead of a heuristic.
 */
export interface LiftSearchResult {
  matches: ProductMatch[];
  /** Stable per response — the jackpot once-per-result-set key. */
  resultSetId: string;
}

/** Success envelope. An EMPTY `matches` array is a legitimate 200 (FR-006). */
export interface VisualSearchResponse {
  matches: ProductMatch[];
}

/**
 * Failure codes carried in feature 001's ErrorResponse envelope
 * (`{ error: { code, message } }`) — one dialect across the whole API.
 */
export type VisualSearchErrorCode =
  | 'INVALID_INPUT' // 400 — malformed imageUrl; nothing sent upstream
  | 'UPSTREAM_FAILED' // 502 — provider error/unreachable/malformed payload
  | 'UPSTREAM_TIMEOUT' // 504 — provider exceeded the abort budget
  | 'INTERNAL_ERROR'; // 500 — unexpected fault (outermost catch)
