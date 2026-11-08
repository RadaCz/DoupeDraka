import { expect, test } from '@playwright/test';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test.describe('visual baseline (optional QA)', () => {
  test('hub and wizard layout', async ({ page }, testInfo) => {
    const telegramId = 710_000_000 + testInfo.workerIndex;
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'An adventure awaits.' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('hub.png'), fullPage: true });

    await page.getByRole('button', { name: 'Create your character' }).click();
    await expect(page.getByRole('heading', { name: 'How do you want to begin?' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('wizard-path.png'), fullPage: true });

    await completeWizardFighter(page, 'Visual QA');
    await expect(page.getByRole('textbox', { name: 'Your action' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('adventure.png'), fullPage: true });
  });
});
