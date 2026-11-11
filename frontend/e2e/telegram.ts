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
      contentSafeAreaInset: { top: 44, bottom: 20 },
      safeAreaInset: { top: 47, bottom: 0 },
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

export type WizardBuildOptions = {
  name: string;
  race?: string;
  characterClass?: string;
  background?: string;
  mode?: 'step' | 'quick';
};

async function wizardContinue(page: Page) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

function wizardCard(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^${label}\\b`, 'i') });
}

export async function completeCharacterWizard(page: Page, options: WizardBuildOptions) {
  const race = options.race ?? 'Human';
  const characterClass = options.characterClass ?? 'Fighter';
  const background = options.background ?? 'Folk Hero';

  await ensureTelegramHome(page);
  await page.getByRole('button', { name: /create your character/i }).click();

  if (options.mode === 'quick') {
    await page.getByRole('button', { name: /Quick generate/i }).click();
    await page.getByLabel('Character name').fill(options.name);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Meet your adventurer/i })).toBeVisible();
    await page.getByRole('button', { name: 'Enter the adventure' }).click();
    await page.getByRole('heading', { name: 'The Whispering Cellar' }).waitFor();
    return;
  }

  await page.getByRole('button', { name: 'Step-by-step wizard' }).click();
  await wizardCard(page, race).click();
  await wizardContinue(page);
  await wizardCard(page, characterClass).click();
  await wizardContinue(page);
  await wizardCard(page, background).click();
  await wizardContinue(page);
  // Abilities: class defaults already assigned in UI
  await wizardContinue(page);
  // Skills: defaults from background/class
  await wizardContinue(page);
  // Gear
  await wizardContinue(page);
  // Spells step skipped for non-casters
  await page.getByLabel('Character name').fill(options.name);
  await wizardContinue(page);
  await expect(page.getByRole('heading', { name: /Meet your adventurer/i })).toBeVisible();
  await page.getByRole('button', { name: 'Enter the adventure' }).click();
  await page.getByRole('heading', { name: 'The Whispering Cellar' }).waitFor();
}

export async function completeWizardWizardCaster(page: Page, name: string) {
  await ensureTelegramHome(page);
  await page.getByRole('button', { name: /create your character/i }).click();
  await page.getByRole('button', { name: 'Step-by-step wizard' }).click();
  await wizardCard(page, 'Elf').click();
  await wizardContinue(page);
  await wizardCard(page, 'Wizard').click();
  await wizardContinue(page);
  await wizardCard(page, 'Sage').click();
  await wizardContinue(page);
  await wizardContinue(page);
  await wizardContinue(page);
  await wizardContinue(page);
  await wizardContinue(page);
  await page.getByLabel('Character name').fill(name);
  await wizardContinue(page);
  await expect(page.getByRole('heading', { name: /Meet your adventurer/i })).toBeVisible();
  await page.getByRole('button', { name: 'Enter the adventure' }).click();
  await page.getByRole('heading', { name: 'The Whispering Cellar' }).waitFor();
}

/** Default fighter manual wizard — used by legacy chapter E2E specs. */
export async function completeWizardFighter(page: Page, name: string) {
  await completeCharacterWizard(page, { name, race: 'Human', characterClass: 'Fighter', background: 'Folk Hero' });
}
