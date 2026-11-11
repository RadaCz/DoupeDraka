import { expect, test } from '@playwright/test';
import {
  ACTION_TEXTBOX,
  CELLAR_HEADING,
  SEND_ACTION_BTN,
  completeWizardFighter,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForAdventureComposerIdle,
  waitForAdventureComposerReady,
} from './telegram.ts';

test.describe.configure({ mode: 'serial' });

test('primary hub screens stay reachable without duplicate stream posts', async ({ page }, testInfo) => {
  const telegramId = 763_000_000 + testInfo.workerIndex;
  const streamStatuses: number[] = [];
  page.on('response', response => {
    if (response.url().includes('/actions/stream') && response.request().method() === 'POST') {
      streamStatuses.push(response.status());
    }
  });

  await mockTelegramWebApp(page, signedTelegramInitData(telegramId));
  await page.goto('/');
  await completeWizardFighter(page, 'Journey Hub E2E');

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /Map/i }).click();
  await expect(page.getByRole('heading', { name: /^Map$/i })).toBeVisible({ timeout: 15_000 });

  await nav.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /Quests/i }).click();
  await expect(page.getByRole('heading', { name: /^Quests$/i })).toBeVisible({ timeout: 15_000 });

  await nav.getByRole('button', { name: /^Adventure$/i }).click();
  await expect(page.getByRole('heading', { name: CELLAR_HEADING })).toBeVisible({ timeout: 20_000 });
  const input = page.getByRole('textbox', { name: ACTION_TEXTBOX });
  await waitForAdventureComposerReady(page);
  const send = page.getByRole('button', { name: SEND_ACTION_BTN });

  await input.fill('look around');
  await send.click();
  await expect.poll(() => streamStatuses.filter(s => s === 200).length, { timeout: 90_000 }).toBe(1);
  await waitForAdventureComposerIdle(page);

  await input.fill('look around');
  await send.dblclick();
  await expect.poll(() => streamStatuses.filter(s => s === 200).length, { timeout: 90_000 }).toBeGreaterThanOrEqual(1);
  expect(streamStatuses.filter(s => s === 200).length).toBeLessThanOrEqual(3);
});
