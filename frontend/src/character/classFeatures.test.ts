import { describe, expect, it } from 'vitest';
import { classFeatureLines, sneakAttackDiceLabel } from './classFeatures';
import type { Character } from '../types';

const t = (value: string) => value;

const base: Character = {
  id: '1',
  name: 'Test',
  race: 'human',
  character_class: 'fighter',
  level: 1,
  abilities: {},
  hp: 10,
  max_hp: 10,
  armor_class: 10,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'Cellar',
  in_combat: false,
  spell_slots: {},
  max_spell_slots: {},
  known_spells: [],
  prepared_spells: [],
  spellcasting_ability: '',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: true,
};

describe('classFeatures', () => {
  it('labels fighter second wind readiness', () => {
    const lines = classFeatureLines({ ...base, fighting_style: 'defense', second_wind_available: true }, t);
    expect(lines.some(line => line.key === 'second_wind' && line.status === 'Ready')).toBe(true);
  });

  it('shows rogue sneak attack dice at level 1', () => {
    expect(sneakAttackDiceLabel(1)).toBe('1d6');
    const lines = classFeatureLines({
      ...base,
      character_class: 'rogue',
      expertise_skills: ['Stealth', 'Acrobatics'],
    }, t);
    expect(lines.some(line => line.key === 'sneak_attack')).toBe(true);
  });
});
