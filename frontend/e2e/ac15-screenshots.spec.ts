import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  completeWizardFighter,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForAdventureComposerReady,
} from './telegram.ts';

const ARTIFACTS = '/opt/cursor/artifacts';
const WIDTHS = [320, 430] as const;

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`AC15 first-session UI ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
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
    await page.goto('/');
    await completeWizardFighter(page, `AC15 ${width}`);

    await expect(page.getByText(/Kde jsi a co chceš/i)).toBeVisible({ timeout: 20_000 });
    await waitForAdventureComposerReady(page);
    await page.screenshot({
      path: `${ARTIFACTS}/ac15-play-scene-${width}px.png`,
      fullPage: true,
    });

    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    await nav.getByRole('button', { name: /^Home$|^Overview$|^Přehled$/i }).click();
    await expect(page.getByText(/Pokračuj tam, kde jsi skončil/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: `${ARTIFACTS}/ac15-home-resume-${width}px.png`,
      fullPage: true,
    });
  });
}