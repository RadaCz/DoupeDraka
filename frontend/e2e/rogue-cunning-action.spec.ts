import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
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

test('Sprint 36 — Rogue Cunning Action Dash, Disengage, Hide', async ({ request }, testInfo) => {
  test.setTimeout(300_000);
  const token = await apiTelegramToken(request, signedTelegramInitData(E2E_TELEGRAM_ID.rogueCunning + testInfo.workerIndex));

  const created = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'S36 Rogue',
      race: 'halfling',
      character_class: 'rogue',
      background: 'criminal',
      class_skills: ['Acrobatics', 'Perception', 'Sleight of Hand', 'Investigation'],
      expertise_skills: ['Stealth', 'Acrobatics'],
      abilities: { strength: 8, dexterity: 16, constitution: 14, intelligence: 12, wisdom: 10, charisma: 13 },
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id: rogueId } = await created.json() as { id: string };

  await ensureLevelAtLeast(request, token, rogueId, 2, 60);
  let state = await fetchCharacterState(request, token, rogueId);
  expect(state.level).toBeGreaterThanOrEqual(2);

  await startCellarCombat(request, token, rogueId);
  state = await fetchCharacterState(request, token, rogueId);
  const moveBefore = state.combat_tactics?.movement_remaining_ft ?? state.combat_movement_remaining_ft ?? 0;
  const speed = state.combat_tactics?.speed_ft ?? 30;

  await postGameAction(request, token, rogueId, 'dash');
  state = await fetchCharacterState(request, token, rogueId);
  expect(state.combat_flags?.bonus_action_used).toBe(true);
  const moveAfter = state.combat_tactics?.movement_remaining_ft ?? state.combat_movement_remaining_ft ?? 0;
  expect(moveAfter).toBeGreaterThanOrEqual(moveBefore + speed - 1);

  await postGameAction(request, token, rogueId, 'dash');
  const afterSecondDash = await fetchCharacterState(request, token, rogueId);
  expect(afterSecondDash.combat_flags?.bonus_action_used).toBe(true);
  expect(
    (afterSecondDash.combat_tactics?.movement_remaining_ft ?? afterSecondDash.combat_movement_remaining_ft ?? 0),
  ).toBe(moveAfter);

  await postGameAction(request, token, rogueId, 'end turn');
  await closeCombatTurnIfStalled(request, token, rogueId);
  state = await fetchCharacterState(request, token, rogueId);
  if (!state.in_combat) {
    await startCellarCombat(request, token, rogueId);
  }
  await waitForPlayerCombatTurn(request, token, rogueId);

  state = await fetchCharacterState(request, token, rogueId);
  expect(state.in_combat).toBe(true);
  expect(state.combat_flags?.bonus_action_used).toBeFalsy();
  const hpAtMelee = state.hp ?? 1;
  await postGameAction(request, token, rogueId, 'disengage');
  state = await fetchCharacterState(request, token, rogueId);
  expect(state.combat_flags?.bonus_action_used).toBe(true);
  expect(state.combat_flags?.action_used).toBeFalsy();

  await postGameAction(request, token, rogueId, 'step back 10 ft');
  const afterStep = await fetchCharacterState(request, token, rogueId);
  expect((afterStep.hp ?? 0)).toBeGreaterThanOrEqual(hpAtMelee - 1);

  await postGameAction(request, token, rogueId, 'end turn');
  await closeCombatTurnIfStalled(request, token, rogueId);
  let mid = await fetchCharacterState(request, token, rogueId);
  if (!mid.in_combat) {
    await startCellarCombat(request, token, rogueId);
  } else {
    await waitForPlayerCombatTurn(request, token, rogueId);
  }

  await postGameAction(request, token, rogueId, 'hide');
  const afterHide = await fetchCharacterState(request, token, rogueId);
  expect(afterHide.combat_flags?.bonus_action_used).toBe(true);

  const reloaded = await fetchCharacterState(request, token, rogueId);
  expect(reloaded.level).toBeGreaterThanOrEqual(2);
  expect(reloaded.combat_flags?.bonus_action_used).toBe(afterHide.combat_flags?.bonus_action_used);
});

test('Sprint 36 — Fighter uses action Disengage (not bonus)', async ({ request }, testInfo) => {
  test.setTimeout(120_000);
  const token = await apiTelegramToken(request, signedTelegramInitData(E2E_TELEGRAM_ID.rogueCunning + 50_000 + testInfo.workerIndex));
  const created = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'S36 Fighter',
      race: 'human',
      character_class: 'fighter',
      abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    },
  });
  const { id } = await created.json() as { id: string };
  await startCellarCombat(request, token, id);
  await postGameAction(request, token, id, 'disengage');
  const state = await fetchCharacterState(request, token, id);
  expect(state.combat_flags?.action_used).toBe(true);
  expect(state.combat_flags?.bonus_action_used).toBeFalsy();
});
