import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForAdventureComposerReady,
  apiTelegramToken,
} from './telegram.ts';

const API = 'http://127.0.0.1:8001';
const ARTIFACTS = '/opt/cursor/artifacts';
const WIDTHS = [320, 430] as const;

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`AC15 first-session UI ${width}px`, async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync(ARTIFACTS, { recursive: true });
    const telegramId = 765_000_000 + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 800 });
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
        name: `AC15 ${width}`,
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
    await page.getByRole('button', { name: /Continue adventure|Pokračovat v dobrodružství/i }).click();

    await expect(page.getByText(/Kde jsi a co chceš/i)).toBeVisible({ timeout: 20_000 });
    await waitForAdventureComposerReady(page);
    await page.screenshot({
      path: `${ARTIFACTS}/ac15-play-scene-${width}px.png`,
      fullPage: true,
    });

    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    const homeTab = nav.getByRole('button', { name: /^Home$|^Overview$|^Přehled$/i });
    await homeTab.scrollIntoViewIfNeeded();
    await homeTab.click();
    await expect(page.getByText(/Pokračuj tam, kde jsi skončil/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: `${ARTIFACTS}/ac15-home-resume-${width}px.png`,
      fullPage: true,
    });
  });
}