import { describe, expect, it } from 'vitest';
import { formatSpellRangeDenial, spellRangeRow } from './combatSpellRange';
import type { Character } from '../types';

describe('combatSpellRange', () => {
  const character = {
    combat_tactics: {
      distance_ft: 121,
      spells: [
        {
          name: 'Fire Bolt',
          range_ft: 120,
          can_cast: false,
          denial: 'Fire Bolt has a range of 120 ft. The enemy is 121 ft away.',
        },
      ],
    },
  } as Character;

  it('finds spell row by name', () => {
    expect(spellRangeRow(character, 'fire bolt')?.can_cast).toBe(false);
  });

  it('formats Czech denial with meter labels', () => {
    const row = spellRangeRow(character, 'Fire Bolt')!;
    const text = formatSpellRangeDenial(row, 'cs', s => s, 121);
    expect(text).toContain('má dosah');
    expect(text).toContain('36,3 m');
  });
});