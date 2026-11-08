import { expect, test } from '@playwright/test';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test.describe('visual baseline (optional QA)', () => {
  test('hub and wizard layout', async ({ page }, testInfo) => {
    const telegramId = 710_000_000 + testInfo.workerIndex;
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /adventure awaits/i })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: testInfo.outputPath('hub.png'), fullPage: true });

    await page.getByRole('button', { name: /create your character/i }).click();
    await expect(page.getByRole('heading', { name: /how do you want to begin/i })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('wizard-path.png'), fullPage: true });

    await page.getByRole('button', { name: /step-by-step wizard/i }).click();
    await page.getByRole('button', { name: 'Human' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Fighter' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Character name').fill('Visual QA');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: /enter the adventure/i }).click();
    await expect(page.getByRole('textbox', { name: 'Your action' })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: testInfo.outputPath('adventure.png'), fullPage: true });
  });
});
