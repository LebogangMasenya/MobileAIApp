/**
 * Visual search contract types (specs/003-visual-search-api, contracts §2).
 *
 * A near-identical copy lives in apps/api/src/types/visual-search.ts —
 * the two MUST stay in sync. Deliberately duplicated instead of extracted
 * into a shared package: at two consumers a package adds versioning/publish
 * overhead that outweighs a copy-paste diff check (Constitution:
 * Anti-Abstraction Mandate — same precedent as types/scan.ts).
 */

/**
 * One shoppable result. EXACTLY these six fields — the normalizer strips
 * everything else the provider sends (FR-004): the mobile client must never
 * grow a dependency on an un-contracted provider field.
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
