/**
 * SerpApi Google Lens provider (specs/003 research §1, contracts §3).
 *
 * One plain `fetch` — no SDK (Anti-Abstraction Mandate). Everything provider-
 * specific is confined to this module: the raw response shape below never
 * crosses into shared types, so a provider change is a one-file swap.
 *
 * Failure philosophy: this module NEVER throws. It returns a discriminated
 * result the route handler maps onto the HTTP envelope — an unparseable or
 * hostile provider payload is a `failed` result, not an exception path
 * (Constitution: Defensive Error Scaffolding).
 */

import type { ProductMatch } from '../../types/visual-search';

/**
 * Own the timeout (FR-008): 10s abort budget, well inside the route's
 * maxDuration=30, so a slow provider becomes a designed UPSTREAM_TIMEOUT
 * payload instead of an opaque platform kill.
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

/** FR-005: top results only — keeps mobile payloads lean and rendering fast. */
const MAX_MATCHES = 20;

export type VisualSearchProviderResult =
  | { kind: 'ok'; matches: ProductMatch[] }
  | { kind: 'failed' } // provider error / network / malformed payload → 502
  | { kind: 'timeout' }; // abort budget exceeded → 504

/**
 * The ONLY provider fields we read (verified against SerpApi's live docs,
 * 003 research §1 + 008 R3/R4 re-verified 2026-07-16: exactness is a
 * per-entry `exact_matches: true` boolean on visual_matches — there is NO
 * separate exact section; numeric price rides `price.extracted_value` +
 * `price.currency`). Parsed from `unknown` — the wire is never trusted to
 * match types.
 */
interface SerpApiVisualMatch {
  position?: unknown;
  title?: unknown;
  link?: unknown;
  thumbnail?: unknown;
  image?: unknown;
  source?: unknown;
  price?: { value?: unknown; extracted_value?: unknown; currency?: unknown };
  exact_matches?: unknown;
  thumbnail_width?: unknown;
  thumbnail_height?: unknown;
}

function isHttpUrl(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function nonEmptyString(candidate: unknown): candidate is string {
  return typeof candidate === 'string' && candidate.trim().length > 0;
}

/**
 * Normalization drop rules (FR-004): an entry without a real title or a real
 * product link is unrenderable and unshoppable — half-empty cards would make
 * the demo look broken, so such entries are dropped rather than padded.
 */
/** A finite positive number — the only shape safe for arithmetic/layout. */
function finitePositive(candidate: unknown): candidate is number {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0;
}

function toProductMatch(raw: SerpApiVisualMatch, index: number): ProductMatch | null {
  if (!nonEmptyString(raw.title) || !isHttpUrl(raw.link)) return null;

  // Prefer the lightweight thumbnail; fall back to the full image. Neither →
  // drop (a text-only card breaks the visual grid the design depends on).
  const thumbnail = isHttpUrl(raw.thumbnail) ? raw.thumbnail : isHttpUrl(raw.image) ? raw.image : null;
  if (thumbnail === null) return null;

  const match: ProductMatch = {
    // Provider `position` when present, list index otherwise — stable within
    // this response, which is all the contract promises.
    id: String(typeof raw.position === 'number' ? raw.position : index + 1),
    title: raw.title.trim(),
    source_url: raw.link,
    thumbnail,
    // Verbatim display string or null — never fabricated (FR-004).
    price: nonEmptyString(raw.price?.value) ? raw.price.value : null,
    store_name: nonEmptyString(raw.source) ? raw.source.trim() : new URL(raw.link).hostname,
  };

  // 008 additive fields — set only when well-typed, absent otherwise, so a
  // malformed provider value degrades to "no claim" rather than a bad claim
  // (FR-013). Numeric price needs BOTH value and currency: an amount without
  // its currency cannot be compared to anything (R4 currency partitioning).
  if (finitePositive(raw.price?.extracted_value) && nonEmptyString(raw.price?.currency)) {
    match.price_value = raw.price.extracted_value;
    match.currency = raw.price.currency;
  }
  // CL-003: the ONLY place `exact` may ever be set — the provider's own flag.
  if (raw.exact_matches === true) {
    match.exact = true;
  }
  if (finitePositive(raw.thumbnail_width) && finitePositive(raw.thumbnail_height)) {
    match.thumbnail_width = raw.thumbnail_width;
    match.thumbnail_height = raw.thumbnail_height;
  }

  return match;
}

function normalize(body: unknown): ProductMatch[] {
  if (typeof body !== 'object' || body === null) return [];
  const visualMatches = (body as { visual_matches?: unknown }).visual_matches;
  if (!Array.isArray(visualMatches)) return [];
  const matches: ProductMatch[] = [];
  for (const [index, raw] of visualMatches.entries()) {
    if (matches.length >= MAX_MATCHES) break;
    if (typeof raw !== 'object' || raw === null) continue;
    const match = toProductMatch(raw as SerpApiVisualMatch, index);
    if (match) matches.push(match);
  }
  return matches;
}

export interface VisualSearchParams {
  imageUrl: string;
  /** Optional two-letter country code passed through to the provider. */
  country?: string;
}

export async function searchByImage(params: VisualSearchParams): Promise<VisualSearchProviderResult> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    // Misconfiguration reads as an upstream failure to the client (there is
    // nothing the user can do differently); the operator sees the real cause.
    console.error('[visual-search] SERPAPI_API_KEY is not configured');
    return { kind: 'failed' };
  }

  const query = new URLSearchParams({
    engine: 'google_lens',
    // `type=all` (008 R3, verified live 2026-07-16): the all-sections search
    // is the one whose visual_matches entries carry the per-entry
    // `exact_matches: true` flag — the ONLY signal allowed to drive the US5
    // jackpot (CL-003). Still one provider call per search (quota rule).
    type: 'all',
    url: params.imageUrl,
    api_key: apiKey,
  });
  if (params.country) query.set('country', params.country.toLowerCase());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(`https://serpapi.com/search.json?${query.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      // Status only — never the body, which can echo request params
      // (including the key) back at us (FR-010 log hygiene).
      console.error(`[visual-search] provider responded ${response.status}`);
      return { kind: 'failed' };
    }

    const body: unknown = await response.json();
    return { kind: 'ok', matches: normalize(body) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[visual-search] provider exceeded ${UPSTREAM_TIMEOUT_MS}ms budget`);
      return { kind: 'timeout' };
    }
    console.error('[visual-search] provider fetch failed:', error instanceof Error ? error.message : 'unknown');
    return { kind: 'failed' };
  } finally {
    clearTimeout(timeout);
  }
}
