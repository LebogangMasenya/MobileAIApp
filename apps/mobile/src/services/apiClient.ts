/**
 * Typed API client for the scan-to-match backend (contracts/scan-api.md).
 *
 * Every call resolves to an `ApiResult<T>` discriminated union instead of
 * throwing. Hooks that consume this client (`useCreateScan`, etc.) then
 * `switch` on `kind` and TypeScript forces them to handle every failure
 * shape — that compile-time pressure is how the constitution's Defensive
 * Error Scaffolding rule ("never a dead end") gets enforced mechanically
 * rather than by reviewer vigilance.
 */

import type {
  ApiError,
  CreateScanResponse,
  ErrorResponse,
  GarmentMatchesResponse,
  PersonGarmentsResponse,
  ScanSource,
} from '../types/scan';

/**
 * `network` is deliberately separate from `api`: a network failure means
 * "we never heard back" (always safe to retry), while an `api` error is the
 * server telling us something specific — its `retryable` flag depends on the
 * code (UPSTREAM_UNAVAILABLE yes; INVALID_PHOTO no, the user needs a new photo).
 */
export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'api'; error: ApiError; retryable: boolean }
  | { kind: 'network'; retryable: true };

/** Server error codes the user can meaningfully retry without changing input. */
const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

/**
 * Resolved at startup rather than per-call so a misconfigured build fails
 * loudly on the first request, not intermittently.
 */
const BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function isErrorResponse(body: unknown): body is ErrorResponse {
  // Runtime narrowing from `unknown` — we never trust the wire format to
  // match our types (strict TS can't verify what a server actually sent).
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false;
  }
  const candidate = (body as { error: unknown }).error;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'code' in candidate &&
    'message' in candidate
  );
}

async function parseFailure(response: Response): Promise<ApiResult<never>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body (e.g. a gateway HTML page) — treat like a network
    // fault: we know nothing specific, so allow retry.
    return { kind: 'network', retryable: true };
  }
  if (isErrorResponse(body)) {
    return {
      kind: 'api',
      error: body.error,
      retryable: RETRYABLE_CODES.has(body.error.code),
    };
  }
  return { kind: 'network', retryable: true };
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    return { kind: 'network', retryable: true };
  }
  if (!response.ok) {
    return parseFailure(response);
  }
  try {
    // Cast is confined to this one seam; callers only ever see typed data.
    return { kind: 'ok', data: (await response.json()) as T };
  } catch {
    return { kind: 'network', retryable: true };
  }
}

export interface CreateScanParams {
  /** Local file URI from expo-camera or expo-image-picker. */
  photoUri: string;
  source: ScanSource;
  /** ISO 3166-1 alpha-2, from useRegionPreference. */
  region: string;
}

/**
 * POST /v1/scans — submit a photo for person detection/segmentation.
 * Multipart because photos are binary; React Native's fetch accepts a
 * `{ uri, name, type }` descriptor in FormData in place of a web File.
 */
export function createScan(params: CreateScanParams): Promise<ApiResult<CreateScanResponse>> {
  const form = new FormData();
  form.append('photo', {
    uri: params.photoUri,
    name: 'scan.jpg',
    type: 'image/jpeg',
    // React Native's FormData file descriptor isn't in the DOM lib types;
    // this narrow cast is the documented RN pattern, not an `any` escape.
  } as unknown as Blob);
  form.append('source', params.source);
  form.append('region', params.region);
  return request<CreateScanResponse>('/v1/scans', {
    method: 'POST',
    body: form,
  });
}

/**
 * POST /v1/scans/{scanId}/people/{personId}/garments — segment one selected
 * person (FR-016/FR-017). Only ever called for multi-person photos.
 */
export function segmentPerson(
  scanId: string,
  personId: string,
): Promise<ApiResult<PersonGarmentsResponse>> {
  return request<PersonGarmentsResponse>(
    `/v1/scans/${encodeURIComponent(scanId)}/people/${encodeURIComponent(personId)}/garments`,
    { method: 'POST' },
  );
}

/**
 * GET /v1/scans/{scanId}/garments/{garmentId}/matches — lazy per-garment
 * store/similar-item lookup, fetched on bubble tap (SC-003 ≤2s budget).
 */
export function getGarmentMatches(
  scanId: string,
  garmentId: string,
): Promise<ApiResult<GarmentMatchesResponse>> {
  return request<GarmentMatchesResponse>(
    `/v1/scans/${encodeURIComponent(scanId)}/garments/${encodeURIComponent(garmentId)}/matches`,
  );
}
