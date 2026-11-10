import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n';
import { SpellbookPanel } from './SpellbookPanel';
import type { Character, Spell } from '../types';

const spells: Spell[] = [
  { name: 'Fire Bolt', level: 0, school: 'evocation', range: '120 ft', text: 'Fire.', effect_modeled: true },
  { name: 'Shield', level: 1, school: 'abjuration', range: 'Self', text: 'Barrier.', effect_modeled: false },
];

const wizard: Character = {
  id: '1',
  name: 'Z',
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
  location: 'X',
  in_combat: false,
  spell_slots: { 1: 2 },
  max_spell_slots: { 1: 2 },
  known_spells: ['Fire Bolt', 'Shield'],
  prepared_spells: [],
  spellcasting_ability: 'int',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: false,
};

describe('SpellbookPanel', () => {
  it('casts modeled spell via detail sheet', () => {
    const onCast = vi.fn();
    render(
      <LocaleProvider>
        <SpellbookPanel character={wizard} spells={spells} onCast={onCast} />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Fire Bolt/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cast this spell/i }));
    expect(onCast).toHaveBeenCalledWith('cast Fire Bolt');
  });

  it('shows non-caster empty state', () => {
    render(
      <LocaleProvider>
        <SpellbookPanel
          character={{ ...wizard, character_class: 'fighter', known_spells: [], prepared_spells: [] }}
          spells={spells}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText(/does not cast spells/i)).toBeInTheDocument();
  });
});
