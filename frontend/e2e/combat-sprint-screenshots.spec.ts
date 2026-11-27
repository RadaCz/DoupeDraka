import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCellarCombat, syncPlayScreen } from './chapter-one-e2e-helpers.ts';
import {
  apiTelegramToken,
  HOME_HEADING,
  mockTelegramWebApp,
  signedTelegramInitData,
  waitForGameScreenIdle,
} from './telegram.ts';
import { E2E_TELEGRAM_ID } from './test-config.ts';

const API = 'http://127.0.0.1:8001';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/pr-screenshots/combat-sprint');

const WIDTHS = [320, 360, 375, 390, 430] as const;

test.describe.configure({ mode: 'serial' });

function csInitData(telegramId: number) {
  return signedTelegramInitData(telegramId, { language_code: 'cs' });
}

function patchKoboldAt18m(characterId: string, page: Page) {
  return page.route(new RegExp(`/characters/${characterId}(\\?|$)`), async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const upstream = await route.fetch();
    const body = await upstream.json() as Record<string, unknown>;
    const tactics = (body.combat_tactics as Record<string, unknown> | undefined) ?? {};
    body.combat_distance_ft = 60;
    body.combat_tactics = {
      ...tactics,
      distance_ft: 60,
      movement_remaining_ft: tactics.movement_remaining_ft ?? 30,
      speed_ft: tactics.speed_ft ?? 30,
      weapon_range: tactics.weapon_range ?? {
        can_attack: false,
        normal_ft: 5,
        long_ft: 0,
        weapon_key: 'longsword',
        denial: 'Out of weapon reach.',
      },
    };
    body.combatant = {
      ...(body.combatant as Record<string, unknown> | undefined),
      name: 'Kobold skirmisher',
      hp: 5,
      max_hp: 5,
      armor_class: 12,
    };
    body.in_combat = true;
    body.combat_turn = 'player';
    await route.fulfill({
      status: upstream.status(),
      headers: upstream.headers(),
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

for (const width of WIDTHS) {
  test(`combat sprint panel ${width}px (cs, 18 m)`, async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });
    const telegramId = E2E_TELEGRAM_ID.classIdentity + 10_000 + width;
    const initData = csInitData(telegramId);
    await page.setViewportSize({ width, height: 820 });
    await mockTelegramWebApp(page, initData);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('app_locale', 'cs');
      } catch {
        /* ignore */
      }
    });
    const token = await apiTelegramToken(request, initData);

    const response = await request.post(`${API}/characters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `Sprint UI ${width}`,
        race: 'human',
        character_class: 'fighter',
        abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      },
    });
    expect(response.ok()).toBeTruthy();
    const fighter = await response.json() as { id: string };

    await startCellarCombat(request, token, fighter.id, 'goblin scout');
    await patchKoboldAt18m(fighter.id, page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /continue adventure|pokračovat/i }).click();
    await waitForGameScreenIdle(page);
    await syncPlayScreen(page);

    const combat = page.locator('.combat-screen.combat-v2');
    await expect(combat).toBeVisible({ timeout: 30_000 });
    await expect(combat.getByText(/18\s*m/i)).toBeVisible({ timeout: 15_000 });
    const sprintBtn = page.getByRole('button', { name: /^Sprint$/i });
    await expect(sprintBtn).toBeVisible({ timeout: 15_000 });
    await expect(sprintBtn).toBeEnabled();

    if (width === 320) {
      const disengage = page.locator('[data-combat-action-id="disengage"]');
      await expect(disengage).toBeVisible();
      const labelFits = await disengage.evaluate(btn => {
        const label = btn.querySelector('.combat-action-label');
        if (!label) return false;
        const pad = 4;
        const btnRect = btn.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        return labelRect.right <= btnRect.right - pad && labelRect.left >= btnRect.left + pad;
      });
      expect(labelFits).toBe(true);
    }

    const outfile = `${OUT}/combat-sprint-tactics-${width}px.png`;
    await combat.screenshot({ path: outfile });
    await testInfo.attach(`combat-sprint-${width}px`, { path: outfile, contentType: 'image/png' });
  });
}