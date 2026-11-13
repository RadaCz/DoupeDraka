import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiError } from './apiErrors';
import {
  classifyAuthFailure,
  classifyBootstrapFailure,
  isAuthenticationFailure401,
  isBootstrapLoading,
  resetAppInitForTests,
  runAppInitOnce,
  shouldClearBrowserSession,
  shouldInvalidateSessionToken,
} from './authSession';

describe('authSession', () => {
  afterEach(() => {
    resetAppInitForTests();
  });

  it('classifies network, server, and session errors', () => {
    expect(classifyAuthFailure(new TypeError('Failed to fetch'))).toBe('network');
    expect(classifyAuthFailure(new ApiError('nope', 500))).toBe('server');
    expect(classifyAuthFailure(new ApiError('Invalid API token', 401))).toBe('session_invalid');
    expect(classifyAuthFailure(new ApiError('Forbidden', 403))).toBe('bootstrap');
    expect(classifyAuthFailure(new ApiError('Unauthorized', 401))).toBe('bootstrap');
  });

  it('classifies bootstrap failures without discarding sessions on opaque 401/403', () => {
    expect(classifyBootstrapFailure(new ApiError('Reference unavailable', 401))).toBe('bootstrap');
    expect(classifyBootstrapFailure(new ApiError('Admin token required', 403))).toBe('bootstrap');
    expect(classifyBootstrapFailure(new ApiError('Invalid API token', 401))).toBe('session_invalid');
    expect(isAuthenticationFailure401(new ApiError('User not found', 401))).toBe(true);
  });

  it('only clears browser session on invalid session', () => {
    expect(shouldClearBrowserSession('session_invalid')).toBe(true);
    expect(shouldClearBrowserSession('network')).toBe(false);
    expect(shouldClearBrowserSession('server')).toBe(false);
  });

  it('keeps session token on network/server failures', () => {
    expect(shouldInvalidateSessionToken('network')).toBe(false);
    expect(shouldInvalidateSessionToken('server')).toBe(false);
    expect(shouldInvalidateSessionToken('session_invalid')).toBe(true);
  });

  it('marks loading phases explicitly', () => {
    expect(isBootstrapLoading('checking_session')).toBe(true);
    expect(isBootstrapLoading('authenticating')).toBe(true);
    expect(isBootstrapLoading('loading_account')).toBe(true);
    expect(isBootstrapLoading('authenticated')).toBe(false);
    expect(isBootstrapLoading('awaiting_login')).toBe(false);
  });

  it('deduplicates app init work across StrictMode remounts', async () => {
    const task = vi.fn(async () => {});
    await Promise.all([runAppInitOnce(task), runAppInitOnce(task)]);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
