import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  apiTelegramToken,
} from './telegram.ts';

const API = 'http://127.0.0.1:8001';
const ARTIFACTS = '/opt/cursor/artifacts';

test('AC18-1 character sheet 375px', async ({ page, request }) => {
  test.setTimeout(120_000);
  mkdirSync(ARTIFACTS, { recursive: true });
  const telegramId = 766_375_000;
  const initData = signedTelegramInitData(telegramId);
  await page.setViewportSize({ width: 375, height: 812 });
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
      name: 'AC18 Sheet',
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      language: 'cs',
    },
  });
  expect(response.ok()).toBeTruthy();
  const fighter = await response.json() as { id: string };

  await page.goto('/');
  await page.evaluate(id => {
    localStorage.setItem('active_character_id', id);
  }, fighter.id);
  await page.reload();
  await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });

  const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
  await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
  await expect(page.getByRole('heading', { name: 'AC18 Sheet' })).toBeVisible({ timeout: 15_000 });

  const hint = page.locator('.char-v2-section-lead, .char-v2-spell-text').first();
  const fontSize = await hint.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(14);

  await page.screenshot({
    path: `${ARTIFACTS}/ac18-character-sheet-375px.png`,
    fullPage: true,
  });
});