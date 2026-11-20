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
  test(`AC16-3 battlefield track ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(ARTIFACTS, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.classIdentity + 3100 + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 740 });
    await mockTelegramWebApp(page, initData);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('app_locale', 'cs');
      } catch { /* ignore */ }
    });
    const token = await apiTelegramToken(request, initData);

    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `PR3 track ${width}`,
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

    const battlefield = page.locator('.combat-battlefield');
    await expect(battlefield).toBeVisible({ timeout: 30_000 });
    const outfile = `${ARTIFACTS}/combat-pr3-track-${width}px.png`;
    await page.locator('.combat-screen.combat-v2').screenshot({ path: outfile });
    await testInfo.attach(`combat-pr3-track-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}

test('AC16-3 victory overlay 320px', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  mkdirSync(ARTIFACTS, { recursive: true });
  const telegramId = E2E_TELEGRAM_ID.classIdentity + 3202;
  const initData = signedTelegramInitData(telegramId);
  await page.setViewportSize({ width: 320, height: 740 });
  await mockTelegramWebApp(page, initData);
  await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
  const token = await apiTelegramToken(request, initData);
  const response = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'PR3 victory',
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 18, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 12, charisma: 8 },
    },
  });
  const fighter = await response.json() as { id: string };
  await startCellarCombat(request, token, fighter.id, 'goblin scout');
  await page.goto('/');
  await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
  await waitForGameScreenIdle(page);
  const deck = page.getByRole('group', { name: /combat actions|bojové akce/i });
  await deck.getByRole('button', { name: /^Attack\b|^Útok\b/i }).click();
  await page.waitForResponse(r => r.url().includes('/actions/stream') && r.status() === 200, { timeout: 90_000 });
  const overlay = page.locator('.victory-moment-card');
  await expect(overlay).toBeVisible({ timeout: 45_000 });
  const outfile = `${ARTIFACTS}/combat-pr3-victory-320px.png`;
  await page.locator('.turn-moment-overlay').screenshot({ path: outfile });
  await testInfo.attach('combat-pr3-victory-320px', { path: outfile, contentType: 'image/png' });
});
