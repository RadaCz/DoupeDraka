import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiTelegramToken } from './telegram.ts';

const E2E_API_BASE = 'http://127.0.0.1:8001';

export type CharacterSnapshot = {
  level: number;
  quest_flags?: Record<string, boolean>;
  location: string;
  in_combat?: boolean;
  gold?: number;
  combatant?: { name?: string } | null;
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
) {
  await expect.poll(async () => {
    const state = await fetchCharacterState(request, token, characterId);
    return Boolean(state.quest_flags?.[flag]) === expected;
  }, { timeout: 120_000 }).toBe(true);
}

export async function waitForActionRound(page: Page) {
  await expect(page.getByRole('log', { name: 'Adventure journal' })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('button.composer-send[aria-busy="true"]')).toHaveCount(0, { timeout: 90_000 });
  const journal = page.getByRole('log', { name: 'Adventure journal' });
  await expect(journal.locator('.journal-action').last()).toBeVisible({ timeout: 90_000 });
}

export async function clickQuestChip(page: Page, pattern: RegExp) {
  const chip = page.locator('.suggested-actions-row button').filter({ hasText: pattern });
  await expect(chip.first()).toBeVisible({ timeout: 30_000 });
  await chip.first().click();
  const inCombat = await page.getByText(/Your turn|Tvůj tah/i).waitFor({ state: 'visible', timeout: 60_000 })
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
    await expect(page.getByRole('log', { name: 'Adventure journal' })).toBeVisible({ timeout: 15_000 });
    return;
  }
  await page.getByRole('button', { name: /Continue adventure|Pokračovat v dobrodružství/i }).click();
  await expect(page.getByRole('log', { name: 'Adventure journal' })).toBeVisible();
}

export async function resolveCombat(page: Page, maxTurns = 48) {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (await page.getByRole('heading', { name: /You have fallen|Padl jsi/i }).isVisible().catch(() => false)) {
      return;
    }
    const playerTurn = await page.getByText(/Your turn|Tvůj tah/i).isVisible().catch(() => false);
    if (!playerTurn) {
      await page.waitForTimeout(300);
      continue;
    }
    const attack = page.getByRole('button', { name: /^Attack$|^Útok$|^Zaútoč/i });
    if (await attack.first().isVisible().catch(() => false)) {
      await attack.first().click();
    } else {
      break;
    }
    await waitForActionRound(page);
    if (!await page.getByText(/Your turn|Enemy turn|Tvůj tah|Nepřítel/i).isVisible().catch(() => false)) {
      return;
    }
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
    await postGameAction(request, token, characterId, `search ${state.location}`);
  }

  const final = await fetchCharacterState(request, token, characterId);
  expect(final.level, `Expected level >= ${minLevel}, got ${final.level}`).toBeGreaterThanOrEqual(minLevel);
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
  await expect(page.getByRole('log', { name: 'Adventure journal' })).toBeVisible({ timeout: 30_000 });
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
  for (let round = 0; round < 60; round += 1) {
    const state = await fetchCharacterState(request, token, characterId);
    if (state.quest_flags?.vault_first_descent_story_awarded) break;
    if (state.hp <= 0) {
      await reviveIfFallen(request, token, characterId);
      continue;
    }
    if (state.in_combat && state.combatant?.name) {
      await postGameAction(request, token, characterId, `attack ${state.combatant.name}`);
      continue;
    }
    break;
  }
  const final = await fetchCharacterState(request, token, characterId);
  expect(final.level, `Vault descent should reach L3+, got L${final.level}`).toBeGreaterThanOrEqual(3);
  expect(final.quest_flags?.vault_first_descent_story_awarded).toBe(true);
}

export async function completeBossViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const snapshot = await fetchCharacterState(request, token, characterId);
    if (snapshot.quest_flags?.chapter_one_complete) return;

    await postGameAction(request, token, characterId, 'rest');
    await travelToPitViaEngine(request, token, characterId);
    await postGameAction(request, token, characterId, 'attack the Bell Warden');

    for (let turn = 0; turn < 100; turn += 1) {
      const state = await fetchCharacterState(request, token, characterId);
      if (state.quest_flags?.chapter_one_complete) return;
      if (state.hp <= 0) {
        await reviveIfFallen(request, token, characterId);
        await postGameAction(request, token, characterId, 'rest');
        continue;
      }
      if (state.in_combat && state.combatant?.name) {
        await postGameAction(request, token, characterId, `attack ${state.combatant.name}`);
      } else if (!state.in_combat) {
        await postGameAction(request, token, characterId, 'attack the Bell Warden');
      }
    }
  }
  await waitForQuestFlag(request, token, characterId, 'chapter_one_complete');
}

export { apiTelegramToken };
