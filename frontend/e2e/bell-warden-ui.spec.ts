import { expect, test } from '@playwright/test';
import {
  backToAdventure,
  clickQuestChip,
  completeBellWardenBossViaUI,
  completeVaultDescentViaEngine,
  fetchCharacterState,
  leaveCombatIfNeeded,
  mapTravelTo,
  openMap,
  syncPlayScreen,
  waitForQuestFlag,
  apiTelegramToken,
} from './chapter-one-e2e-helpers.ts';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

/**
 * Sprint 37.1 — Bell Warden defeat exclusively through Playwright UI (combat deck + quest chips).
 * Quest grind to L3 still uses engine stream actions (same endpoints the UI calls); boss phase bans API attack loops.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(900_000);

test('Bell Warden chapter finale via UI combat deck', async ({ page, request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.bellWardenUI + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardFighter(page, 'Bell UI E2E');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  await openMap(page);
  await mapTravelTo(page, /Sunken Corridor|Potopen/i);
  await openMap(page);
  await mapTravelTo(page, /Shrine|Forgotten|Svatyn/i);

  await clickQuestChip(page, /Caldus|zvon|bell/i);
  await waitForQuestFlag(request, token, characterId!, 'bell_quest_accepted');

  await clickQuestChip(page, /Goblin Market|Gobliní trh|Travel to/i);
  await clickQuestChip(page, /Nib|zvon|bell/i);
  await waitForQuestFlag(request, token, characterId!, 'bell_acquired');

  await clickQuestChip(page, /Shrine|Svatyn|Travel to/i);
  await clickQuestChip(page, /Return|Vratit|bell|zvon/i);
  await waitForQuestFlag(request, token, characterId!, 'bell_quest_complete');

  await clickQuestChip(page, /Vault|Krypt|Caldus/i);
  await waitForQuestFlag(request, token, characterId!, 'vault_unlocked');

  await openMap(page);
  await mapTravelTo(page, /Sunken Corridor|Potopen/i);
  await backToAdventure(page);
  await completeVaultDescentViaEngine(request, token, characterId!);
  await leaveCombatIfNeeded(request, token, characterId!, 60);
  await syncPlayScreen(page);

  await openMap(page);
  await mapTravelTo(page, /Bell Warden|Jáma strážce/i);
  await backToAdventure(page);

  const pit = await fetchCharacterState(request, token, characterId!);
  expect(pit.location).toMatch(/Bell Warden|Pit|Jáma/i);
  expect(pit.level).toBeGreaterThanOrEqual(3);
  expect(pit.quest_flags?.vault_unlocked).toBe(true);

  let tokenAfterBoss = await completeBellWardenBossViaUI(page, request, token, characterId!, initData);
  tokenAfterBoss = await apiTelegramToken(request, initData);
  const done = await fetchCharacterState(request, tokenAfterBoss, characterId!);
  expect(done.quest_flags?.chapter_one_complete).toBe(true);
  expect(done.in_combat).toBeFalsy();
});
