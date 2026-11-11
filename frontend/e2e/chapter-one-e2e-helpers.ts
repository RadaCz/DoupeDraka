import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiTelegramToken, waitForAdventureComposerReady } from './telegram.ts';

const E2E_API_BASE = 'http://127.0.0.1:8001';

export type CharacterSnapshot = {
  level: number;
  hp?: number;
  quest_flags?: Record<string, boolean>;
  location: string;
  in_combat?: boolean;
  gold?: number;
  combatant?: { name?: string } | null;
  combat_turn?: string;
  conditions?: Array<{ condition_id: string }>;
};

export async function reviveIfFallen(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  const state = await fetchCharacterState(request, token, characterId);
  if (state.hp > 0) return;
  const response = await request.post(`${E2E_API_BASE}/characters/${characterId}/revive`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
}

export async function postGameAction(
  request: APIRequestContext,
  token: string,
  characterId: string,
  action: string,
) {
  const response = await request.post(`${E2E_API_BASE}/characters/${characterId}/actions/stream`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': randomUUID(),
    },
    data: { action },
  });
  expect(response.ok()).toBeTruthy();
  await response.body();
}

export async function fetchCharacterState(
  request: APIRequestContext,
  token: string,
  characterId: string,
): Promise<CharacterSnapshot> {
  const response = await request.get(`${E2E_API_BASE}/characters/${characterId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await expect(response).toBeOK();
  return response.json() as Promise<CharacterSnapshot>;
}

export async function waitForQuestFlag(
  request: APIRequestContext,
  token: string,
  characterId: string,
  flag: string,
  expected = true,
  timeoutMs = 60_000,
) {
  await expect.poll(async () => {
    const state = await fetchCharacterState(request, token, characterId);
    return Boolean(state.quest_flags?.[flag]) === expected;
  }, { timeout: timeoutMs, intervals: [250, 500, 1000] }).toBe(true);
}

const ADVENTURE_JOURNAL = /adventure journal|deník dobrodružství/i;

export async function waitForActionRound(page: Page) {
  const journal = page.getByRole('log', { name: ADVENTURE_JOURNAL });
  await expect(journal).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('button.composer-send[aria-busy="true"]')).toHaveCount(0, { timeout: 45_000 });
  await expect(journal.locator('.journal-action').last()).toBeVisible({ timeout: 45_000 });
}

export async function clickQuestChip(page: Page, pattern: RegExp) {
  const chip = page.locator('.suggested-actions-row button').filter({ hasText: pattern });
  await expect(chip.first()).toBeVisible({ timeout: 20_000 });
  await chip.first().click();
  const inCombat = await page.getByText(/Your turn|Tvůj tah/i).waitFor({ state: 'visible', timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  if (!inCombat) await waitForActionRound(page);
}

export async function mapTravelTo(page: Page, place: RegExp) {
  await page.getByRole('button', { name: place }).first().click();
  await page.getByRole('button', { name: /Set out|Vyrazit/i }).click();
  await waitForActionRound(page);
}

export async function openMap(page: Page) {
  const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
  await nav.getByRole('button', { name: /^More$|^Více$/i }).click();
  await page.getByRole('button', { name: /Map|Mapa/i }).click();
  await expect(page.getByRole('heading', { name: /^Map$|^Mapa$/i })).toBeVisible({ timeout: 15_000 });
}

export async function backToAdventure(page: Page) {
  const onMap = await page.getByRole('heading', { name: /^Map$|^Mapa$/i }).isVisible().catch(() => false);
  if (!onMap) {
    await expect(page.getByRole('log', { name: ADVENTURE_JOURNAL })).toBeVisible({ timeout: 15_000 });
    return;
  }
  await page.getByRole('button', { name: /Continue adventure|Pokračovat v dobrodružství/i }).click();
  await expect(page.getByRole('log', { name: ADVENTURE_JOURNAL })).toBeVisible();
}

export async function resolveCombat(page: Page, maxTurns = 48) {
  const defeatPattern = /You have fallen|You have been defeated|Padl jsi|You blacked out/i;
  const victoryPattern = /Chapter complete|bells fall silent|Warden.*defeated/i;
  const arena = page.locator('.combat-arena');
  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (await page.getByText(defeatPattern).first().isVisible().catch(() => false)) return;
    if (await page.getByText(victoryPattern).first().isVisible().catch(() => false)) return;
    if (!(await page.getByText(/Your turn|Tvůj tah/i).isVisible().catch(() => false))) {
      await page.waitForTimeout(350);
      continue;
    }
    const attack = page.getByRole('button', { name: /^Attack$|^Útok$|^Zaútoč/i }).first();
    if (!(await attack.isVisible().catch(() => false))) break;
    await attack.click();
    if (await page.getByText(defeatPattern).first().isVisible().catch(() => false)) return;
    if (await page.getByText(victoryPattern).first().isVisible().catch(() => false)) return;
    if (await arena.isVisible().catch(() => false)) {
      try {
        await expect(arena).not.toHaveAttribute('data-busy', 'true', { timeout: 60_000 });
      } catch {
        // Narration can lag; if defeat or victory surfaced, exit below.
      }
    }
    if (!(await arena.isVisible().catch(() => false))) return;
  }
}

/** Real engine turns via the same stream endpoint the UI uses (for level grind before tier-3 boss). */
export async function ensureLevelAtLeast(
  request: APIRequestContext,
  token: string,
  characterId: string,
  minLevel: number,
  maxRounds = 80,
) {
  for (let round = 0; round < maxRounds; round += 1) {
    const state = await fetchCharacterState(request, token, characterId);
    if (state.level >= minLevel) return;

    if (state.hp <= 0) {
      await reviveIfFallen(request, token, characterId);
      continue;
    }
    if (state.in_combat && state.combatant?.name) {
      await postGameAction(request, token, characterId, `attack ${state.combatant.name}`);
      continue;
    }
    const tier1Foe = state.location?.includes('Cellar') ? 'goblin' : 'kobold';
    await postGameAction(request, token, characterId, `attack ${tier1Foe}`);
  }

  const final = await fetchCharacterState(request, token, characterId);
  expect(final.level, `Expected level >= ${minLevel}, got ${final.level}`).toBeGreaterThanOrEqual(minLevel);
}

const COMBAT_ACTIONS = /combat actions|bojové akce/i;

export async function syncCombatOrAdventurePlay(page: Page) {
  await page.reload();
  const continueBtn = page.getByRole('button', { name: /Continue adventure|Pokračovat/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
  } else {
    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    await nav.getByRole('button', { name: /^Adventure$|^Hra$/i }).click();
  }
  const combatDeck = page.getByRole('group', { name: COMBAT_ACTIONS });
  if (await combatDeck.isVisible().catch(() => false)) {
    await expect(combatDeck).toBeVisible({ timeout: 30_000 });
    return 'combat' as const;
  }
  await waitForAdventureComposerReady(page);
  return 'adventure' as const;
}

export async function syncPlayScreen(page: Page) {
  await page.reload();
  const continueBtn = page.getByRole('button', { name: /Continue adventure|Pokračovat/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
  } else {
    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    await nav.getByRole('button', { name: /^Adventure$|^Hra$/i }).click();
  }
  await expect(page.getByRole('log', { name: ADVENTURE_JOURNAL })).toBeVisible({ timeout: 30_000 });
}

export async function travelToPitViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  for (const step of [
    'travel to The Sunken Corridor',
    'travel to The Vault of Echoes',
    "travel to The Bell Warden's Pit",
  ]) {
    await postGameAction(request, token, characterId, step);
  }
}

export async function completeVaultDescentViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  for (const step of ['travel to The Vault of Echoes']) {
    await postGameAction(request, token, characterId, step);
  }
  for (let round = 0; round < 40; round += 1) {
    const state = await fetchCharacterState(request, token, characterId);
    if (state.quest_flags?.vault_first_descent_story_awarded) break;
    if (state.hp <= 0) {
      await reviveIfFallen(request, token, characterId);
      continue;
    }
    if (state.in_combat) {
      const foe = state.combatant?.name ?? 'Kobold skirmisher';
      await postGameAction(request, token, characterId, `attack ${foe}`);
      continue;
    }
    await postGameAction(request, token, characterId, 'search the vault');
  }
  const final = await fetchCharacterState(request, token, characterId);
  expect(final.level, `Vault descent should reach L3+, got L${final.level}`).toBeGreaterThanOrEqual(3);
  expect(final.quest_flags?.vault_first_descent_story_awarded).toBe(true);
}

async function ensureAtBellWardenPit(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  const pitPattern = /Bell Warden|Pit|Jáma strážce/i;
  let state = await fetchCharacterState(request, token, characterId);
  if (pitPattern.test(state.location)) return;

  const routes: string[] = [];
  if (!/Vault of Echoes|Krypt echa/i.test(state.location)) {
    if (!/Sunken Corridor|Potopen/i.test(state.location)) {
      routes.push('travel to The Sunken Corridor');
    }
    routes.push('travel to The Vault of Echoes');
  }
  routes.push("travel to The Bell Warden's Pit");
  for (const step of routes) {
    await postGameAction(request, token, characterId, step);
  }
  state = await fetchCharacterState(request, token, characterId);
  expect(pitPattern.test(state.location)).toBeTruthy();
}

export async function completeBossViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  await ensureAtBellWardenPit(request, token, characterId);
  let state = await fetchCharacterState(request, token, characterId);
  expect(state.level, `Bell Warden requires level 3+, got L${state.level}`).toBeGreaterThanOrEqual(3);

  for (let round = 0; round < 200; round += 1) {
    state = await fetchCharacterState(request, token, characterId);
    if (state.quest_flags?.chapter_one_complete) return;
    if ((state.hp ?? 1) <= 0) {
      await reviveIfFallen(request, token, characterId);
      await ensureAtBellWardenPit(request, token, characterId);
      continue;
    }
    if (!state.in_combat && !/Bell Warden|Pit|Jáma/i.test(state.location)) {
      await ensureAtBellWardenPit(request, token, characterId);
      continue;
    }
    const lowHp = (state.hp ?? 1) < Math.max(6, Math.floor((state.max_hp ?? 12) * 0.4));
    if (state.in_combat) {
      if (lowHp) {
        await postGameAction(request, token, characterId, 'drink potion');
        const afterPotion = await fetchCharacterState(request, token, characterId);
        if ((afterPotion.hp ?? 0) <= (state.hp ?? 0)) {
          await postGameAction(request, token, characterId, 'defend');
        }
        continue;
      }
      const foe = state.combatant?.name ?? 'Bell Warden';
      await postGameAction(request, token, characterId, `attack ${foe}`);
      continue;
    }
    if (lowHp) {
      await postGameAction(request, token, characterId, 'drink potion');
      const healed = await fetchCharacterState(request, token, characterId);
      if ((healed.hp ?? 0) <= (state.hp ?? 0)) {
        await postGameAction(request, token, characterId, 'rest');
      }
      continue;
    }
    await postGameAction(request, token, characterId, 'attack the Bell Warden');
  }
  const final = await fetchCharacterState(request, token, characterId);
  expect(
    final.quest_flags?.chapter_one_complete,
    `Bell Warden loop ended without chapter_one_complete after 200 turns (level ${final.level}, hp ${final.hp}, in_combat ${final.in_combat})`,
  ).toBe(true);
}

export { apiTelegramToken };
