import { describe, expect, it } from 'vitest';
import type { Character, Spell } from '../types';
import {
  buildCastAction,
  castBlockReasonKey,
  castSpellAction,
  heroSpellRows,
  isCasterClass,
  modeledCombatSpells,
  slotAvailableForSpell,
} from './spellbook';

const spells: Spell[] = [
  { name: 'Fire Bolt', level: 0, school: 'evocation', range: '120 feet', text: '', effect_modeled: true },
  { name: 'Shield', level: 1, school: 'abjuration', range: 'Self', text: '', effect_modeled: false },
  { name: 'Magic Missile', level: 1, school: 'evocation', range: '120 feet', text: '', effect_modeled: true },
];

const wizard: Character = {
  id: '1',
  name: 'M',
  race: 'human',
  character_class: 'wizard',
  level: 1,
  abilities: {},
  hp: 8,
  max_hp: 8,
  armor_class: 12,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'Cellar',
  in_combat: false,
  spell_slots: { 1: 2 },
  max_spell_slots: { 1: 2 },
  known_spells: ['Fire Bolt', 'Shield', 'Magic Missile'],
  prepared_spells: [],
  spellcasting_ability: 'int',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: false,
};

const fighter: Character = { ...wizard, character_class: 'fighter', known_spells: [], prepared_spells: [], spell_slots: {}, max_spell_slots: {} };

describe('spellbook', () => {
  it('detects caster vs martial', () => {
    expect(isCasterClass('wizard')).toBe(true);
    expect(isCasterClass('fighter')).toBe(false);
  });

  it('splits known modeled combat spells', () => {
    expect(modeledCombatSpells(wizard, spells).map(s => s.name)).toEqual(['Fire Bolt', 'Magic Missile']);
  });

  it('blocks non-modeled cast', () => {
    expect(castBlockReasonKey(wizard, spells[1], false)).toBe('not_modeled');
  });

  it('builds targeted combat cast', () => {
    const inCombat = { ...wizard, in_combat: true, combat_turn: 'player', combatant: { name: 'Goblin', hp: 5, max_hp: 7, armor_class: 13 } };
    expect(buildCastAction(inCombat, 'Fire Bolt')).toBe('cast Fire Bolt at Goblin');
    expect(castSpellAction('Magic Missile', 'Goblin')).toBe('cast Magic Missile at Goblin');
  });

  it('reports slot availability', () => {
    expect(slotAvailableForSpell({ ...wizard, spell_slots: { 1: 0 } }, 1)).toBe(false);
    expect(slotAvailableForSpell(wizard, 0)).toBe(true);
  });

  it('lists hero spell rows', () => {
    expect(heroSpellRows(wizard, spells).map(r => r.spell.name)).toEqual(['Fire Bolt', 'Magic Missile', 'Shield']);
    expect(heroSpellRows(fighter, spells)).toHaveLength(0);
  });
});
