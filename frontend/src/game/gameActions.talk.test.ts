import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import {
  buildQuickActions,
  playActionChips,
  resolveNpcTalkAction,
  resolveQuestBossAction,
  resolveQuestTravelAction,
} from './gameActions';

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

  it('does not surface listen-for-movement as a quick chip', () => {
    const chips = playActionChips(base, [], [], t, false, false);
    expect(chips.some(chip => (chip.action ?? '').includes('listen for movement'))).toBe(false);
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

  it('offers vault follow-up at the shrine after the bell is returned', () => {
    const shrine: Character = {
      ...base,
      location: 'The Shrine of the Forgotten',
      quest_flags: { bell_quest_complete: true },
    };
    const npc = resolveNpcTalkAction(shrine, t);
    expect(npc?.action).toBe('talk to Caldus about the vault of echoes');
  });

  it('suggests quest travel from cellar toward corridor before the bell quest is accepted', () => {
    const hero: Character = { ...base, quest_flags: {} };
    const locations = [
      {
        name: 'The Whispering Cellar',
        connections: ['The Sunken Corridor'],
        arrival_beat: '',
        encounter_pool: [],
      },
      {
        name: 'The Sunken Corridor',
        connections: ['The Shrine of the Forgotten', 'The Whispering Cellar'],
        arrival_beat: '',
        encounter_pool: [],
      },
      {
        name: 'The Shrine of the Forgotten',
        connections: ['The Goblin Market', 'The Sunken Corridor'],
        arrival_beat: '',
        encounter_pool: [],
      },
    ];
    const travel = resolveQuestTravelAction(hero, locations, t);
    expect(travel?.action).toBe('travel to The Sunken Corridor');
    const chips = playActionChips(hero, [], locations, t, false, false);
    expect(chips.some(c => c.action === 'travel to The Sunken Corridor')).toBe(true);
  });

  it('suggests one-hop travel toward Goblin Market after the bell quest is accepted', () => {
    const hero: Character = {
      ...base,
      quest_flags: { bell_quest_accepted: true },
    };
    const locations = [
      {
        name: 'The Whispering Cellar',
        connections: ['The Sunken Corridor'],
        arrival_beat: '',
        encounter_pool: [],
      },
      {
        name: 'The Sunken Corridor',
        connections: ['The Shrine of the Forgotten', 'The Whispering Cellar', 'The Goblin Market'],
        arrival_beat: '',
        encounter_pool: [],
      },
      {
        name: 'The Goblin Market',
        connections: ['The Sunken Corridor'],
        arrival_beat: '',
        encounter_pool: [],
      },
    ];
    expect(resolveQuestTravelAction(hero, locations, t)?.action).toBe('travel to The Sunken Corridor');
  });

  it('offers Bell Warden attack chip in the pit when the vault is unlocked', () => {
    const pit: Character = {
      ...base,
      location: "The Bell Warden's Pit",
      quest_flags: { vault_unlocked: true },
    };
    const boss = resolveQuestBossAction(pit, t);
    expect(boss?.action).toBe('attack the Bell Warden');
    const chips = playActionChips(pit, [], [], t, false, false);
    expect(chips.some(c => c.action === 'attack the Bell Warden')).toBe(true);
  });
});
