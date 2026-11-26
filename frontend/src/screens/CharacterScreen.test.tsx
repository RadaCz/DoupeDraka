import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../i18n';
import { CharacterScreen } from './CharacterScreen';
import type { Character, Spell } from '../types';

const hero: Character = {
  id: '1',
  name: 'Grath',
  race: 'half_orc',
  character_class: 'barbarian',
  level: 2,
  abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 10, charisma: 10 },
  hp: 18,
  max_hp: 22,
  armor_class: 15,
  mana: 0,
  max_mana: 0,
  xp: 40,
  gold: 12,
  inventory: ['Mace'],
  item_instances: [{ instance_id: '1', definition_id: 'mace', name: 'Mace', equipped: true, attack_bonus: 0 }],
  location: 'The Underground River',
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
  saving_throw_proficiencies: ['strength', 'constitution'],
  speed: 30,
};

const spells: Spell[] = [];

describe('CharacterScreen V2', () => {
  it('renders identity, abilities, equipment, and progress', () => {
    render(
      <LocaleProvider>
        <CharacterScreen
          character={hero}
          characters={[hero]}
          spells={spells}
          maxLevel={3}
          xpPerLevel={100}
          onSelect={() => {}}
          onCreate={() => {}}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Grath' })).toBeInTheDocument();
    expect(screen.getByText(/The Underground River/)).toBeInTheDocument();
    expect(screen.getByText(/ability scores/i)).toBeInTheDocument();
    expect(screen.getAllByText('Mace').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^40 \/ 100$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/40 \/ 100 ZK/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Combat basics/i)).toBeInTheDocument();
    expect(screen.getByText(/Proficiency bonus/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength · Constitution/)).toBeInTheDocument();
    expect(screen.getByText(/30 ft\./)).toBeInTheDocument();
  });

  it('keeps hook order when character changes between null and a loaded hero', () => {
    const shell = (
      <LocaleProvider>
        <CharacterScreen
          character={null}
          characters={[]}
          spells={spells}
          onSelect={() => {}}
          onCreate={() => {}}
        />
      </LocaleProvider>
    );
    const { rerender: rtlRerender, unmount } = render(shell);
    expect(screen.getByRole('heading', { name: /Your adventurers/i })).toBeInTheDocument();

    rtlRerender(
      <LocaleProvider>
        <CharacterScreen
          character={hero}
          characters={[hero]}
          spells={spells}
          maxLevel={3}
          xpPerLevel={100}
          onSelect={() => {}}
          onCreate={() => {}}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Grath' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Inventory/i })).toBeInTheDocument();
    expect(screen.getByText(/ability scores/i)).toBeInTheDocument();

    rtlRerender(
      <LocaleProvider>
        <CharacterScreen
          character={null}
          characters={[]}
          spells={spells}
          onSelect={() => {}}
          onCreate={() => {}}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: /Your adventurers/i })).toBeInTheDocument();
    unmount();
  });

  it('shows darkvision range in meters and narrative hint on the character sheet (cs)', () => {
    localStorage.setItem('app_locale', 'cs');
    const elf: Character = {
      ...hero,
      race: 'elf',
      race_features: {
        race: 'elf',
        darkvision_ft: 60,
        traits: [{ id: 'darkvision', name: 'Darkvision', modeled: true, deferred: false }],
      },
    };
    render(
      <LocaleProvider>
        <CharacterScreen character={elf} characters={[elf]} spells={spells} onSelect={() => {}} onCreate={() => {}} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('char-darkvision-lead')).toHaveTextContent(
      'Vidění ve tmě: 18 m. Zatím se projevuje jen v příběhu.',
    );
  });
});
