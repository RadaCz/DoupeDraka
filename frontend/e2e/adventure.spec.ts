import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { E2E_BOT_TOKEN } from './test-config.ts';

function signedTelegramInitData(userId: number) {
  const fields = {
    auth_date: Math.floor(Date.now() / 1000).toString(),
    user: JSON.stringify({ id: userId, first_name: 'E2E Adventurer' }),
  };
  const checkString = Object.keys(fields)
    .sort()
    .map(key => `${key}=${fields[key as keyof typeof fields]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(E2E_BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

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
  await page.route('https://telegram.org/js/telegram-web-app.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.Telegram = { WebApp: { initData: ${JSON.stringify(initData)}, ready() {}, expand() {} } };`,
  }));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'An adventure awaits.' })).toBeVisible();

  await page.getByRole('button', { name: 'Create your character' }).click();
  await page.getByRole('button', { name: 'Step-by-step wizard' }).click();
  await page.getByRole('button', { name: 'Human' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Fighter' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Character name').fill('E2E Arin');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meet your adventurer' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter the adventure' }).click();

  await expect(page.getByRole('heading', { name: 'The Whispering Cellar' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Your action' }).fill('inspect the old door');
  await page.getByRole('button', { name: 'Send action' }).click();
  await expect.poll(() => actionStatuses.length).toBe(1);
  await expect.poll(() => actionStatuses.length).toBe(1);
  expect(actionStatuses, actionErrors.join('\n')).toEqual([200]);
  const journal = page.getByRole('log', { name: 'Adventure journal' });
  await expect(journal.locator('.journal-action')).toContainText('inspect the old door');
  await expect(journal.getByText(/Intelligence check:/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('active_character_id'))).not.toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('api_token'))).toBeNull();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, E2E Arin.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue adventure' }).click();
  const restoredJournal = page.getByRole('log', { name: 'Adventure journal' });
  await expect(restoredJournal.locator('.journal-action')).toContainText('inspect the old door');
  await expect(restoredJournal.getByText(/Intelligence check:/)).toBeVisible();
});
