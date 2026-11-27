import { describe, expect, it } from 'vitest';
import { formatSpellRangeDenial, spellRangeRow } from './combatSpellRange';
import type { Character } from '../types';

const t = (s: string) => (
  s === 'Sacred Flame' ? 'Posvátný plamen' : s
);

describe('combatSpellRange', () => {
  const character = {
    combat_tactics: {
      distance_ft: 120,
      spells: [
        {
          name: 'Sacred Flame',
          range_ft: 60,
          can_cast: false,
          denial: 'Sacred Flame has a range of 60 ft. The enemy is 120 ft away.',
        },
        {
          name: 'Fire Bolt',
          range_ft: 120,
          can_cast: true,
          denial: null,
        },
      ],
    },
  } as Character;

  it('finds spell row by name', () => {
    expect(spellRangeRow(character, 'sacred flame')?.can_cast).toBe(false);
  });

  it('formats Czech denial with engine distance in meters', () => {
    const row = spellRangeRow(character, 'Sacred Flame')!;
    const text = formatSpellRangeDenial(row, 'cs', t, 120);
    expect(text).toBe('Posvátný plamen má dosah 18 m. Nepřítel je 36 m daleko.');
  });

  it('formats Czech denial without distance as range-only', () => {
    const row = spellRangeRow(character, 'Sacred Flame')!;
    const text = formatSpellRangeDenial(row, 'cs', t, undefined);
    expect(text).toBe('Posvátný plamen má dosah 18 m.');
    expect(text).not.toMatch(/Nepřítel/);
  });
});