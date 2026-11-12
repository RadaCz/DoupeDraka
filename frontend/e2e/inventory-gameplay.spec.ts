import { expect, test } from '@playwright/test';
import {
  fetchCharacterState,
  postGameAction,
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

  let state = await fetchCharacterState(request, token, characterId!);
  const goldBefore = state.gold as number;
  await postGameAction(request, token, characterId!, 'travel to The Goblin Market');
  await postGameAction(request, token, characterId!, 'buy healing potion');
  state = await fetchCharacterState(request, token, characterId!);
  expect((state.inventory as string[]).some(i => i.toLowerCase().includes('potion'))).toBeTruthy();
  expect(state.gold as number).toBeLessThan(goldBefore);

  const hpBefore = state.hp as number;
  await postGameAction(request, token, characterId!, 'use potion');
  const afterPotion = await fetchCharacterState(request, token, characterId!);
  expect(afterPotion.hp as number).toBeGreaterThanOrEqual(hpBefore);
  expect((afterPotion.inventory as string[]).filter(i => i.toLowerCase().includes('potion')).length).toBe(0);

  const afterReload = await fetchCharacterState(request, token, characterId!);
  expect(afterReload.armor_class).toBe(afterPotion.armor_class);
  expect((afterReload.inventory as string[]).filter(i => i.toLowerCase().includes('potion')).length).toBe(0);

  await page.reload();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Adventure$/i }).click();
  await expect(page.getByRole('heading', { name: /Whispering|Goblin|Šeptající/i })).toBeVisible({ timeout: 20_000 });
});
