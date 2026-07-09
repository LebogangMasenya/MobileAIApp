/**
 * useSignUpForm — form state + the contract signUp flow (FR-004).
 *
 * Screens stay presentational (Constitution VIII): every rule and lifecycle
 * lives here. Validation predicates are IMPORTED from the provider so the
 * form and the provider can never disagree about what "valid" means.
 */

import { useCallback, useMemo, useState } from 'react';

import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH, useAuthSession } from '@/features/auth/providers/mock-auth-provider';
import { authErrorMessage } from '@/features/auth/utils/error-copy';

export function useSignUpForm() {
  const { signUp } = useAuthSession();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // As-you-type errors appear only once the field has content — an empty form
  // shouldn't scold the user before they've done anything (FR-004).
  const emailError = useMemo(
    () => (email.length > 0 && !EMAIL_PATTERN.test(email.trim().toLowerCase()) ? 'Enter a valid email address.' : null),
    [email],
  );
  const passwordError = useMemo(
    () =>
      password.length > 0 && password.length < MIN_PASSWORD_LENGTH
        ? `At least ${MIN_PASSWORD_LENGTH} characters.`
        : null,
    [password],
  );

  const canSubmit =
    EMAIL_PATTERN.test(email.trim().toLowerCase()) && password.length >= MIN_PASSWORD_LENGTH && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      // Success needs no navigation: the session flip re-routes the app via
      // the root guards (G4). Inputs stay untouched on failure (FR-007).
      await signUp(email, password, firstName.trim() || undefined);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, email, firstName, password, signUp]);

  return {
    firstName,
    setFirstName,
    email,
    setEmail,
    password,
    setPassword,
    emailError,
    passwordError,
    formError,
    submitting,
    canSubmit,
    submit,
  };
}
