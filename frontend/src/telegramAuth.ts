const API_URL = import.meta.env.VITE_API_URL || '/api';

let telegramAuthInFlight: Promise<string> | null = null;
let cachedTelegramAuth: { initData: string; token: string } | null = null;

function readErrorDetail(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0];
      if (typeof first === 'object' && first && 'msg' in first) {
        return String((first as { msg: unknown }).msg);
      }
    }
  }
  return `Sign-in failed (${status}).`;
}

async function postTelegramAuth(initData: string, attempt: number): Promise<string> {
  const response = await fetch(`${API_URL}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ init_data: initData }),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string };
  if (!response.ok) {
    const detail = readErrorDetail(body, response.status);
    if (response.status === 409 && attempt < 2) {
      await new Promise(resolve => window.setTimeout(resolve, 80 * (attempt + 1)));
      return postTelegramAuth(initData, attempt + 1);
    }
    throw new Error(detail);
  }
  if (!body.access_token) throw new Error('Invalid authentication response from server.');
  return body.access_token;
}

/** One in-flight Telegram login per page load — survives React StrictMode double effects. */
export function loginWithTelegramInitData(initData: string): Promise<string> {
  if (cachedTelegramAuth?.initData === initData) {
    return Promise.resolve(cachedTelegramAuth.token);
  }
  if (telegramAuthInFlight) return telegramAuthInFlight;
  telegramAuthInFlight = postTelegramAuth(initData, 0)
    .then(token => {
      cachedTelegramAuth = { initData, token };
      return token;
    })
    .finally(() => {
      telegramAuthInFlight = null;
    });
  return telegramAuthInFlight;
}

/** Test-only: reset module auth state between Vitest cases. */
export function resetTelegramAuthSession(): void {
  telegramAuthInFlight = null;
  cachedTelegramAuth = null;
}

export async function linkTelegramAccount(initData: string, accessToken: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/link-telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ init_data: initData }),
  });
  const body = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) {
    throw new Error(typeof body.detail === 'string' ? body.detail : `Link failed (${response.status}).`);
  }
}
