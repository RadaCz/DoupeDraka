import { expect, test } from '@playwright/test';
import {
  completeWizardFighter,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForCharacterInventoryIdle,
} from './telegram.ts';

test('character inventory shows wielded weapon without redundant equip action', async ({ page }, testInfo) => {
  const telegramId = 730_000_000 + testInfo.workerIndex;
  await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /adventure awaits|Welcome back/i })).toBeVisible({ timeout: 20_000 });
  await completeWizardFighter(page, 'Gear Tester');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
  await expect(page.getByRole('heading', { name: 'Gear Tester' })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.char-v2-equipped-card').first()).toContainText(/shortsword/i);

  const acVital = page.locator('.char-v2-vital').filter({ has: page.locator('small', { hasText: /^AC$/i }) }).locator('strong');
  await expect(acVital).toHaveText('18');
  await page.getByRole('button', { name: /shield/i }).first().click();
  await page.getByRole('button', { name: /^Unequip shield$/i }).click();
  await waitForCharacterInventoryIdle(page);
  await expect(acVital).toHaveText('16', { timeout: 20_000 });

  await page.getByRole('button', { name: /Shortsword: shortsword/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('This weapon is currently wielded.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Equip$/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Adventure$/i }).click();
  await expect(page.getByRole('heading', { name: /Whispering|Šeptající/i })).toBeVisible({ timeout: 20_000 });
});
