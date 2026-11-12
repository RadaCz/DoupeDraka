import type { Character } from '../types';

/** Minimal Character for unit tests — fill only what each case needs. */
export function characterStub(overrides: Partial<Character> & Pick<Character, 'id' | 'name' | 'character_class'>): Character {
  return {
    race: 'human',
    level: 1,
    abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    hp: 10,
    max_hp: 10,
    armor_class: 10,
    mana: 0,
    max_mana: 0,
    xp: 0,
    gold: 0,
    inventory: [],
    location: 'cellar',
    in_combat: false,
    spell_slots: {},
    max_spell_slots: {},
    known_spells: [],
    prepared_spells: [],
    spellcasting_ability: 'intelligence',
    difficulty: 'normal',
    tone: 'heroic',
    humor: 'light',
    verbose: false,
    ...overrides,
  };
}
