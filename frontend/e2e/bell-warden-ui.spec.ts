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
} from './chapter-one-e2e-helpers.ts';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

/**
 * Sprint 38 — Bell Warden UI fight.
 * Fixture (engine) may prepare quest/vault/level/location.
 * Boss damage, victory flag, and persistence must come from the UI combat deck.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

test('Bell Warden boss fight via UI combat deck (fixture prep OK)', async ({ page, request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.bellWardenUI + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardFighter(page, 'Bell UI E2E');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  // Fixture prep — not claimed as UI gameplay.
  await completeBellQuestViaEngine(request, token, characterId!);
  await unlockVaultViaCaldusAfterBell(request, token, characterId!);
  await travelToLocation(request, token, characterId!, 'The Sunken Corridor');
  await completeVaultDescentViaEngine(request, token, characterId!);
  await leaveCombatIfNeeded(request, token, characterId!, 40);

  const preBoss = await fetchCharacterState(request, token, characterId!);
  expect(preBoss.level).toBeGreaterThanOrEqual(3);
  expect(preBoss.quest_flags?.vault_unlocked).toBe(true);

  let tokenAfterBoss = await completeBellWardenBossViaUI(page, request, token, characterId!, initData);
  tokenAfterBoss = await apiTelegramToken(request, initData);
  const done = await fetchCharacterState(request, tokenAfterBoss, characterId!);
  expect(done.quest_flags?.chapter_one_complete).toBe(true);
  expect(done.in_combat).toBeFalsy();
});
