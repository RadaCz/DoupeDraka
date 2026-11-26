import { expect, test } from '@playwright/test';
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
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/pr-screenshots/text-batch-1');

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

for (const width of [320, 375, 430] as const) {
  test(`text batch 1 character sheet and inventory ${width}px`, async ({ page, request }) => {
    test.skip(!process.env.SAVE_PR_SCREENSHOTS, 'set SAVE_PR_SCREENSHOTS=1');
    test.setTimeout(120_000);
    mkdirSync(OUT, { recursive: true });
    const telegramId = 769_100_000 + width;
    const initData = signedTelegramInitData(telegramId);
    const token = await apiTelegramToken(request, initData);
    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `Text ${width}`,
        race: 'human',
        character_class: 'fighter',
        background: 'folk_hero',
        abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
        language: 'cs',
      },
    });
    expect(response.ok()).toBeTruthy();
    const fighter = await response.json() as { id: string };

    await page.setViewportSize({ width, height: 812 });
    await mockTelegramWebApp(page, initData);
    await page.addInitScript(() => {
      try { localStorage.setItem('app_locale', 'cs'); } catch { /* ignore */ }
    });
    await page.goto('/');
    await page.evaluate(id => localStorage.setItem('active_character_id', id), fighter.id);
    await page.reload();
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });

    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
    await expect(page.getByRole('heading', { name: `Text ${width}` })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Akrobacie|Přežití|Zacházení se zvířaty|Atletika/).first()).toBeVisible();

    const sheet = page.locator('.character-screen.character-v2');
    await prepareFullSheetCapture(page, width);
    await sheet.screenshot({ path: `${OUT}/character-sheet-full-${width}px.png` });

    const inventory = page.locator('section[aria-labelledby="char-inventory-heading"]');
    await inventory.scrollIntoViewIfNeeded();
    await inventory.screenshot({ path: `${OUT}/character-inventory-${width}px.png` });
  });
}