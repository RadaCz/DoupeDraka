import { expect, test } from '@playwright/test';
import {
  assertBottomNavVisible,
  assertComposerAboveBottomNav,
  assertNoHorizontalOverflow,
} from './mobile-helpers.ts';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

const MOBILE_VIEWPORTS = [
  { width: 320, height: 568, label: '320x568' },
  { width: 360, height: 800, label: '360x800' },
  { width: 375, height: 812, label: '375x812' },
  { width: 390, height: 844, label: '390x844' },
  { width: 430, height: 932, label: '430x932' },
] as const;

test.describe.configure({ mode: 'serial' });

MOBILE_VIEWPORTS.forEach((viewport, index) => {
  test(`layout smoke at ${viewport.label}`, async ({ page }, testInfo) => {
    const telegramId = 750_000_000 + testInfo.workerIndex * 100 + index;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /adventure awaits/i })).toBeVisible({ timeout: 20_000 });
    await completeWizardFighter(page, `Viewport ${viewport.label}`);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('button', { name: /^Overview$/i }).click();
    await assertNoHorizontalOverflow(page);
    await nav.getByRole('button', { name: /^Character$/i }).click();
    await assertNoHorizontalOverflow(page);
    await nav.getByRole('button', { name: /^More$/i }).click();
    await expect(page.getByRole('heading', { name: /^More$/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await nav.getByRole('button', { name: /^Adventure$/i }).click();
    await assertNoHorizontalOverflow(page);
    await assertComposerAboveBottomNav(page);
  });
});
