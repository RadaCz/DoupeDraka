import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import { isCombatDefeatRespawn, noticeFromLevelUp } from './turnMoments';

const baseCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'c1',
  name: 'Test',
  class_name: 'fighter',
  race: 'human',
  level: 1,
  hp: 10,
  max_hp: 10,
  location: 'The Whispering Cellar',
  ...overrides,
} as Character);

describe('turnMoments', () => {
  it('detects combat defeat respawn events', () => {
    expect(isCombatDefeatRespawn(['Defeated in combat. You black out.'])).toBe(true);
    expect(isCombatDefeatRespawn(['You hit for 5 damage.'])).toBe(false);
  });

  it('builds level-up notice from facts or character delta', () => {
    const before = baseCharacter({ level: 1, max_hp: 10 });
    const after = baseCharacter({ level: 2, max_hp: 18 });
    expect(noticeFromLevelUp(before, after, { new_level: 2, hp_gained: 8 })).toEqual({
      level: 2,
      hpGained: 8,
    });
    expect(noticeFromLevelUp(before, after)).toEqual({ level: 2, hpGained: 8 });
    expect(noticeFromLevelUp(before, before)).toBeNull();
  });
});
