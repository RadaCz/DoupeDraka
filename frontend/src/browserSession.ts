const SESSION_KEY = 'dd_browser_session_token';

export function readBrowserSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeBrowserSessionToken(token: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
  }
}

export function clearBrowserSessionToken(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
  }
}

export async function loginWithPassword(username: string, password: string): Promise<string> {
  const api = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; detail?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Sign-in failed.');
  }
  return body.access_token;
}

export async function registerBrowserAccount(username: string, password: string): Promise<string> {
  const api = import.meta.env.VITE_API_URL || '/api';
  const created = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!created.ok) {
    const body = (await created.json().catch(() => ({}))) as { detail?: string };
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Registration failed.');
  }
  return loginWithPassword(username, password);
}
