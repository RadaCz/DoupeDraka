import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiTelegramToken, waitForAdventureComposerReady } from './telegram.ts';

const E2E_API_BASE = 'http://127.0.0.1:8001';
const MELEE_REACH_FT = 5;

function combatDistanceFt(state: CharacterSnapshot): number {
  return (
    state.combat_tactics?.distance_ft
    ?? state.combat_distance_ft
    ?? 0
  );
}

function movementRemainingFt(state: CharacterSnapshot): number {
  return (
    state.combat_tactics?.movement_remaining_ft
    ?? state.combat_movement_remaining_ft
    ?? 0
  );
}

function reactionPending(state: CharacterSnapshot): boolean {
  return Boolean(state.combat_reaction_pending && (state.combat_reaction_pending as { kind?: string }).kind);
}

/** Test/E2E default: clear Shield window without casting (production leaves choice to the player). */
export async function resolvePendingReactionForE2E(
  request: APIRequestContext,
  token: string,
  characterId: string,
  options?: { autoDecline?: boolean },
) {
  const autoDecline = options?.autoDecline !== false;
  if (!autoDecline) return;
  let state = await fetchCharacterState(request, token, characterId);
  if (!reactionPending(state)) return;
  await postGameAction(request, token, characterId, 'decline reaction');
  state = await fetchCharacterState(request, token, characterId);
  expect(reactionPending(state)).toBeFalsy();
}

/** Sprint 27+ vault kobold opens at range — mirror ``resolve_combat_action_for_simulation`` advance loop. */
export async function advanceIntoMeleeIfNeeded(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  await resolvePendingReactionForE2E(request, token, characterId);
  const state = await fetchCharacterState(request, token, characterId);
  if (!state.in_combat || state.combat_turn !== 'player') return;
  let distance = combatDistanceFt(state);
  let moveLeft = movementRemainingFt(state);
  while (moveLeft > 0 && distance > MELEE_REACH_FT) {
    const step = Math.min(moveLeft, distance - MELEE_REACH_FT);
    if (step <= 0) break;
    await postGameAction(request, token, characterId, `advance ${step} ft`);
    const next = await fetchCharacterState(request, token, characterId);
    distance = combatDistanceFt(next);
    moveLeft = movementRemainingFt(next);
    if (next.combat_turn !== 'player') break;
  }
}

export async function postCombatAttack(
  request: APIRequestContext,
  token: string,
  characterId: string,
  foeName: string,
) {
  await expect.poll(async () => {
    let probe = await fetchCharacterState(request, token, characterId);
    if (reactionPending(probe)) {
      await postGameAction(request, token, characterId, 'decline reaction');
      probe = await fetchCharacterState(request, token, characterId);
    }
    return !probe.in_combat || probe.combat_turn === 'player';
  }, { timeout: 60_000, intervals: [200, 400, 800] }).toBe(true);
  await advanceIntoMeleeIfNeeded(request, token, characterId);
  await postGameAction(request, token, characterId, `attack ${foeName}`);
  await resolvePendingReactionForE2E(request, token, characterId);
  const state = await fetchCharacterState(request, token, characterId);
  const flags = state.combat_flags ?? {};
  if (state.in_combat && state.combat_turn === 'player') {
    const dist = combatDistanceFt(state);
    const moveLeft = movementRemainingFt(state);
    if (flags.action_used && !flags.bonus_action_used) {
      await postGameAction(request, token, characterId, 'end turn');
    } else if (!flags.action_used && moveLeft === 0 && dist > MELEE_REACH_FT) {
      /* Mirror tests/combat_turn_helpers — close turn after partial advance without a legal attack. */
      await postGameAction(request, token, characterId, 'end turn');
    }
  }
  await closeCombatTurnIfStalled(request, token, characterId);
}

export type CharacterSnapshot = {
  level: number;
  hp?: number;
  max_hp?: number;
  quest_flags?: Record<string, boolean>;
  location: string;
  in_combat?: boolean;
  gold?: number;
  combatant?: { name?: string } | null;
  combat_turn?: string;
  combat_distance_ft?: number;
  combat_movement_remaining_ft?: number;
  combat_tactics?: {
    distance_ft?: number;
    movement_remaining_ft?: number;
    weapon_range?: { allowed?: boolean; weapon_type?: string };
  };
  combat_flags?: Record<string, boolean>;
  combat_reaction_pending?: Record<string, unknown>;
  conditions?: Array<{ condition_id: string }>;
  fighting_style?: string;
  divine_domain?: string;
  second_wind_available?: boolean;
  arcane_recovery_available?: boolean;
  arcane_recovery_ready?: boolean;
  known_spells?: string[];
  prepared_spells?: string[];
  spell_slots?: Record<string, number>;
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

/** After Sprint 25 economy, lone Action leaves player turn open when Bonus remains — close it like the UI. */
export async function closeCombatTurnIfStalled(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  await resolvePendingReactionForE2E(request, token, characterId);
  const state = await fetchCharacterState(request, token, characterId);
  if (
    state.in_combat
    && state.combat_turn === 'player'
    && state.combat_flags?.action_used
    && !state.combat_flags?.bonus_action_used
  ) {
    await postGameAction(request, token, characterId, 'end turn');
  }
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
    const endTurn = page.getByRole('button', { name: /^End turn$|^Konec tahu$/i });
    if (await endTurn.isVisible().catch(() => false)) {
      await endTurn.click();
    }
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
      await postCombatAttack(request, token, characterId, state.combatant.name);
      continue;
    }
    const tier1Foe = state.location?.includes('Cellar') ? 'goblin' : 'kobold';
    await postCombatAttack(request, token, characterId, tier1Foe);
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
      await postCombatAttack(request, token, characterId, foe);
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
        await closeCombatTurnIfStalled(request, token, characterId);
        const afterPotion = await fetchCharacterState(request, token, characterId);
        if ((afterPotion.hp ?? 0) <= (state.hp ?? 0)) {
          await postGameAction(request, token, characterId, 'defend');
          await closeCombatTurnIfStalled(request, token, characterId);
        }
        continue;
      }
      const foe = state.combatant?.name ?? 'Bell Warden';
      await postCombatAttack(request, token, characterId, foe);
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
