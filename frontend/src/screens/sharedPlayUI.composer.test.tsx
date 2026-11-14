import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../i18n';
import { ActionComposer } from './sharedPlayUI';
import type { Character, Spell } from '../types';

const hero: Character = {
  id: '1',
  name: 'Lira',
  race: 'human',
  character_class: 'wizard',
  level: 1,
  abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 10 },
  hp: 8,
  max_hp: 8,
  armor_class: 12,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 5,
  inventory: [],
  item_instances: [],
  location: 'The Whispering Cellar',
  in_combat: false,
  spell_slots: {},
  max_spell_slots: { '1': 2 },
  known_spells: ['Magic Missile'],
  prepared_spells: ['Magic Missile'],
  spellcasting_ability: 'int',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: false,
};

const spells: Spell[] = [
  {
    name: 'Magic Missile',
    level: 1,
    text: 'Three darts',
    effect_modeled: true,
    school: 'evocation',
    casting_time: '1 action',
    range: '120 ft',
  },
];

const composerBase = {
  error: null,
  narrationStatus: null as 'narrated' | 'fallback' | null,
};

function renderComposer() {
  return render(
    <LocaleProvider>
      <ActionComposer
        {...composerBase}
        character={hero}
        spells={spells}
        events={[]}
        locations={[]}
        busy={false}
        onAction={() => {}}
        onOpenSheet={() => {}}
      />
    </LocaleProvider>,
  );
}

describe('ActionComposer mobile UX', () => {
  it('opens help from action sheet and closes with Close help', () => {
    renderComposer();
    fireEvent.click(screen.getByRole('button', { name: /Play actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /How actions and exploration work/i }));
    const help = screen.getByRole('dialog', { name: /How actions and exploration work/i });
    expect(help).toBeInTheDocument();
    fireEvent.click(within(help).getByRole('button', { name: /Close help/i }));
    expect(screen.queryByRole('dialog', { name: /How actions and exploration work/i })).not.toBeInTheDocument();
  });

  it('closes action sheet on Escape', () => {
    renderComposer();
    fireEvent.click(screen.getByRole('button', { name: /Play actions/i }));
    expect(screen.getByRole('dialog', { name: /Play actions/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Play actions/i })).not.toBeInTheDocument();
  });

  it('picks a spell from the visible sheet', () => {
    renderComposer();
    fireEvent.click(screen.getByRole('button', { name: /Play actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cast spell/i }));
    const sheet = screen.getByRole('dialog', { name: /Pick a spell/i });
    fireEvent.click(within(sheet).getByRole('button', { name: /Magic Missile/i }));
    expect(screen.getByLabelText(/Your action/i)).toHaveValue('cast Magic Missile');
  });
});