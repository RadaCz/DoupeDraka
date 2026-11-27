import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../types';
import { CombatActionDeck, CombatHeroStrip } from './CombatUI';

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'paralyzed' ? 'Paralyza' : key),
    locale: 'en' as const,
  }),
}));

const combatHero: Character = {
  id: '1',
  name: 'Alden',
  race: 'elf',
  character_class: 'wizard',
  level: 2,
  abilities: {},
  hp: 8,
  max_hp: 12,
  armor_class: 12,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'The Sunken Corridor',
  in_combat: true,
  combatant: { name: 'Cellar ghoul', hp: 10, max_hp: 22, armor_class: 12 },
  spell_slots: {},
  max_spell_slots: {},
  known_spells: [],
  prepared_spells: [],
  spellcasting_ability: 'intelligence',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: false,
  conditions: [{ condition_id: 'paralyzed', source_id: 'ghoul' }],
};

describe('CombatActionDeck paralysis', () => {
  it('shows only status message and Continue when paralyzed on player turn', async () => {
    const onAction = vi.fn();
    render(
      <CombatActionDeck
        character={{ ...combatHero, combat_turn: 'player' }}
        spells={[]}
        busy={false}
        onAction={onAction}
      />,
    );
    expect(screen.getByText('You are paralyzed this turn and cannot act.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Attack\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Advance/i })).not.toBeInTheDocument();
    const cont = screen.getByRole('button', { name: /^Continue$/i });
    cont.click();
    expect(onAction).toHaveBeenCalledWith('end turn');
  });
});

describe('CombatHeroStrip conditions', () => {
  it('renders engine condition chips', () => {
    render(<CombatHeroStrip character={combatHero} />);
    expect(screen.getByText('Paralyza')).toBeInTheDocument();
  });

  it('omits chips when conditions are cleared', () => {
    const cleared = { ...combatHero, conditions: [] };
    const { rerender } = render(<CombatHeroStrip character={combatHero} />);
    expect(screen.getByText('Paralyza')).toBeInTheDocument();
    rerender(<CombatHeroStrip character={cleared} />);
    expect(screen.queryByText('Paralyza')).not.toBeInTheDocument();
  });
});
