import { createHmac } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { E2E_BOT_TOKEN } from './test-config.ts';

const E2E_API_BASE = 'http://127.0.0.1:8001';

/** Bilingual patterns — E2E shares one browser context; `locale.spec` can leave `app_locale=cs`. */
export const HOME_HEADING = /adventure awaits|dobrodružství čeká|welcome back|vítej zpět/i;
export const CREATE_CHARACTER_BTN = /create your character|vytvořit postavu/i;
export const BUILD_YOUR_OWN_BTN = /build your own|vytvořit vlastní/i;
export const STEP_BY_STEP_WIZARD_BTN = /step-by-step wizard|průvodce krok za krokem/i;
export const WIZARD_CONTINUE_BTN = /^Continue$|^Pokračovat$/i;
export const ENTER_ADVENTURE_BTN = /enter the adventure|vstoupit do dobrodružství|vstoupit/i;
export const MEET_ADVENTURER_HEADING = /meet your adventurer|tvůj hrdina|poznej svého dobrodruha/i;
export const CELLAR_HEADING = /whispering cellar|šeptající sklep/i;
export const MAIN_NAV = /main navigation|hlavní navigace/i;
export const ACTION_TEXTBOX = /your action|tvoje akce/i;
export const SEND_ACTION_BTN = /send action|odeslat akci/i;
export const SENDING_ACTION_STATUS = /sending your action|odesílám tvoji akci/i;

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

function homeDiagnostics(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1')?.textContent?.trim() ?? '(no h1)';
    const buttons = [...document.querySelectorAll('button')]
      .map(btn => btn.textContent?.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 24);
    const alert = document.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
    const loading = Boolean(document.querySelector('.loading-screen'));
    return { heading, buttons, alert, loading, locale: localStorage.getItem('app_locale') };
  });
}

export async function mockTelegramWebApp(page: Page, initData: string) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('app_locale', 'en');
      localStorage.removeItem('active_character_id');
      localStorage.removeItem('api_token');
    } catch {
      /* storage may be blocked in about:blank */
    }
  });

  const userJson = new URLSearchParams(initData).get('user') ?? '{}';
  const user = JSON.parse(userJson) as { id: number; first_name: string; language_code: string };

  await page.route('https://telegram.org/js/telegram-web-app.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.Telegram = { WebApp: {
      initData: ${JSON.stringify(initData)},
      initDataUnsafe: { user: ${JSON.stringify(user)} },
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
  const blockingAlert = page.getByRole('alert').filter({
    hasText: /could not sign|nepodařilo se přihlásit|open this app from telegram|otevři tuto aplikaci|conflicted|retry sign-in/i,
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await blockingAlert.isVisible().catch(() => false)) {
      const text = await blockingAlert.textContent();
      throw new Error(`Telegram home blocked by alert: ${text ?? 'unknown'}`);
    }

    const loadingScreen = page.locator('.loading-screen');
    if (await loadingScreen.isVisible().catch(() => false)) {
      await loadingScreen.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
    }

    const homeHeading = page.getByRole('heading', { name: HOME_HEADING });
    if (await homeHeading.isVisible().catch(() => false)) {
      await expect(homeHeading).toBeVisible();
      return;
    }

    const conflict = page.getByRole('alert').filter({ hasText: /conflicted|retry sign-in/i });
    if (await conflict.isVisible().catch(() => false)) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      continue;
    }

    try {
      await homeHeading.waitFor({ state: 'visible', timeout: 12_000 });
      return;
    } catch {
      if (attempt === 3) {
        const diag = await homeDiagnostics(page);
        throw new Error(
          `Telegram sign-in did not reach home. attempt=${attempt + 1} `
          + `heading=${diag.heading} loading=${diag.loading} locale=${diag.locale} `
          + `alert=${diag.alert || 'none'} buttons=${diag.buttons.join(' | ')}`,
        );
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
}

export async function openCharacterCreation(page: Page) {
  await ensureTelegramHome(page);

  const createPrimary = page.getByRole('button', { name: CREATE_CHARACTER_BTN });
  const buildOwn = page.getByRole('button', { name: BUILD_YOUR_OWN_BTN }).first();
  const continueAdventure = page.getByRole('button', { name: /continue adventure|pokračovat v dobrodružství/i });

  let entryKind = '';
  await expect.poll(async () => {
    if (await createPrimary.isVisible().catch(() => false)) {
      entryKind = 'primary';
      return true;
    }
    if (await buildOwn.isVisible().catch(() => false)) {
      entryKind = 'build';
      return true;
    }
    if (await continueAdventure.isVisible().catch(() => false)) {
      entryKind = 'returning';
      return true;
    }
    entryKind = '';
    return false;
  }, { timeout: 20_000 }).toBe(true);

  if (entryKind === 'returning') {
    const nav = page.getByRole('navigation', { name: MAIN_NAV });
    await nav.getByRole('button', { name: /^More$|^Více$/i }).click();
    const createAnother = page.getByRole('button', { name: /create another adventurer|vytvořit dalšího dobrodruha/i });
    await createAnother.scrollIntoViewIfNeeded();
    await createAnother.click();
    return;
  }

  const kind = await createPrimary.isVisible().catch(() => false) ? 'primary' : 'build';
  const target = kind === 'primary' ? createPrimary : buildOwn;
  await target.scrollIntoViewIfNeeded();
  await target.click();
}

export type WizardBuildOptions = {
  name: string;
  race?: string;
  characterClass?: string;
  background?: string;
  mode?: 'step' | 'quick';
};

async function wizardContinue(page: Page) {
  await page.getByRole('button', { name: WIZARD_CONTINUE_BTN }).click();
}

function wizardCard(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^${label}\\b`, 'i') });
}

export async function completeCharacterWizard(page: Page, options: WizardBuildOptions) {
  const race = options.race ?? 'Human';
  const characterClass = options.characterClass ?? 'Fighter';
  const background = options.background ?? 'Folk Hero';

  await openCharacterCreation(page);

  if (options.mode === 'quick') {
    await page.getByRole('button', { name: /quick generate|rychle generovat/i }).click();
    await page.getByLabel(/character name|jméno postavy/i).fill(options.name);
    await wizardContinue(page);
    await expect(page.getByRole('heading', { name: MEET_ADVENTURER_HEADING })).toBeVisible();
    await page.getByRole('button', { name: ENTER_ADVENTURE_BTN }).click();
    await page.getByRole('heading', { name: CELLAR_HEADING }).waitFor();
    return;
  }

  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
  await wizardCard(page, race).click();
  await wizardContinue(page);
  await wizardCard(page, characterClass).click();
  await wizardContinue(page);
  await wizardCard(page, background).click();
  await wizardContinue(page);
  await wizardContinue(page);
  await wizardContinue(page);
  await wizardContinue(page);
  await page.getByLabel(/character name|jméno postavy/i).fill(options.name);
  await wizardContinue(page);
  await expect(page.getByRole('heading', { name: MEET_ADVENTURER_HEADING })).toBeVisible();
  await page.getByRole('button', { name: ENTER_ADVENTURE_BTN }).click();
  await page.getByRole('heading', { name: CELLAR_HEADING }).waitFor();
}

export async function completeWizardWizardCaster(page: Page, name: string) {
  await openCharacterCreation(page);
  await page.getByRole('button', { name: STEP_BY_STEP_WIZARD_BTN }).click();
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
  await page.getByLabel(/character name|jméno postavy/i).fill(name);
  await wizardContinue(page);
  await expect(page.getByRole('heading', { name: MEET_ADVENTURER_HEADING })).toBeVisible();
  await page.getByRole('button', { name: ENTER_ADVENTURE_BTN }).click();
  await page.getByRole('heading', { name: CELLAR_HEADING }).waitFor();
}

/** Default fighter manual wizard — used by legacy chapter E2E specs. */
export async function completeWizardFighter(page: Page, name: string) {
  await completeCharacterWizard(page, { name, race: 'Human', characterClass: 'Fighter', background: 'Folk Hero' });
}

export async function waitForAdventureComposerReady(page: Page) {
  const input = page.getByRole('textbox', { name: ACTION_TEXTBOX });
  await expect(input).toBeEnabled({ timeout: 90_000 });
  const send = page.getByRole('button', { name: SEND_ACTION_BTN });
  await expect(send).not.toHaveAttribute('aria-busy', 'true');
}

/** After a streamed turn: composer accepts input again and send is not narrating. */
export async function waitForAdventureComposerIdle(page: Page) {
  const send = page.getByRole('button', { name: SEND_ACTION_BTN });
  await expect(send).not.toHaveAttribute('aria-busy', 'true', { timeout: 90_000 });
  await expect(page.getByRole('textbox', { name: ACTION_TEXTBOX })).toBeEnabled({ timeout: 90_000 });
}

export async function waitForGameScreenIdle(page: Page) {
  const screen = page.locator('section.game-screen, section.combat-screen');
  await expect(screen.first()).toBeVisible({ timeout: 30_000 });
  await expect(screen.first()).not.toHaveAttribute('aria-busy', 'true', { timeout: 120_000 });
}

export function playStreamResponse(page: Page) {
  return page.waitForResponse(
    response => response.url().includes('/actions/stream')
      && response.request().method() === 'POST'
      && response.status() === 200,
    { timeout: 120_000 },
  );
}

export async function waitForCharacterInventoryIdle(page: Page) {
  await expect(page.getByRole('status', { name: SENDING_ACTION_STATUS })).toBeHidden({ timeout: 60_000 });
}
