import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchCharacterState,
  isCombatReactionPending,
  resolvePendingReactionForE2E,
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
const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const REPO_SHOTS = path.join(REPO_ROOT, 'docs/pr-screenshots/combat-p0a');
const WIDTHS = [320, 360, 375, 390, 430] as const;
const TARGET_DISTANCE_FT = 120;

function patchE2ECharacter(characterId: string, ...extraArgs: string[]) {
  const dbDir = process.env.E2E_DATABASE_DIRECTORY;
  const e2ePython = process.env.E2E_PYTHON;
  if (!dbDir || !e2ePython) {
    throw new Error('E2E_DATABASE_DIRECTORY and E2E_PYTHON must be set');
  }
  const dbPath = path.join(dbDir, 'e2e.db');
  const grantScript = path.join(REPO_ROOT, 'frontend/e2e/support/grant-character-spells.py');
  execFileSync(e2ePython, [grantScript, dbPath, characterId, ...extraArgs], { cwd: REPO_ROOT, stdio: 'pipe' });
}

async function stabilizePlayerTurn(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  characterId: string,
) {
  await resolvePendingReactionForE2E(request, token, characterId);
  await expect.poll(async () => {
    const probe = await fetchCharacterState(request, token, characterId);
    return probe.combat_turn === 'player' && !isCombatReactionPending(probe);
  }, { timeout: 90_000 }).toBe(true);
}

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`combat P0a spell range ${width}px @ 120 ft`, async ({ page, request }, testInfo) => {
    test.setTimeout(300_000);
    mkdirSync(REPO_SHOTS, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.spellGameplay + 60_000 + width;
    const initData = signedTelegramInitData(telegramId);
    await page.setViewportSize({ width, height: 920 });
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
        name: `P0a cleric ${width}`,
        race: 'human',
        character_class: 'cleric',
        divine_domain: 'life',
        cantrips: ['Guidance', 'Sacred Flame', 'Spare the Dying'],
        level_one_spells: ['Bless', 'Cure Wounds', 'Healing Word', 'Shield of Faith'],
        abilities: { strength: 10, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 16, charisma: 10 },
      },
    });
    expect(response.ok()).toBeTruthy();
    const cleric = await response.json() as { id: string };

    patchE2ECharacter(cleric.id, 'Fire Bolt');
    await startCellarCombat(request, token, cleric.id, 'goblin scout');
    const mid = await fetchCharacterState(request, token, cleric.id);
    expect(mid.in_combat).toBeTruthy();
    patchE2ECharacter(cleric.id, '--distance-ft', String(TARGET_DISTANCE_FT));
    const distState = await fetchCharacterState(request, token, cleric.id);
    const dist = distState.combat_tactics?.distance_ft ?? distState.combat_distance_ft ?? 0;
    expect(dist).toBe(TARGET_DISTANCE_FT);

    const state = await fetchCharacterState(request, token, cleric.id);
    const sacredRow = state.combat_tactics?.spells?.find((s: { name: string }) => s.name === 'Sacred Flame');
    const fireBoltRow = state.combat_tactics?.spells?.find((s: { name: string }) => s.name === 'Fire Bolt');
    expect(sacredRow?.can_cast).toBe(false);
    expect(fireBoltRow?.can_cast).toBe(true);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
    await waitForGameScreenIdle(page);

    await stabilizePlayerTurn(request, token, cleric.id);
    await page.reload();
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
    await waitForGameScreenIdle(page);

    const combat = page.locator('.combat-screen.combat-v2');
    await expect(combat).toBeVisible({ timeout: 30_000 });
    const declineReaction = page.getByRole('button', { name: /Odmítnout reakci|Decline reaction/i });
    if (await declineReaction.isVisible().catch(() => false)) {
      await declineReaction.click();
      await waitForGameScreenIdle(page);
    }

    await expect(page.locator('.combat-action-deck .combat-action-grid-main')).toBeVisible();
    await page.locator('[data-combat-action-id="abilities"]').click();
    await expect(page.locator('.combat-subpanel')).toBeVisible({ timeout: 15_000 });

    const sacredFlame = page.locator('[data-combat-action-id="spell-Sacred Flame"]');
    const fireBolt = page.locator('[data-combat-action-id="spell-Fire Bolt"]');
    await expect(sacredFlame).toBeDisabled();
    await expect(fireBolt).toBeEnabled();

    const reason = sacredFlame.locator('.combat-action-reason');
    await expect(reason).toBeVisible();
    await expect(reason).toHaveText('Posvátný plamen má dosah 18 m. Nepřítel je 36 m daleko.');
    await sacredFlame.scrollIntoViewIfNeeded();
    await fireBolt.scrollIntoViewIfNeeded();

    const outfile = path.join(REPO_SHOTS, `combat-p0a-spell-range-${width}px.png`);
    await combat.screenshot({ path: outfile });
    await testInfo.attach(`combat-p0a-spell-range-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}