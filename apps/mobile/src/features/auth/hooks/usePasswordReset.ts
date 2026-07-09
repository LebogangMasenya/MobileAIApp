/**
 * usePasswordReset — the enumeration-safe reset flow (FR-006, contract C3).
 *
 * `sent` flips to the SAME confirmation state for any input — the contract
 * guarantees identical resolution and timing whether or not the email is
 * registered, so this hook (and the screen) literally cannot leak account
 * existence.
 */

import { useCallback, useState } from 'react';

import { EMAIL_PATTERN, useAuthSession } from '@/features/auth/providers/mock-auth-provider';
import { authErrorMessage } from '@/features/auth/utils/error-copy';

export function usePasswordReset() {
  const { requestPasswordReset } = useAuthSession();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailError =
    email.length > 0 && !EMAIL_PATTERN.test(email.trim().toLowerCase()) ? 'Enter a valid email address.' : null;
  const canSubmit = EMAIL_PATTERN.test(email.trim().toLowerCase()) && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      // Only a transport-level failure can land here (never "unknown email").
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, email, requestPasswordReset]);

  return { email, setEmail, emailError, formError, submitting, sent, canSubmit, submit };
}
