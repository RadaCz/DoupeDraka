import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  apiTelegramToken,
  playStreamResponse,
  waitForAdventureComposerReady,
  waitForGameScreenIdle,
} from './telegram.ts';

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

export function isCombatReactionPending(state: CharacterSnapshot): boolean {
  return Boolean(state.combat_reaction_pending && (state.combat_reaction_pending as { kind?: string }).kind);
}

function reactionPending(state: CharacterSnapshot): boolean {
  return isCombatReactionPending(state);
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
  xp?: number;
  gold?: number;
  hp?: number;
  max_hp?: number;
  inventory?: string[];
  armor_class?: number;
  quest_flags?: Record<string, boolean>;
  location: string;
  in_combat?: boolean;
  combatant?: { name?: string; hp?: number; max_hp?: number } | null;
  combat_turn?: string;
  combat_round?: number;
  combat_distance_ft?: number;
  combat_movement_remaining_ft?: number;
  combat_tactics?: {
    distance_ft?: number;
    movement_remaining_ft?: number;
    speed_ft?: number;
    weapon_range?: { allowed?: boolean; weapon_type?: string };
  };
  combat_flags?: Record<string, boolean>;
  combat_reaction_pending?: Record<string, unknown>;
  conditions?: Array<{ condition_id: string }>;
  fighting_style?: string;
  divine_domain?: string;
  second_wind_available?: boolean;
  action_surge_available?: boolean;
  channel_divinity_available?: boolean;
  arcane_recovery_available?: boolean;
  arcane_recovery_ready?: boolean;
  known_spells?: string[];
  prepared_spells?: string[];
  spell_slots?: Record<string, number>;
  expertise_skills?: string[];
  concentration_spell?: string;
  mage_armor_active?: boolean;
};

/**
 * MVP combat defeat: engine sets location to SAFE_RESPAWN (Whispering Cellar),
 * hp=1, in_combat=false; death_state remains "alive" (not fallen).
 */
export function isMvpCombatDefeatRecovery(state: CharacterSnapshot): boolean {
  return Boolean(
    !state.in_combat
    && state.hp === 1
    && /Whispering Cellar|Šeptající/i.test(state.location ?? ''),
  );
}

/** After defeat or low HP: heal at safe hub, travel to Sunken Corridor, verify min HP. */
export async function recoverForGhoulEncounter(
  request: APIRequestContext,
  token: string,
  characterId: string,
  minHp = 8,
): Promise<CharacterSnapshot> {
  let state = await fetchCharacterState(request, token, characterId);
  if ((state.hp ?? 1) <= 0) {
    await reviveIfFallen(request, token, characterId);
    state = await fetchCharacterState(request, token, characterId);
  }
  if (isMvpCombatDefeatRecovery(state) || (state.hp ?? 1) < minHp) {
    const safeHub = /Whispering Cellar|Shrine of the Forgotten|Goblin Market/i;
    if (safeHub.test(state.location ?? '')) {
      await postGameAction(request, token, characterId, 'long rest');
      state = await fetchCharacterState(request, token, characterId);
    }
  }
  if (!/Sunken Corridor|Potopená chodba|Potopen/i.test(state.location ?? '')) {
    await postGameAction(request, token, characterId, 'travel to The Sunken Corridor');
    state = await fetchCharacterState(request, token, characterId);
  }
  if (!/Sunken Corridor|Potopen/i.test(state.location ?? '')) {
    throw new Error(`Ghoul prep: expected Sunken Corridor, got ${state.location}`);
  }
  if ((state.hp ?? 0) < minHp) {
    await postGameAction(request, token, characterId, 'short rest');
    state = await fetchCharacterState(request, token, characterId);
  }
  expect(state.hp ?? 0).toBeGreaterThanOrEqual(minHp);
  return state;
}

export async function reviveIfFallen(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  let state = await fetchCharacterState(request, token, characterId);
  if (isMvpCombatDefeatRecovery(state)) {
    await postGameAction(request, token, characterId, 'long rest');
    return;
  }
  if ((state.hp ?? 1) > 0) return;
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
  await postGameActionWithIdempotencyKey(request, token, characterId, action, randomUUID());
}

export async function postGameActionWithIdempotencyKey(
  request: APIRequestContext,
  token: string,
  characterId: string,
  action: string,
  idempotencyKey: string,
) {
  const response = await request.post(`${E2E_API_BASE}/characters/${characterId}/actions/stream`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    data: { action },
    // Finite bound: a hung SSE body previously burned the full 15m chapter timeout with no error.
    timeout: 60_000,
  });
  expect(response.ok(), `stream action failed: ${action}`).toBeTruthy();
  await Promise.race([
    response.body(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`stream body timeout after headers: ${action}`)), 60_000);
    }),
  ]);
}

export async function waitForPlayerCombatTurn(
  request: APIRequestContext,
  token: string,
  characterId: string,
  timeoutMs = 60_000,
) {
  await expect.poll(async () => {
    await resolvePendingReactionForE2E(request, token, characterId);
    const state = await fetchCharacterState(request, token, characterId);
    if (reactionPending(state)) return false;
    return Boolean(state.in_combat) && state.combat_turn === 'player';
  }, { timeout: timeoutMs }).toBe(true);
}

export async function startCellarCombat(
  request: APIRequestContext,
  token: string,
  characterId: string,
  foePhrase = 'goblin scout',
) {
  await resolvePendingReactionForE2E(request, token, characterId);
  await reviveIfFallen(request, token, characterId);
  let state = await fetchCharacterState(request, token, characterId);

  if (state.in_combat) {
    await leaveCombatIfNeeded(request, token, characterId, 60);
  }

  if (!/Cellar|sklep/i.test(state.location ?? '')) {
    await postGameAction(request, token, characterId, 'travel to The Whispering Cellar');
  }

  const wantSkeleton = /skeleton/i.test(foePhrase);
  if (wantSkeleton) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      state = await fetchCharacterState(request, token, characterId);
      if (state.in_combat && /skeleton/i.test(state.combatant?.name ?? '')) {
        break;
      }
      if (state.in_combat) {
        await leaveCombatIfNeeded(request, token, characterId, 50);
      }
      await postCombatAttack(request, token, characterId, 'skeleton');
    }
    state = await fetchCharacterState(request, token, characterId);
    expect(state.in_combat, 'Expected combat with an undead skeleton foe').toBeTruthy();
    expect(state.combatant?.name ?? '', 'Expected skeleton in encounter pool').toMatch(/skeleton/i);
  } else {
    for (let round = 0; round < 8; round += 1) {
      state = await fetchCharacterState(request, token, characterId);
      if (state.in_combat) break;
      await postCombatAttack(request, token, characterId, foePhrase);
    }
    await expect.poll(async () => {
      const probe = await fetchCharacterState(request, token, characterId);
      return Boolean(probe.in_combat);
    }, { timeout: 45_000 }).toBe(true);
  }

  await resolvePendingReactionForE2E(request, token, characterId);
  await waitForPlayerCombatTurn(request, token, characterId);
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

/** Match engine location names in snapshots (EN labels from API). */
const LOCATION_WAIT: Record<string, RegExp> = {
  'The Whispering Cellar': /Whispering Cellar|Šeptající sklepení/i,
  'The Sunken Corridor': /Sunken Corridor|Potopená chodba/i,
  'The Shrine of the Forgotten': /Shrine of the Forgotten|Chrám zapomenutých/i,
  'The Goblin Market': /Goblin Market|Gobliní tržiště/i,
  'The Vault of Echoes': /Vault of Echoes|Krypt echa/i,
  'The Forgotten Crypt': /Forgotten Crypt|Zapomenutá krypta/i,
  'The Bandit Camp': /Bandit Camp|Tábor banditů/i,
  'The Underground River': /Underground River|Podzemní řeka/i,
};

export async function travelToLocation(
  request: APIRequestContext,
  token: string,
  characterId: string,
  destination: string,
) {
  const pattern = LOCATION_WAIT[destination];
  expect(pattern, `Unknown E2E travel destination: ${destination}`).toBeTruthy();
  await postGameAction(request, token, characterId, `travel to ${destination}`);
  await expect.poll(async () => {
    const probe = await fetchCharacterState(request, token, characterId);
    return pattern!.test(probe.location);
  }, { timeout: 30_000 }).toBe(true);
}

/** Chapter One bell arc — same stream actions a player uses (no test endpoints). */
export async function completeBellQuestViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  let state = await fetchCharacterState(request, token, characterId);
  if (state.quest_flags?.bell_quest_complete) {
    return state;
  }

  if (!LOCATION_WAIT['The Shrine of the Forgotten']!.test(state.location)) {
    if (!LOCATION_WAIT['The Sunken Corridor']!.test(state.location)) {
      await travelToLocation(request, token, characterId, 'The Sunken Corridor');
    }
    await travelToLocation(request, token, characterId, 'The Shrine of the Forgotten');
  }

  if (!state.quest_flags?.bell_quest_accepted) {
    await postGameAction(request, token, characterId, 'talk to Caldus about the shrine bell');
    await waitForQuestFlag(request, token, characterId, 'bell_quest_accepted');
  }

  state = await fetchCharacterState(request, token, characterId);
  if (!state.quest_flags?.bell_acquired) {
    await travelToLocation(request, token, characterId, 'The Goblin Market');
    await postGameAction(request, token, characterId, 'ask Nib about the shrine bell');
    await waitForQuestFlag(request, token, characterId, 'bell_acquired');
  }

  state = await fetchCharacterState(request, token, characterId);
  if (!state.quest_flags?.bell_quest_complete) {
    await travelToLocation(request, token, characterId, 'The Shrine of the Forgotten');
    await postGameAction(request, token, characterId, 'return the shrine bell to Caldus');
    await waitForQuestFlag(request, token, characterId, 'bell_quest_complete');
  }

  return fetchCharacterState(request, token, characterId);
}

/** After bell return, Caldus reveals the vault route (`vault_unlocked`). */
export async function unlockVaultViaCaldusAfterBell(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  let state = await fetchCharacterState(request, token, characterId);
  if (state.quest_flags?.vault_unlocked) {
    return state;
  }
  expect(state.quest_flags?.bell_quest_complete, 'Bell quest must finish before vault unlock').toBe(true);
  if (!LOCATION_WAIT['The Shrine of the Forgotten']!.test(state.location)) {
    await travelToLocation(request, token, characterId, 'The Shrine of the Forgotten');
  }
  await postGameAction(request, token, characterId, 'talk to Caldus about the shrine bell');
  await waitForQuestFlag(request, token, characterId, 'vault_unlocked');
  return fetchCharacterState(request, token, characterId);
}

/** One-time +15 gp crypt relic (`CRYPT_RELIC_GOLD_GP`) via Forgotten Crypt search. */
export async function claimCryptRelicViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  let state = await fetchCharacterState(request, token, characterId);
  if (state.quest_flags?.crypt_relic_claimed) {
    return state;
  }

  if (!LOCATION_WAIT['The Forgotten Crypt']!.test(state.location)) {
    if (!LOCATION_WAIT['The Underground River']!.test(state.location)) {
      if (!LOCATION_WAIT['The Sunken Corridor']!.test(state.location)) {
        if (LOCATION_WAIT['The Goblin Market']!.test(state.location)) {
          await travelToLocation(request, token, characterId, 'The Shrine of the Forgotten');
        } else if (LOCATION_WAIT['The Shrine of the Forgotten']!.test(state.location)) {
          /* already adjacent to Sunken */
        } else if (LOCATION_WAIT['The Bandit Camp']!.test(state.location)) {
          await travelToLocation(request, token, characterId, 'The Goblin Market');
          await travelToLocation(request, token, characterId, 'The Shrine of the Forgotten');
        } else if (LOCATION_WAIT['The Whispering Cellar']!.test(state.location)) {
          /* Cellar → Sunken only */
        } else if (LOCATION_WAIT['The Vault of Echoes']!.test(state.location)) {
          await travelToLocation(request, token, characterId, 'The Forgotten Crypt');
          state = await fetchCharacterState(request, token, characterId);
          if (LOCATION_WAIT['The Forgotten Crypt']!.test(state.location)) {
            await postGameAction(request, token, characterId, 'search the crypt');
            await waitForQuestFlag(request, token, characterId, 'crypt_relic_claimed');
            return fetchCharacterState(request, token, characterId);
          }
        }
        await travelToLocation(request, token, characterId, 'The Sunken Corridor');
      }
      await travelToLocation(request, token, characterId, 'The Underground River');
    }
    await travelToLocation(request, token, characterId, 'The Forgotten Crypt');
  }

  await postGameAction(request, token, characterId, 'search the crypt');
  await waitForQuestFlag(request, token, characterId, 'crypt_relic_claimed');
  state = await fetchCharacterState(request, token, characterId);
  expect((state.gold ?? 0), 'Crypt relic should grant gold').toBeGreaterThan(0);
  return state;
}

async function travelTowardGoblinMarket(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  let state = await fetchCharacterState(request, token, characterId);
  if (LOCATION_WAIT['The Goblin Market']!.test(state.location)) {
    return;
  }
  if (LOCATION_WAIT['The Forgotten Crypt']!.test(state.location)) {
    await travelToLocation(request, token, characterId, 'The Underground River');
    await travelToLocation(request, token, characterId, 'The Sunken Corridor');
  } else if (LOCATION_WAIT['The Underground River']!.test(state.location)) {
    await travelToLocation(request, token, characterId, 'The Sunken Corridor');
  } else if (LOCATION_WAIT['The Vault of Echoes']!.test(state.location)) {
    await travelToLocation(request, token, characterId, 'The Sunken Corridor');
  } else if (LOCATION_WAIT['The Bandit Camp']!.test(state.location)) {
    await travelToLocation(request, token, characterId, 'The Goblin Market');
    return;
  } else if (LOCATION_WAIT['The Whispering Cellar']!.test(state.location)) {
    await travelToLocation(request, token, characterId, 'The Sunken Corridor');
  }
  state = await fetchCharacterState(request, token, characterId);
  if (!LOCATION_WAIT['The Shrine of the Forgotten']!.test(state.location)) {
    if (LOCATION_WAIT['The Sunken Corridor']!.test(state.location)) {
      await travelToLocation(request, token, characterId, 'The Shrine of the Forgotten');
    }
  }
  if (!LOCATION_WAIT['The Goblin Market']!.test(state.location)) {
    await travelToLocation(request, token, characterId, 'The Goblin Market');
  }
}

/** +20 gp shrine evidence at Bandit Camp (stealth, social, or captain combat). */
export async function earnBanditEvidenceViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  let state = await fetchCharacterState(request, token, characterId);
  if (state.quest_flags?.bandit_shrine_evidence) {
    return state;
  }

  if (!LOCATION_WAIT['The Bandit Camp']!.test(state.location)) {
    await travelTowardGoblinMarket(request, token, characterId);
    await travelToLocation(request, token, characterId, 'The Bandit Camp');
  }

  await postGameAction(request, token, characterId, 'inspect the bounty notice');
  await postGameAction(request, token, characterId, 'sneak past the bandit sentries');
  await postGameAction(request, token, characterId, 'bluff the bandit captain');

  let priorFoeHp: number | undefined;
  let stall = 0;
  for (let step = 0; step < 48; step += 1) {
    state = await fetchCharacterState(request, token, characterId);
    if (state.quest_flags?.bandit_shrine_evidence) {
      return state;
    }
    if ((state.hp ?? 1) <= 0) {
      await reviveIfFallen(request, token, characterId);
      await travelToLocation(request, token, characterId, 'The Bandit Camp');
      continue;
    }

    if (state.in_combat) {
      const foeHp = state.combatant?.hp;
      if (priorFoeHp !== undefined && foeHp !== undefined && foeHp >= priorFoeHp) stall += 1;
      else stall = 0;
      priorFoeHp = foeHp;
      expect(
        stall,
        `Bandit combat stall step=${step} foe_hp=${foeHp} hero_hp=${state.hp} location=${state.location}`,
      ).toBeLessThan(12);
      const foe = state.combatant?.name ?? 'Bandit captain';
      await postCombatAttack(request, token, characterId, foe);
      continue;
    }

    await postGameAction(request, token, characterId, 'attack the bandit captain');
    const after = await fetchCharacterState(request, token, characterId);
    if (!after.in_combat && !after.quest_flags?.bandit_shrine_evidence) {
      await postGameAction(request, token, characterId, 'attack');
    }
  }

  state = await fetchCharacterState(request, token, characterId);
  expect(
    state.quest_flags?.bandit_shrine_evidence,
    `Bandit evidence missing after 48 steps: hp=${state.hp} location=${state.location} in_combat=${state.in_combat}`,
  ).toBeTruthy();
  return state;
}

/**
 * Deterministic Chapter One shop budget (Folk Hero Fighter ≈10 gp start):
 * bell return +10, crypt relic +15, bandit evidence +20 → ≥45 gp healing potion (engine authority).
 */
/** Optional top-up: engine 1d4 scavenge on explore d6=3 (one-time per location). */

export async function scavengeExplorationGoldUntil(
  request: APIRequestContext,
  token: string,
  characterId: string,
  minGoldGp: number,
  maxExplores: number,
) {
  let state = await fetchCharacterState(request, token, characterId);
  await leaveCombatIfNeeded(request, token, characterId);
  for (let attempt = 0; attempt < maxExplores && (state.gold ?? 0) < minGoldGp; attempt += 1) {
    state = await fetchCharacterState(request, token, characterId);
    if ((state.hp ?? 1) <= 0) {
      await reviveIfFallen(request, token, characterId);
    }
    if (state.in_combat) {
      const foe = state.combatant?.name ?? 'goblin';
      await postCombatAttack(request, token, characterId, foe);
    } else {
      await postGameAction(request, token, characterId, 'explore');
    }
    state = await fetchCharacterState(request, token, characterId);
  }
  return state;
}

export async function leaveCombatIfNeeded(
  request: APIRequestContext,
  token: string,
  characterId: string,
  maxRounds = 80,
) {
  for (let round = 0; round < maxRounds; round += 1) {
    const state = await fetchCharacterState(request, token, characterId);
    if (!state.in_combat) {
      return state;
    }
    if (state.combatant?.name) {
      await postCombatAttack(request, token, characterId, state.combatant.name);
    } else {
      await postGameAction(request, token, characterId, 'defend');
      await closeCombatTurnIfStalled(request, token, characterId);
    }
  }
  const final = await fetchCharacterState(request, token, characterId);
  expect(final.in_combat, 'Expected to leave combat before UI reload').toBeFalsy();
  return final;
}

/** Engine refuses potions at full HP — explore/defend until wounded (real combat rolls). */
export async function ensureHpBelowMaxForPotionUse(
  request: APIRequestContext,
  token: string,
  characterId: string,
  maxRounds = 40,
) {
  let state = await fetchCharacterState(request, token, characterId);
  const maxHp = state.max_hp ?? 12;
  if ((state.hp ?? maxHp) < maxHp) {
    return state;
  }
  for (let round = 0; round < maxRounds; round += 1) {
    state = await fetchCharacterState(request, token, characterId);
    if ((state.hp ?? 0) < maxHp) {
      return state;
    }
    if (state.in_combat) {
      await postGameAction(request, token, characterId, 'defend');
      await closeCombatTurnIfStalled(request, token, characterId);
      continue;
    }
    await postGameAction(request, token, characterId, 'explore');
  }
  state = await fetchCharacterState(request, token, characterId);
  expect((state.hp ?? 0), 'Expected damage from explore/combat before potion use').toBeLessThan(maxHp);
  return state;
}

/** Damage until HP is strictly below half max (Preserve Life SRD cap requires room under half). */
export async function ensureHpBelowHalfMax(
  request: APIRequestContext,
  token: string,
  characterId: string,
  maxRounds = 48,
) {
  let state = await fetchCharacterState(request, token, characterId);
  for (let round = 0; round < maxRounds; round += 1) {
    state = await fetchCharacterState(request, token, characterId);
    const maxHp = state.max_hp ?? 12;
    const halfCap = Math.max(1, Math.floor(maxHp / 2));
    if ((state.hp ?? maxHp) < halfCap) {
      return state;
    }
    if ((state.hp ?? 1) <= 0) {
      await reviveIfFallen(request, token, characterId);
      continue;
    }
    if (state.in_combat) {
      await resolvePendingReactionForE2E(request, token, characterId);
      await postGameAction(request, token, characterId, 'defend');
      await closeCombatTurnIfStalled(request, token, characterId);
      continue;
    }
    await startCellarCombat(request, token, characterId);
  }
  state = await fetchCharacterState(request, token, characterId);
  const maxHp = state.max_hp ?? 12;
  const halfCap = Math.max(1, Math.floor(maxHp / 2));
  expect((state.hp ?? maxHp), `Expected HP below half max (${halfCap})`).toBeLessThan(halfCap);
  return state;
}

export async function earnChapterOneShopGold(
  request: APIRequestContext,
  token: string,
  characterId: string,
  minGoldGp: number,
) {
  let state = await completeBellQuestViaEngine(request, token, characterId);
  state = await unlockVaultViaCaldusAfterBell(request, token, characterId);

  if ((state.gold ?? 0) < minGoldGp && !state.quest_flags?.crypt_relic_claimed) {
    state = await claimCryptRelicViaEngine(request, token, characterId);
  }
  state = await fetchCharacterState(request, token, characterId);
  if ((state.gold ?? 0) < minGoldGp && !state.quest_flags?.bandit_shrine_evidence) {
    state = await earnBanditEvidenceViaEngine(request, token, characterId);
  }

  state = await fetchCharacterState(request, token, characterId);
  if ((state.gold ?? 0) < minGoldGp) {
    state = await scavengeExplorationGoldUntil(
      request,
      token,
      characterId,
      minGoldGp,
      36,
    );
  }

  state = await fetchCharacterState(request, token, characterId);
  expect(
    state.gold ?? 0,
    `Need ${minGoldGp} gp (bell +10, crypt +15, bandit +20, optional 1d4 scavenge); have ${state.gold ?? 0}`,
  ).toBeGreaterThanOrEqual(minGoldGp);
  return state;
}

/** Matches EN label and CS `Dobrodružný deník` (also legacy no-diacritic / word-order variants). */
const ADVENTURE_JOURNAL = /adventure journal|dobrodružn[yý] den[ií]k|den[ií]k dobrodružstv/i;

export async function waitForActionRound(page: Page) {
  const journal = page.getByRole('log', { name: ADVENTURE_JOURNAL });
  await expect(journal).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('button.composer-send[aria-busy="true"]')).toHaveCount(0, { timeout: 45_000 });
  await expect(journal.locator('.journal-action').last()).toBeVisible({ timeout: 45_000 });
}

export async function clickQuestChip(page: Page, pattern: RegExp) {
  const chip = page.locator('.suggested-actions-row button').filter({ hasText: pattern });
  await expect(chip.first()).toBeVisible({ timeout: 20_000 });
  const streamDone = playStreamResponse(page);
  await chip.first().click();
  await streamDone;
  const inCombat = await page.getByText(PLAYER_TURN).waitFor({ state: 'visible', timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  const combatDeck = page.getByRole('group', { name: COMBAT_DECK });
  if (inCombat || await combatDeck.isVisible().catch(() => false)) {
    // Stream 200 already proves the action landed — avoid the 120s aria-busy budget.
    const screen = page.locator('section.game-screen, section.combat-screen').first();
    await expect(screen).not.toHaveAttribute('aria-busy', 'true', { timeout: 20_000 });
    return;
  }
  await waitForActionRound(page);
}

export async function mapTravelTo(page: Page, place: RegExp) {
  const destination = page.getByRole('button', { name: place }).first();
  await expect(destination).toBeVisible({ timeout: 45_000 });
  await destination.click();
  const setOut = page.getByRole('button', { name: /Set out|Vyrazit/i });
  await expect(setOut).toBeVisible({ timeout: 45_000 });
  await setOut.click();
  await waitForActionRound(page);
}

/** Map hops after vault unlock (Vault of Echoes → Bell Warden's Pit). */
export async function travelToBellWardenPitViaMap(page: Page) {
  await openMap(page);
  const vaultBtn = page.getByRole('button', { name: /Vault of Echoes|Krypt echa/i }).first();
  if (await vaultBtn.isVisible().catch(() => false)) {
    await mapTravelTo(page, /Vault of Echoes|Krypt echa/i);
    await openMap(page);
  }
  await mapTravelTo(page, /Bell Warden|Jáma strážce|Pit/i);
  await backToAdventure(page);
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

const COMBAT_DECK = /combat actions|bojové akce/i;
const PLAYER_TURN = /Your turn|Tvůj tah/i;
const ATTACK_BTN = /^Attack$|^Útok$/i;
const ADVANCE_BTN = /^Advance$|^Přiblížit|^Priblizit/i;
const END_TURN_BTN = /^End turn$|^Konec tahu$/i;
const DEFEND_BTN = /^Defend$|^Obrana$|^Bránit se$/i;
const POTION_BTN = /healing potion|léčivý lektvar/i;
const DECLINE_REACTION = /decline reaction|odmítnout reakci/i;

async function clickCombatDeckButton(page: Page, name: RegExp) {
  const deck = page.getByRole('group', { name: COMBAT_DECK });
  await expect(deck).toBeVisible({ timeout: 45_000 });
  const button = deck.getByRole('button', { name }).first();
  await expect(button).toBeEnabled({ timeout: 15_000 });
  const streamDone = playStreamResponse(page);
  await button.click();
  await streamDone;
  await waitForGameScreenIdle(page);
}

/**
 * Bell Warden UI loop: require stream 200, then a short idle — not the full 120s aria-busy budget.
 * A completed stream already proves the combat action was accepted by the API.
 */
async function clickCombatDeckButtonAwaitState(
  page: Page,
  _request: APIRequestContext,
  _token: string,
  _characterId: string,
  name: RegExp,
  actionLabel: string,
) {
  const continueAdventure = page.getByRole('button', { name: /Continue adventure|Pokračovat/i });
  if (await continueAdventure.isVisible().catch(() => false)) {
    return actionLabel; // caller handles defeat modal
  }
  const deck = page.getByRole('group', { name: COMBAT_DECK });
  await expect(deck).toBeVisible({ timeout: 15_000 });
  const button = deck.getByRole('button', { name }).first();
  await expect(button).toBeEnabled({ timeout: 8_000 });
  const streamDone = page.waitForResponse(
    response => response.url().includes('/actions/stream')
      && response.request().method() === 'POST'
      && response.status() === 200,
    { timeout: 25_000 },
  );
  await button.click();
  await streamDone;
  if (await continueAdventure.isVisible().catch(() => false)) {
    return actionLabel;
  }
  const screen = page.locator('section.game-screen, section.combat-screen').first();
  await expect(screen).not.toHaveAttribute('aria-busy', 'true', { timeout: 8_000 });
  return actionLabel;
}

export function combatProgressSignature(state: CharacterSnapshot): string {
  const flags = state.quest_flags?.chapter_one_complete ? '1' : '0';
  const reaction = isCombatReactionPending(state) ? '1' : '0';
  const cf = state.combat_flags ?? {};
  return [
    state.in_combat ? '1' : '0',
    state.combat_turn ?? '-',
    state.combat_round ?? '-',
    state.hp ?? '-',
    state.combatant?.hp ?? '-',
    flags,
    reaction,
    cf.action_used ? '1' : '0',
    cf.bonus_action_used ? '1' : '0',
    movementRemainingFt(state),
    combatDistanceFt(state),
  ].join('|');
}

function logBellWardenRound(round: number, action: string, state: CharacterSnapshot, t0: number) {
  const elapsed = Date.now() - t0;
  console.log(
    `[bw-ui] round=${round} +${elapsed}ms action=${action} ${bossLoopSnapshot(state, round, action)}`,
  );
}

/** Close player turn via UI when engage chip or deck spent action/bonus (matches Sprint 25 economy). */
export async function endCombatTurnViaUiIfSpent(
  page: Page,
  request: APIRequestContext,
  token: string,
  characterId: string,
): Promise<boolean> {
  const state = await fetchCharacterState(request, token, characterId);
  if (!state.in_combat || state.combat_turn !== 'player') return false;
  if (!state.combat_flags?.action_used && !state.combat_flags?.bonus_action_used) return false;
  const end = page.getByRole('group', { name: COMBAT_DECK }).getByRole('button', { name: END_TURN_BTN });
  if (!await end.isEnabled().catch(() => false)) return false;
  await clickCombatDeckButtonAwaitState(page, request, token, characterId, END_TURN_BTN, 'end_turn');
  return true;
}

async function settleFreshPlayerTurnAfterEngage(
  page: Page,
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  await syncPlayScreen(page);
  for (let guard = 0; guard < 12; guard += 1) {
    const state = await fetchCharacterState(request, token, characterId);
    if (!state.in_combat || state.quest_flags?.chapter_one_complete) return;
    if (state.combat_turn !== 'player') {
      await expect.poll(async () => {
        const probe = await fetchCharacterState(request, token, characterId);
        return probe.combat_turn === 'player' || isCombatReactionPending(probe);
      }, { timeout: 10_000 }).toBe(true);
      continue;
    }
    if (isCombatReactionPending(state)) {
      const decline = page.getByRole('group', { name: COMBAT_DECK }).getByRole('button', { name: DECLINE_REACTION });
      if (await decline.isEnabled().catch(() => false)) {
        await clickCombatDeckButtonAwaitState(page, request, token, characterId, DECLINE_REACTION, 'decline_reaction');
      }
      continue;
    }
    if (await endCombatTurnViaUiIfSpent(page, request, token, characterId)) {
      continue;
    }
    if (!state.combat_flags?.action_used && !state.combat_flags?.bonus_action_used) {
      return;
    }
    throw new Error(
      `Bell Warden engage: player turn blocked after chip. ${bossLoopSnapshot(state, guard, 'engage_stuck')}`,
    );
  }
}

/** Legacy helper — UI attack loop without stream waits (prefer completeBellWardenBossViaUI). */
export async function resolveCombat(page: Page, maxTurns = 48) {
  const defeatPattern = /You have fallen|You have been defeated|Padl jsi|You blacked out/i;
  const victoryPattern = /Chapter complete|bells fall silent|Warden.*defeated/i;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (await page.getByText(defeatPattern).first().isVisible().catch(() => false)) return;
    if (await page.getByText(victoryPattern).first().isVisible().catch(() => false)) return;
    if (!(await page.getByText(PLAYER_TURN).isVisible().catch(() => false))) {
      await page.waitForTimeout(350);
      continue;
    }
    try {
      await clickCombatDeckButton(page, ATTACK_BTN);
    } catch {
      break;
    }
    const endTurn = page.getByRole('group', { name: COMBAT_DECK }).getByRole('button', { name: END_TURN_BTN });
    if (await endTurn.isVisible().catch(() => false)) {
      await clickCombatDeckButton(page, END_TURN_BTN);
    }
  }
}

/**
 * Sprint 37.1 — defeat Bell Warden using combat deck + quest chips only (no API attack loops).
 */
export async function completeBellWardenBossViaUI(
  page: Page,
  request: APIRequestContext,
  token: string,
  characterId: string,
  initData: string,
  maxRounds = 48,
  hooks?: { onRound?: (round: number, action: string, state: CharacterSnapshot) => void },
): Promise<string> {
  let activeToken = token;
  const victoryPattern = /Chapter complete|bells fall silent|Warden.*defeated|kapitol/i;
  const fightT0 = Date.now();

  await prepareBellWardenUiFight(request, activeToken, characterId);
  await syncPlayScreen(page);

  const before = await fetchCharacterState(request, activeToken, characterId);
  const goldBefore = before.gold ?? 0;
  const xpBefore = before.xp ?? 0;

  await clickQuestChip(page, /Face the Bell Warden|Bell Warden|Strážce zvonu|Postav se/i);
  await expect.poll(async () => {
    const probe = await fetchCharacterState(request, activeToken, characterId);
    return Boolean(probe.in_combat) || Boolean(probe.quest_flags?.chapter_one_complete);
  }, { timeout: 30_000 }).toBe(true);
  await settleFreshPlayerTurnAfterEngage(page, request, activeToken, characterId);

  let sawDamage = false;
  let priorFoeHp: number | undefined;
  let priorProgressSig: string | undefined;
  let noProgressStreak = 0;
  let defeatRecoveries = 0;

  const clickBoss = (name: RegExp, label: string) =>
    clickCombatDeckButtonAwaitState(page, request, activeToken, characterId, name, label);

  for (let round = 0; round < maxRounds; round += 1) {
    if (round > 0 && round % 4 === 0) {
      activeToken = await apiTelegramToken(request, initData);
    }
    let state = await fetchCharacterState(request, activeToken, characterId);
    logBellWardenRound(round, 'poll', state, fightT0);
    hooks?.onRound?.(round, 'poll', state);
    if (state.quest_flags?.chapter_one_complete) {
      break;
    }

    if (
      !state.in_combat
      && !state.quest_flags?.chapter_one_complete
      && (state.hp ?? 1) <= 1
    ) {
      activeToken = await apiTelegramToken(request, initData);
      await reviveIfFallen(request, activeToken, characterId);
      await prepareBellWardenUiFight(request, activeToken, characterId);
      await syncPlayScreen(page);
      await clickQuestChip(page, /Face the Bell Warden|Bell Warden|Strážce zvonu|Postav se/i);
      await settleFreshPlayerTurnAfterEngage(page, request, activeToken, characterId);
      continue;
    }

    // Defeat modal leaves HP at 1 in a safe hub — dismiss UI then re-stabilize (do not treat as normal turn).
    const continueAdventure = page.getByRole('button', { name: /Continue adventure|Pokračovat/i });
    if (await continueAdventure.isVisible().catch(() => false)) {
      defeatRecoveries += 1;
      if (defeatRecoveries > 4) {
        throw new Error(`Hero fallen repeatedly during Bell Warden UI fight (round ${round}).`);
      }
      await continueAdventure.click();
      activeToken = await apiTelegramToken(request, initData);
      await prepareBellWardenUiFight(request, activeToken, characterId);
      await syncPlayScreen(page);
      await clickQuestChip(page, /Face the Bell Warden|Bell Warden|Strážce zvonu|Postav se/i);
      await settleFreshPlayerTurnAfterEngage(page, request, activeToken, characterId);
      continue;
    }

    if ((state.hp ?? 1) <= 0) {
      defeatRecoveries += 1;
      if (defeatRecoveries > 4) {
        throw new Error(
          `Hero fallen repeatedly during Bell Warden UI fight (round ${round}). `
            + bossLoopSnapshot(state, round, 'fallen'),
        );
      }
      // Prefer UI revive when FallenScreen is visible; fixture revive only as last resort.
      const reviveBtn = page.getByRole('button', { name: /Revive hero|Obnovit hrdinu/i });
      if (await reviveBtn.isVisible().catch(() => false)) {
        await reviveBtn.click();
        await page.waitForTimeout(500);
      } else {
        await reviveIfFallen(request, activeToken, characterId);
      }
      await prepareBellWardenUiFight(request, activeToken, characterId);
      await syncPlayScreen(page);
      await clickQuestChip(page, /Face the Bell Warden|Bell Warden|Strážce zvonu|Postav se/i);
      continue;
    }

    if (!atBellWardenPit(state) && !state.in_combat) {
      await prepareBellWardenUiFight(request, activeToken, characterId);
      await syncPlayScreen(page);
      await clickQuestChip(page, /Face the Bell Warden|Bell Warden|Strážce zvonu|Postav se/i);
      continue;
    }

    const deck = page.getByRole('group', { name: COMBAT_DECK });
    const progressSig = combatProgressSignature(state);
    if (priorProgressSig !== undefined && progressSig === priorProgressSig) {
      noProgressStreak += 1;
    } else {
      noProgressStreak = 0;
    }
    priorProgressSig = progressSig;
    expect(
      noProgressStreak,
      `Bell Warden UI no combat progress for ${noProgressStreak} polls. ${bossLoopSnapshot(state, round, 'stall')}`,
    ).toBeLessThan(12);

    if (state.in_combat && state.combatant?.hp != null) {
      const foeHp = state.combatant.hp;
      if (priorFoeHp !== undefined && foeHp < priorFoeHp) {
        sawDamage = true;
      }
      priorFoeHp = foeHp;
      if (foeHp <= 0) {
        continue;
      }
    }

    if (state.in_combat && state.combat_turn !== 'player') {
      const declineUi = deck.getByRole('button', { name: DECLINE_REACTION });
      if (reactionPending(state)) {
        if (await declineUi.isVisible().catch(() => false) && await declineUi.isEnabled().catch(() => false)) {
          const act = await clickBoss(DECLINE_REACTION, 'decline_reaction');
          logBellWardenRound(round, act, await fetchCharacterState(request, activeToken, characterId), fightT0);
          hooks?.onRound?.(round, act, await fetchCharacterState(request, activeToken, characterId));
          continue;
        }
        throw new Error(
          `Bell Warden UI: pending reaction without UI control. ${bossLoopSnapshot(state, round, 'reaction')}`,
        );
      }
      const sig0 = combatProgressSignature(state);
      try {
        await expect.poll(async () => {
          const probe = await fetchCharacterState(request, activeToken, characterId);
          if (probe.combat_turn === 'player' || isCombatReactionPending(probe)) return true;
          return combatProgressSignature(probe) !== sig0;
        }, { timeout: 8_000, intervals: [150, 300, 600] }).toBe(true);
      } catch {
        const stuck = await fetchCharacterState(request, activeToken, characterId);
        throw new Error(
          `Bell Warden UI: enemy turn did not return control in 8s. ${bossLoopSnapshot(stuck, round, 'enemy_stall')}`,
        );
      }
      continue;
    }

    const maxHp = state.max_hp ?? 12;
    const heroHp = state.hp ?? maxHp;
    let distance = combatDistanceFt(state);
    let moveLeft = movementRemainingFt(state);
    let combatFlags = state.combat_flags ?? {};
    const lowHp = heroHp < Math.max(10, Math.floor(maxHp * 0.45));
    const criticalHp = heroHp < Math.max(8, Math.floor(maxHp * 0.35));
    if (state.in_combat && state.combat_turn !== 'player') {
      throw new Error(
        `Bell Warden UI: expected player turn before deck actions. ${bossLoopSnapshot(state, round, 'not_player')}`,
      );
    }

    state = await fetchCharacterState(request, activeToken, characterId);

    const logAfterClick = async (act: string) => {
      const post = await fetchCharacterState(request, activeToken, characterId);
      logBellWardenRound(round, act, post, fightT0);
      hooks?.onRound?.(round, act, post);
      return post;
    };

    const potionBtn = deck.getByRole('button', { name: POTION_BTN });
    if (lowHp && await potionBtn.isEnabled().catch(() => false)) {
      await logAfterClick(await clickBoss(POTION_BTN, 'potion'));
      await endCombatTurnViaUiIfSpent(page, request, activeToken, characterId);
      continue;
    }
    const secondWind = deck.getByRole('button', { name: /Second Wind|Druhý dech/i });
    if (
      lowHp
      && combatFlags.action_used
      && !combatFlags.bonus_action_used
      && await secondWind.isEnabled().catch(() => false)
    ) {
      await logAfterClick(await clickBoss(/Second Wind|Druhý dech/i, 'second_wind'));
      await endCombatTurnViaUiIfSpent(page, request, activeToken, characterId);
      continue;
    }

    const advanceBtn = deck.getByRole('button', { name: ADVANCE_BTN });
    const attackBtn = deck.getByRole('button', { name: ATTACK_BTN });
    const endBtn = deck.getByRole('button', { name: END_TURN_BTN });
    const attackEnabled = await attackBtn.isEnabled().catch(() => false);
    const defendBtn = deck.getByRole('button', { name: DEFEND_BTN });

    if (criticalHp && !combatFlags.action_used && await defendBtn.isEnabled().catch(() => false)) {
      await logAfterClick(await clickBoss(DEFEND_BTN, 'defend'));
      await endCombatTurnViaUiIfSpent(page, request, activeToken, characterId);
      continue;
    }

    if (combatFlags.action_used) {
      const surgeBtn = deck.getByRole('button', { name: /Action Surge|Příval akce|Prival akce/i });
      if (await attackBtn.isEnabled().catch(() => false)) {
        await logAfterClick(await clickBoss(ATTACK_BTN, 'attack'));
        continue;
      }
      if (await surgeBtn.isEnabled().catch(() => false)) {
        await logAfterClick(await clickBoss(/Action Surge|Příval akce|Prival akce/i, 'action_surge'));
        continue;
      }
      if (await endBtn.isEnabled().catch(() => false)) {
        await logAfterClick(await clickBoss(END_TURN_BTN, 'end_turn'));
        continue;
      }
      throw new Error(
        `Bell Warden UI: action spent but no legal follow-up. dist=${distance} move=${moveLeft} `
          + bossLoopSnapshot(state, round, 'action_used'),
      );
    }

    if (distance > MELEE_REACH_FT && moveLeft > 0) {
      if (await advanceBtn.isEnabled().catch(() => false)) {
        const distBefore = distance;
        const moveBefore = moveLeft;
        const post = await logAfterClick(await clickBoss(ADVANCE_BTN, 'advance'));
        if (
          combatDistanceFt(post) >= distBefore
          && movementRemainingFt(post) >= moveBefore
          && post.combat_turn === 'player'
        ) {
          throw new Error(
            `Bell Warden UI: Advance did not change distance/movement. `
              + bossLoopSnapshot(post, round, 'advance_noop'),
          );
        }
        continue;
      }
      if (await endBtn.isEnabled().catch(() => false)) {
        await logAfterClick(await clickBoss(END_TURN_BTN, 'end_turn'));
        continue;
      }
    }

    if (!combatFlags.action_used && !attackEnabled && moveLeft === 0 && distance > MELEE_REACH_FT) {
      if (await endBtn.isEnabled().catch(() => false)) {
        await logAfterClick(await clickBoss(END_TURN_BTN, 'end_turn'));
        continue;
      }
    }

    if (!attackEnabled) {
      await expect(attackBtn).toBeEnabled({ timeout: 3_000 }).catch(() => undefined);
    }
    let afterAction = state;
    type DeckChoice = 'attack' | 'end_turn' | 'defend' | 'enemy' | '';
    let deckChoice = '' as DeckChoice;
    if (await attackBtn.isEnabled().catch(() => false)) {
      deckChoice = 'attack';
    } else if (await endBtn.isEnabled().catch(() => false)) {
      deckChoice = 'end_turn';
    } else if (await deck.getByRole('button', { name: DEFEND_BTN }).isEnabled().catch(() => false)) {
      deckChoice = 'defend';
    } else {
      try {
        await expect.poll(async () => {
          const probe = await fetchCharacterState(request, activeToken, characterId);
          if (probe.combat_turn !== 'player') {
            deckChoice = 'enemy';
            return true;
          }
          const deckProbe = page.getByRole('group', { name: COMBAT_DECK });
          const atk = deckProbe.getByRole('button', { name: ATTACK_BTN });
          const end = deckProbe.getByRole('button', { name: END_TURN_BTN });
          const def = deckProbe.getByRole('button', { name: DEFEND_BTN });
          if (await atk.isEnabled().catch(() => false)) {
            deckChoice = 'attack';
            return true;
          }
          if (await end.isEnabled().catch(() => false)) {
            deckChoice = 'end_turn';
            return true;
          }
          if (await def.isEnabled().catch(() => false)) {
            deckChoice = 'defend';
            return true;
          }
          return false;
        }, { timeout: 8_000, intervals: [200, 400, 800] }).toBe(true);
      } catch {
        const stuck = await fetchCharacterState(request, activeToken, characterId);
        throw new Error(
          `Bell Warden UI: no Attack/End turn/Defend enabled after 8s. ${bossLoopSnapshot(stuck, round, 'no_buttons')}`,
        );
      }
    }

    switch (deckChoice) {
      case 'enemy':
        continue;
      case 'attack':
        afterAction = await logAfterClick(await clickBoss(ATTACK_BTN, 'attack'));
        break;
      case 'end_turn':
        afterAction = await logAfterClick(await clickBoss(END_TURN_BTN, 'end_turn'));
        continue;
      case 'defend':
        afterAction = await logAfterClick(await clickBoss(DEFEND_BTN, 'defend'));
        break;
      default:
        break;
    }

    if (afterAction.quest_flags?.chapter_one_complete) {
      break;
    }
    if (await endCombatTurnViaUiIfSpent(page, request, activeToken, characterId)) {
      logBellWardenRound(round, 'end_turn_cleanup', await fetchCharacterState(request, activeToken, characterId), fightT0);
    }
  }

  const afterLoop = await fetchCharacterState(request, activeToken, characterId);
  if (!afterLoop.quest_flags?.chapter_one_complete) {
    throw new Error(
      `Bell Warden UI fight exceeded ${maxRounds} rounds without chapter_one_complete. `
        + bossLoopSnapshot(afterLoop, maxRounds, 'timeout')
        + ` sawDamage=${sawDamage}`,
    );
  }

  const final = await fetchCharacterState(request, activeToken, characterId);
  expect(final.quest_flags?.chapter_one_complete, 'Bell Warden UI fight must set chapter_one_complete').toBe(true);
  expect(final.in_combat, 'Chapter completion should leave combat').toBeFalsy();
  expect(sawDamage, 'Expected Bell Warden HP to decrease at least once during UI combat').toBeTruthy();
  expect(final.gold ?? 0).toBeGreaterThanOrEqual(goldBefore);
  expect((final.xp ?? 0)).toBeGreaterThanOrEqual(xpBefore);

  await syncPlayScreen(page);
  await expect(page.getByRole('log', { name: ADVENTURE_JOURNAL })).toContainText(victoryPattern, { timeout: 60_000 });

  await page.reload();
  const continueBtn = page.getByRole('button', { name: /Continue adventure|Pokračovat/i });
  if (await continueBtn.isVisible({ timeout: 45_000 }).catch(() => false)) {
    await continueBtn.click();
  } else {
    const nav = page.getByRole('navigation', { name: /Main navigation|Hlavní navigace/i });
    await nav.getByRole('button', { name: /^Adventure$|^Hra$/i }).click();
  }
  await expect(page.getByRole('log', { name: ADVENTURE_JOURNAL })).toBeVisible({ timeout: 60_000 });
  await waitForGameScreenIdle(page);
  activeToken = await apiTelegramToken(request, initData);
  const reloaded = await fetchCharacterState(request, activeToken, characterId);
  expect(reloaded.quest_flags?.chapter_one_complete).toBe(true);
  expect(reloaded.gold).toBe(final.gold);
  return activeToken;
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

    if ((state.hp ?? 1) <= 0) {
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
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  const continueBtn = page.getByRole('button', { name: /Continue adventure|Pokračovat/i });
  if (await continueBtn.isVisible({ timeout: 15_000 }).catch(() => false)) {
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
  // Combat play still mounts the adventure journal; if combat deck is up first, that is enough.
  const mode = await syncCombatOrAdventurePlay(page);
  if (mode === 'combat') {
    const journal = page.getByRole('log', { name: ADVENTURE_JOURNAL });
    if (await journal.isVisible().catch(() => false)) return;
    await expect(page.getByRole('group', { name: COMBAT_ACTIONS })).toBeVisible({ timeout: 30_000 });
    return;
  }
  await expect(page.getByRole('log', { name: ADVENTURE_JOURNAL })).toBeVisible({ timeout: 30_000 });
}

/**
 * One player combat turn for ghoul paralysis hunt — stream-bound clicks, advance into melee, Sprint 25 end turn.
 */


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
    if ((state.hp ?? 1) <= 0) {
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

function atBellWardenPit(state: CharacterSnapshot): boolean {
  return /Bell Warden|Pit|Jáma/i.test(state.location ?? '');
}

/** Engine boss loop diagnostic line for E2E failure reports. */
export function bossLoopSnapshot(state: CharacterSnapshot, round: number, lastAction: string): string {
  const flags = state.quest_flags ? Object.entries(state.quest_flags).filter(([, v]) => v).map(([k]) => k) : [];
  return [
    `round=${round}`,
    `action=${lastAction}`,
    `hp=${state.hp}/${state.max_hp}`,
    `level=${state.level}`,
    `in_combat=${state.in_combat}`,
    `combat_turn=${state.combat_turn ?? '-'}`,
    `combat_round=${state.combat_round ?? '-'}`,
    `foe=${state.combatant?.name ?? '-'} hp=${state.combatant?.hp ?? '-'}/${state.combatant?.max_hp ?? '-'}`,
    `location=${state.location}`,
    `flags=${flags.join(',') || '-'}`,
  ].join(' ');
}

function bellWardenHealTarget(maxHp: number): number {
  return Math.max(10, Math.floor(maxHp * 0.5));
}

function atSafeRestHub(state: CharacterSnapshot): boolean {
  return /Whispering Cellar|Shrine of the Forgotten|Goblin Market/i.test(state.location ?? '');
}

async function travelToSafeRestHub(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  let state = await fetchCharacterState(request, token, characterId);
  if (atSafeRestHub(state)) return;
  if (atBellWardenPit(state) || LOCATION_WAIT['The Vault of Echoes']!.test(state.location ?? '')) {
    await travelToLocation(request, token, characterId, 'The Sunken Corridor');
  }
  state = await fetchCharacterState(request, token, characterId);
  if (!atSafeRestHub(state)) {
    await travelToLocation(request, token, characterId, 'The Whispering Cellar');
  }
}

async function healCharacterToFullForBossFixture(
  request: APIRequestContext,
  token: string,
  characterId: string,
): Promise<CharacterSnapshot> {
  await leaveCombatIfNeeded(request, token, characterId, 24);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let state = await fetchCharacterState(request, token, characterId);
    const maxHp = state.max_hp ?? 12;
    if ((state.hp ?? 0) >= maxHp) return state;

    if (isMvpCombatDefeatRecovery(state) || (state.hp ?? 1) <= 1) {
      await reviveIfFallen(request, token, characterId);
      state = await fetchCharacterState(request, token, characterId);
      if ((state.hp ?? 0) < (state.max_hp ?? 12) && atSafeRestHub(state)) {
        await postGameAction(request, token, characterId, 'long rest');
      }
      continue;
    }
    if (!atSafeRestHub(state)) {
      await travelToSafeRestHub(request, token, characterId);
      continue;
    }
    await stabilizeForBellWardenFight(request, token, characterId, true);
    state = await fetchCharacterState(request, token, characterId);
    if ((state.hp ?? 0) < maxHp) {
      await postGameAction(request, token, characterId, 'long rest');
      state = await fetchCharacterState(request, token, characterId);
    }
    if ((state.hp ?? 0) < maxHp && (state.gold ?? 0) >= 45) {
      if (!LOCATION_WAIT['The Goblin Market']!.test(state.location ?? '')) {
        await travelToLocation(request, token, characterId, 'The Goblin Market');
      }
      for (let buy = 0; buy < 2 && (state.gold ?? 0) >= 45 && (state.hp ?? 0) < maxHp; buy += 1) {
        await postGameAction(request, token, characterId, 'buy healing potion');
        state = await fetchCharacterState(request, token, characterId);
      }
      const inv = state.inventory ?? [];
      if (inv.some(item => /potion/i.test(item)) && (state.hp ?? 0) < maxHp) {
        await postGameAction(request, token, characterId, 'drink potion');
        state = await fetchCharacterState(request, token, characterId);
      }
    }
    if ((state.hp ?? 0) < maxHp) {
      await postGameAction(request, token, characterId, 'short rest');
    }
  }
  const final = await fetchCharacterState(request, token, characterId);
  throw new Error(
    `Bell Warden UI heal fixture failed before travel. ${bossLoopSnapshot(final, 0, 'heal_failed')}`,
  );
}

/** Full HP at pit before Bell Warden UI fight (fixture only). */
export async function prepareBellWardenUiFight(
  request: APIRequestContext,
  token: string,
  characterId: string,
): Promise<CharacterSnapshot> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await healCharacterToFullForBossFixture(request, token, characterId);
    await leaveCombatIfNeeded(request, token, characterId, 24);
    if (!atBellWardenPit(await fetchCharacterState(request, token, characterId))) {
      await ensureAtBellWardenPit(request, token, characterId);
      await leaveCombatIfNeeded(request, token, characterId, 24);
    }

    const state = await fetchCharacterState(request, token, characterId);
    const maxHp = state.max_hp ?? 12;
    const ready = (state.hp ?? 0) === maxHp
      && atBellWardenPit(state)
      && !state.in_combat
      && state.level >= 3
      && Boolean(state.quest_flags?.vault_unlocked);
    if (ready) return state;
  }
  const final = await fetchCharacterState(request, token, characterId);
  throw new Error(
    `Bell Warden UI prep failed: expected full HP at pit. ${bossLoopSnapshot(final, 0, 'prep_failed')}`,
  );
}

async function stabilizeForBellWardenFight(
  request: APIRequestContext,
  token: string,
  characterId: string,
  fullHeal = false,
) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let state = await fetchCharacterState(request, token, characterId);
    const maxHp = state.max_hp ?? 12;
    const target = fullHeal ? maxHp : bellWardenHealTarget(maxHp);
    if ((state.hp ?? 1) >= target) return;

    const safeHub = /Whispering Cellar|Shrine of the Forgotten|Goblin Market/i.test(state.location ?? '');
    if (!safeHub) {
      await postGameAction(request, token, characterId, 'travel to The Whispering Cellar');
      state = await fetchCharacterState(request, token, characterId);
    }
    if (/Whispering Cellar|Shrine of the Forgotten|Goblin Market/i.test(state.location ?? '')) {
      await postGameAction(request, token, characterId, 'long rest');
      state = await fetchCharacterState(request, token, characterId);
      if ((state.hp ?? 1) >= target) return;
    }
    const hpBefore = state.hp ?? 1;
    if (state.second_wind_available) {
      await postGameAction(request, token, characterId, 'use second wind');
      state = await fetchCharacterState(request, token, characterId);
      if ((state.hp ?? 1) >= target) return;
    }
    if ((state.hp ?? 1) <= hpBefore) {
      await postGameAction(request, token, characterId, 'take a breather');
      state = await fetchCharacterState(request, token, characterId);
    }
    if ((state.hp ?? 1) < target) {
      await postGameAction(request, token, characterId, 'drink potion');
    }
  }
}

export async function completeBossViaEngine(
  request: APIRequestContext,
  token: string,
  characterId: string,
) {
  await ensureAtBellWardenPit(request, token, characterId);
  let state = await fetchCharacterState(request, token, characterId);
  expect(state.level, `Bell Warden requires level 3+, got L${state.level}`).toBeGreaterThanOrEqual(3);
  await stabilizeForBellWardenFight(request, token, characterId);

  const diag: string[] = [];
  let lastAction = 'init';
  let priorFoeHp: number | undefined;
  let noProgress = 0;

  for (let round = 0; round < 48; round += 1) {
    state = await fetchCharacterState(request, token, characterId);
    if (state.quest_flags?.chapter_one_complete) return;
    if ((state.hp ?? 1) <= 0) {
      await reviveIfFallen(request, token, characterId);
      await stabilizeForBellWardenFight(request, token, characterId);
      await ensureAtBellWardenPit(request, token, characterId);
      lastAction = 'revive';
      diag.push(bossLoopSnapshot(state, round, lastAction));
      continue;
    }
    if (!atBellWardenPit(state)) {
      if (/Whispering Cellar|Shrine|Forgotten/i.test(state.location ?? '')) {
        await stabilizeForBellWardenFight(request, token, characterId);
      }
      await ensureAtBellWardenPit(request, token, characterId);
      lastAction = 'travel_to_pit';
      continue;
    }

    const maxHp = state.max_hp ?? 12;
    const heroHp = state.hp ?? 1;
    const healTarget = bellWardenHealTarget(maxHp);

    if (state.in_combat) {
      const foeHp = state.combatant?.hp;
      if (priorFoeHp !== undefined && foeHp !== undefined && foeHp >= priorFoeHp) noProgress += 1;
      else if (foeHp !== undefined && priorFoeHp !== undefined && foeHp < priorFoeHp) noProgress = 0;
      priorFoeHp = foeHp;
      expect(
        noProgress,
        `Engine boss no foe-HP progress (${noProgress}). ${bossLoopSnapshot(state, round, lastAction)}`,
      ).toBeLessThan(12);

      await resolvePendingReactionForE2E(request, token, characterId);
      if (state.action_surge_available && (state.combatant?.hp ?? 99) > 12) {
        lastAction = 'action surge';
        await postGameAction(request, token, characterId, 'action surge');
        await closeCombatTurnIfStalled(request, token, characterId);
      }
      if (heroHp <= 6 && heroHp < maxHp - 2) {
        const beforeHp = heroHp;
        lastAction = 'drink potion';
        await postGameAction(request, token, characterId, 'drink potion');
        await closeCombatTurnIfStalled(request, token, characterId);
        const afterPotion = await fetchCharacterState(request, token, characterId);
        if ((afterPotion.hp ?? 0) > beforeHp + 1) {
          diag.push(bossLoopSnapshot(afterPotion, round, lastAction));
        }
      }
      const foe = state.combatant?.name ?? 'Bell Warden';
      lastAction = `attack ${foe}`;
      await postCombatAttack(request, token, characterId, foe);
      diag.push(bossLoopSnapshot(await fetchCharacterState(request, token, characterId), round, lastAction));
      continue;
    }

    if (heroHp < healTarget) {
      lastAction = 'stabilize';
      const hpBeforeStabilize = heroHp;
      await stabilizeForBellWardenFight(request, token, characterId);
      const afterStabilize = await fetchCharacterState(request, token, characterId);
      diag.push(bossLoopSnapshot(afterStabilize, round, lastAction));
      if ((afterStabilize.hp ?? 1) <= hpBeforeStabilize && (afterStabilize.hp ?? 1) < healTarget) {
        lastAction = 'attack the Bell Warden (low hp)';
      } else {
        continue;
      }
    }
    lastAction = 'attack the Bell Warden';
    await postGameAction(request, token, characterId, 'attack the Bell Warden');
    const afterEngage = await fetchCharacterState(request, token, characterId);
    diag.push(bossLoopSnapshot(afterEngage, round, lastAction));
  }
  const final = await fetchCharacterState(request, token, characterId);
  const tail = diag.slice(-12).join('\n');
  expect(
    final.quest_flags?.chapter_one_complete,
    `Bell Warden engine loop ended without chapter_one_complete after 48 turns `
      + `(level ${final.level}, hp ${final.hp}, in_combat ${final.in_combat}).\nRecent:\n${tail}`,
  ).toBe(true);
}

export { apiTelegramToken };
