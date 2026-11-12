import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  closeCombatTurnIfStalled,
  ensureHpBelowMaxForPotionUse,
  ensureLevelAtLeast,
  fetchCharacterState,
  postGameAction,
  postGameActionWithIdempotencyKey,
  resolvePendingReactionForE2E,
  startCellarCombat,
  waitForPlayerCombatTurn,
} from './chapter-one-e2e-helpers.ts';
import { apiTelegramToken, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';

test.describe.configure({ mode: 'serial' });

test('Sprint 36 — Cleric Preserve Life, Turn Undead, rest & idempotency', async ({ request }, testInfo) => {
  test.setTimeout(300_000);
  const token = await apiTelegramToken(request, signedTelegramInitData(E2E_TELEGRAM_ID.clericChannel + testInfo.workerIndex));

  const created = await request.post(`${API}/characters`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      name: 'S36 Cleric',
      race: 'dwarf',
      character_class: 'cleric',
      divine_domain: 'life',
      cantrips: ['Guidance', 'Sacred Flame', 'Spare the Dying'],
      level_one_spells: ['Cure Wounds', 'Healing Word', 'Shield of Faith', 'Bless'],
      abilities: { strength: 14, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 16, charisma: 12 },
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id: clericId } = await created.json() as { id: string };

  await ensureLevelAtLeast(request, token, clericId, 2, 60);
  let state = await fetchCharacterState(request, token, clericId);
  expect(state.level).toBeGreaterThanOrEqual(2);
  expect(state.channel_divinity_available).toBe(true);

  await startCellarCombat(request, token, clericId);
  state = await ensureHpBelowMaxForPotionUse(request, token, clericId, 24);
  expect((state.hp ?? 0)).toBeLessThan(state.max_hp ?? 20);

  for (let guard = 0; guard < 40; guard += 1) {
    await resolvePendingReactionForE2E(request, token, clericId);
    state = await fetchCharacterState(request, token, clericId);
    if (state.combat_turn === 'player' && !state.combat_flags?.action_used) {
      break;
    }
    if (state.combat_turn === 'player' && state.combat_flags?.action_used) {
      await postGameAction(request, token, clericId, 'end turn');
      await closeCombatTurnIfStalled(request, token, clericId);
      continue;
    }
    if (!state.in_combat) {
      await startCellarCombat(request, token, clericId);
    }
  }
  expect(state.combat_turn).toBe('player');
  expect(state.combat_flags?.action_used).toBeFalsy();

  const hpBefore = state.hp ?? 0;
  const idemKey = randomUUID();
  await postGameActionWithIdempotencyKey(request, token, clericId, 'preserve life', idemKey);
  state = await fetchCharacterState(request, token, clericId);
  expect(state.channel_divinity_available).toBe(false);
  expect((state.hp ?? 0)).toBeGreaterThan(hpBefore);
  const healedOnce = state.hp ?? 0;
  expect(healedOnce).toBeLessThanOrEqual(hpBefore + 5 * (state.level ?? 2));

  await postGameActionWithIdempotencyKey(request, token, clericId, 'preserve life', idemKey);
  const replay = await fetchCharacterState(request, token, clericId);
  expect(replay.hp).toBe(healedOnce);
  expect(replay.channel_divinity_available).toBe(false);

  await postGameAction(request, token, clericId, 'preserve life');
  const denied = await fetchCharacterState(request, token, clericId);
  expect(denied.hp).toBe(healedOnce);

  await postGameAction(request, token, clericId, 'end turn');
  while ((await fetchCharacterState(request, token, clericId)).in_combat) {
    const probe = await fetchCharacterState(request, token, clericId);
    if (probe.combat_turn === 'player' && probe.in_combat) {
      await postGameAction(request, token, clericId, 'flee');
    }
    await waitForPlayerCombatTurn(request, token, clericId).catch(() => undefined);
    if (!(await fetchCharacterState(request, token, clericId)).in_combat) break;
  }

  await postGameAction(request, token, clericId, 'short rest');
  state = await fetchCharacterState(request, token, clericId);
  expect(state.channel_divinity_available).toBe(true);

  await startCellarCombat(request, token, clericId, 'skeleton');
  state = await fetchCharacterState(request, token, clericId);
  expect(state.in_combat).toBe(true);
  await postGameAction(request, token, clericId, 'turn undead');
  state = await fetchCharacterState(request, token, clericId);
  expect(state.channel_divinity_available).toBe(false);

  if (!state.in_combat) {
    await startCellarCombat(request, token, clericId);
  }
  await postGameAction(request, token, clericId, 'turn undead');
  const goblinDeny = await fetchCharacterState(request, token, clericId);
  expect(goblinDeny.channel_divinity_available).toBe(false);

  const reloaded = await fetchCharacterState(request, token, clericId);
  expect(reloaded.channel_divinity_available).toBe(goblinDeny.channel_divinity_available);
});
