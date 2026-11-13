import { expect, test } from '@playwright/test';
import {
  fetchCharacterState,
  postGameAction,
  resolvePendingReactionForE2E,
  startCellarCombat,
  syncCombatOrAdventurePlay,
  waitForPlayerCombatTurn,
} from './chapter-one-e2e-helpers.ts';
import {
  apiTelegramToken,
  completeWizardWizardCaster,
  mockTelegramWebApp,
  signedTelegramInitData,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

test('wizard Burning Hands shows monster saving throw and reduced HP', async ({ page, request }, testInfo) => {
  const telegramId = E2E_TELEGRAM_ID.spellSave + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardWizardCaster(page, 'Spell Save E2E');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  await startCellarCombat(request, token, characterId!);
  await waitForPlayerCombatTurn(request, token, characterId!);
  await resolvePendingReactionForE2E(request, token, characterId!);
  const before = await fetchCharacterState(request, token, characterId!);
  expect(before.in_combat).toBeTruthy();
  const foeHp = before.combatant?.hp ?? 5;

  await postGameAction(request, token, characterId!, 'cast Burning Hands');
  const after = await fetchCharacterState(request, token, characterId!);
  expect(after.combatant?.hp ?? 0).toBeLessThan(foeHp);

  // Sync combat play UI (journal shares the combat screen; do not require adventure-only layout).
  await syncCombatOrAdventurePlay(page);
  const journal = page.getByRole('log', { name: /adventure journal|dobrodružn[yý] den[ií]k|den[ií]k dobrodružstv/i });
  await expect(journal).toBeVisible({ timeout: 45_000 });
  await expect(journal).toContainText(/saving throw|záchranný hod|dexterity save|obratnost/i, { timeout: 45_000 });
  await expect(journal).toContainText(/Burning Hands|Hořící dlaně|Horici dlane/i);
});
