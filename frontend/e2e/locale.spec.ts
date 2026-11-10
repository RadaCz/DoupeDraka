import { expect, test } from '@playwright/test';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test('switches to Czech UI and patches narration language', async ({ page }, testInfo) => {
  const telegramId = 720_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  const settingsPatches: Array<Record<string, unknown>> = [];
  page.on('request', request => {
    if (request.url().includes('/settings') && request.method() === 'PATCH') {
      settingsPatches.push(request.postDataJSON() as Record<string, unknown>);
    }
  });

  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /adventure awaits/i })).toBeVisible({ timeout: 20_000 });
  await completeWizardFighter(page, 'Locale E2E');

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /Settings/i }).click();
  await page.getByLabel('Language').selectOption('cs');

  await expect(page.getByRole('heading', { name: /Nastavení/i })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => settingsPatches.some(patch => patch.language === 'cs')).toBeTruthy();

  const nav = page.getByRole('navigation', { name: /Hlavní navigace|Main navigation/i });
  await expect(nav.getByRole('button', { name: /Přehled|Hub/i })).toBeVisible();
  await nav.getByRole('button', { name: /Hra|Play/i }).click();
  await expect(page.getByRole('heading', { name: /Šeptající sklep|The Whispering Cellar/i })).toBeVisible();
});
