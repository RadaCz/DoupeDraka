import { ApiError } from './apiErrors';

export type BootstrapPhase =
  | 'checking_session'
  | 'authenticating'
  | 'loading_account'
  | 'authenticated'
  | 'awaiting_login'
  | 'auth_error';

export type AuthFailureKind =
  | 'telegram_auth'
  | 'browser_auth'
  | 'session_invalid'
  | 'network'
  | 'server'
  | 'bootstrap';

let appInitPromise: Promise<void> | null = null;

export function runAppInitOnce(task: () => Promise<void>): Promise<void> {
  if (!appInitPromise) appInitPromise = task();
  return appInitPromise;
}

export function resetAppInitForTests(): void {
  appInitPromise = null;
}

export function isBootstrapLoading(phase: BootstrapPhase): boolean {
  return phase === 'checking_session' || phase === 'authenticating' || phase === 'loading_account';
}

const SESSION_INVALID_401_MARKERS = [
  'invalid api token',
  'user not found',
  'invalid credentials',
];

/** True when the backend has rejected the bearer token or login proof (not a data/permission error). */
export function isAuthenticationFailure401(error: ApiError): boolean {
  const msg = error.message.toLowerCase();
  return SESSION_INVALID_401_MARKERS.some(marker => msg.includes(marker));
}

export function classifyBootstrapFailure(reason: unknown): AuthFailureKind {
  if (reason instanceof TypeError) return 'network';
  if (reason instanceof ApiError) {
    if (reason.status >= 500) return 'server';
    if (reason.status === 403) return 'bootstrap';
    if (reason.status === 401) {
      return isAuthenticationFailure401(reason) ? 'session_invalid' : 'bootstrap';
    }
    return 'bootstrap';
  }
  if (reason instanceof Error) {
    const message = reason.message.toLowerCase();
    if (message.includes('sign-in failed') || message.includes('registration failed')) {
      return 'browser_auth';
    }
    if (message.includes('telegram') || message.includes('init')) {
      return 'telegram_auth';
    }
  }
  return 'bootstrap';
}

export function classifyAuthFailure(reason: unknown): AuthFailureKind {
  if (reason instanceof TypeError) return 'network';
  if (reason instanceof ApiError) {
    if (reason.status === 401 && isAuthenticationFailure401(reason)) return 'session_invalid';
    if (reason.status >= 500) return 'server';
    return 'bootstrap';
  }
  if (reason instanceof Error) {
    const message = reason.message.toLowerCase();
    if (message.includes('sign-in failed') || message.includes('registration failed')) {
      return 'browser_auth';
    }
    if (message.includes('telegram') || message.includes('init')) {
      return 'telegram_auth';
    }
  }
  return 'bootstrap';
}

export function shouldClearBrowserSession(kind: AuthFailureKind): boolean {
  return kind === 'session_invalid';
}

export function shouldInvalidateSessionToken(kind: AuthFailureKind): boolean {
  return kind === 'session_invalid';
}

export type BootstrapOutcome = 'ok' | AuthFailureKind;

export function messageKeyForAuthFailure(kind: AuthFailureKind | null): string | null {
  if (!kind) return null;
  switch (kind) {
    case 'network':
      return 'A network error stopped sign-in. Check your connection and try again.';
    case 'server':
      return 'The server is temporarily unavailable. Try again in a moment.';
    case 'session_invalid':
      return 'Your saved session expired. Sign in again.';
    case 'telegram_auth':
      return 'Telegram sign-in failed. Retry below or use a browser account.';
    case 'bootstrap':
      return 'Your account loaded but game data failed. Try again.';
    default:
      return null;
  }
}
