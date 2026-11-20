import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  apiTelegramToken,
} from './telegram.ts';

const API = 'http://127.0.0.1:8001';
const OUT = '/agent/repos/DoupeDraka/docs/pr-screenshots/18-1';

test('baseline character sheet 375px (db01a21)', async ({ page, request }) => {
  test.skip(!process.env.SAVE_PR_SCREENSHOTS, 'set SAVE_PR_SCREENSHOTS=1');
  mkdirSync(OUT, { recursive: true });
  const initData = signedTelegramInitData(768_000_375);
  const token = await apiTelegramToken(request, initData);
  const response = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'Before AC18',
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      language: 'cs',
    },
  });
  expect(response.ok()).toBeTruthy();
  const fighter = await response.json() as { id: string };
  await page.setViewportSize({ width: 375, height: 812 });
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
  await expect(page.getByRole('heading', { name: 'Before AC18' })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({
    path: resolve(OUT, 'before-character-375.png'),
    fullPage: true,
  });
});