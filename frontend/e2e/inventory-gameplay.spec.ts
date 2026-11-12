import { expect, test } from '@playwright/test';
import {
  earnChapterOneShopGold,
  ensureHpBelowMaxForPotionUse,
  fetchCharacterState,
  leaveCombatIfNeeded,
  postGameAction,
  syncPlayScreen,
  travelToLocation,
} from './chapter-one-e2e-helpers.ts';
import {
  completeWizardFighter,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForCharacterInventoryIdle,
} from './telegram.ts';
import { apiTelegramToken } from './telegram.ts';

const API = 'http://127.0.0.1:8001';

test('inventory hub: equip, potion via shop, reload keeps state', async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const telegramId = 739_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardFighter(page, 'Inv34');
  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Character$/i }).click();
  const acVital = page.locator('.char-v2-vital').filter({ has: page.locator('small', { hasText: /^AC$/i }) }).locator('strong');
  await expect(acVital).toHaveText('19');

  await page.getByRole('button', { name: /shield/i }).first().click();
  await page.getByRole('button', { name: /^Unequip shield$/i }).click();
  await waitForCharacterInventoryIdle(page);
  await expect(acVital).toHaveText('17', { timeout: 20_000 });

  /** Engine: bell +10, crypt +15, bandit evidence +20 on Folk Hero start gold (45 gp potion at Nib). */
  let state = await earnChapterOneShopGold(request, token, characterId!, 45);
  const goldBefore = state.gold ?? 0;
  expect(goldBefore, `Need 45 gp for potion; have ${goldBefore}`).toBeGreaterThanOrEqual(45);
  await travelToLocation(request, token, characterId!, 'The Goblin Market');
  await postGameAction(request, token, characterId!, 'buy healing potion');
  state = await fetchCharacterState(request, token, characterId!);
  expect((state.inventory as string[]).some(i => i.toLowerCase().includes('potion'))).toBeTruthy();
  expect(state.gold as number).toBeLessThan(goldBefore);

  await ensureHpBelowMaxForPotionUse(request, token, characterId!);
  state = await fetchCharacterState(request, token, characterId!);
  const hpBefore = state.hp as number;
  await postGameAction(request, token, characterId!, 'use potion');
  const afterPotion = await fetchCharacterState(request, token, characterId!);
  expect(afterPotion.hp as number).toBeGreaterThanOrEqual(hpBefore);
  expect((afterPotion.inventory as string[]).filter(i => i.toLowerCase().includes('potion')).length).toBe(0);

  const afterReload = await fetchCharacterState(request, token, characterId!);
  expect(afterReload.armor_class).toBe(afterPotion.armor_class);
  expect((afterReload.inventory as string[]).filter(i => i.toLowerCase().includes('potion')).length).toBe(0);

  await leaveCombatIfNeeded(request, token, characterId!);
  await page.reload();
  await syncPlayScreen(page);
  await expect(page.getByRole('log', { name: /adventure journal|deník dobrodružství/i })).toBeVisible({ timeout: 20_000 });
});
