import { expect, test } from '@playwright/test';
import {
  apiTelegramToken,
  completeWizardFighter,
  forceCharacterFallen,
  mockTelegramWebApp,
  signedTelegramInitData,
} from './telegram.ts';

test('shows fallen screen and revives without narrator error panel', async ({ page, request }, testInfo) => {
  const telegramId = 710_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /adventure awaits|Welcome back/i })).toBeVisible({ timeout: 20_000 });
  await completeWizardFighter(page, 'Fallen E2E');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();

  const token = await apiTelegramToken(request, initData);
  await forceCharacterFallen(request, token, characterId!);

  await page.reload();
  await expect(page.getByRole('heading', { name: /Welcome back, Fallen E2E/i })).toBeVisible();
  await page.getByRole('button', { name: /Continue adventure/i }).click();
  await expect(page.getByRole('heading', { name: 'You have fallen' })).toBeVisible();
  await expect(page.getByText(/thread of the weave/i)).toHaveCount(0);

  const revivePromise = page.waitForResponse(response =>
    response.url().includes('/revive') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Revive hero/i }).click();
  const revive = await revivePromise;
  expect(revive.ok()).toBeTruthy();

  await expect(page.getByRole('heading', { name: 'The Whispering Cellar' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your action' })).toBeEnabled();
});
