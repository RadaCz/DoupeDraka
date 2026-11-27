import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const WIDTHS = [320, 360, 375, 390, 430] as const;
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SCREENSHOT_DIR = join(REPO_ROOT, 'docs/pr-screenshots/combat-paralyzed');

const CONTINUE_BTN = /^Continue$|^Pokračovat$/i;
const COMBAT_ACTIONS = /combat actions|bojové akce/i;

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`paralyzed combat UI ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.classIdentity + 4100 + width;
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
        name: `Paralyzed UI ${width}`,
        race: 'human',
        character_class: 'fighter',
        abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      },
    });
    expect(response.ok()).toBeTruthy();
    const fighter = await response.json() as { id: string };

    await startCellarCombat(request, token, fighter.id, 'goblin scout');

    await page.route(`**/characters/${fighter.id}`, async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const upstream = await route.fetch();
      const body = await upstream.json() as Record<string, unknown>;
      body.conditions = [{
        condition_id: 'paralyzed',
        source_id: 'ghoul',
        repeat_save_ability: 'constitution',
        repeat_save_dc: 10,
      }];
      body.combat_turn = 'player';
      body.in_combat = true;
      await route.fulfill({
        status: upstream.status(),
        headers: upstream.headers(),
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
    await waitForGameScreenIdle(page);
    await syncPlayScreen(page);

    const deck = page.getByRole('group', { name: COMBAT_ACTIONS });
    await expect(deck).toBeVisible({ timeout: 30_000 });
    await expect(deck.getByText(/Tento tah nemůžeš jednat/i)).toBeVisible();
    await expect(deck.getByRole('button', { name: CONTINUE_BTN })).toBeVisible();
    await expect(deck.getByRole('button', { name: /^Útok\b|^Attack\b/i })).toHaveCount(0);

    const outfile = join(SCREENSHOT_DIR, `combat-paralyzed-${width}px.png`);
    await page.locator('.combat-screen.combat-v2').screenshot({ path: outfile });
    await testInfo.attach(`combat-paralyzed-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}

test('paralyzed Continue sends end turn', async ({ page, request }) => {
  test.setTimeout(120_000);
  const telegramId = E2E_TELEGRAM_ID.classIdentity + 4199;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.addInitScript(() => localStorage.setItem('app_locale', 'cs'));
  const token = await apiTelegramToken(request, initData);

  const response = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'Paralyzed end turn',
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    },
  });
  const fighter = await response.json() as { id: string };
  await startCellarCombat(request, token, fighter.id, 'goblin scout');

  let lastAction = '';
  await page.route(`**/characters/${fighter.id}/actions/stream`, async route => {
    const payload = route.request().postDataJSON() as { action?: string };
    lastAction = payload.action ?? '';
    await route.continue();
  });

  await page.route(`**/characters/${fighter.id}`, async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const upstream = await route.fetch();
    const body = await upstream.json() as Record<string, unknown>;
    body.conditions = [{ condition_id: 'paralyzed', source_id: 'ghoul' }];
    body.combat_turn = 'player';
    body.in_combat = true;
    await route.fulfill({
      status: upstream.status(),
      headers: upstream.headers(),
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /pokračovat v dobrodružství|continue adventure/i }).click();
  await waitForGameScreenIdle(page);
  await syncPlayScreen(page);

  const deck = page.getByRole('group', { name: COMBAT_ACTIONS });
  await deck.getByRole('button', { name: CONTINUE_BTN }).click();
  await waitForGameScreenIdle(page);
  expect(lastAction.trim().toLowerCase()).toBe('end turn');
});