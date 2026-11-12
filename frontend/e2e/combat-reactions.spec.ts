import { expect, test } from '@playwright/test';
import {
  fetchCharacterState,
  postCombatAttack,
  postGameAction,
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

  let state = await fetchCharacterState(request, token, characterId!);
  for (let i = 0; i < 20 && !state.in_combat; i += 1) {
    await postCombatAttack(request, token, characterId!, 'goblin scout');
    state = await fetchCharacterState(request, token, characterId!);
  }
  expect(state.in_combat).toBeTruthy();

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

  await syncCombatOrAdventurePlay(page);
  await expect(page.getByRole('button', { name: /^Disengage$|^Ustoupit$/i })).toBeVisible();
});
