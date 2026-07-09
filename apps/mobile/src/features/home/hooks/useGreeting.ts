/**
 * useGreeting — derives the Home greeting from the session user (FR-012).
 * Pure derivation of the UserProfile rules in data-model.md: first name when
 * we have one, a time-of-day greeting when we don't (critique D6 — no more
 * "Hello user" placeholder).
 */

import { useAuthSession } from '@/features/auth/providers/mock-auth-provider';

function timeOfDayGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export interface Greeting {
  /** e.g. "Hello Brandon" or "Good evening". */
  headline: string;
}

export function useGreeting(): Greeting {
  const { user } = useAuthSession();
  const name = user?.firstName?.trim() || null;
  return {
    headline: name ? `Hello ${name}` : timeOfDayGreeting(new Date().getHours()),
  };
}
