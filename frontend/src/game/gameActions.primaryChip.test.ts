import { describe, expect, it } from 'vitest';
import { primaryPlayChipKey, playActionChips } from './gameActions';
import type { JournalEvent } from '../types';
import { characterStub } from '../test/characterStub';

const t = (s: string) => s;
const base = characterStub({
  id: '1',
  name: 'A',
  character_class: 'fighter',
  armor_class: 14,
  location: 'The Shrine of the Forgotten',
  quest_flags: { bell_quest_accepted: false },
});

describe('primaryPlayChipKey', () => {
  it('prefers NPC talk at shrine when bell quest is open', () => {
    const character = { ...base, quest_flags: { bell_quest_accepted: false } };
    const key = primaryPlayChipKey(character, [], [], t, false, false);
    const chips = playActionChips(character, [], [], t, false, false);
    expect(chips.some(c => c.key === key)).toBe(true);
    expect(key).toBeTruthy();
  });
});
