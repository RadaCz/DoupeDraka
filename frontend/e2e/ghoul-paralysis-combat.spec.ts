import { expect, test } from '@playwright/test';
import {
  ensureLevelAtLeast,
  fetchCharacterState,
  postGameAction,
  reviveIfFallen,
} from './chapter-one-e2e-helpers.ts';
import {
  ACTION_TEXTBOX,
  SEND_ACTION_BTN,
  apiTelegramToken,
  MAIN_NAV,
  completeWizardWizardCaster,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForAdventureComposerIdle,
  waitForAdventureComposerReady,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

test('ghoul paralyzing claws apply paralysis through real combat and UI', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const telegramId = E2E_TELEGRAM_ID.ghoulParalysis + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardWizardCaster(page, 'Ghoul Paralysis E2E');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  await ensureLevelAtLeast(request, token, characterId!, 2, 50);
  await postGameAction(request, token, characterId!, 'travel to The Sunken Corridor');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await fetchCharacterState(request, token, characterId!);
    if (state.conditions?.some(c => c.condition_id === 'paralyzed')) break;
    if (!state.in_combat) {
      await postGameAction(request, token, characterId!, 'attack ghoul');
    } else if (state.combat_turn === 'player') {
      await postGameAction(request, token, characterId!, 'attack ghoul');
    } else {
      await postGameAction(request, token, characterId!, 'defend');
    }
  }

  await expect.poll(async () => {
    const state = await fetchCharacterState(request, token, characterId!);
    return state.conditions?.some(c => c.condition_id === 'paralyzed') ?? false;
  }, { timeout: 90_000 }).toBe(true);

  await reviveIfFallen(request, token, characterId!);
  const nav = page.getByRole('navigation', { name: MAIN_NAV });
  await nav.getByRole('button', { name: /^Character$|^Postava$/i }).click();
  await nav.getByRole('button', { name: /^Adventure$|^Hra$/i }).click();
  await waitForAdventureComposerReady(page);
  const beforeTurn = await fetchCharacterState(request, token, characterId!);
  expect(beforeTurn.conditions?.some(c => c.condition_id === 'paralyzed')).toBeTruthy();
  await expect(page.getByText(/paralyz|Paralyza/i)).toBeVisible({ timeout: 30_000 });

  const journal = page.getByRole('log', { name: /Adventure journal|Dobrodružný deník/i });
  await page.getByRole('textbox', { name: ACTION_TEXTBOX }).fill('attack ghoul');
  await page.getByRole('button', { name: SEND_ACTION_BTN }).click();
  await waitForAdventureComposerIdle(page);
  await expect(journal).toContainText(/paralyz|cannot act|neschopný/i, { timeout: 45_000 });

  const afterUi = await fetchCharacterState(request, token, characterId!);
  if (afterUi.in_combat && afterUi.conditions?.some(c => c.condition_id === 'paralyzed')) {
    await postGameAction(request, token, characterId!, 'defend');
    await waitForAdventureComposerIdle(page);
    await expect(journal).toContainText(/repeat save|end of your turn|konce tvého tahu|saving throw|záchranný hod/i, {
      timeout: 45_000,
    });
  }
});
