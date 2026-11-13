import { expect, test } from '@playwright/test';
import {
  closeCombatTurnIfStalled,
  fetchCharacterState,
  postGameAction,
  startCellarCombat,
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

  await startCellarCombat(request, token, fighter.id, 'goblin scout');
  // Opening engage spends the action (B-04). Advance to a fresh player turn for bonus→action.
  await expect.poll(async () => {
    const s = await fetchCharacterState(request, token, fighter.id);
    return Boolean(s.in_combat);
  }, { timeout: 60_000 }).toBe(true);
  for (let guard = 0; guard < 24; guard += 1) {
    const s = await fetchCharacterState(request, token, fighter.id);
    if (!s.in_combat) {
      await startCellarCombat(request, token, fighter.id, 'goblin scout');
      continue;
    }
    if (s.combat_turn === 'player' && !s.combat_flags?.action_used && !s.combat_flags?.bonus_action_used) {
      break;
    }
    if (s.combat_turn === 'player' && s.combat_flags?.action_used) {
      await postGameAction(request, token, fighter.id, 'end turn');
      await closeCombatTurnIfStalled(request, token, fighter.id);
      continue;
    }
    await closeCombatTurnIfStalled(request, token, fighter.id);
  }
  await expect.poll(async () => {
    const s = await fetchCharacterState(request, token, fighter.id);
    return Boolean(s.in_combat) && s.combat_turn === 'player' && !s.combat_flags?.action_used;
  }, { timeout: 60_000 }).toBe(true);

  await postGameAction(request, token, fighter.id, 'second wind');
  const afterBonus = await fetchCharacterState(request, token, fighter.id);
  expect(afterBonus.combat_flags?.bonus_action_used).toBe(true);
  expect(afterBonus.combat_flags?.action_used).toBeFalsy();
  expect(afterBonus.combat_turn).toBe('player');

  // Persist mid-turn bonus state (do not take the action yet — defend/attack may auto-cycle the turn).
  const reloaded = await fetchCharacterState(request, token, fighter.id);
  expect(reloaded.in_combat).toBe(true);
  expect(reloaded.combat_flags?.bonus_action_used).toBe(true);
  expect(reloaded.combat_flags?.action_used).toBeFalsy();
});
