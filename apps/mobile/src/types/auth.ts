/**
 * Session-contract and dashboard types for the entry funnel
 * (specs/002-entry-funnel-dashboard — data-model.md + contracts §1).
 *
 * `AuthContract` is the ONE seam between screens and whichever auth provider
 * sits behind it (the on-device mock today, a managed provider like Clerk in a
 * follow-up). Screens import these types and call `useAuthSession()` — they
 * never see provider internals, so the swap later is a one-file replacement
 * (FR-024).
 */

/** Typed failure codes — the UI maps these to human copy; raw provider errors never surface (FR-008). */
export type AuthErrorCode =
  /** Wrong password OR unknown account — deliberately one code so the UI cannot leak which (no enumeration). */
  | 'invalid-credentials'
  | 'email-taken'
  | 'invalid-email'
  | 'weak-password'
  | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * What `useAuthSession().user` exposes. Shaped to match what a managed
 * provider returns later, so the swap is type-stable. The mock never supplies
 * `imageUrl`, which means the initials-avatar fallback path is always
 * exercised (FR-018).
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

/** A dismissed consent sheet is a deliberate act, not an error — hence a result, not a rejection. */
export type SocialSignInResult = 'completed' | 'cancelled';

export interface AuthContract {
  /** Session restoration finished — the splash airlock's release signal (FR-001). */
  isLoaded: boolean;
  /** Valid session exists — the ONLY routing key the gate reads (FR-011). */
  isSignedIn: boolean;
  user: AuthUser | null;
  /**
   * True when restoration found a session that is no longer valid
   * (expired/revoked) rather than no session at all — drives the gentle
   * "please sign in again" notice on Welcome (US2 scenario 2).
   */
  sessionExpired: boolean;

  /** Rejects with `AuthError` (`email-taken`, `weak-password`, `invalid-email`). */
  signUp(email: string, password: string, firstName?: string): Promise<void>;
  /** Rejects with `AuthError('invalid-credentials')` — identical for wrong password and unknown account. */
  signIn(email: string, password: string): Promise<void>;
  signInWithApple(): Promise<SocialSignInResult>;
  signInWithGoogle(): Promise<SocialSignInResult>;
  /** ALWAYS resolves identically (same state, same timing) whether or not the email is registered (FR-006). */
  requestPasswordReset(email: string): Promise<void>;
  /** Purges all session material from secure storage before resolving (FR-009). */
  signOut(): Promise<void>;
}

/** Display-facing derivation of AuthUser — computed, never stored (data-model.md). */
export interface UserProfile {
  displayName: string;
  /** null → the UI falls back to a time-of-day greeting (FR-012). */
  greetingName: string | null;
  initials: string;
  avatarUrl: string | null;
}

/** Card-level view of a feature-001 scan powering the Home rail (FR-013). */
export interface RecentScanSummary {
  /** Key back into feature 001's scan experience (FR-015). */
  scanId: string;
  /** Local photo URI captured at scan time. */
  thumbnailUri: string;
  /** ISO 8601 — the rail sorts newest-first. */
  capturedAt: string;
  garmentCount: number;
}

/**
 * Versioned envelope for the device-local store, so a future server-side
 * migration can detect and upgrade old payloads (contracts §6).
 */
export interface RecentScansStore {
  v: 1;
  scans: RecentScanSummary[];
}
