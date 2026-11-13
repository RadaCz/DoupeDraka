import { describe, expect, it } from 'vitest';
import {
  buildCombatActions,
  castSpellAction,
  hasHealingPotion,
  isPlayerCombatTurn,
  lastCombatBeat,
  modeledCombatSpells,
} from './combatActions';
import type { Character, JournalEvent, Spell } from '../types';

const t = (s: string) => s;

const fighter: Character = {
  id: '1',
  name: 'A',
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
  inventory: ['Healing potion'],
  location: 'The Whispering Cellar',
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

const spells: Spell[] = [
  { name: 'Fire Bolt', level: 0, school: 'evocation', text: '', effect_modeled: true },
  { name: 'Shield', level: 1, school: 'abjuration', text: '', effect_modeled: false },
];

describe('combatActions', () => {
  it('detects player vs enemy turn', () => {
    expect(isPlayerCombatTurn(fighter)).toBe(true);
    expect(isPlayerCombatTurn({ ...fighter, combat_turn: 'enemy' })).toBe(false);
  });

  it('uses Czech attack descriptions without English templates', () => {
    const actions = buildCombatActions(fighter, spells, t, 'cs');
    const attack = actions.find(a => a.id === 'attack');
    expect(attack?.description).toContain('Goblin scout');
    expect(attack?.description).not.toMatch(/Strike|with your weapon/i);
  });

  it('builds combat actions with movement and potion when in pack', () => {
    const actions = buildCombatActions(fighter, spells, t);
    expect(actions).toHaveLength(8);
    expect(actions.find(a => a.id === 'disengage')?.action).toBe('disengage');
    expect(actions.find(a => a.id === 'advance')?.action).toBe('advance 15 ft');
    expect(actions.find(a => a.id === 'potion')?.disabled).toBe(false);
    expect(hasHealingPotion({ ...fighter, inventory: [] })).toBe(false);
    expect(buildCombatActions({ ...fighter, inventory: [] }, spells, t).find(a => a.id === 'potion')?.disabled).toBe(
      true,
    );
  });

  it('disables all actions on enemy turn', () => {
    const actions = buildCombatActions({ ...fighter, combat_turn: 'enemy' }, spells, t);
    expect(actions.every(a => a.disabled)).toBe(true);
  });

  it('offers End turn when action and bonus are both spent (fighter second wind + attack)', () => {
    const spent = {
      ...fighter,
      level: 3,
      combat_flags: { action_used: true, bonus_action_used: true },
    };
    const actions = buildCombatActions(spent, spells, t);
    const endTurn = actions.find(a => a.id === 'end_turn');
    expect(endTurn?.disabled).toBe(false);
    expect(endTurn?.action).toBe('end turn');
    expect(actions.find(a => a.id === 'attack')?.disabled).toBe(true);
  });

  it('filters modeled combat spells for wizard', () => {
    const wizard = {
      ...fighter,
      known_spells: ['Fire Bolt', 'Shield'],
      prepared_spells: ['Fire Bolt'],
    };
    expect(modeledCombatSpells(wizard, spells).map(s => s.name)).toEqual(['Fire Bolt']);
  });

  it('builds cast action with target for damage spells', () => {
    expect(castSpellAction('Fire Bolt', 'Goblin scout')).toBe('cast Fire Bolt at Goblin scout');
    expect(castSpellAction('Shield', 'Goblin scout')).toBe('cast Shield');
  });

  it('picks last combat beat from journal', () => {
    const events: JournalEvent[] = [
      { id: 1, character_id: '1', action: 'search', result: 'Quiet.', created_at: new Date().toISOString() },
      { id: 2, character_id: '1', action: 'attack goblin', result: 'Steel rings.\n\nAttack roll: 15 — hit.', created_at: new Date().toISOString() },
    ];
    expect(lastCombatBeat(events)?.action).toMatch(/attack/);
  });
});
