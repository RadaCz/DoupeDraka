import { expect, test } from '@playwright/test';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test('equips a weapon from the character inventory and reflects in play', async ({ page }, testInfo) => {
  const telegramId = 730_000_000 + testInfo.workerIndex;
  await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /adventure awaits|Welcome back/i })).toBeVisible({ timeout: 20_000 });
  await completeWizardFighter(page, 'Gear Tester');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
  await page.getByRole('tab', { name: /Character sheet/i }).click();
  await page.getByRole('button', { name: /Shortsword/i }).click();
  await page.getByRole('button', { name: /^Equip$/i }).click();
  await expect(page.getByRole('heading', { name: 'The Whispering Cellar' })).toBeVisible({ timeout: 20_000 });
  const journal = page.getByRole('log', { name: 'Adventure journal' });
  await expect(journal.locator('.journal-action')).toContainText(/equip/i);
});
