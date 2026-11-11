import { expect, test } from '@playwright/test';
import { fetchCharacterState, postGameAction, syncPlayScreen } from './chapter-one-e2e-helpers.ts';
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

  await postGameAction(request, token, characterId!, 'travel to The Sunken Corridor');
  for (let round = 0; round < 6; round += 1) {
    const state = await fetchCharacterState(request, token, characterId!);
    if (state.in_combat && (state.combatant?.hp ?? 0) > 0) break;
    await postGameAction(request, token, characterId!, 'attack goblin scout');
  }
  const before = await fetchCharacterState(request, token, characterId!);
  expect(before.in_combat).toBeTruthy();
  const foeHp = before.combatant?.hp ?? 5;

  await postGameAction(request, token, characterId!, 'cast Burning Hands');
  await syncPlayScreen(page);

  const journal = page.getByRole('log', { name: /Adventure journal|Dobrodružný deník/i });
  await expect(journal).toContainText(/saving throw|záchranný hod/i, { timeout: 45_000 });
  await expect(journal).toContainText(/Burning Hands|Hořící dlaně/i);

  const after = await fetchCharacterState(request, token, characterId!);
  expect(after.combatant?.hp ?? 0).toBeLessThan(foeHp);
});
