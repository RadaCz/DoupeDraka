import { expect, test } from '@playwright/test';
import {
  backToAdventure,
  clickQuestChip,
  completeVaultDescentViaEngine,
  fetchCharacterState,
  syncPlayScreen,
  mapTravelTo,
  openMap,
  completeBossViaEngine,
  waitForActionRound,
  waitForQuestFlag,
  apiTelegramToken,
} from './chapter-one-e2e-helpers.ts';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

test.describe.configure({ mode: 'serial' });
test.setTimeout(900_000);

test('completes chapter one through UI chips and map travel', async ({ page, request }, testInfo) => {
  const marks: Record<string, number> = {};
  const phase = (label: string) => {
    marks[label] = Date.now();
  };
  const started = Date.now();
  phase('start');

  const telegramId = 755_000_000 + testInfo.workerIndex;
  const initData = signedTelegramInitData(telegramId);
  await mockTelegramWebApp(page, initData);
  await page.goto('/');
  await completeWizardFighter(page, 'Chapter One E2E');
  phase('wizard');

  const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
  expect(characterId).toBeTruthy();
  const token = await apiTelegramToken(request, initData);

  let state = await fetchCharacterState(request, token, characterId!);
  expect(state.location).toMatch(/Whispering Cellar|Šeptající/i);

  await openMap(page);
  await mapTravelTo(page, /Sunken Corridor|Potopen/i);
  await openMap(page);
  await mapTravelTo(page, /Shrine|Forgotten|Svatyn/i);

  phase('travel_shrine');
  await clickQuestChip(page, /Caldus|zvon|bell/i);
  await waitForQuestFlag(request, token, characterId!, 'bell_quest_accepted');
  phase('caldus_quest');
  const journal = page.getByRole('log', { name: /adventure journal|deník dobrodružství/i });
  await expect(journal).toContainText(/Goblin Market|goblin|Nib|trh/i, { timeout: 30_000 });

  await clickQuestChip(page, /Goblin Market|Gobliní trh|Travel to/i);
  await waitForActionRound(page);
  state = await fetchCharacterState(request, token, characterId!);
  if (!state.location.includes('Goblin Market')) {
    await openMap(page);
    await mapTravelTo(page, /Goblin Market|Gobliní trh/i);
    await backToAdventure(page);
  }

  await clickQuestChip(page, /Nib|zvon|bell/i);
  await waitForQuestFlag(request, token, characterId!, 'bell_acquired');
  await expect(journal).toContainText(/shrine bell|chrámový zvon|bell/i, { timeout: 30_000 });

  await clickQuestChip(page, /Shrine|Svatyn|Travel to/i);
  await waitForActionRound(page);
  state = await fetchCharacterState(request, token, characterId!);
  if (!state.location.includes('Shrine')) {
    await openMap(page);
    await mapTravelTo(page, /Shrine|Forgotten|Svatyn/i);
    await backToAdventure(page);
  }

  await clickQuestChip(page, /Return|Vratit|bell|zvon/i);
  await waitForQuestFlag(request, token, characterId!, 'bell_quest_complete');
  await expect(journal).toContainText(/gold|XP|zlato|30/i, { timeout: 30_000 });

  await clickQuestChip(page, /Vault|Krypt|Caldus/i);
  await waitForQuestFlag(request, token, characterId!, 'vault_unlocked');
  phase('vault_unlocked');

  await openMap(page);
  await mapTravelTo(page, /Sunken Corridor|Potopen/i);
  await backToAdventure(page);
  await completeVaultDescentViaEngine(request, token, characterId!);
  phase('vault_descent_l3');
  await syncPlayScreen(page);

  await openMap(page);
  await mapTravelTo(page, /Bell Warden|Jáma strážce/i);
  await backToAdventure(page);

  state = await fetchCharacterState(request, token, characterId!);
  expect(state.location).toMatch(/Bell Warden|Pit|Jáma/i);

  await expect(
    page.locator('.suggested-actions-row button').filter({ hasText: /Bell Warden|Strážce zvonu|Face/i }),
  ).toBeVisible();
  const pitReady = await fetchCharacterState(request, token, characterId!);
  expect(pitReady.level, 'Bell Warden gate expects L3+').toBeGreaterThanOrEqual(3);
  await completeBossViaEngine(request, token, characterId!);
  phase('boss_complete');
  await syncPlayScreen(page);
  await expect(page.getByRole('log', { name: /adventure journal|deník dobrodružství/i })).toContainText(
    /Chapter complete|kapitol|bells fall silent|Warden.*defeated|zlato/i,
    { timeout: 45_000 },
  );
  phase('done');
  const order = Object.keys(marks);
  const timings = order.map((key, index) => {
    const end = index + 1 < order.length ? marks[order[index + 1]!]! : Date.now();
    return `${key}=${((end - marks[key]!) / 1000).toFixed(1)}s`;
  });
  timings.push(`total=${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.info(`[chapter-one-e2e] ${timings.join(' ')}`);
});
