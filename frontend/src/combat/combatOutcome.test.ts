import { describe, expect, it } from 'vitest';
import { extractCombatVictory, shouldOfferCombatVictory } from './combatOutcome';

describe('combat victory screen facts', () => {
  it('parses XP from engine defeat lines only', () => {
    const rewards = extractCombatVictory([
      'Goblin scout is defeated. You gain 50 XP.',
    ]);
    expect(rewards?.xp).toBe(50);
    expect(rewards?.foeName).toBe('Goblin scout');
    expect(extractCombatVictory(['You miss.'])).toBeNull();
  });

  it('offers victory overlay when combat ends with positive HP', () => {
    const events = ['Goblin scout is defeated. You gain 50 XP.'];
    expect(shouldOfferCombatVictory(true, false, 10, events)).toBe(true);
    expect(shouldOfferCombatVictory(true, true, 10, events)).toBe(false);
    expect(shouldOfferCombatVictory(true, false, 0, events)).toBe(false);
  });
});