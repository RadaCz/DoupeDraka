import { expect, test } from '@playwright/test';
import {
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  apiTelegramToken,
} from './telegram.ts';
import { installMvpRulesetReferenceMock } from './ac18-reference-mock.ts';

const API = 'http://127.0.0.1:8001';
const LEVEL_CAP_NOTE = 'V 1. kapitole je nejvyšší 3. úroveň.';

test('AC18-1 level cap shows Czech chapter lock sentence', async ({ page, request }) => {
  const telegramId = 768_300_001;
  const initData = signedTelegramInitData(telegramId);
  const token = await apiTelegramToken(request, initData);
  const response = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'AC18 cap UI',
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      language: 'cs',
    },
  });
  expect(response.ok()).toBeTruthy();
  const fighter = await response.json() as { id: string };

  await page.setViewportSize({ width: 375, height: 900 });
  await mockTelegramWebApp(page, initData);
  await installMvpRulesetReferenceMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('app_locale', 'cs'); } catch { /* ignore */ }
  });

  const capPatch = (body: Record<string, unknown>) => ({ ...body, level: 3, xp: 200 });
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
        json: body.map(row => (row.id === fighter.id ? capPatch(row) : row)),
      });
      return;
    }
    if (body && typeof body === 'object' && body.id === fighter.id) {
      await route.fulfill({ response, json: capPatch(body) });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await page.evaluate(id => localStorage.setItem('active_character_id', id), fighter.id);
  await page.reload();
  await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });

  const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
  await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
  const capNote = page.getByTestId('level-cap-note');
  await expect(capNote).toHaveText(LEVEL_CAP_NOTE, { timeout: 20_000 });
  await expect(page.locator('.char-v2-vitals-primary')).toContainText('200');
  await expect(page.locator('.char-v2-vitals-primary')).not.toContainText('/ 100');
  await expect(page.locator('.char-v2-xp-track')).toHaveCount(0);
  await capNote.scrollIntoViewIfNeeded();
  await expect(capNote).toBeVisible();
});