import { expect, test } from '@playwright/test';
import {
  apiTelegramToken,
  completeWizardFighter,
  forceCharacterFallen,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForAdventureComposerReady,
} from './telegram.ts';
import { fetchCharacterState } from './chapter-one-e2e-helpers.ts';

/**
 * Sprint 38 — defeat recovery UI.
 * Fixture may force fallen; revive + return to playable UI must be real clicks.
 */
test('defeat recovery: fallen modal, revive, positive HP, playable UI', async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  const telegramId = 710_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /adventure awaits|Welcome back|dobrodružství čeká|Vítej/i })).toBeVisible({
    timeout: 20_000,
  });
  await completeWizardFighter(page, 'Fallen E2E');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();

  const token = await apiTelegramToken(request, initData);
  await forceCharacterFallen(request, token, characterId!);

  await page.reload();
  await expect(page.getByRole('heading', { name: /Welcome back, Fallen E2E|Vítej zpět, Fallen E2E/i })).toBeVisible();
  // Overview must not pretend a fallen hero can "continue" as if alive.
  const hubCta = page.getByRole('button', { name: /Revive hero|Obnovit hrdinu|Continue adventure|Pokračovat/i });
  await expect(hubCta).toBeVisible();
  await hubCta.click();
  await expect(page.getByRole('heading', { name: /You have fallen|Padl jsi/i })).toBeVisible();
  await expect(page.getByText(/thread of the weave/i)).toHaveCount(0);

  const revivePromise = page.waitForResponse(response =>
    response.url().includes('/revive') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Revive hero|Obnovit hrdinu/i }).click();
  const revive = await revivePromise;
  expect(revive.ok()).toBeTruthy();

  const after = await fetchCharacterState(request, token, characterId!);
  expect(after.hp).toBeGreaterThan(0);

  await expect(page.getByRole('heading', { name: /Whispering Cellar|Šeptající sklep/i })).toBeVisible({ timeout: 20_000 });
  await waitForAdventureComposerReady(page);
  await expect(page.getByRole('textbox', { name: /Your action|tvoje akce|Co uděláš/i })).toBeEnabled();
});
