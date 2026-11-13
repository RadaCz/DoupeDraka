import { expect, test } from '@playwright/test';
import { apiTelegramToken, fetchCharacterState } from './chapter-one-e2e-helpers.ts';
import {
  CELLAR_HEADING,
  completeWizardFighter,
  mockTelegramWebApp,
  playStreamResponse,
  signedTelegramInitData,
  waitForAdventureComposerReady,
  waitForAdventureComposerIdle,
} from './telegram.ts';

/**
 * Sprint 38 — real first-session UI path for a new player.
 * No vault/boss API grind. Proves chips + overview + Caldus + explore entry.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

test('first session: create → overview → travel chip → Caldus → explore', async ({ page, request }, testInfo) => {
  const telegramId = 764_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');

  await completeWizardFighter(page, 'First Session');
  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  await expect(page.getByRole('heading', { name: CELLAR_HEADING })).toBeVisible({ timeout: 20_000 });
  await waitForAdventureComposerReady(page);

  const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
  await nav.getByRole('button', { name: /^Home$|^Overview$|^Přehled$/i }).click();
  await expect(page.getByRole('heading', { name: /Welcome back|Vítej zpět/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/MAIN QUEST|HLAVNÍ ÚKOL/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Continue adventure|Pokračovat v dobrodružství/i }).click();
  await expect(page.getByRole('heading', { name: CELLAR_HEADING })).toBeVisible({ timeout: 15_000 });
  await waitForAdventureComposerReady(page);

  const travelChip = page.locator('.suggested-actions-row button').filter({
    hasText: /Cesta do Potopen|Travel to The Sunken Corridor|Sunken Corridor|Potopen/i,
  });
  await expect(travelChip.first()).toBeVisible({ timeout: 15_000 });
  const stream1 = playStreamResponse(page);
  await travelChip.first().click();
  await stream1;
  await waitForAdventureComposerIdle(page);

  await expect.poll(async () => {
    const state = await fetchCharacterState(request, token, characterId!);
    return state.location;
  }, { timeout: 30_000 }).toMatch(/Sunken Corridor|Potopen/i);

  const stateAfterCorridor = await fetchCharacterState(request, token, characterId!);
  if (stateAfterCorridor.in_combat) {
    const flee = page.getByRole('button', { name: /^Flee$|^Útěk$|^Utek$/i });
    if (await flee.isVisible().catch(() => false) && await flee.isEnabled().catch(() => false)) {
      const streamFlee = playStreamResponse(page);
      await flee.click();
      await streamFlee.catch(() => undefined);
      await waitForAdventureComposerIdle(page).catch(() => undefined);
    }
  }
  const shrineChip = page.locator('.suggested-actions-row button').filter({
    hasText: /Cesta ke Svatyni|Travel to The Shrine|Shrine of the Forgotten|Svatyn[ií] zapomenut/i,
  });
  await expect(shrineChip.first()).toBeVisible({ timeout: 20_000 });
  const stream2 = playStreamResponse(page);
  await shrineChip.first().click();
  await stream2;
  await waitForAdventureComposerIdle(page);

  await expect.poll(async () => {
    const state = await fetchCharacterState(request, token, characterId!);
    return state.location;
  }, { timeout: 30_000 }).toMatch(/Shrine|Forgotten|Svatyn/i);

  const caldus = page.locator('.suggested-actions-row button').filter({ hasText: /Caldus|zvon|bell/i });
  await expect(caldus.first()).toBeVisible({ timeout: 20_000 });
  const stream3 = playStreamResponse(page);
  await caldus.first().click();
  await stream3;
  await waitForAdventureComposerIdle(page);

  await expect.poll(async () => {
    const state = await fetchCharacterState(request, token, characterId!);
    return Boolean(state.quest_flags?.bell_quest_accepted);
  }, { timeout: 30_000 }).toBe(true);

  const explore = page.locator('.suggested-actions-row button').filter({
    hasText: /Prozkoumat|Explore|Search|Hledat|Mluvit|Talk/i,
  });
  await expect(explore.first()).toBeVisible({ timeout: 15_000 });
  const stream4 = playStreamResponse(page);
  await explore.first().click();
  await stream4;
  const combatDeck = page.getByRole('group', { name: /combat actions|bojové akce/i });
  if (!(await combatDeck.isVisible().catch(() => false))) {
    await waitForAdventureComposerIdle(page);
  }

  const state = await fetchCharacterState(request, token, characterId!);
  const journal = page.getByRole('log', { name: /adventure journal|deník dobrodružství/i });
  if (state.in_combat) {
    await expect(combatDeck).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(journal).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Your action|tvoje akce|Co uděláš/i })).toBeEnabled();
  }
});
