import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character, JournalEvent, Spell } from '../types';
import { CombatActionDeck, CombatMoment } from './CombatUI';
import { buildCombatActionDeck, modeledCombatSpells } from './combatActions';

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'cs' as const,
  }),
}));

const fighter: Character = {
  id: '1',
  name: 'A',
  race: 'human',
  character_class: 'fighter',
  abilities: {},
  level: 1,
  hp: 10,
  max_hp: 12,
  armor_class: 14,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: ['Healing potion'],
  location: 'Cellar',
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
  { name: 'Mage Hand', level: 0, school: 'transmutation', text: '', effect_modeled: false },
];

describe('AC16-2 action deck layout', () => {
  it('exposes four main buttons without permanent hint list', () => {
    const onAction = vi.fn();
    render(<CombatActionDeck character={fighter} spells={spells} busy={false} onAction={onAction} />);
    const deck = screen.getByRole('group', { name: 'Combat actions' });
    expect(within(deck).getByRole('button', { name: /^Attack/ })).toBeInTheDocument();
    expect(within(deck).getByRole('button', { name: /^Defend/ })).toBeInTheDocument();
    expect(within(deck).getByRole('button', { name: /^Combat abilities/ })).toBeInTheDocument();
    expect(within(deck).getByRole('button', { name: /^Items/ })).toBeInTheDocument();
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  expect(deck.querySelector('.combat-action-hints')).toBeNull();
  });

  it('places Attack first in the deck model', () => {
    const deck = buildCombatActionDeck(fighter, spells, s => s, 'cs');
    expect(deck.main[0]?.id).toBe('attack');
    expect(deck.main).toHaveLength(4);
  });
});

describe('AC16-5 disabled reasons visible', () => {
  it('renders denial text when attack is out of reach', () => {
    const outOfReach = {
      ...fighter,
      combat_tactics: {
        distance_ft: 60,
        weapon_range: { can_attack: false, denial: 'Target is out of range (60 ft).' },
      },
    };
    render(<CombatActionDeck character={outOfReach} spells={spells} busy={false} onAction={vi.fn()} />);
    expect(screen.getByText('Target is out of range (60 ft).')).toBeInTheDocument();
  });
});

describe('AC16-6 modeled spells only', () => {
  it('offers Fire Bolt in abilities panel but not Shield or Mage Hand', async () => {
    const wizard = {
      ...fighter,
      character_class: 'wizard',
      known_spells: ['Fire Bolt', 'Shield', 'Mage Hand'],
      prepared_spells: ['Fire Bolt', 'Shield', 'Mage Hand'],
    };
    expect(modeledCombatSpells(wizard, spells).map(s => s.name)).toEqual(['Fire Bolt']);
    render(<CombatActionDeck character={wizard} spells={spells} busy={false} onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Combat abilities/ }));
    expect(screen.getByRole('button', { name: 'Fire Bolt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shield' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mage Hand' })).not.toBeInTheDocument();
  });
});

describe('AC16-7 no emoji in combat chrome', () => {
  it('uses SVG icons instead of emoji glyphs on action buttons', () => {
    render(<CombatActionDeck character={fighter} spells={spells} busy={false} onAction={vi.fn()} />);
    const deck = screen.getByRole('group', { name: 'Combat actions' });
    expect(deck.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(deck.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});

describe('AC16-4 result card layers', () => {
  it('renders story, outcome chips, and what next from resolution', () => {
    const events: JournalEvent[] = [
      {
        id: 1,
        action: 'attack goblin',
        result: 'Čepel zazvoní.\n\nAttack with sword: 17 vs AC 13 — hit.',
        created_at: new Date().toISOString(),
        resolution: {
          beats: [
            {
              kind: 'attack',
              weapon: 'sword',
              attack_roll: { total: 17, modifier: 4, natural: 13 },
              target_ac: 13,
              outcome: 'hit',
              damage: { total: 5 },
            },
          ],
        },
      },
    ];
    render(
      <CombatMoment character={fighter} events={events} busy={false} />,
    );
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(screen.getByText('Turn outcome')).toBeInTheDocument();
    expect(screen.getByText(/sword.*zásah/i)).toBeInTheDocument();
  });
});