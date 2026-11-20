import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../types';
import { CombatBattlefieldTrack } from './CombatBattlefieldTrack';
import { CombatChronicleFold } from './CombatChronicleFold';

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
  inventory: [],
  location: 'Cellar',
  in_combat: true,
  combat_turn: 'player',
  combatant: { name: 'Goblin scout', hp: 4, max_hp: 7, armor_class: 13 },
  combat_tactics: {
    distance_ft: 65,
    movement_remaining_ft: 10,
    weapon_range: { normal_ft: 5, can_attack: false },
  },
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

describe('AC16-3 battlefield UI', () => {
  it('renders track with 60+ ft label and weapon reach band', () => {
    const { container } = render(<CombatBattlefieldTrack character={fighter} />);
    expect(screen.getByText('60+ ft')).toBeInTheDocument();
    expect(container.querySelector('.combat-battlefield-weapon-reach')).toBeTruthy();
    expect(container.querySelector('.combat-battlefield-foe-token')).toBeTruthy();
  });
});

describe('AC16-3 combat chronicle fold', () => {
  it('shows collapsed Průběh boje when prior beats exist', () => {
    render(
      <CombatChronicleFold
        events={[
          { id: 1, action: 'attack goblin', result: 'hit', created_at: new Date().toISOString() },
          { id: 2, action: 'defend', result: 'stance', created_at: new Date().toISOString() },
        ]}
      />,
    );
    expect(screen.getByText('Combat progress')).toBeInTheDocument();
  });
});