/**
 * Visual search route handler (specs/003 contracts §1).
 *
 * Same architecture as routes/scans.ts: a plain async function over
 * Web-standard Request/Response; the file under src/app/v1/** is a one-line
 * framework adapter. All failures leave through feature 001's error envelope
 * (`{ error: { code, message } }`) so the whole API speaks one dialect.
 */

import { searchByImage } from '../services/visualSearch/serpApiProvider';
import type { VisualSearchErrorCode, VisualSearchResponse } from '../types/visual-search';

function json<T>(body: T, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(code: VisualSearchErrorCode, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

function isHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Two ASCII letters — same cheap validation as 001's region check. */
const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;

/**
 * Resolve which image to search, in precedence order:
 *   1. explicit `imageUrl` in the request body,
 *   2. `DEMO_IMAGE_URL` env (local dev — SerpApi can't fetch localhost),
 *   3. this deployment's own static asset, derived from the REQUEST origin.
 * The self-origin default is the trick that makes a deployed instance
 * zero-config: wherever this route is publicly served, its /public assets are
 * publicly served too, so the URL is provider-reachable by construction
 * (research §2).
 */
function resolveImageUrl(explicit: string | undefined, request: Request): string {
  if (explicit) return explicit;
  const fromEnv = process.env.DEMO_IMAGE_URL;
  if (fromEnv && isHttpUrl(fromEnv)) return fromEnv;
  return `${new URL(request.url).origin}/demo/demo-garment.jpeg`;
}

/** POST /v1/visual-search */
export async function handleVisualSearch(request: Request): Promise<Response> {
  try {
    // Tolerant body parse: an empty or absent body is a valid "use the demo
    // image" request (contracts §1); only a PRESENT-but-broken body is noise
    // we still accept as empty rather than punish (the fields are optional).
    let body: { imageUrl?: unknown; country?: unknown } = {};
    try {
      const parsed: unknown = await request.json();
      if (typeof parsed === 'object' && parsed !== null) {
        body = parsed as { imageUrl?: unknown; country?: unknown };
      }
    } catch {
      body = {};
    }

    // FR-002: reject bad explicit input BEFORE spending upstream quota.
    if (body.imageUrl !== undefined && (typeof body.imageUrl !== 'string' || !isHttpUrl(body.imageUrl))) {
      return errorResponse('INVALID_INPUT', 'imageUrl must be a valid http(s) URL.', 400);
    }
    const country =
      typeof body.country === 'string' && COUNTRY_PATTERN.test(body.country) ? body.country : undefined;

    const imageUrl = resolveImageUrl(body.imageUrl as string | undefined, request);

    const result = await searchByImage({ imageUrl, country });
    switch (result.kind) {
      case 'ok':
        // Empty matches is a legitimate 200 — "nothing shoppable" is a
        // result, not an error (FR-006, US2).
        return json<VisualSearchResponse>({ matches: result.matches }, 200);
      case 'timeout':
        return errorResponse('UPSTREAM_TIMEOUT', 'The search took too long. Please try again.', 504);
      case 'failed':
        return errorResponse(
          'UPSTREAM_FAILED',
          'The search service is temporarily unavailable. Please try again.',
          502,
        );
    }
  } catch (error) {
    // Outermost catch (FR-009): whatever went wrong, the client still gets
    // the typed envelope — never a stack trace or platform error page.
    console.error('[visual-search] unexpected error:', error instanceof Error ? error.message : 'unknown');
    return errorResponse('INTERNAL_ERROR', 'Something went wrong on our side. Please try again.', 500);
  }
}
