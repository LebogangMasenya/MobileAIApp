/**
 * useSignInForm — form state + the contract signIn flow (FR-005/FR-008).
 *
 * On failure the email (and password) stay populated for an immediate retry,
 * and the single `invalid-credentials` message can't reveal whether the
 * account exists (no enumeration).
 */

import { useCallback, useState } from 'react';

import { useAuthSession } from '@/features/auth/providers/mock-auth-provider';
import { authErrorMessage } from '@/features/auth/utils/error-copy';

export function useSignInForm() {
  const { signIn } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, email, password, signIn]);

  return { email, setEmail, password, setPassword, formError, submitting, canSubmit, submit };
}
