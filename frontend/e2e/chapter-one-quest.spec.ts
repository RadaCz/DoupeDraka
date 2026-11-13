import { expect, test } from '@playwright/test';
import {
  backToAdventure,
  clickQuestChip,
  fetchCharacterState,
  mapTravelTo,
  openMap,
  waitForActionRound,
  waitForQuestFlag,
  apiTelegramToken,
} from './chapter-one-e2e-helpers.ts';
import { completeWizardFighter, mockTelegramWebApp, signedTelegramInitData } from './telegram.ts';

/**
 * Sprint 38 — UI proof for the bell quest through vault unlock only.
 * Vault grind and Bell Warden completion are engine/pytest and bell-warden-ui.spec.ts —
 * this file must not claim UI completion of API-driven steps.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('UI bell quest: map travel, Caldus/Nib, vault unlock (no engine boss)', async ({ page, request }, testInfo) => {
  const marks: Record<string, number> = {};
  const phase = (label: string) => {
    marks[label] = Date.now();
  };
  const dumpPhases = (reason: string) => {
    const order = Object.keys(marks);
    const timings = order.map((key, index) => {
      const end = index + 1 < order.length ? marks[order[index + 1]!]! : Date.now();
      return `${key}=${((end - marks[key]!) / 1000).toFixed(1)}s`;
    });
    console.error(`[chapter-one-ui] FAIL ${reason} | ${timings.join(' ')}`);
  };
  const started = Date.now();
  phase('start');

  try {
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

    state = await fetchCharacterState(request, token, characterId!);
    expect(state.quest_flags?.vault_unlocked).toBe(true);
    expect(state.quest_flags?.chapter_one_complete).toBeFalsy();
    // Honest boundary: vault descent + boss are NOT claimed here.
    phase('done');
    const order = Object.keys(marks);
    const timings = order.map((key, index) => {
      const end = index + 1 < order.length ? marks[order[index + 1]!]! : Date.now();
      return `${key}=${((end - marks[key]!) / 1000).toFixed(1)}s`;
    });
    timings.push(`total=${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.info(`[chapter-one-ui] ${timings.join(' ')}`);
  } catch (error) {
    dumpPhases(error instanceof Error ? error.message : String(error));
    const characterId = await page.evaluate(() => localStorage.getItem('active_character_id'));
    if (characterId) {
      try {
        const token = await apiTelegramToken(request, signedTelegramInitData(755_000_000 + testInfo.workerIndex));
        const snap = await fetchCharacterState(request, token, characterId);
        console.error(
          `[chapter-one-ui] state location=${snap.location} hp=${snap.hp}/${snap.max_hp} `
            + `level=${snap.level} in_combat=${snap.in_combat} flags=${JSON.stringify(snap.quest_flags)}`,
        );
      } catch (diagErr) {
        console.error(`[chapter-one-ui] state dump failed: ${diagErr}`);
      }
    }
    throw error;
  }
});
