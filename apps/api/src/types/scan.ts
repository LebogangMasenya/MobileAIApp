/**
 * Entity and API contract types for the scan-to-match feature.
 *
 * Source of truth: specs/001-camera-scan-match/data-model.md and
 * contracts/scan-api.md. A near-identical copy lives in
 * apps/mobile/src/types/scan.ts — the two MUST stay in sync. We deliberately
 * duplicate instead of extracting a shared npm package: at two consumers,
 * a package adds versioning/publish overhead that outweighs a copy-paste
 * diff check (Constitution: Anti-Abstraction Mandate — no layers before
 * they earn their keep).
 */

/**
 * Normalized (0–1) rectangle relative to the photo's dimensions.
 * Normalized rather than pixel coordinates so bubble/tap-target placement
 * survives the photo being rendered at any size or scale on any screen.
 */
export interface BoundingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which entry point produced the photo (FR-002 live capture, FR-002a import). */
export type ScanSource = 'camera' | 'import';

export type ScanStatus = 'processing' | 'segmented' | 'failed';

/**
 * One distinguishable person in the photo (FR-016).
 * `segmentationStatus` stays "pending" until the user explicitly selects
 * this person — that user-driven transition is what prevents a multi-person
 * photo from segmenting everyone at once.
 */
export interface DetectedPerson {
  id: string;
  boundingRegion: BoundingRegion;
  segmentationStatus: 'pending' | 'segmented' | 'failed';
}

/**
 * One segmented clothing item, tied to the person it was found on.
 * `matchStatus` is "unresolved" until the detail view is opened — store
 * matches are fetched lazily per garment so the initial scan stays fast
 * (SC-001 ≤5s) and we never pay for lookups the user doesn't ask for.
 */
export interface DetectedGarment {
  id: string;
  personId: string;
  category: string;
  confidence: number;
  boundingRegion: BoundingRegion;
  matchStatus: 'unresolved' | 'matched' | 'no_match';
}

export interface Store {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 codes for the regions this store serves. */
  regions: string[];
  logoUrl: string | null;
}

export interface Price {
  amount: number;
  currency: string;
}

/** A specific store listing matching (or closely matching) a garment (FR-007). */
export interface MatchedProduct {
  id: string;
  garmentId: string;
  /** Embedded rather than referenced so the detail view is one round trip. */
  store: Store;
  title: string;
  imageUrl: string;
  price: Price | null;
  ctaUrl: string;
  isExactMatch: boolean;
}

/** A look-alike alternative, ranked by similarity and region availability (FR-009, FR-011). */
export interface SimilarItem extends MatchedProduct {
  similarityScore: number;
  /**
   * Always true for items the API returns — region filtering happens
   * server-side so the client never has to reason about ineligible items;
   * an empty list *is* the "no regional match" state.
   */
  regionAvailable: boolean;
}

/**
 * A single capture-or-import event and its lifecycle.
 * State machine: processing → segmented | failed (terminal; retry = new session).
 */
export interface ScanSession {
  id: string;
  source: ScanSource;
  /** ISO 8601 timestamp. */
  createdAt: string;
  status: ScanStatus;
  /** ISO 3166-1 alpha-2 region applied when matches were resolved (FR-010). */
  regionUsed: string;
  /** One entry per distinguishable person; populated when segmented. */
  people: DetectedPerson[];
  /**
   * Garments for the currently selected person. Auto-populated only for
   * single-person photos; multi-person photos keep this empty until the
   * user picks someone (FR-016).
   */
  garments: DetectedGarment[];
  /** Human-readable reason when status === "failed" (FR-012, FR-018). */
  failureReason: string | null;
}

// ---------------------------------------------------------------------------
// API contract shapes (contracts/scan-api.md)
// ---------------------------------------------------------------------------

/** POST /v1/scans — 201 (segmented) and 200 (business-level failure) share this body. */
export interface CreateScanResponse {
  scanSession: ScanSession;
}

/** POST /v1/scans/{scanId}/people/{personId}/garments — 200. */
export interface PersonGarmentsResponse {
  personId: string;
  status: 'segmented' | 'failed';
  garments: DetectedGarment[];
  failureReason: string | null;
}

/** GET /v1/scans/{scanId}/garments/{garmentId}/matches — 200. */
export interface GarmentMatchesResponse {
  garmentId: string;
  /** null + empty similarItems = the full FR-013 "try another angle" state. */
  exactMatch: MatchedProduct | null;
  similarItems: SimilarItem[];
}

export type ApiErrorCode =
  | 'INVALID_PHOTO'
  | 'UNSUPPORTED_FORMAT'
  | 'PERSON_NOT_FOUND'
  | 'GARMENT_NOT_FOUND'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  /** User-safe, non-technical wording (Constitution: Defensive Error Scaffolding). */
  message: string;
}

export interface ErrorResponse {
  error: ApiError;
}
