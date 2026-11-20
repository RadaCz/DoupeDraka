import { describe, expect, it } from 'vitest';
import {
  attackResolutionUsesSpellName,
  beatToChips,
  chipsFromResolution,
} from './combatResolution';
import type { TurnResolution, TurnResolutionBeat } from '../types';

describe('AC16-4 resolution chips', () => {
  it('builds attack chips from structured beats only', () => {
    const resolution: TurnResolution = {
      beats: [
        {
          kind: 'attack',
          actor: 'hero',
          attack_roll: { natural: 15, modifier: 5, total: 20 },
          target_ac: 13,
          outcome: 'hit',
          weapon: 'longsword',
          damage: { total: 8 },
        },
      ],
    };
    const chips = chipsFromResolution(resolution, 'cs');
    expect(chips.some(c => c.label.includes('longsword'))).toBe(true);
    expect(chips.some(c => c.label.includes('zásah'))).toBe(true);
    expect(chips.some(c => c.label.includes('Poškození 8'))).toBe(true);
  });

  it('shows Fire Bolt as spell attack label, not a weapon', () => {
    const beat: TurnResolutionBeat = {
      kind: 'attack',
      spell_name: 'Fire Bolt',
      attack_roll: { total: 14, modifier: 5, natural: 9 },
      target_ac: 13,
      outcome: 'hit',
      damage: { total: 6 },
    };
    expect(attackResolutionUsesSpellName(beat)).toBe(true);
    const chips = beatToChips(beat, 'cs');
    expect(chips[0]?.label.startsWith('Fire Bolt:')).toBe(true);
    expect(chips[0]?.label).not.toMatch(/longsword|zbraň/i);
  });

  it('includes movement and shield reaction chips', () => {
    const resolution: TurnResolution = {
      beats: [
        { kind: 'movement', distance_ft: { from: 15, to: 5 } },
        { kind: 'reaction', name: 'shield', cast: true },
      ],
    };
    const chips = chipsFromResolution(resolution, 'cs');
    expect(chips.some(c => c.label.includes('15 → 5'))).toBe(true);
    expect(chips.some(c => c.label.includes('Shield'))).toBe(true);
  });
});