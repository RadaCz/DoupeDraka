import { expect, test } from '@playwright/test';
import { closeCombatTurnIfStalled, fetchCharacterState, postGameAction, syncPlayScreen } from './chapter-one-e2e-helpers.ts';
import {
  ACTION_TEXTBOX,
  MAIN_NAV,
  SEND_ACTION_BTN,
  apiTelegramToken,
  completeWizardFighter,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForAdventureComposerIdle,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const SAVE_LINE = /Saving throw|Záchranný hod/i;
const DEX_LINE = /Dexterity|Obratnost/i;

test('vault falling stones trigger a dexterity saving throw in the journal', async ({ page, request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.savingThrow + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardFighter(page, 'Save Tester');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  const vaultPrep = [
    'travel to The Sunken Corridor',
    'travel to The Shrine of the Forgotten',
    'talk to Caldus about the shrine bell',
    'travel to The Goblin Market',
    'ask Nib about the shrine bell',
    'travel to The Shrine of the Forgotten',
    'return the shrine bell to Caldus',
    'talk to Caldus about the shrine bell',
    'travel to The Sunken Corridor',
    'travel to The Vault of Echoes',
  ];
  for (const action of vaultPrep) {
    await postGameAction(request, token, characterId!, action);
  }

  let state = await fetchCharacterState(request, token, characterId!);
  expect(state.location).toMatch(/Vault of Echoes|Krypt echa/i);
  expect(state.quest_flags?.vault_unlocked).toBe(true);

  for (let round = 0; round < 30 && state.in_combat; round += 1) {
    const foe = state.combatant?.name ?? 'Kobold skirmisher';
    await postGameAction(request, token, characterId!, `attack ${foe}`);
    await closeCombatTurnIfStalled(request, token, characterId!);
    state = await fetchCharacterState(request, token, characterId!);
  }
  expect(state.in_combat).toBeFalsy();

  await syncPlayScreen(page);
  const nav = page.getByRole('navigation', { name: MAIN_NAV });
  await nav.getByRole('button', { name: /^Adventure$|^Hra$/i }).click();

  const journal = page.getByRole('log', { name: /Adventure journal|Dobrodružný deník/i });
  await expect(journal).toBeVisible({ timeout: 30_000 });
  const input = page.getByRole('textbox', { name: ACTION_TEXTBOX });
  const send = page.getByRole('button', { name: SEND_ACTION_BTN });

  await input.fill('look around the vault');
  await send.click();
  await waitForAdventureComposerIdle(page);

  await expect(journal).toContainText(SAVE_LINE, { timeout: 30_000 });
  await expect(journal).toContainText(DEX_LINE);
  await expect(journal).toContainText(/success|failure|úspěch|neúspěch/i);
  await expect(page.locator('h1')).toContainText(/Vault of Echoes|Krypt echa/i);
});
