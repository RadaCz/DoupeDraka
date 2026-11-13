import { expect, test } from '@playwright/test';
import {
  completeBellQuestViaEngine,
  completeBellWardenBossViaUI,
  completeVaultDescentViaEngine,
  fetchCharacterState,
  leaveCombatIfNeeded,
  travelToLocation,
  apiTelegramToken,
  unlockVaultViaCaldusAfterBell,
  bossLoopSnapshot,
} from './chapter-one-e2e-helpers.ts';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

/**
 * Sprint 38 — Bell Warden UI fight.
 * Fixture (engine) may prepare quest/vault/level/location.
 * Boss damage, victory flag, and persistence must come from the UI combat deck.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(210_000);

test('Bell Warden boss fight via UI combat deck (fixture prep OK)', async ({ page, request }, testInfo) => {
  const actionTrace: string[] = [];
  const telegramId = E2E_TELEGRAM_ID.bellWardenUI + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);

  await test.step('Telegram mock + character creation', async () => {
    await mockTelegramWebApp(page, initData);
    await page.goto('/');
    await completeWizardFighter(page, 'Bell UI E2E');
  });

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  let token = await apiTelegramToken(request, initData);

  await test.step('Engine fixture prep (quest, vault, corridor)', async () => {
    await completeBellQuestViaEngine(request, token, characterId!);
    await unlockVaultViaCaldusAfterBell(request, token, characterId!);
    await travelToLocation(request, token, characterId!, 'The Sunken Corridor');
    await completeVaultDescentViaEngine(request, token, characterId!);
    await leaveCombatIfNeeded(request, token, characterId!, 40);

    const preBoss = await fetchCharacterState(request, token, characterId!);
    expect(preBoss.level, `fixture level: ${bossLoopSnapshot(preBoss, 0, 'fixture')}`).toBeGreaterThanOrEqual(3);
    expect(preBoss.quest_flags?.vault_unlocked).toBe(true);
  });

  await test.step('UI sync + full-heal boss prep', async () => {
    const probe = await fetchCharacterState(request, token, characterId!);
    expect(probe.in_combat, bossLoopSnapshot(probe, 0, 'pre_fight_in_combat')).toBeFalsy();
  });

  await test.step('Bell Warden UI boss engagement and combat', async () => {
    token = await completeBellWardenBossViaUI(page, request, token, characterId!, initData, 48, {
      onRound: (round, action, state) => {
        actionTrace.push(`r${round}:${action}:${state.combat_round ?? '-'}:${state.hp}/${state.max_hp}:${state.combatant?.hp ?? '-'}`);
      },
    });
  });

  await test.step('Victory persistence + reload', async () => {
    token = await apiTelegramToken(request, initData);
    const done = await fetchCharacterState(request, token, characterId!);
    expect(done.quest_flags?.chapter_one_complete, `trace tail: ${actionTrace.slice(-8).join(' | ')}`).toBe(true);
    expect(done.in_combat).toBeFalsy();
  });
});
