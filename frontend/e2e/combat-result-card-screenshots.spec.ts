import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { startCellarCombat, syncPlayScreen } from './chapter-one-e2e-helpers.ts';
import {
  apiTelegramToken,
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForGameScreenIdle,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';
const ARTIFACTS = '/opt/cursor/artifacts';

const WIDTHS = [320, 430] as const;

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`SPEC-16 result card screenshot ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(ARTIFACTS, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.classIdentity + 1600 + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 740 });
    await mockTelegramWebApp(page, initData);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('app_locale', 'cs');
      } catch {
        /* ignore */
      }
    });
    const token = await apiTelegramToken(request, initData);

    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `Chip texts ${width}`,
        race: 'human',
        character_class: 'fighter',
        abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      },
    });
    expect(response.ok()).toBeTruthy();
    const fighter = await response.json() as { id: string };

    await startCellarCombat(request, token, fighter.id, 'goblin scout');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
    await waitForGameScreenIdle(page);

    const combat = page.locator('.combat-screen.combat-v2');
    await expect(combat).toBeVisible({ timeout: 30_000 });
    const deck = page.getByRole('group', { name: /combat actions|bojové akce/i });
    const defendBtn = deck.getByRole('button', { name: /^Defend\b|^Obrana\b|^Bránit se\b/i });
    await expect(defendBtn).toBeEnabled({ timeout: 15_000 });
    const streamDone = page.waitForResponse(
      response => response.url().includes('/actions/stream')
        && response.request().method() === 'POST'
        && response.status() === 200,
      { timeout: 60_000 },
    );
    await defendBtn.click();
    await streamDone;
    await syncPlayScreen(page);
    await expect(combat).toBeVisible({ timeout: 15_000 });

    const resultCard = page.locator('.combat-result-card.combat-moment');
    await expect(resultCard).toBeVisible({ timeout: 45_000 });
    await expect(resultCard.locator('.combat-result-chip').first()).toBeVisible({ timeout: 45_000 });

    const outfile = `${ARTIFACTS}/combat-result-card-${width}px.png`;
    await resultCard.screenshot({ path: outfile });
    await testInfo.attach(`combat-result-card-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}