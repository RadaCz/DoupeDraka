import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import {
  abilityModifier,
  canWieldInventoryItem,
  equippedWeaponInstance,
  formatModifier,
  formatSavingThrowProficiencies,
  inventoryCounts,
  potionUseBlocked,
  proficiencyBonus,
  xpProgress,
} from './characterSheet';

const hero: Character = {
  id: '1',
  name: 'A',
  race: 'human',
  character_class: 'fighter',
  level: 1,
  abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 },
  hp: 8,
  max_hp: 12,
  armor_class: 14,
  mana: 0,
  max_mana: 0,
  xp: 35,
  gold: 5,
  inventory: ['Longsword', 'Healing potion', 'Healing potion'],
  item_instances: [
    { instance_id: 'a', definition_id: 'longsword', name: 'Longsword', equipped: true, attack_bonus: 0 },
    { instance_id: 'b', definition_id: 'healing_potion', name: 'Healing potion', equipped: false, attack_bonus: 0 },
  ],
  location: 'Cellar',
  in_combat: false,
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

describe('characterSheet', () => {
  it('formats ability modifiers', () => {
    expect(abilityModifier(16)).toBe(3);
    expect(formatModifier(8)).toBe('-1');
  });

  it('mirrors engine proficiency bonus by level', () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
  });

  it('formats saving throw proficiencies for display', () => {
    const line = formatSavingThrowProficiencies(['strength', 'constitution'], key => key);
    expect(line).toContain('Strength');
    expect(line).toContain('Constitution');
  });

  it('tracks XP progress toward engine threshold', () => {
    expect(xpProgress(35)).toEqual({ current: 35, threshold: 100 });
  });

  it('knows wieldable vs decorative weapons', () => {
    expect(canWieldInventoryItem('Longsword')).toBe(true);
    expect(canWieldInventoryItem('Longbow')).toBe(false);
  });

  it('groups duplicate inventory labels', () => {
    expect(inventoryCounts(hero.inventory)).toEqual([
      { label: 'Healing potion', count: 2 },
      { label: 'Longsword', count: 1 },
    ]);
  });

  it('reads equipped weapon instance', () => {
    expect(equippedWeaponInstance(hero.item_instances)?.name).toBe('Longsword');
  });

  it('blocks potion when at full health', () => {
    expect(potionUseBlocked({ ...hero, hp: 12 })).toBe('You are already at full health.');
  });

  it('blocks potion on enemy combat turn', () => {
    expect(potionUseBlocked({ ...hero, in_combat: true, combat_turn: 'enemy' })).toMatch(/Wait for your turn/);
  });
});
