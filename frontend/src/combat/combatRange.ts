import type { Character } from '../types';

export interface CombatTactics {
  distance_ft?: number;
  movement_remaining_ft?: number;
  speed_ft?: number;
  weapon_range?: {
    weapon_key?: string;
    weapon_type?: string;
    normal_ft?: number;
    long_ft?: number | null;
    can_attack?: boolean;
    disadvantage_reason?: string | null;
    denial?: string;
  };
}

export function readCombatTactics(character: Character): CombatTactics | null {
  return character.combat_tactics ?? null;
}

export function rangeDisadvantageLabel(reason: string | null | undefined, t: (s: string) => string): string | null {
  if (!reason) return null;
  if (reason === 'long range') return t('Long range — disadvantage on attack');
  if (reason === 'ranged in melee') return t('Foe within 5 ft — ranged attack at disadvantage');
  return reason;
}
