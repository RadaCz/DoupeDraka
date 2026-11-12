import { expect, test } from '@playwright/test';
import {
  closeCombatTurnIfStalled,
  fetchCharacterState,
  postCombatAttack,
  postGameAction,
} from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

test.describe.configure({ mode: 'serial' });

test('Sprint 25 — bonus then action economy & reload', async ({ request }, testInfo) => {
  test.setTimeout(240_000);
  const telegramId = E2E_TELEGRAM_ID.classIdentity + 50 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  const token = await apiTelegramToken(request, initData);

  const response = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'S25 Fighter',
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    },
  });
  expect(response.ok()).toBeTruthy();
  const fighter = await response.json() as { id: string; max_hp: number };

  await postCombatAttack(request, token, fighter.id, 'goblin scout');
  await expect.poll(async () => {
    const s = await fetchCharacterState(request, token, fighter.id);
    return Boolean(s.in_combat) && s.combat_turn === 'player' && !s.combat_flags?.action_used;
  }, { timeout: 60_000 }).toBe(true);

  await postGameAction(request, token, fighter.id, 'second wind');
  let state = await fetchCharacterState(request, token, fighter.id);
  expect(state.combat_flags?.bonus_action_used).toBe(true);
  expect(state.combat_flags?.action_used).toBeFalsy();
  expect(state.combat_turn).toBe('player');

  await postCombatAttack(request, token, fighter.id, 'goblin scout');
  state = await fetchCharacterState(request, token, fighter.id);
  if (state.in_combat && state.combat_turn === 'player') {
    expect(state.combat_flags?.action_used).toBe(true);
    expect(state.combat_flags?.bonus_action_used).toBe(true);
  }

  const reloaded = await fetchCharacterState(request, token, fighter.id);
  expect(reloaded.in_combat).toBe(state.in_combat);
  expect(reloaded.combat_flags?.bonus_action_used).toBe(state.combat_flags?.bonus_action_used);
});
