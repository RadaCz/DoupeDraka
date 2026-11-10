import { createHmac } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { E2E_BOT_TOKEN } from './test-config.ts';

const E2E_API_BASE = 'http://127.0.0.1:8001';

export function signedTelegramInitData(userId: number) {
  const fields = {
    auth_date: Math.floor(Date.now() / 1000).toString(),
    user: JSON.stringify({ id: userId, first_name: `E2E ${userId}`, language_code: 'en' }),
  };
  const checkString = Object.keys(fields)
    .sort()
    .map(key => `${key}=${fields[key as keyof typeof fields]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(E2E_BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

export async function apiTelegramToken(request: APIRequestContext, initData: string) {
  const response = await request.post(`${E2E_API_BASE}/auth/telegram`, {
    data: { init_data: initData },
  });
  await expect(response).toBeOK();
  const body = await response.json() as { access_token: string };
  return body.access_token;
}

export async function forceCharacterFallen(request: APIRequestContext, token: string, characterId: string) {
  const response = await request.post(`${E2E_API_BASE}/characters/${characterId}/__e2e/fallen`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await expect(response).toBeOK();
}

export async function mockTelegramWebApp(page: Page, initData: string) {
  await page.route('https://telegram.org/js/telegram-web-app.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.Telegram = { WebApp: {
      initData: ${JSON.stringify(initData)},
      ready() {},
      expand() {},
      contentSafeAreaInset: { top: 0, bottom: 20 },
      safeAreaInset: { top: 0, bottom: 0 },
      themeParams: { bg_color: '#0d120e', text_color: '#edf1e5' },
      BackButton: {
        show() {},
        hide() {},
        onClick() {},
        offClick() {},
      },
      MainButton: {
        setText() {},
        show() {},
        hide() {},
        enable() {},
        onClick() {},
        offClick() {},
      },
    } };`,
  }));
}

export async function ensureTelegramHome(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const home = page.getByRole('heading', { name: /adventure awaits|Welcome back/i });
    if (await home.isVisible().catch(() => false)) return;
    const conflict = page.getByRole('alert').filter({ hasText: /conflicted|retry sign-in/i });
    if (await conflict.isVisible().catch(() => false)) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      continue;
    }
    await home.waitFor({ state: 'visible', timeout: 15_000 });
    return;
  }
  throw new Error('Telegram sign-in did not reach the home screen');
}

export async function completeWizardFighter(page: Page, name: string) {
  await ensureTelegramHome(page);
  await page.getByRole('button', { name: /create your character/i }).click();
  await page.getByRole('button', { name: 'Step-by-step wizard' }).click();
  await page.getByRole('button', { name: 'Human' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Fighter' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Character name').fill(name);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the adventure' }).click();
  await page.getByRole('heading', { name: 'The Whispering Cellar' }).waitFor();
}
