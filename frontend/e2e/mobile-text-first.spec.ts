import { expect, test } from '@playwright/test';
import {
  assertComposerAboveBottomNav,
  assertJournalScrolledToLatest,
  assertLocatorInPageViewport,
  simulateMobileKeyboard,
} from './mobile-helpers.ts';
import { completeWizardFighter, ensureTelegramHome, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test.describe.configure({ mode: 'serial' });

test.describe('text-first mobile layout', () => {
  test('keeps the composer visible when the action field is focused (keyboard proxy)', async ({ page }, testInfo) => {
    const telegramId = 740_000_000 + testInfo.workerIndex;
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /adventure awaits/i })).toBeVisible({ timeout: 20_000 });
    await completeWizardFighter(page, 'Mobile Layout E2E');

    const input = page.getByRole('textbox', { name: 'Your action' });
    const send = page.getByRole('button', { name: 'Send action' });

    await assertComposerAboveBottomNav(page);
    await input.focus();
    await simulateMobileKeyboard(page);

    await assertLocatorInPageViewport(input);
    await assertLocatorInPageViewport(send);
    await assertComposerAboveBottomNav(page);

    await expect(page.locator('.game-screen.text-first')).toBeVisible();
  });

  test('scrolls the journal to the newest beat while the composer stays fixed', async ({ page }, testInfo) => {
    const telegramId = 741_000_000 + testInfo.workerIndex;
    const actionStatuses: number[] = [];
    page.on('response', response => {
      if (response.url().includes('/actions/stream') && response.request().method() === 'POST') {
        actionStatuses.push(response.status());
      }
    });
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /adventure awaits/i })).toBeVisible({ timeout: 20_000 });
    await completeWizardFighter(page, 'Mobile Scroll E2E');

    const input = page.getByRole('textbox', { name: 'Your action' });
    const journal = page.getByRole('log', { name: 'Adventure journal' });
    const composer = page.locator('.action-composer-text-first');

    const actions = [
      'listen for movement',
      'inspect the stonework',
      'inspect the old door',
    ];

    for (const action of actions) {
      await expect(input).toBeEnabled({ timeout: 90_000 });
      await input.fill(action);
      await page.getByRole('button', { name: 'Send action' }).click();
      await expect.poll(
        () => journal.locator('.journal-action').filter({ hasText: action }).count(),
        { timeout: 90_000 },
      ).toBe(1);
      await assertJournalScrolledToLatest(page);
      await assertComposerAboveBottomNav(page);
      const composerBox = await composer.boundingBox();
      expect(composerBox).toBeTruthy();
    }

    await expect.poll(() => actionStatuses.filter(status => status === 200).length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(actions.length);
    await expect(journal.locator('.journal-beat')).toHaveCount(actions.length);
    await assertJournalScrolledToLatest(page);
  });

  test('uses dynamic viewport height for the narrative column', async ({ page }, testInfo) => {
    const telegramId = 742_000_000 + testInfo.workerIndex;
    await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
    await page.goto('/');
    await ensureTelegramHome(page);
    await completeWizardFighter(page, 'Mobile Dvh E2E');

    const stylesheetUsesDvh = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes('70dvh')) return true;
          }
        } catch {
          // Ignore opaque cross-origin stylesheets.
        }
      }
      return false;
    });
    expect(stylesheetUsesDvh).toBe(true);

    const layout = await page.evaluate(() => {
      const screen = document.querySelector('.game-screen.text-first');
      const journal = document.querySelector('.game-screen.text-first .journal-scene');
      const composer = document.querySelector('.action-composer-text-first');
      if (!screen || !journal || !composer) return null;
      const screenRect = screen.getBoundingClientRect();
      const journalRect = journal.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      return {
        journalHeight: journalRect.height,
        screenHeight: screenRect.height,
        journalShare: journalRect.height / screenRect.height,
        composerTop: composerRect.top,
        journalBottom: journalRect.bottom,
      };
    });
    expect(layout).toBeTruthy();
    expect(layout!.journalShare).toBeGreaterThan(0.4);
    expect(layout!.journalHeight).toBeGreaterThan(180);
    expect(layout!.composerTop).toBeGreaterThanOrEqual(layout!.journalBottom - 4);
  });
});
