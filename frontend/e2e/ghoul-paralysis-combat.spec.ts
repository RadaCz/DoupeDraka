import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  closeCombatTurnIfStalled,
  ensureLevelAtLeast,
  fetchCharacterState,
  type CharacterSnapshot,
  isCombatReactionPending,
  postCombatAttack,
  postGameAction,
  resolvePendingReactionForE2E,
  reviveIfFallen,
  syncCombatOrAdventurePlay,
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

function formatGhoulCombatDiagnostics(state: CharacterSnapshot, journalTail?: string): string {
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
      journal_tail: journalTail,
    },
    null,
    2,
  );
}

async function advanceGhoulParalysisCombat(
  request: APIRequestContext,
  token: string,
  characterId: string,
): Promise<'paralyzed' | 'continue'> {
  let state = await fetchCharacterState(request, token, characterId);
  await resolvePendingReactionForE2E(request, token, characterId);
  state = await fetchCharacterState(request, token, characterId);

  if (state.conditions?.some(c => c.condition_id === 'paralyzed')) {
    return 'paralyzed';
  }
  if ((state.hp ?? 1) <= 0) {
    await reviveIfFallen(request, token, characterId);
    return 'continue';
  }

  if (isCombatReactionPending(state) || state.combat_turn === 'reaction') {
    await resolvePendingReactionForE2E(request, token, characterId);
    return 'continue';
  }

  if (!state.in_combat) {
    await postGameAction(request, token, characterId, 'attack ghoul');
    await resolvePendingReactionForE2E(request, token, characterId);
    await closeCombatTurnIfStalled(request, token, characterId);
    return 'continue';
  }

  if (state.combat_turn === 'player') {
    await postCombatAttack(request, token, characterId, 'ghoul');
    await resolvePendingReactionForE2E(request, token, characterId);
    return 'continue';
  }

  if (state.combat_turn === 'enemy') {
    const afterEnemy = await fetchCharacterState(request, token, characterId);
    if (!isCombatReactionPending(afterEnemy) && afterEnemy.combat_turn === 'enemy') {
      await postGameAction(request, token, characterId, 'defend');
    }
    return 'continue';
  }

  await resolvePendingReactionForE2E(request, token, characterId);
  return 'continue';
}

/**
 * Requires a fresh E2E_RNG_SEED stream (combat-saves phase / isolated spec run in run-tests.mjs).
 * With seed 27, elf wizard L2 vs ghoul: hit + failed CON save on the second combat exchange.
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
  await postGameAction(request, token, characterId!, 'travel to The Sunken Corridor');

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const outcome = await advanceGhoulParalysisCombat(request, token, characterId!);
    if (outcome === 'paralyzed') break;
  }

  try {
    await expect.poll(async () => {
      const state = await fetchCharacterState(request, token, characterId!);
      await resolvePendingReactionForE2E(request, token, characterId!);
      return state.conditions?.some(c => c.condition_id === 'paralyzed') ?? false;
    }, { timeout: 45_000, intervals: [250, 500, 1000] }).toBe(true);
  } catch (error) {
    await resolvePendingReactionForE2E(request, token, characterId!);
    const state = await fetchCharacterState(request, token, characterId!);
    throw new Error(
      `Ghoul paralysis not applied within 45s.\n${formatGhoulCombatDiagnostics(state)}\n${String(error)}`,
    );
  }

  await reviveIfFallen(request, token, characterId!);
  const playMode = await syncCombatOrAdventurePlay(page);
  const beforeTurn = await fetchCharacterState(request, token, characterId!);
  expect(beforeTurn.conditions?.some(c => c.condition_id === 'paralyzed')).toBeTruthy();
  await expect(page.getByText(/paralyz|paralyzed|Paralyza/i).first()).toBeVisible({ timeout: 30_000 });

  const blockedOrSave = /paralyz|cannot act|neschopný|repeat save|end of your turn|konce tvého tahu|saving throw|záchranný hod/i;

  if (playMode === 'combat') {
    const combatDeck = page.getByRole('group', { name: COMBAT_ACTIONS });
    const streamDone = playStreamResponse(page);
    await combatDeck.getByRole('button', { name: ATTACK_BTN }).click();
    await streamDone;
    await waitForGameScreenIdle(page);
    const mechanics = page.getByRole('button', { name: /mechanical details|mechanické detaily/i });
    if (await mechanics.isVisible().catch(() => false)) {
      await mechanics.click();
    }
    const combatBeat = page.getByRole('region', { name: COMBAT_BEAT });
    const journal = page.getByRole('log', { name: /Adventure journal|Dobrodružný deník/i });
    await expect(combatBeat.or(journal)).toContainText(blockedOrSave, { timeout: 45_000 });
  } else {
    const journal = page.getByRole('log', { name: /Adventure journal|Dobrodružný deník/i });
    const streamDone = playStreamResponse(page);
    await page.getByRole('textbox', { name: ACTION_TEXTBOX }).fill('attack ghoul');
    await page.getByRole('button', { name: SEND_ACTION_BTN }).click();
    await streamDone;
    await waitForAdventureComposerIdle(page);
    await expect(journal).toContainText(blockedOrSave, { timeout: 45_000 });
  }
});
