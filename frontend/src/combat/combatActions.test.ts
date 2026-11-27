import { describe, expect, it } from 'vitest';
import {
  buildCombatActionDeck,
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
    const deck = buildCombatActionDeck(fighter, spells, t, 'cs');
    const attack = deck.main.find(a => a.id === 'attack');
    expect(attack?.description).toContain('Goblin scout');
    expect(attack?.description).not.toMatch(/Strike|with your weapon/i);
  });

  it('offers Sprint action in tactics when player turn and action available', () => {
    const deck = buildCombatActionDeck(fighter, spells, t);
    const sprint = deck.tactics.find(a => a.id === 'sprint');
    expect(sprint?.action).toBe('sprint');
    expect(sprint?.disabled).toBe(false);
    expect(sprint?.economySlot).toBe('action');
    const spent = buildCombatActionDeck(
      { ...fighter, combat_flags: { action_used: true, bonus_action_used: false } },
      spells,
      t,
    ).tactics.find(a => a.id === 'sprint');
    expect(spent?.disabled).toBe(true);
  });

  it('shows Czech Sprint description in meters', () => {
    const csT = (s: string) => ({
      'Action: gain {distance} more movement this turn.': 'Akce: získáš dalších {distance} pohybu v tomto tahu.',
      Sprint: 'Sprint',
    }[s] ?? s);
    const deck = buildCombatActionDeck(fighter, spells, csT, 'cs');
    const sprint = deck.tactics.find(a => a.id === 'sprint');
    expect(sprint?.description).toBe('Akce: získáš dalších 9 m pohybu v tomto tahu.');
    expect(sprint?.icon).toBe('sprint');
  });

  it('orders tactics advance, step back, sprint, disengage', () => {
    const ids = buildCombatActionDeck(fighter, spells, t).tactics.map(a => a.id);
    expect(ids.slice(0, 4)).toEqual(['advance', 'step_back', 'sprint', 'disengage']);
  });

  it('rogue keeps bonus Dash in abilities and Sprint in tactics', () => {
    const rogue = {
      ...fighter,
      character_class: 'rogue' as const,
      level: 2,
    };
    const deck = buildCombatActionDeck(rogue, spells, t);
    expect(deck.abilityActions.some(a => a.id === 'cunning_dash' && a.economySlot === 'bonus')).toBe(true);
    expect(deck.tactics.some(a => a.id === 'sprint')).toBe(true);
  });

  it('builds combat deck with tactics and potion panel', () => {
    const deck = buildCombatActionDeck(fighter, spells, t);
    expect(deck.main).toHaveLength(4);
    expect(deck.tactics.find(a => a.id === 'disengage')?.action).toBe('disengage');
    expect(deck.tactics.find(a => a.id === 'advance')?.action).toBe('advance 15 ft');
    expect(deck.itemActions.find(a => a.id === 'potion')?.disabled).toBe(false);
    expect(hasHealingPotion({ ...fighter, inventory: [] })).toBe(false);
    expect(buildCombatActionDeck({ ...fighter, inventory: [] }, spells, t).itemActions[0]?.disabled).toBe(true);
  });

  it('disables attack on enemy turn', () => {
    const deck = buildCombatActionDeck({ ...fighter, combat_turn: 'enemy' }, spells, t);
    expect(deck.main.every(a => a.disabled)).toBe(true);
    expect(deck.tactics).toHaveLength(0);
  });

  it('offers End turn when action and bonus are both spent (fighter second wind + attack)', () => {
    const spent = {
      ...fighter,
      level: 3,
      combat_flags: { action_used: true, bonus_action_used: true },
    };
    const deck = buildCombatActionDeck(spent, spells, t);
    expect(deck.endTurn?.disabled).toBe(false);
    expect(deck.endTurn?.action).toBe('end turn');
    expect(deck.main.find(a => a.id === 'attack')?.disabled).toBe(true);
  });

  it('filters modeled combat spells for wizard', () => {
    const wizard = {
      ...fighter,
      known_spells: ['Fire Bolt', 'Shield'],
      prepared_spells: ['Fire Bolt'],
    };
    expect(modeledCombatSpells(wizard, spells).map(s => s.name)).toEqual(['Fire Bolt']);
  });

  it('disables out-of-range modeled spells from combat_tactics.spells', () => {
    const wizard = {
      ...fighter,
      known_spells: ['Fire Bolt'],
      prepared_spells: ['Fire Bolt'],
      combat_tactics: {
        distance_ft: 121,
        spells: [
          {
            name: 'Fire Bolt',
            range_ft: 120,
            can_cast: false,
            denial: 'Fire Bolt has a range of 120 ft. The enemy is 121 ft away.',
          },
        ],
      },
    };
    const deck = buildCombatActionDeck(wizard, spells, t, 'cs');
    const fireBolt = deck.abilityActions.find(a => a.id === 'spell-Fire Bolt');
    expect(fireBolt?.disabled).toBe(true);
    expect(fireBolt?.disabledReason).toContain('36,3 m');
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

  it('legacy buildCombatActions flattens deck entries', () => {
    expect(buildCombatActions(fighter, spells, t).length).toBeGreaterThan(4);
  });

  it('paralyzed player turn exposes only Continue (end turn)', () => {
    const paralyzed = {
      ...fighter,
      conditions: [{ condition_id: 'paralyzed', source_id: 'ghoul' }],
    };
    const deck = buildCombatActionDeck(paralyzed, spells, t);
    expect(deck.main).toHaveLength(0);
    expect(deck.tactics).toHaveLength(0);
    expect(deck.paralyzedTurn?.message).toBe('You are paralyzed this turn and cannot act.');
    expect(deck.paralyzedTurn?.continue.label).toBe('Continue');
    expect(deck.paralyzedTurn?.continue.action).toBe('end turn');
    expect(deck.paralyzedTurn?.continue.disabled).toBe(false);
    expect(deck.tactics.some(a => a.id === 'sprint')).toBe(false);
  });

  it('Czech paralyzed turn copy', () => {
    const paralyzed = {
      ...fighter,
      conditions: [{ condition_id: 'paralyzed' }],
    };
    const cs = (key: string) =>
      ({
        'You are paralyzed this turn and cannot act.': 'Jsi paralyzovaný. Tento tah nemůžeš jednat.',
        Continue: 'Pokračovat',
        'Pass to the enemy when you are done acting.': 'Předej tah protivníkovi.',
      })[key] ?? key;
    const deck = buildCombatActionDeck(paralyzed, spells, cs, 'cs');
    expect(deck.paralyzedTurn?.message).toBe('Jsi paralyzovaný. Tento tah nemůžeš jednat.');
    expect(deck.paralyzedTurn?.continue.label).toBe('Pokračovat');
  });
});