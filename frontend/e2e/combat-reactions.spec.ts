import { expect, test } from '@playwright/test';
import {
  fetchCharacterState,
  postGameAction,
  startCellarCombat,
  syncCombatOrAdventurePlay,
} from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test('disengage then step back avoids opportunity attack', async ({ page, request }, testInfo) => {
  const telegramId = 780_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardFighter(page, 'OA E2E');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  await startCellarCombat(request, token, characterId!, 'goblin scout');
  let state = await fetchCharacterState(request, token, characterId!);

  const dist = state.combat_tactics?.distance_ft ?? state.combat_distance_ft ?? 99;
  if (dist > 5) {
    const move = Math.min(dist - 5, state.combat_tactics?.movement_remaining_ft ?? 30);
    await postGameAction(request, token, characterId!, `advance ${move} ft`);
  }

  await postGameAction(request, token, characterId!, 'disengage');
  await postGameAction(request, token, characterId!, 'step back 10 ft');
  const disengaged = await fetchCharacterState(request, token, characterId!);
  expect(disengaged.combat_flags?.enemy_reaction_used).toBeFalsy();

  await postGameAction(request, token, characterId!, 'end turn');
  await postGameAction(request, token, characterId!, 'end turn');
  const reset = await fetchCharacterState(request, token, characterId!);
  if (reset.in_combat && reset.combat_turn === 'player') {
    await postGameAction(request, token, characterId!, `advance ${Math.min(15, reset.combat_tactics?.movement_remaining_ft ?? 0)} ft`);
    await postGameAction(request, token, characterId!, 'step back 10 ft');
    const raw = await fetchCharacterState(request, token, characterId!);
    expect(raw.combat_flags?.enemy_reaction_used).toBe(true);
  }

  let uiState = await fetchCharacterState(request, token, characterId!);
  if (!uiState.in_combat) {
    await startCellarCombat(request, token, characterId!, 'goblin scout');
    uiState = await fetchCharacterState(request, token, characterId!);
  }
  expect(uiState.in_combat, 'Need an active fight to assert Disengage on the combat deck').toBeTruthy();
  await syncCombatOrAdventurePlay(page);
  await expect(page.getByRole('button', { name: /^Disengage|^Odpojit se|^Ustoupit$/i })).toBeVisible({ timeout: 15_000 });
});
