import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import { economyDenialReason, readCombatEconomy, shouldOfferEndTurn, spellEconomySlot } from './combatEconomy';

const t = (key: string) => key;

function combatHero(flags: Record<string, boolean> = {}): Character {
  return {
    name: 'Test',
    in_combat: true,
    combat_turn: 'player',
    combat_flags: flags,
  } as Character;
}

describe('combatEconomy', () => {
  it('reads availability from combat_flags', () => {
    const eco = readCombatEconomy(combatHero());
    expect(eco.actionAvailable).toBe(true);
    expect(eco.bonusAvailable).toBe(true);
  });

  it('marks spent pools', () => {
    const eco = readCombatEconomy(
      combatHero({ action_used: true, bonus_action_used: true }),
    );
    expect(eco.actionAvailable).toBe(false);
    expect(eco.bonusAvailable).toBe(false);
    const reason = economyDenialReason(eco, 'bonus', t);
    expect(reason).toContain('bonus action');
  });

  it('offers end turn when only one pool was spent', () => {
    expect(shouldOfferEndTurn(combatHero())).toBe(false);
    expect(shouldOfferEndTurn(combatHero({ action_used: true }))).toBe(true);
    expect(shouldOfferEndTurn(combatHero({ bonus_action_used: true }))).toBe(true);
    expect(shouldOfferEndTurn(combatHero({ action_used: true, bonus_action_used: true }))).toBe(false);
  });

  it('classifies Healing Word as bonus', () => {
    expect(spellEconomySlot('Healing Word')).toBe('bonus');
    expect(spellEconomySlot('Sacred Flame')).toBe('action');
  });
});
