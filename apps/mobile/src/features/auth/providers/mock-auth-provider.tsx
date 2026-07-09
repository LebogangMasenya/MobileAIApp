/**
 * MockAuthProvider — the ON-DEVICE SIMULATED auth provider (FR-022..FR-025).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ DEV SCAFFOLD — this file is the ONLY thing replaced when the real       │
 * │ managed provider (Clerk) lands. Nothing outside this folder may touch   │
 * │ its storage keys or internals; screens speak `useAuthSession()` only    │
 * │ (contract C5). Shipping this as production auth is out of bounds        │
 * │ (FR-025).                                                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * What it faithfully reproduces (so the funnel is honestly testable today):
 * - A device-local account REGISTRY, so wrong-password and unknown-account
 *   attempts produce the real `invalid-credentials` error state — with one
 *   shared code, so the UI can't reveal whether an account exists.
 * - Session persistence: restoration is a GENUINE async SecureStore read —
 *   the splash airlock waits on real work, and a synchronous shortcut here
 *   would mask airlock bugs that surface the moment a slower real provider
 *   is swapped in (research §3).
 * - Simulated latency (~400–900ms) on every operation: instant resolution
 *   would hide busy-state and double-tap bugs the real network will find.
 * - A simulated Apple/Google consent sheet with a working Cancel path, so
 *   the "dismissed sheet returns silently" edge case is exercisable.
 *
 * Deliberate compromise: registry passwords are stored as plain text. That is
 * acceptable ONLY because this is a hardware-backed (Keychain/Keystore),
 * device-local dev scaffold — real credential verification is the provider's
 * job after the swap. Do not copy this pattern anywhere else.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Platform } from 'react-native';

import { deleteItem, readItem, writeItem } from '@/services/device-store';
import { AuthError, type AuthContract, type AuthUser, type SocialSignInResult } from '@/types/auth';

// ---------------------------------------------------------------------------
// Storage shapes (mock-internal — never exported, never leave this file)
// ---------------------------------------------------------------------------

const ACCOUNTS_KEY = 'satori.auth.accounts.v1';
const SESSION_KEY = 'satori.auth.session.v1';

/** Sentinel the dev-expiry utility writes so restoration can tell "expired" from "absent". */
const EXPIRED_TOKEN = 'expired';

interface MockAccount {
  id: string;
  email: string;
  password: string; // plain text — see the module-level compromise note
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

interface StoredSession {
  token: string;
  userId: string;
}

// Shared validation rules — exported so the form hooks validate with the SAME
// predicate the provider enforces (one source of truth, no drift).
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

/** Demo identity behind the simulated Apple/Google sheets (FR-023). */
const DEMO_ACCOUNT = {
  email: 'demo@satori.app',
  firstName: 'Demo',
  lastName: 'User',
} as const;

// ---------------------------------------------------------------------------
// Small internals
// ---------------------------------------------------------------------------

/**
 * Simulated network latency. Randomized so animations/busy states are tested
 * against jitter — except when a FIXED delay is requested (password reset must
 * take identical time for registered and unknown emails, FR-006/C3).
 */
function delay(fixedMs?: number): Promise<void> {
  const ms = fixedMs ?? 400 + Math.random() * 500;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function parseAccounts(raw: string | null): MockAccount[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MockAccount[]) : [];
  } catch {
    // A corrupt registry degrades to "no accounts" — never a crash (Constitution VII).
    return [];
  }
}

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as StoredSession).token === 'string' &&
      typeof (parsed as StoredSession).userId === 'string'
    ) {
      return parsed as StoredSession;
    }
    return null;
  } catch {
    return null;
  }
}

function toAuthUser(account: MockAccount): AuthUser {
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    // Always null from the mock — the initials-avatar fallback is therefore
    // always exercised (FR-018, data-model.md).
    imageUrl: null,
  };
}

/**
 * The simulated consent sheet (FR-023). A real provider presents a native
 * sheet; the closest zero-dependency stand-in is a native Alert with an
 * explicit Cancel path so the "dismissed sheet" edge case stays testable.
 */
function presentConsentSheet(providerName: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    // RN-web's Alert has no buttons; confirm() keeps web layout checks unblocked.
    return Promise.resolve(globalThis.confirm?.(`Continue as Demo User? (simulated ${providerName})`) ?? true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      `Sign in with ${providerName}`,
      `Simulated consent sheet (dev scaffold).\nContinue as ${DEMO_ACCOUNT.firstName} ${DEMO_ACCOUNT.lastName} (${DEMO_ACCOUNT.email})?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue as Demo User', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * __DEV__-only utility: corrupts the stored session token IN PLACE so the
 * next launch's restoration finds an invalid (not absent) session and shows
 * the "please sign in again" notice on Welcome (US2 scenario 2).
 */
export async function devExpireSession(): Promise<void> {
  if (!__DEV__) return;
  const session = parseSession(await readItem(SESSION_KEY));
  if (session) {
    await writeItem(SESSION_KEY, JSON.stringify({ ...session, token: EXPIRED_TOKEN } satisfies StoredSession));
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const AuthSessionContext = createContext<AuthContract | null>(null);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // The registry lives in a ref: it's provider bookkeeping, not render state —
  // only the derived `user` should cause re-renders (Constitution VIII).
  const accountsRef = useRef<MockAccount[]>([]);

  // --- Session restoration (the airlock's real async work — FR-001) --------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accountsRaw, sessionRaw] = await Promise.all([readItem(ACCOUNTS_KEY), readItem(SESSION_KEY)]);
      if (cancelled) return;
      accountsRef.current = parseAccounts(accountsRaw);
      const session = parseSession(sessionRaw);
      if (session) {
        const account = accountsRef.current.find((candidate) => candidate.id === session.userId);
        if (account && session.token !== EXPIRED_TOKEN && session.token.length > 0) {
          setUser(toAuthUser(account));
        } else {
          // Invalid ≠ absent: surface the gentle notice, then purge (US2-2).
          setSessionExpired(true);
          await deleteItem(SESSION_KEY);
        }
      }
      if (!cancelled) setIsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistAccounts = useCallback(async () => {
    await writeItem(ACCOUNTS_KEY, JSON.stringify(accountsRef.current));
  }, []);

  const establishSession = useCallback(async (account: MockAccount) => {
    await writeItem(
      SESSION_KEY,
      JSON.stringify({ token: randomId('tok'), userId: account.id } satisfies StoredSession),
    );
    setSessionExpired(false);
    // Setting `user` LAST: it flips `isSignedIn`, which flips the root guards —
    // the session must already be durable when the (app) group mounts.
    setUser(toAuthUser(account));
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, firstName?: string) => {
      await delay();
      const normalized = email.trim().toLowerCase();
      // The forms validate as-you-type; the provider re-validates on submit so
      // the rules hold even if a future caller skips the form layer.
      if (!EMAIL_PATTERN.test(normalized)) throw new AuthError('invalid-email');
      if (password.length < MIN_PASSWORD_LENGTH) throw new AuthError('weak-password');
      if (accountsRef.current.some((candidate) => candidate.email === normalized)) {
        throw new AuthError('email-taken');
      }
      const account: MockAccount = {
        id: randomId('usr'),
        email: normalized,
        password,
        firstName: firstName?.trim() ? firstName.trim() : null,
        lastName: null,
        createdAt: new Date().toISOString(),
      };
      accountsRef.current = [...accountsRef.current, account];
      await persistAccounts();
      await establishSession(account);
    },
    [establishSession, persistAccounts],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await delay();
      const normalized = email.trim().toLowerCase();
      const account = accountsRef.current.find((candidate) => candidate.email === normalized);
      // ONE code for both failure shapes — the UI can't leak which happened.
      if (!account || account.password !== password) throw new AuthError('invalid-credentials');
      await establishSession(account);
    },
    [establishSession],
  );

  const socialSignIn = useCallback(
    async (providerName: string): Promise<SocialSignInResult> => {
      await delay();
      const consented = await presentConsentSheet(providerName);
      if (!consented) return 'cancelled';
      let account = accountsRef.current.find((candidate) => candidate.email === DEMO_ACCOUNT.email);
      if (!account) {
        account = {
          id: randomId('usr'),
          email: DEMO_ACCOUNT.email,
          password: randomId('pw'), // unreachable via the password form — social-only identity
          firstName: DEMO_ACCOUNT.firstName,
          lastName: DEMO_ACCOUNT.lastName,
          createdAt: new Date().toISOString(),
        };
        accountsRef.current = [...accountsRef.current, account];
        await persistAccounts();
      }
      await establishSession(account);
      return 'completed';
    },
    [establishSession, persistAccounts],
  );

  const signInWithApple = useCallback(() => socialSignIn('Apple'), [socialSignIn]);
  const signInWithGoogle = useCallback(() => socialSignIn('Google'), [socialSignIn]);

  const requestPasswordReset = useCallback(async (_email: string) => {
    // FIXED delay + unconditional resolve: registered and unknown emails are
    // indistinguishable by state AND by timing (FR-006, contract C3). No mail
    // is sent — that's the real provider's job after the swap.
    await delay(700);
  }, []);

  const signOut = useCallback(async () => {
    await delay(400);
    // Purge the session key ONLY — the registry survives so the user can sign
    // back in with the same credentials (US2 scenario 4).
    await deleteItem(SESSION_KEY);
    setUser(null); // flips the guards → (app) unmounts with history removal (FR-010)
  }, []);

  const value = useMemo<AuthContract>(
    () => ({
      isLoaded,
      isSignedIn: user !== null,
      user,
      sessionExpired,
      signUp,
      signIn,
      signInWithApple,
      signInWithGoogle,
      requestPasswordReset,
      signOut,
    }),
    [isLoaded, user, sessionExpired, signUp, signIn, signInWithApple, signInWithGoogle, requestPasswordReset, signOut],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

/**
 * The single way any code reads or mutates session state (FR-011/FR-024,
 * gate invariant G4). If this throws, a screen rendered outside the provider —
 * a wiring bug worth failing loudly on, in dev and prod alike.
 */
export function useAuthSession(): AuthContract {
  const contract = useContext(AuthSessionContext);
  if (!contract) {
    throw new Error('useAuthSession must be used inside <MockAuthProvider> (see src/app/_layout.tsx)');
  }
  return contract;
}
