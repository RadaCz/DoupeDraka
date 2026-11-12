import { expect, test } from '@playwright/test';
import {
  ensureLevelAtLeast,
  fetchCharacterState,
  postCombatAttack,
  postGameAction,
  reviveIfFallen,
  syncPlayScreen,
} from './chapter-one-e2e-helpers.ts';
import {
  apiTelegramToken,
  completeWizardFighter,
  mockTelegramWebApp,
  signedTelegramInitData,
} from './telegram.ts';

test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

test('fighter levels through real combat, uses Action Surge, persists after reload', async ({
  page,
  request,
}, testInfo) => {
  const telegramId = 756_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardFighter(page, 'Level Progression E2E');
  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  let state = await fetchCharacterState(request, token, characterId!);
  expect(state.level).toBe(1);
  expect(state.action_surge_available).toBeFalsy();
  expect(state.location).toMatch(/Whispering Cellar|Šeptající/i);
  const maxHpAtL1 = state.max_hp ?? 0;
  const xpAtL1 = state.xp;

  await ensureLevelAtLeast(request, token, characterId!, 2, 40);
  state = await fetchCharacterState(request, token, characterId!);
  expect(state.level).toBeGreaterThanOrEqual(2);
  expect(state.action_surge_available).toBeTruthy();
  expect(state.max_hp).toBeGreaterThan(maxHpAtL1);
  expect(state.xp).toBeGreaterThanOrEqual(0);
  if (typeof xpAtL1 === 'number' && state.xp !== undefined) {
    expect(state.xp).toBeLessThan(100);
  }

  if ((state.hp ?? 1) <= 0) await reviveIfFallen(request, token, characterId!);
  await postCombatAttack(request, token, characterId!, 'goblin');
  state = await fetchCharacterState(request, token, characterId!);
  if (state.in_combat && state.combat_flags?.action_used && state.action_surge_available) {
    await postGameAction(request, token, characterId!, 'action surge');
    state = await fetchCharacterState(request, token, characterId!);
    expect(state.action_surge_available).toBeFalsy();
    expect(state.combat_flags?.action_used).toBeFalsy();
    if (state.combatant?.name) {
      await postCombatAttack(request, token, characterId!, state.combatant.name);
    }
  }

  await postGameAction(request, token, characterId!, 'short rest');
  state = await fetchCharacterState(request, token, characterId!);
  expect(state.action_surge_available).toBeTruthy();

  await ensureLevelAtLeast(request, token, characterId!, 3, 60);
  state = await fetchCharacterState(request, token, characterId!);
  expect(state.level).toBe(3);

  const levelBeforeReload = state.level;
  const maxHpBeforeReload = state.max_hp;
  await page.reload();
  await syncPlayScreen(page);
  state = await fetchCharacterState(request, token, characterId!);
  expect(state.level).toBe(levelBeforeReload);
  expect(state.max_hp).toBe(maxHpBeforeReload);
});
