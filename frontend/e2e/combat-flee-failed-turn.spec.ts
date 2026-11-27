import { expect, test } from '@playwright/test';
import {
  closeCombatTurnIfStalled,
  ensureLevelAtLeast,
  fetchCharacterState,
  postGameAction,
  startCellarCombat,
  waitForPlayerCombatTurn,
} from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

test.describe.configure({ mode: 'serial' });

test('Schválená pravidla §3 — neúspěšný útěk, hráč dál jedná', async ({ request }, testInfo) => {
  test.setTimeout(300_000);
  const token = await apiTelegramToken(
    request,
    signedTelegramInitData(E2E_TELEGRAM_ID.classIdentity + 91 + testInfo.workerIndex),
  );

  const created = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'Flee Fail Rogue',
      race: 'halfling',
      character_class: 'rogue',
      background: 'criminal',
      class_skills: ['Acrobatics', 'Stealth', 'Perception', 'Sleight of Hand'],
      abilities: { strength: 8, dexterity: 8, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id: rogueId } = await created.json() as { id: string };

  await ensureLevelAtLeast(request, token, rogueId, 2, 60);
  await startCellarCombat(request, token, rogueId, 'goblin scout');
  await waitForPlayerCombatTurn(request, token, rogueId);

  let state = await fetchCharacterState(request, token, rogueId);
  const hpBefore = state.hp ?? 1;
  const foeHpBefore = state.combatant?.hp ?? 0;

  let failed = false;
  for (let attempt = 0; attempt < 12 && !failed; attempt += 1) {
    if (!state.in_combat) {
      await startCellarCombat(request, token, rogueId, 'goblin scout');
      await waitForPlayerCombatTurn(request, token, rogueId);
      state = await fetchCharacterState(request, token, rogueId);
    }
    if (state.combat_flags?.action_used) {
      await postGameAction(request, token, rogueId, 'end turn');
      await closeCombatTurnIfStalled(request, token, rogueId);
      await waitForPlayerCombatTurn(request, token, rogueId);
      state = await fetchCharacterState(request, token, rogueId);
    }
    expect(state.combat_turn).toBe('player');
    expect(state.combat_flags?.action_used).toBeFalsy();

    await postGameAction(request, token, rogueId, 'flee');
    state = await fetchCharacterState(request, token, rogueId);

    if (state.in_combat && state.combat_flags?.action_used) {
      failed = true;
      break;
    }
  }

  expect(failed, 'Expected a failed flee within 12 attempts (DEX 8, DC 10)').toBe(true);
  expect(state.combat_turn).toBe('player');
  expect(state.combat_flags?.bonus_action_used).toBeFalsy();
  expect((state.hp ?? 0)).toBeGreaterThanOrEqual(hpBefore - 1);
  expect(state.combatant?.hp ?? 0).toBe(foeHpBefore);

  const distBefore = state.combat_distance_ft ?? state.combat_tactics?.distance_ft ?? 0;
  await postGameAction(request, token, rogueId, 'retreat 5 ft');
  state = await fetchCharacterState(request, token, rogueId);
  expect(state.combat_turn).toBe('player');
  const distAfter = state.combat_distance_ft ?? state.combat_tactics?.distance_ft ?? 0;
  expect(distAfter).toBeGreaterThanOrEqual(distBefore);

  await postGameAction(request, token, rogueId, 'dash');
  state = await fetchCharacterState(request, token, rogueId);
  expect(state.combat_flags?.bonus_action_used).toBe(true);
  expect(state.combat_turn).toBe('player');
});