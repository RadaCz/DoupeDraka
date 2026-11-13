import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  ensureLevelAtLeast,
  fetchCharacterState,
  type CharacterSnapshot,
  isCombatReactionPending,
  isMvpCombatDefeatRecovery,
  recoverForGhoulEncounter,
  resolvePendingReactionForE2E,
  reviveIfFallen,
  syncPlayScreen,
} from './chapter-one-e2e-helpers.ts';
import {
  ACTION_TEXTBOX,
  SEND_ACTION_BTN,
  apiTelegramToken,
  completeWizardWizardCaster,
  mockTelegramWebApp,
  signedTelegramInitData,
  playStreamResponse,
  waitForAdventureComposerIdle,
  waitForGameScreenIdle,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const COMBAT_ACTIONS = /combat actions|bojové akce/i;
const COMBAT_BEAT = /latest combat beat|nejnovější bojový moment/i;
const ATTACK_BTN = /^Attack$|^Útok$/i;
const END_TURN_BTN = /^End turn$|^Konec tahu$/i;
const DECLINE_REACTION = /decline reaction|odmítnout reakci/i;

function formatGhoulCombatDiagnostics(state: CharacterSnapshot, extra?: string): string {
  return JSON.stringify(
    {
      location: state.location,
      level: state.level,
      hp: state.hp,
      max_hp: state.max_hp,
      in_combat: state.in_combat,
      combat_turn: state.combat_turn,
      combat_round: state.combat_round,
      combat_reaction_pending: state.combat_reaction_pending,
      combatant: state.combatant?.name,
      conditions: state.conditions,
      combat_flags: state.combat_flags,
      extra,
    },
    null,
    2,
  );
}

async function uiDeclineReactionIfNeeded(page: Page) {
  const deck = page.getByRole('group', { name: COMBAT_ACTIONS });
  const decline = deck.getByRole('button', { name: DECLINE_REACTION });
  if (await decline.isVisible().catch(() => false) && await decline.isEnabled().catch(() => false)) {
    const streamDone = playStreamResponse(page);
    await decline.click();
    await streamDone;
    await waitForGameScreenIdle(page).catch(() => undefined);
  }
}

async function uiEngageGhoulOrThrow(
  page: Page,
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  const before = await fetchCharacterState(request, token, characterId);
  if (before.in_combat) return;
  if (!/Sunken Corridor|Potopen/i.test(before.location ?? '')) {
    throw new Error(
      `Ghoul engage: must be in Sunken Corridor.\n${formatGhoulCombatDiagnostics(before)}`,
    );
  }
  const streamDone = playStreamResponse(page);
  await page.getByRole('textbox', { name: ACTION_TEXTBOX }).fill('attack ghoul');
  await page.getByRole('button', { name: SEND_ACTION_BTN }).click();
  await streamDone;
  await waitForAdventureComposerIdle(page).catch(() => undefined);
  const after = await fetchCharacterState(request, token, characterId);
  if (!after.in_combat) {
    throw new Error(
      `Ghoul engage rejected (not in combat after UI attack ghoul).\n${formatGhoulCombatDiagnostics(after)}`,
    );
  }
}

async function uiPlayerCombatStep(page: Page) {
  const deck = page.getByRole('group', { name: COMBAT_ACTIONS });
  await expect(deck).toBeVisible({ timeout: 15_000 });
  const attack = deck.getByRole('button', { name: ATTACK_BTN }).first();
  if (await attack.isEnabled().catch(() => false)) {
    const streamDone = playStreamResponse(page);
    await attack.click();
    await streamDone;
    await waitForGameScreenIdle(page).catch(() => undefined);
  }
  const endTurn = deck.getByRole('button', { name: END_TURN_BTN }).first();
  if (await endTurn.isEnabled().catch(() => false)) {
    const streamDone = playStreamResponse(page);
    await endTurn.click();
    await streamDone;
    await waitForGameScreenIdle(page).catch(() => undefined);
  }
}

/**
 * E2E harness: deterministic per-character RNG when E2E_RNG_SEED is set (see app/e2e_rng.py).
 * Fixture prep may use API; combat actions use the UI combat deck / composer.
 */
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
  await recoverForGhoulEncounter(request, token, characterId!, 8);
  await syncPlayScreen(page);

  let paralyzed = false;
  for (let round = 0; round < 24; round += 1) {
    let state = await fetchCharacterState(request, token, characterId!);
    if (state.conditions?.some(c => c.condition_id === 'paralyzed')) {
      paralyzed = true;
      break;
    }
    if ((state.hp ?? 1) <= 0 || isMvpCombatDefeatRecovery(state)) {
      await recoverForGhoulEncounter(request, token, characterId!, 8);
      await syncPlayScreen(page);
      continue;
    }

    await uiDeclineReactionIfNeeded(page);
    state = await fetchCharacterState(request, token, characterId!);
    if (isCombatReactionPending(state)) {
      await resolvePendingReactionForE2E(request, token, characterId!);
      continue;
    }

    if (!state.in_combat) {
      await uiEngageGhoulOrThrow(page, request, token, characterId!);
      continue;
    }

    if (state.combat_turn === 'player') {
      await uiPlayerCombatStep(page);
      continue;
    }

    await page.waitForTimeout(250);
  }

  const finalState = await fetchCharacterState(request, token, characterId!);
  if (!paralyzed && !finalState.conditions?.some(c => c.condition_id === 'paralyzed')) {
    throw new Error(
      `Ghoul paralysis not reached in 24 UI rounds.\n${formatGhoulCombatDiagnostics(finalState)}`,
    );
  }

  await reviveIfFallen(request, token, characterId!);
  await syncPlayScreen(page);
  const beforeTurn = await fetchCharacterState(request, token, characterId!);
  expect(beforeTurn.conditions?.some(c => c.condition_id === 'paralyzed')).toBeTruthy();
  await expect(page.getByText(/paralyz|paralyzed|Paralyza/i).first()).toBeVisible({ timeout: 30_000 });

  const blockedOrSave = /paralyz|cannot act|neschopný|repeat save|end of your turn|konce tvého tahu|saving throw|záchranný hod/i;
  const deck = page.getByRole('group', { name: COMBAT_ACTIONS });
  if (await deck.isVisible().catch(() => false)) {
    const streamDone = playStreamResponse(page);
    await deck.getByRole('button', { name: ATTACK_BTN }).click();
    await streamDone;
    await waitForGameScreenIdle(page);
  } else {
    const streamDone = playStreamResponse(page);
    await page.getByRole('textbox', { name: ACTION_TEXTBOX }).fill('attack ghoul');
    await page.getByRole('button', { name: SEND_ACTION_BTN }).click();
    await streamDone;
    await waitForAdventureComposerIdle(page);
  }
  const mechanics = page.getByRole('button', { name: /mechanical details|mechanické detaily/i });
  if (await mechanics.isVisible().catch(() => false)) {
    await mechanics.click();
  }
  const combatBeat = page.getByRole('region', { name: COMBAT_BEAT });
  const journal = page.getByRole('log', { name: /Adventure journal|Dobrodružný deník/i });
  await expect(combatBeat.or(journal)).toContainText(blockedOrSave, { timeout: 30_000 });
});
