import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForGameScreenIdle,
} from './telegram.ts';
import { apiTelegramToken } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCREENSHOT_DIR = join(REPO_ROOT, 'docs', 'pr-screenshots', 'playtest-4');
const WIDTHS = [320, 375, 430] as const;

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`playtest 4 — action retry error UI ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.idempotencyRetry + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 760 });
    await mockTelegramWebApp(page, initData);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('app_locale', 'cs');
      } catch {
        /* ignore */
      }
    });

    const seenKeys: string[] = [];
    let streamPosts = 0;
    await page.route('**/actions/stream', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      streamPosts += 1;
      const key = route.request().headers()['idempotency-key'];
      if (key) seenKeys.push(key);
      if (streamPosts === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Database unavailable' }),
        });
        return;
      }
      await route.continue();
    });

    const token = await apiTelegramToken(request, initData);
    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `Retry UI ${width}`,
        race: 'human',
        character_class: 'fighter',
        abilities: { strength: 14, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      },
    });
    expect(response.ok()).toBeTruthy();
    const hero = await response.json() as { id: string };

    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
    await waitForGameScreenIdle(page);

    const composer = page.getByRole('textbox', { name: /your action|tvoje akce/i });
    await composer.fill('prozkoumat sklep');
    await page.getByRole('button', { name: /send action|odeslat akci/i }).click();

    await expect(page.getByText('Poslední akce se možná nedokončila. Zkus to znovu – nic se nezapočítá dvakrát.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Zkusit znovu' }).first()).toBeVisible();
    await expect(page.getByText(/stejným klíčem|idempotenc/i)).toHaveCount(0);

    const panel = page.locator('.game-play-journal .pending-turn-recovery');
      await expect(panel).toBeVisible();
    const outfile = join(SCREENSHOT_DIR, `action-retry-error-${width}px.png`);
    await panel.screenshot({ path: outfile });
    await testInfo.attach(`action-retry-error-${width}px`, { path: outfile, contentType: 'image/png' });

    if (width === 375) {
      await page.getByRole('button', { name: 'Zkusit znovu' }).first().click();
      await expect.poll(() => seenKeys.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
      expect(seenKeys[0]).toBe(seenKeys[1]);
    }
  });
}