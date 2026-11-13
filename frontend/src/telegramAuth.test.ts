import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  invalidateTelegramAuthCache,
  loginWithTelegramInitData,
  resetTelegramAuthSession,
} from './telegramAuth';

describe('loginWithTelegramInitData', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetTelegramAuthSession();
  });

  it('deduplicates concurrent login requests', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>(resolve => {
        setTimeout(
          () => resolve(new Response(JSON.stringify({ access_token: 'tok-1' }), { status: 200 })),
          20,
        );
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([
      loginWithTelegramInitData('signed-init'),
      loginWithTelegramInitData('signed-init'),
    ]);
    expect(a).toBe('tok-1');
    expect(b).toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries 409 then succeeds with backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'conflict' }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'tok-retry' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const token = await loginWithTelegramInitData('signed-init');
    expect(token).toBe('tok-retry');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resets in-flight state after total failure so a later login can succeed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ detail: 'nope' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithTelegramInitData('signed-init')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'tok-later' }), { status: 200 }));
    const token = await loginWithTelegramInitData('signed-init');
    expect(token).toBe('tok-later');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('reuses a successful session for the same initData (StrictMode remount)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'tok-cached' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await loginWithTelegramInitData('same-init-data')).toBe('tok-cached');
    expect(await loginWithTelegramInitData('same-init-data')).toBe('tok-cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not share in-flight promise across different initData', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_input: RequestInfo, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { init_data?: string };
        const id = body.init_data ?? 'unknown';
        return new Promise<Response>(resolve => {
          setTimeout(
            () => resolve(new Response(JSON.stringify({ access_token: `tok-${id}` }), { status: 200 })),
            15,
          );
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([
      loginWithTelegramInitData('init-a'),
      loginWithTelegramInitData('init-b'),
    ]);
    expect(a).toBe('tok-init-a');
    expect(b).toBe('tok-init-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('force refresh bypasses a stale cached token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'stale-tok' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'fresh-tok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await loginWithTelegramInitData('signed-init')).toBe('stale-tok');
    invalidateTelegramAuthCache('signed-init');
    expect(await loginWithTelegramInitData('signed-init', { forceRefresh: true })).toBe('fresh-tok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears cache on 401 from telegram auth and allows a later success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Invalid credentials' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'fresh-after-401' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithTelegramInitData('signed-init')).rejects.toThrow();
    const token = await loginWithTelegramInitData('signed-init');
    expect(token).toBe('fresh-after-401');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not reuse cache when initData changes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'tok-a' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'tok-b' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await loginWithTelegramInitData('init-a')).toBe('tok-a');
    expect(await loginWithTelegramInitData('init-b')).toBe('tok-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
