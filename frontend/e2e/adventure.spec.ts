import { expect, test } from '@playwright/test';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test('requires Telegram initData outside Telegram', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) apiRequests.push(request.url());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Your story begins in Telegram' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Open this app from Telegram');
  expect(apiRequests).toEqual([]);
});

test('creates a hero, completes a real game turn, and restores its journal after reload', async ({ page }, testInfo) => {
  const telegramId = 700_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  const actionStatuses: number[] = [];
  const actionErrors: string[] = [];
  page.on('response', response => {
    if (response.url().includes('/actions/stream')) {
      actionStatuses.push(response.status());
      if (!response.ok()) void response.text().then(text => actionErrors.push(text));
    }
  });
  await mockTelegramWebApp(page, initData);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'An adventure awaits.' })).toBeVisible();
  await completeWizardFighter(page, 'E2E Arin');
  await page.getByRole('textbox', { name: 'Your action' }).fill('inspect the old door');
  await page.getByRole('button', { name: 'Send action' }).click();
  await expect.poll(() => actionStatuses.length).toBe(1);
  await expect.poll(() => actionStatuses.length).toBe(1);
  expect(actionStatuses, actionErrors.join('\n')).toEqual([200]);
  const journal = page.getByRole('log', { name: 'Adventure journal' });
  await expect(journal.locator('.journal-action')).toContainText('inspect the old door');
  await expect(journal.getByText(/(Intelligence|Investigation) check:/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('active_character_id'))).not.toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('api_token'))).toBeNull();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, E2E Arin.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue adventure' }).click();
  const restoredJournal = page.getByRole('log', { name: 'Adventure journal' });
  await expect(restoredJournal.locator('.journal-action')).toContainText('inspect the old door');
  await expect(restoredJournal.getByText(/(Intelligence|Investigation) check:/i)).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('button')).toHaveCount(4);
  await expect(nav.getByRole('button', { name: /^Overview$/i })).toBeVisible();
  await expect(nav.getByRole('button', { name: /^Adventure$/i })).toBeVisible();
  await expect(nav.getByRole('button', { name: /^Character$/i })).toBeVisible();
  await expect(nav.getByRole('button', { name: /^More$/i })).toBeVisible();
  await expect(page.locator('.quick-action-grid')).toHaveCount(0);
  await nav.getByRole('button', { name: /^More$/i }).click();
  await expect(page.getByRole('heading', { name: /^More$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Map/i })).toBeVisible();
  await page.getByRole('button', { name: /Quests/i }).click();
  await expect(page.getByRole('heading', { name: /Recover the stolen shrine bell|Quests/i })).toBeVisible();
});
