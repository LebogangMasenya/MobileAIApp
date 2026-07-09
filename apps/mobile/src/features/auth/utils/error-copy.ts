/**
 * Maps typed AuthError codes to human copy (FR-008). This is the ONLY place
 * auth failures become words, so tone stays consistent and no raw provider
 * error can leak into the UI. Note `invalid-credentials` deliberately covers
 * both wrong-password and unknown-account — one message, no enumeration.
 */

import { AuthError } from '@/types/auth';

export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'invalid-credentials':
        return "That email and password don't match. Check them and try again.";
      case 'email-taken':
        return 'An account with this email already exists — try logging in instead.';
      case 'invalid-email':
        return "That doesn't look like a valid email address.";
      case 'weak-password':
        return 'Passwords need at least 8 characters.';
      case 'unknown':
        break;
    }
  }
  return 'Something unexpected went wrong. Please try again.';
}
