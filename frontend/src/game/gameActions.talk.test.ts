import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import { buildQuickActions, resolveNpcTalkAction } from './gameActions';

const t = (value: string) => value;

const base: Character = {
  id: 'c1',
  name: 'Hero',
  race: 'human',
  character_class: 'fighter',
  level: 1,
  abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  hp: 10,
  max_hp: 10,
  armor_class: 12,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'The Whispering Cellar',
  in_combat: false,
  combatant: null,
  spell_slots: {},
  max_spell_slots: {},
  known_spells: [],
  prepared_spells: [],
  spellcasting_ability: '',
};

describe('Talk quick action', () => {
  it('does not default Talk to listen for movement without an NPC', () => {
    const quick = buildQuickActions(base, [], [], t, false, false);
    const talk = quick.find(item => item.id === 'talk');
    expect(talk?.action).toBeUndefined();
    expect(talk?.mode).toBe('focus');
    expect(talk?.action).not.toBe('listen for movement');
  });

  it('offers Caldus dialogue only at the shrine with the right flags', () => {
    const shrine: Character = {
      ...base,
      location: 'The Shrine of the Forgotten',
      quest_flags: {},
    };
    const npc = resolveNpcTalkAction(shrine, t);
    expect(npc?.action).toBe('talk to Caldus about the shrine bell');

    const quick = buildQuickActions(shrine, [], [], t, false, false);
    expect(quick.find(item => item.id === 'talk')?.action).toBe('talk to Caldus about the shrine bell');
  });
});
