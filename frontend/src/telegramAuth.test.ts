import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginWithTelegramInitData, resetTelegramAuthSession } from './telegramAuth';

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
