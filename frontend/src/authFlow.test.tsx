import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { __readAppSessionTokenForTests, __resetAppSessionForTests } from './App';
import { resetAppInitForTests } from './authSession';
import { clearBrowserSessionToken, writeBrowserSessionToken } from './browserSession';
import { resetTelegramAuthSession } from './telegramAuth';

const referenceData = { races: [], classes: [], feats: [], backgrounds: [], character_creation: {}, draconic_ancestry: {}, locations: [] };

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'Error',
    json: () => Promise.resolve(body),
  } as Response);
}

describe('authentication bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAppInitForTests();
    __resetAppSessionForTests();
    resetTelegramAuthSession();
    clearBrowserSessionToken();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAppInitForTests();
    resetTelegramAuthSession();
  });

  it('does not show authenticated UI when reference bootstrap fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/auth/telegram') return jsonResponse({ access_token: 'tok-1' });
      if (url.pathname === '/api/characters') return jsonResponse([]);
      if (url.pathname === '/api/characters/presets') return jsonResponse([]);
      if (url.pathname === '/api/reference') return jsonResponse({ detail: 'broken' }, 500);
      if (url.pathname === '/api/economy') return jsonResponse({ balance: 0, balance_tenths: 0, tier: 'normal', tiers: [], packages: [] });
      if (url.pathname === '/api/reference/spells') return jsonResponse([]);
      return jsonResponse({ detail: 'missing' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = { WebApp: { initData: 'signed-init', ready: vi.fn(), expand: vi.fn() } };

    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry loading adventure data/i })).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument();
  });

  it('bootstrap retry succeeds after reference failure', async () => {
    let referenceFails = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/auth/telegram') return jsonResponse({ access_token: 'tok-1' });
      if (url.pathname === '/api/characters') return jsonResponse([]);
      if (url.pathname === '/api/characters/presets') return jsonResponse([]);
      if (url.pathname === '/api/reference') {
        return referenceFails
          ? jsonResponse({ detail: 'broken' }, 500)
          : jsonResponse(referenceData);
      }
      if (url.pathname === '/api/economy') return jsonResponse({ balance: 0, balance_tenths: 0, tier: 'normal', tiers: [], packages: [] });
      if (url.pathname === '/api/reference/spells') return jsonResponse([]);
      return jsonResponse({ detail: 'missing' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = { WebApp: { initData: 'signed-init', ready: vi.fn(), expand: vi.fn() } };

    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry loading adventure data/i })).toBeInTheDocument());
    referenceFails = false;
    fireEvent.click(screen.getByRole('button', { name: /retry loading adventure data/i }));
    await waitFor(() => expect(screen.getByText(/adventure awaits/i)).toBeInTheDocument());
  });

  it('keeps stored browser token on network error during bootstrap', async () => {
    writeBrowserSessionToken('browser-tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/characters') throw new TypeError('Failed to fetch');
      return jsonResponse({ detail: 'unused' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = undefined;

    render(<App />);
    await waitFor(() => expect(screen.getByText(/network error stopped sign-in/i)).toBeInTheDocument());
    expect(sessionStorage.getItem('dd_browser_session_token')).toBe('browser-tok');
  });

  it('clears invalid stored browser token on 401 bootstrap', async () => {
    writeBrowserSessionToken('browser-tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/characters') return jsonResponse({ detail: 'Invalid API token' }, 401);
      return jsonResponse({ detail: 'unused' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = undefined;

    render(<App />);
    await waitFor(() => expect(screen.getByText(/saved session expired/i)).toBeInTheDocument());
    expect(sessionStorage.getItem('dd_browser_session_token')).toBeNull();
  });

  it('does not clear token or reauth via Telegram when reference bootstrap returns opaque 401', async () => {
    writeBrowserSessionToken('browser-tok');
    let telegramAuthCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/auth/telegram') {
        telegramAuthCalls += 1;
        return jsonResponse({ access_token: 'should-not-be-used' });
      }
      if (url.pathname === '/api/characters') return jsonResponse([]);
      if (url.pathname === '/api/characters/presets') return jsonResponse([]);
      if (url.pathname === '/api/reference') return jsonResponse({ detail: 'Unauthorized' }, 401);
      if (url.pathname === '/api/economy') return jsonResponse({ balance: 0, balance_tenths: 0, tier: 'normal', tiers: [], packages: [] });
      if (url.pathname === '/api/reference/spells') return jsonResponse([]);
      return jsonResponse({ detail: 'missing' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = { WebApp: { initData: 'signed-init', ready: vi.fn(), expand: vi.fn() } };

    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry loading adventure data/i })).toBeInTheDocument());
    expect(sessionStorage.getItem('dd_browser_session_token')).toBe('browser-tok');
    expect(telegramAuthCalls).toBe(0);
    expect(__readAppSessionTokenForTests()).toBeTruthy();
  });

  it('does not clear token when bootstrap receives 403', async () => {
    writeBrowserSessionToken('browser-tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/characters') return jsonResponse({ detail: 'Admin token required' }, 403);
      return jsonResponse({ detail: 'unused' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = undefined;

    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry loading adventure data/i })).toBeInTheDocument());
    expect(sessionStorage.getItem('dd_browser_session_token')).toBe('browser-tok');
    expect(__readAppSessionTokenForTests()).toBeTruthy();
  });

  it('shares in-flight bootstrap across rapid retry clicks', async () => {
    let referenceFails = true;
    let referenceRequests = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/auth/telegram') return jsonResponse({ access_token: 'tok-1' });
      if (url.pathname === '/api/characters') return jsonResponse([]);
      if (url.pathname === '/api/characters/presets') return jsonResponse([]);
      if (url.pathname === '/api/reference') {
        referenceRequests += 1;
        return referenceFails
          ? jsonResponse({ detail: 'broken' }, 500)
          : jsonResponse(referenceData);
      }
      if (url.pathname === '/api/economy') return jsonResponse({ balance: 0, balance_tenths: 0, tier: 'normal', tiers: [], packages: [] });
      if (url.pathname === '/api/reference/spells') return jsonResponse([]);
      return jsonResponse({ detail: 'missing' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = { WebApp: { initData: 'signed-init', ready: vi.fn(), expand: vi.fn() } };

    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry loading adventure data/i })).toBeInTheDocument());
    referenceFails = false;
    const retryBtn = screen.getByRole('button', { name: /retry loading adventure data/i });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => expect(screen.getByText(/adventure awaits/i)).toBeInTheDocument());
    expect(referenceRequests).toBeLessThanOrEqual(2);
  });

  it('telegram failure shows retry and allows manual retry success', async () => {
    let telegramFails = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/auth/telegram') {
        if (telegramFails) {
          return jsonResponse({ detail: 'bad' }, 401);
        }
        return jsonResponse({ access_token: 'tok-2' });
      }
      if (url.pathname === '/api/characters') return jsonResponse([]);
      if (url.pathname === '/api/characters/presets') return jsonResponse([]);
      if (url.pathname === '/api/reference') return jsonResponse(referenceData);
      if (url.pathname === '/api/economy') return jsonResponse({ balance: 0, balance_tenths: 0, tier: 'normal', tiers: [], packages: [] });
      if (url.pathname === '/api/reference/spells') return jsonResponse([]);
      return jsonResponse({ detail: 'missing' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.Telegram = { WebApp: { initData: 'signed-init', ready: vi.fn(), expand: vi.fn() } };

    render(<App />);
    await waitFor(() => expect(
      screen.queryByRole('button', { name: /retry telegram sign-in/i })
        ?? screen.getByText(/telegram sign-in failed/i),
    ).toBeTruthy());
    telegramFails = false;
    resetTelegramAuthSession();
    const retry = screen.queryByRole('button', { name: /retry telegram sign-in/i });
    if (retry) fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText(/adventure awaits/i)).toBeInTheDocument());
  });
});
