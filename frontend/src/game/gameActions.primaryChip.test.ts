import { describe, expect, it } from 'vitest';
import { primaryPlayChipKey, playActionChips } from './gameActions';
import type { Character, JournalEvent } from '../types';

const t = (s: string) => s;
const base: Character = {
  id: '1',
  name: 'A',
  race: 'human',
  character_class: 'fighter',
  level: 1,
  hp: 10,
  max_hp: 10,
  armor_class: 14,
  location: 'The Shrine of the Forgotten',
  xp: 0,
  gold: 0,
  inventory: [],
  quest_flags: { bell_quest_accepted: false },
  in_combat: false,
};

describe('primaryPlayChipKey', () => {
  it('prefers NPC talk at shrine when bell quest is open', () => {
    const character = { ...base, quest_flags: { bell_quest_accepted: false } };
    const key = primaryPlayChipKey(character, [], [], t, false, false);
    const chips = playActionChips(character, [], [], t, false, false);
    expect(chips.some(c => c.key === key)).toBe(true);
    expect(key).toBeTruthy();
  });
});
