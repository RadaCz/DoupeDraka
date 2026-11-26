import { expect, test, type APIRequestContext } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  apiTelegramToken,
} from './telegram.ts';

const API = 'http://127.0.0.1:8001';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/pr-screenshots/18-1');

/** Hide fixed chrome and grow the viewport so element screenshots include full sheet content. */
async function prepareFullSheetCapture(page: import('@playwright/test').Page, width: number) {
  const metrics = await page.evaluate(() => {
    const sheet = document.querySelector('.character-screen.character-v2') as HTMLElement | null;
    const main = document.querySelector('.main-content') as HTMLElement | null;
    const nav = document.querySelector('.bottom-nav') as HTMLElement | null;
    if (nav) nav.style.display = 'none';
    if (main) {
      main.style.overflow = 'visible';
      main.style.height = 'auto';
      main.style.maxHeight = 'none';
      main.style.minHeight = `${main.scrollHeight}px`;
      main.scrollTop = 0;
    }
    document.body.style.paddingBottom = '0';
    return {
      sheetHeight: sheet?.scrollHeight ?? 900,
      mainScroll: main?.scrollHeight ?? 900,
    };
  });
  const viewportHeight = Math.min(
    Math.max(metrics.sheetHeight + 48, metrics.mainScroll + 24, 900),
    8000,
  );
  await page.setViewportSize({ width, height: viewportHeight });
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function seedHero(request: APIRequestContext, telegramId: number, name: string) {
  const initData = signedTelegramInitData(telegramId);
  const token = await apiTelegramToken(request, initData);
  const response = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name,
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      language: 'cs',
    },
  });
  expect(response.ok()).toBeTruthy();
  const fighter = await response.json() as { id: string };
  return { initData, fighterId: fighter.id };
}

test.describe.configure({ mode: 'serial' });

for (const width of [320, 375, 430] as const) {
  test(`PR screenshot after character ${width}px`, async ({ page, request }) => {
    test.skip(!process.env.SAVE_PR_SCREENSHOTS, 'set SAVE_PR_SCREENSHOTS=1');
    mkdirSync(OUT, { recursive: true });
    const telegramId = 768_100_000 + width;
    const { initData, fighterId } = await seedHero(request, telegramId, `AC18 ${width}`);
    await page.setViewportSize({ width, height: 812 });
    await mockTelegramWebApp(page, initData);
    await page.addInitScript(() => {
      try { localStorage.setItem('app_locale', 'cs'); } catch { /* ignore */ }
    });
    await page.route(`**/characters/${fighterId}`, async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, level: 2, xp: 40 },
      });
    });
    await page.goto('/');
    await page.evaluate(id => localStorage.setItem('active_character_id', id), fighterId);
    await page.reload();
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
    await expect(page.getByRole('heading', { name: `AC18 ${width}` })).toBeVisible({ timeout: 15_000 });
    await page.locator('.char-v2-vitals-primary').screenshot({
      path: `${OUT}/after-vitals-${width}px.png`,
    });
    const sheet = page.locator('.character-screen.character-v2');
    await prepareFullSheetCapture(page, width);
    await sheet.screenshot({ path: `${OUT}/after-character-${width}px.png` });
  });
}

test('PR screenshot after character 375px at level cap', async ({ page, request }) => {
  test.skip(!process.env.SAVE_PR_SCREENSHOTS, 'set SAVE_PR_SCREENSHOTS=1');
  mkdirSync(OUT, { recursive: true });
  const width = 375;
  const telegramId = 768_200_375;
  const { initData, fighterId } = await seedHero(request, telegramId, 'AC18 cap');
  await page.setViewportSize({ width, height: 900 });
  await mockTelegramWebApp(page, initData);
  await page.addInitScript(() => {
    try { localStorage.setItem('app_locale', 'cs'); } catch { /* ignore */ }
  });
  const capPatch = (body: Record<string, unknown>) => ({ ...body, level: 3, xp: 99 });
  await page.route('**/characters**', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const url = route.request().url();
    if (!url.includes('/characters')) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    if (Array.isArray(body)) {
      await route.fulfill({
        response,
        json: body.map(row => (row.id === fighterId ? capPatch(row) : row)),
      });
      return;
    }
    if (body && typeof body === 'object' && body.id === fighterId) {
      await route.fulfill({ response, json: capPatch(body) });
      return;
    }
    await route.continue();
  });
  await page.goto('/');
  await page.evaluate(id => localStorage.setItem('active_character_id', id), fighterId);
  await page.reload();
  await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
  const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
  await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
  await expect(page.getByTestId('level-cap-note')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.char-v2-vitals-primary')).toContainText('99');
  await expect(page.locator('.char-v2-vitals-primary')).not.toContainText('/ 100');
  await page.locator('.char-v2-vitals-primary').screenshot({
    path: `${OUT}/after-vitals-375-cap.png`,
  });
  await nav.getByRole('button', { name: /^Home$|^Overview$|^Přehled$/i }).click();
  await expect(page.getByText(/Pokračuj tam, kde jsi skončil/i)).toBeVisible();
  await page.locator('.hero-card-footer').screenshot({
    path: `${OUT}/after-home-375-cap.png`,
  });
  await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
  await expect(page.getByTestId('level-cap-note')).toBeVisible({ timeout: 20_000 });
  const sheet = page.locator('.character-screen.character-v2');
  await prepareFullSheetCapture(page, width);
  await sheet.screenshot({ path: `${OUT}/after-character-375-cap.png` });
});