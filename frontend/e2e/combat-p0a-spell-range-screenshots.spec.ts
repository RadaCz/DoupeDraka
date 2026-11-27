import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  fetchCharacterState,
  postGameAction,
  startCellarCombat,
} from './chapter-one-e2e-helpers.ts';
import {
  apiTelegramToken,
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForGameScreenIdle,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';
const REPO_SHOTS = path.resolve(import.meta.dirname, '../../docs/pr-screenshots/combat-p0a');
const WIDTHS = [320, 360, 375, 390, 430] as const;

async function retreatBeyondSpellRange(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  characterId: string,
) {
  for (let round = 0; round < 8; round += 1) {
    const state = await fetchCharacterState(request, token, characterId);
    const dist = state.combat_tactics?.distance_ft ?? state.combat_distance_ft ?? 0;
    if (dist > 120) return;
    if (!state.in_combat || state.combat_turn !== 'player') {
      await postGameAction(request, token, characterId, 'end turn');
      continue;
    }
    const move = Math.min(state.combat_tactics?.movement_remaining_ft ?? 30, 125 - dist);
    if (move > 0) {
      await postGameAction(request, token, characterId, `retreat ${move} ft`);
    } else {
      await postGameAction(request, token, characterId, 'end turn');
    }
  }
}

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`combat P0a blocked spell ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    mkdirSync(REPO_SHOTS, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.spellGameplay + 50_000 + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, initData);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('app_locale', 'cs');
      } catch { /* ignore */ }
    });
    const token = await apiTelegramToken(request, initData);

    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `P0a wizard ${width}`,
        race: 'human',
        character_class: 'wizard',
        cantrips: ['Fire Bolt', 'Mage Hand', 'Light'],
        level_one_spells: ['Magic Missile', 'Mage Armor', 'Burning Hands', 'Shield'],
        abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 8 },
      },
    });
    expect(response.ok()).toBeTruthy();
    const wizard = await response.json() as { id: string };

    await startCellarCombat(request, token, wizard.id, 'goblin scout');
    await retreatBeyondSpellRange(request, token, wizard.id);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
    await waitForGameScreenIdle(page);

    const combat = page.locator('.combat-screen.combat-v2');
    await expect(combat).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Bojové schopnosti|Combat abilities/i }).click();
    const fireBolt = page.getByRole('button', { name: /Ohnivý paprsek|Fire Bolt/i }).first();
    await expect(fireBolt).toBeDisabled({ timeout: 15_000 });

    const outfile = path.join(REPO_SHOTS, `blocked-fire-bolt-${width}px.png`);
    await combat.screenshot({ path: outfile });
    await testInfo.attach(`blocked-fire-bolt-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}