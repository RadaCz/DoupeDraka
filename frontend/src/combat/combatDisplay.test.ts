import { describe, expect, it } from 'vitest';
import type { Character, JournalEvent } from '../types';
import {
  canonicalPlayLocation,
  combatAtmosphereLine,
  combatIntroProse,
  isPreStrikeCombatBeat,
} from './combatDisplay';

const base: Character = {
  id: '1',
  name: 'Grath',
  race: 'human',
  character_class: 'fighter',
  abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
  level: 1,
  hp: 10,
  max_hp: 12,
  armor_class: 14,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'The Underground River',
  in_combat: true,
  combat_turn: 'player',
  combatant: { name: 'Goblin scout', hp: 4, max_hp: 7, armor_class: 13 },
  spell_slots: {},
  max_spell_slots: {},
  known_spells: [],
  prepared_spells: [],
  spellcasting_ability: 'int',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: false,
};

describe('combatDisplay', () => {
  it('uses character.location as canonical play location', () => {
    expect(canonicalPlayLocation(base)).toBe('The Underground River');
    expect(combatAtmosphereLine(base, 'en')).toContain('The Underground River');
    expect(combatAtmosphereLine(base, 'en')).not.toContain('Sunken Corridor');
  });

  it('keeps atmosphere aligned with hero location (not stale journal place names)', () => {
    const wrongJournalLocation = 'The Sunken Corridor';
    const atmosphere = combatAtmosphereLine(
      { ...base, location: 'The Underground River' },
      'en',
    );
    expect(atmosphere).toContain('The Underground River');
    expect(atmosphere).not.toContain(wrongJournalLocation);
  });

  it('detects pre-strike vs post-strike combat beats', () => {
    const spawn: JournalEvent[] = [
      {
        id: 1,
        character_id: '1',
        action: 'search',
        result: 'An enemy appears: Goblin scout (7 HP).\n\nInitiative: you 14 (DEX), Goblin scout 11 (DEX).',
        created_at: new Date().toISOString(),
      },
    ];
    expect(isPreStrikeCombatBeat(spawn)).toBe(true);

    const afterAttack: JournalEvent[] = [
      ...spawn,
      {
        id: 2,
        character_id: '1',
        action: 'attack Goblin scout',
        result: 'Steel rings.\n\nAttack roll: 15 — hit.',
        created_at: new Date().toISOString(),
      },
    ];
    expect(isPreStrikeCombatBeat(afterAttack)).toBe(false);
  });

  it('writes distinct intro prose in CS and EN using foe and location', () => {
    const cs = combatIntroProse(base, 'cs');
    const en = combatIntroProse(base, 'en');
    expect(cs).toContain('Gobliní zvěd');
    expect(cs).toContain('Podzemní řeka');
    expect(cs).not.toMatch(/Strike|with your weapon/i);
    expect(en).toContain('Goblin scout');
    expect(en).toContain('The Underground River');
  });
});
