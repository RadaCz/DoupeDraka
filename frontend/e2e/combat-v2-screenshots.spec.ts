import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { startCellarCombat } from './chapter-one-e2e-helpers.ts';
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

const WIDTHS = [320, 375, 430] as const;

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`AC16 screenshot combat UI ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(ARTIFACTS, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.classIdentity + 900 + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 700 });
    await mockTelegramWebApp(page, initData);
    const token = await apiTelegramToken(request, initData);

    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `Combat V2 ${width}`,
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
    await expect(page.getByRole('button', { name: /^Attack$|^Útok$/i })).toBeVisible();

    const outfile = `${ARTIFACTS}/combat-v2-${width}px.png`;
    await combat.screenshot({ path: outfile });
    await testInfo.attach(`combat-v2-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}