/**
 * Scan-to-match route handlers (contracts/scan-api.md).
 *
 * These are plain async functions over Web-standard Request/Response rather
 * than Next.js-specific exports — the framework adapter files under
 * `src/app/v1/**` are one-line delegates. That split exists because plan.md
 * calls the serverless-platform choice reversible: if the API moves from
 * Vercel to Express later, only the thin adapters change, not the logic.
 */

import type {
  CreateScanResponse,
  DetectedGarment,
  ErrorResponse,
  GarmentMatchesResponse,
  PersonGarmentsResponse,
  ScanSession,
  ScanSource,
} from '../types/scan';
import { findMatches, ScanPhotoExpiredError } from '../services/matching/matchService';
import { sessionStore } from '../services/storage/sessionStore';
import {
  detectPeople,
  segmentGarments,
  UpstreamUnavailableError,
} from '../services/vision/dispatch';

/** SC-003: bubble tap → results in ≤2s. Instrumented in handleGetMatches (T041). */
const MATCHES_LATENCY_BUDGET_MS = 2000;

function json<T>(body: T, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(code: ErrorResponse['error']['code'], message: string, status: number): Response {
  return json<ErrorResponse>({ error: { code, message } }, status);
}

/**
 * One funnel for unexpected failures so every handler degrades identically:
 * upstream trouble → retryable 503; anything else → generic 500 with a
 * user-safe message (Constitution: Defensive Error Scaffolding — internals
 * never leak to the client, and the client always gets a typed shape).
 */
function mapUnexpected(error: unknown): Response {
  if (error instanceof UpstreamUnavailableError) {
    return errorResponse(
      'UPSTREAM_UNAVAILABLE',
      'The identification service is temporarily unavailable. Please try again.',
      503,
    );
  }
  console.error('[scans] unexpected error:', error);
  return errorResponse('INTERNAL_ERROR', 'Something went wrong on our side. Please try again.', 500);
}

const SUPPORTED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp']);

/** ISO 3166-1 alpha-2 — two ASCII letters. Cheap validation, catches most garbage. */
const REGION_PATTERN = /^[A-Za-z]{2}$/;

/**
 * POST /v1/scans (T023).
 *
 * Detects people; a single-person photo auto-segments immediately (one round
 * trip for the common case), while a multi-person photo returns people only
 * and waits for an explicit selection (FR-016 — segmenting everyone at once
 * is exactly what the spec rules out). "Nothing found" is a business-level
 * 200 with status "failed", NOT an HTTP error: the transport worked, the
 * photo just had nothing in it (FR-012).
 */
export async function handleCreateScan(request: Request): Promise<Response> {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorResponse('INVALID_PHOTO', 'The upload could not be read. Please try again with a photo.', 400);
    }

    const photo = form.get('photo');
    const source = form.get('source');
    const region = form.get('region');

    if (!(photo instanceof Blob)) {
      return errorResponse('INVALID_PHOTO', 'No photo was included in the scan.', 400);
    }
    if (photo.type && !SUPPORTED_PHOTO_TYPES.has(photo.type)) {
      return errorResponse('UNSUPPORTED_FORMAT', 'That image format is not supported. Please use a JPEG or PNG photo.', 400);
    }
    if (source !== 'camera' && source !== 'import') {
      return errorResponse('INVALID_PHOTO', 'The scan source was missing or invalid.', 400);
    }
    if (typeof region !== 'string' || !REGION_PATTERN.test(region)) {
      return errorResponse('INVALID_PHOTO', 'A valid region is required for the scan.', 400);
    }

    const photoBytes = await photo.arrayBuffer();
    const people = await detectPeople(photoBytes);

    const session: ScanSession = {
      id: crypto.randomUUID(),
      source: source as ScanSource,
      createdAt: new Date().toISOString(),
      status: 'processing',
      regionUsed: region.toUpperCase(),
      people: [],
      garments: [],
      failureReason: null,
    };

    if (people.length === 0) {
      // FR-012: friendly business failure, not an exception path.
      session.status = 'failed';
      session.failureReason =
        'We could not find a person in this photo. Try again with the person clearly in frame.';
      await sessionStore.put(session);
      return json<CreateScanResponse>({ scanSession: session }, 200);
    }

    session.people = people;
    // Retain bytes so selecting a person later doesn't require re-upload.
    cacheScanPhoto(session.id, photoBytes);

    if (people.length === 1) {
      // Single person: segment now so the common case is one round trip
      // (SC-001's 5s budget has no room for a second client-server hop).
      const person = people[0];
      try {
        session.garments = await segmentGarments(photoBytes, person);
        person.segmentationStatus = 'segmented';
        session.status = 'segmented';
      } catch (error) {
        if (error instanceof UpstreamUnavailableError) throw error;
        // FR-018-adjacent: person found but unprocessable → business failure.
        session.status = 'failed';
        session.failureReason =
          'We found a person but could not process the photo. Please try another photo.';
        await sessionStore.put(session);
        return json<CreateScanResponse>({ scanSession: session }, 200);
      }
    } else {
      // Multi-person: return people for tap-to-select; garments stay empty
      // by data-model.md's rule until the user picks someone.
      session.status = 'segmented';
    }

    await sessionStore.put(session);
    return json<CreateScanResponse>({ scanSession: session }, 201);
  } catch (error) {
    return mapUnexpected(error);
  }
}

/**
 * POST /v1/scans/{scanId}/people/{personId}/garments (T024).
 *
 * Per-person segmentation, driven only by explicit user selection
 * (FR-016/FR-017). A per-person failure is reported inside a 200 body —
 * "this person didn't work" is information the user acts on in-place,
 * not a transport error (FR-018).
 *
 * NOTE: the photo isn't re-uploaded on person selection; handleCreateScan
 * retains the bytes in this isolate-local cache. Same honest limitation as
 * sessionStore: correct for local dev (single process), needs a blob-store
 * swap (e.g. Vercel Blob keyed by scanId) before production. When the bytes
 * are gone (isolate recycled), the handler says "rescan" rather than
 * returning a mysteriously empty result.
 */
const photoCache = new Map<string, ArrayBuffer>();

/** Photos are large; keep only the most recent handful in memory. */
const PHOTO_CACHE_MAX = 20;

function cacheScanPhoto(scanId: string, bytes: ArrayBuffer): void {
  // Map iteration order is insertion order, so the first key is the oldest —
  // a free FIFO eviction without tracking timestamps.
  while (photoCache.size >= PHOTO_CACHE_MAX) {
    const oldest = photoCache.keys().next().value;
    if (oldest === undefined) break;
    photoCache.delete(oldest);
  }
  photoCache.set(scanId, bytes);
}

export async function handleSegmentPerson(
  scanId: string,
  personId: string,
): Promise<Response> {
  try {
    const session = await sessionStore.get(scanId);
    const person = session?.people.find((candidate) => candidate.id === personId);
    if (!session || !person) {
      return errorResponse('PERSON_NOT_FOUND', 'That scan or person could not be found. Please rescan the photo.', 404);
    }

    const photoBytes = photoCache.get(scanId);
    if (!photoBytes) {
      // Session outlived its photo bytes (isolate recycled) — the honest
      // answer is "rescan", not a mysterious empty result.
      return errorResponse('PERSON_NOT_FOUND', 'This scan has expired. Please rescan the photo.', 404);
    }

    let garments: DetectedGarment[];
    try {
      garments = await segmentGarments(photoBytes, person);
    } catch (error) {
      if (error instanceof UpstreamUnavailableError) throw error;
      person.segmentationStatus = 'failed';
      await sessionStore.put(session);
      return json<PersonGarmentsResponse>(
        {
          personId,
          status: 'failed',
          garments: [],
          failureReason: 'We could not process this person in the photo. Try selecting them again, or use another photo.',
        },
        200,
      );
    }

    person.segmentationStatus = 'segmented';
    // Replace rather than append: `garments` holds the *currently selected*
    // person's items (data-model.md) — mixing two people's bubbles would
    // put bubbles over someone the user didn't pick.
    session.garments = garments;
    await sessionStore.put(session);

    return json<PersonGarmentsResponse>(
      { personId, status: 'segmented', garments, failureReason: null },
      200,
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

/**
 * GET /v1/scans/{scanId}/garments/{garmentId}/matches (T031).
 *
 * Wraps the lookup in latency instrumentation (T041): SC-003 gives this
 * round trip a 2s budget, and a log line that flags budget breaches is the
 * cheapest possible way to notice drift before users do.
 */
export async function handleGetMatches(
  request: Request,
  scanId: string,
  garmentId: string,
): Promise<Response> {
  const startedAt = performance.now();
  try {
    const session = await sessionStore.get(scanId);
    const garment = session?.garments.find((candidate) => candidate.id === garmentId);
    if (!session || !garment) {
      return errorResponse('GARMENT_NOT_FOUND', 'That garment could not be found. Please rescan the photo.', 404);
    }

    // Visual matching needs the original photo (to crop this garment) and
    // our public origin (to host the crop for the URL-only provider). Bytes
    // may be gone — findMatches turns that into ScanPhotoExpiredError below.
    const { exactMatch, similarItems } = await findMatches(garment, session.regionUsed, {
      photoBytes: photoCache.get(scanId),
      origin: new URL(request.url).origin,
    });

    garment.matchStatus = exactMatch || similarItems.length > 0 ? 'matched' : 'no_match';
    await sessionStore.put(session);

    return json<GarmentMatchesResponse>({ garmentId, exactMatch, similarItems }, 200);
  } catch (error) {
    if (error instanceof ScanPhotoExpiredError) {
      // Session-lifetime fact, not upstream trouble: the same honest answer
      // the person-selection route gives when its photo bytes are gone.
      return errorResponse('GARMENT_NOT_FOUND', 'This scan has expired. Please rescan the photo.', 404);
    }
    return mapUnexpected(error);
  } finally {
    const elapsedMs = Math.round(performance.now() - startedAt);
    const verdict = elapsedMs <= MATCHES_LATENCY_BUDGET_MS ? 'within' : 'OVER';
    // Structured single-line log: greppable in Vercel's log drain, and the
    // "OVER" token is an alertable string for SC-003 regression monitoring.
    console.info(
      `[scans.matches] scanId=${scanId} garmentId=${garmentId} elapsedMs=${elapsedMs} budgetMs=${MATCHES_LATENCY_BUDGET_MS} verdict=${verdict}`,
    );
  }
}
