/**
 * Visual search route handler (specs/003 contracts §1; dual-mode since
 * specs/008 contracts/search-api.md §1).
 *
 * Same architecture as routes/scans.ts: a plain async function over
 * Web-standard Request/Response; the file under src/app/v1/** is a one-line
 * framework adapter. All failures leave through feature 001's error envelope
 * (`{ error: { code, message } }`) so the whole API speaks one dialect.
 *
 * Mode A (JSON `{ imageUrl?, country? }`) is feature 003's demo path,
 * preserved verbatim — empty body still means "use the server's demo image".
 * Mode B (multipart, field `photo`) is feature 008's upload path: the
 * device's isolated garment PNG is parked in the ephemeral uploadStore and
 * served back to the URL-only provider from THIS deployment's own public
 * origin (the 003 self-origin trick, now applied to user uploads).
 */

import { searchByImage } from '../services/visualSearch/serpApiProvider';
import { putUpload } from '../services/visualSearch/uploadStore';
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

/** Contract §1: multipart uploads above this are rejected before any work. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Mode B: multipart upload → ephemeral self-origin hosting → provider search.
 * Validation failures return null-with-response via exceptions kept local —
 * everything leaves through the same envelope the JSON path uses.
 */
async function handleMultipartSearch(request: Request): Promise<Response> {
  // A hostile/truncated multipart body makes formData() throw — that is bad
  // INPUT, not an internal fault, so it gets its own catch and a 400.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse('INVALID_INPUT', 'The upload could not be read. Please try again.', 400);
  }

  const photo = form.get('photo');
  if (!(photo instanceof File)) {
    return errorResponse('INVALID_INPUT', 'A `photo` file field is required.', 400);
  }
  if (photo.type !== 'image/png') {
    return errorResponse('INVALID_INPUT', 'The photo must be a PNG image.', 400);
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return errorResponse('INVALID_INPUT', 'The photo is too large (8MB max).', 400);
  }

  const countryValue = form.get('country');
  const country =
    typeof countryValue === 'string' && COUNTRY_PATTERN.test(countryValue) ? countryValue : undefined;

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const id = putUpload(bytes);
  // Self-origin URL (research R2): wherever this route is publicly served,
  // the images route beside it is publicly served too — reachable by the
  // provider with zero extra infrastructure.
  const imageUrl = `${new URL(request.url).origin}/v1/visual-search/images/${id}`;

  const result = await searchByImage({ imageUrl, country });
  switch (result.kind) {
    case 'ok':
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
}

/** POST /v1/visual-search */
export async function handleVisualSearch(request: Request): Promise<Response> {
  try {
    // Mode dispatch on content-type: multipart is unambiguous (a JSON body
    // can never carry that header), so Mode A's tolerant-parse behavior is
    // untouched for every existing caller.
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      return await handleMultipartSearch(request);
    }

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
