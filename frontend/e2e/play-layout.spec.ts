import { expect, test } from '@playwright/test';
import {
  assertBottomNavVisible,
  assertComposerAboveBottomNav,
  assertPlayStoryFillsMiddle,
  simulateMobileKeyboard,
} from './mobile-helpers.ts';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

for (const [index, viewport] of VIEWPORTS.entries()) {
  test(`play layout at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const telegramId = 760_100_000 + index;
    await page.setViewportSize(viewport);
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await completeWizardFighter(page, `Layout ${viewport.width}`);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Adventure$/i }).click();

    await assertPlayStoryFillsMiddle(page);
    await assertComposerAboveBottomNav(page);
    await assertBottomNavVisible(page);

    const input = page.locator('#adventure-action-input');
    await input.click();
    await simulateMobileKeyboard(page);
    await assertComposerAboveBottomNav(page);
    await page.setViewportSize(viewport);
    await assertPlayStoryFillsMiddle(page);
  });
}
