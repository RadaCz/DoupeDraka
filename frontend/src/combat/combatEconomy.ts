import type { Character } from '../types';

export interface CombatEconomyState {
  actionAvailable: boolean;
  bonusAvailable: boolean;
  reactionAvailable: boolean;
  inPlayerTurn: boolean;
}

function flag(character: Character, key: string): boolean {
  return Boolean(character.combat_flags?.[key]);
}

export function readCombatEconomy(character: Character): CombatEconomyState {
  const inCombat = Boolean(character.in_combat);
  const inPlayerTurn = inCombat && character.combat_turn !== 'enemy';
  return {
    inPlayerTurn,
    actionAvailable: inPlayerTurn && !flag(character, 'action_used'),
    bonusAvailable: inPlayerTurn && !flag(character, 'bonus_action_used'),
    reactionAvailable: inCombat && !flag(character, 'reaction_used'),
  };
}

export type EconomySlot = 'action' | 'bonus' | 'reaction';

export const BONUS_ACTION_SPELLS = new Set(['Healing Word']);

export function spellEconomySlot(spellName: string): EconomySlot {
  return BONUS_ACTION_SPELLS.has(spellName) ? 'bonus' : 'action';
}

export function shouldOfferEndTurn(character: Character): boolean {
  if (!character.in_combat || character.combat_turn === 'enemy') return false;
  const actionUsed = flag(character, 'action_used');
  const bonusUsed = flag(character, 'bonus_action_used');
  if (!actionUsed && !bonusUsed) return false;
  return !(actionUsed && bonusUsed);
}

export function economyDenialReason(
  economy: CombatEconomyState,
  slot: EconomySlot,
  t: (key: string) => string,
  character?: { combat_turn?: string },
): string | undefined {
  if (!economy.inPlayerTurn && character.combat_turn !== 'reaction') {
    return t('Wait for the enemy to act.');
  }
  if (slot === 'action' && !economy.actionAvailable) {
    return t('You already used your action this turn.');
  }
  if (slot === 'bonus' && !economy.bonusAvailable) {
    return t('You already used your bonus action this turn.');
  }
  if (slot === 'reaction' && !economy.reactionAvailable) {
    return t('You already used your reaction this round.');
  }
  return undefined;
}
