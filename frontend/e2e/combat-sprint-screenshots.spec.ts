import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/pr-screenshots/combat-sprint');

const WIDTHS = [320, 360, 375, 390, 430] as const;

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`combat sprint panel ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.classIdentity + 10_000 + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, initData);
    const token = await apiTelegramToken(request, initData);

    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `Sprint UI ${width}`,
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
    const sprintBtn = page.getByRole('button', { name: /^Sprint$/i });
    await expect(sprintBtn).toBeVisible({ timeout: 15_000 });
    await expect(sprintBtn).toBeEnabled();

    const outfile = `${OUT}/combat-sprint-tactics-${width}px.png`;
    await combat.screenshot({ path: outfile });
    await testInfo.attach(`combat-sprint-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}