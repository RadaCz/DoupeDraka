import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '../i18n';
import { CharacterScreen } from '../screens/CharacterScreen';
import { CombatActionDeck } from '../combat/CombatUI';
import { SpellbookPanel } from './SpellbookPanel';
import { modeledCombatSpells } from './spellbook';
import type { Character, Spell } from '../types';

const STORY_LABEL = 'Jen v příběhu';

beforeEach(() => {
  localStorage.setItem('app_locale', 'cs');
});

function mkSpell(name: string, level: number, effectModeled: boolean): Spell {
  return {
    name,
    level,
    school: 'evocation',
    range: '30 feet',
    text: `${name} description.`,
    effect_modeled: effectModeled,
  };
}

const baseHero: Character = {
  id: '1',
  name: 'Caster',
  race: 'human',
  character_class: 'wizard',
  level: 1,
  abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10 },
  hp: 8,
  max_hp: 8,
  armor_class: 12,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'The Whispering Cellar',
  in_combat: false,
  spell_slots: { 1: 2 },
  max_spell_slots: { 1: 2 },
  known_spells: ['Mage Hand', 'Light', 'Magic Missile', 'Sleep', 'Fire Bolt'],
  prepared_spells: [],
  spellcasting_ability: 'int',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: false,
};

const cleric: Character = {
  ...baseHero,
  character_class: 'cleric',
  known_spells: [],
  prepared_spells: ['Guidance', 'Cure Wounds', 'Bless'],
};

const wizardSpells: Spell[] = [
  mkSpell('Mage Hand', 0, false),
  mkSpell('Light', 0, false),
  mkSpell('Sleep', 1, false),
  mkSpell('Fire Bolt', 0, true),
  mkSpell('Magic Missile', 1, true),
];

const clericSpells: Spell[] = [
  mkSpell('Guidance', 0, false),
  mkSpell('Cure Wounds', 1, true),
  mkSpell('Bless', 1, true),
];

const combatWizard: Character = {
  ...baseHero,
  in_combat: true,
  combat_turn: 'player',
  combatant: { name: 'Goblin scout', hp: 4, max_hp: 7, armor_class: 13 },
};

describe('Story-only spell label (task 22)', () => {
  it('shows „Jen v příběhu“ on unmodeled wizard spells, not on modeled ones', () => {
    render(
      <LocaleProvider>
        <SpellbookPanel character={baseHero} spells={wizardSpells} />
      </LocaleProvider>,
    );
    const storyTags = screen.getAllByText(STORY_LABEL);
    expect(storyTags).toHaveLength(3);
    expect(screen.getByText('Mágova ruka').closest('button')?.textContent).toContain(STORY_LABEL);
    expect(screen.getByText('Sleep').closest('button')?.textContent).toContain(STORY_LABEL);
    expect(screen.getByText('Magická střela').closest('button')?.textContent).not.toContain(STORY_LABEL);
    expect(screen.getByText('Ohnivá střela').closest('button')?.textContent).not.toContain(STORY_LABEL);
  });

  it('shows the label for Cleric Guidance but not Cure Wounds on the character sheet', () => {
    render(
      <LocaleProvider>
        <CharacterScreen
          character={cleric}
          characters={[cleric]}
          spells={clericSpells}
          onSelect={() => {}}
          onCreate={() => {}}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText('Vedení').closest('li')?.textContent).toContain(STORY_LABEL);
    expect(screen.getByText('Léčení ran').closest('li')?.textContent).not.toContain(STORY_LABEL);
    expect(screen.getByText('Požehnání').closest('li')?.textContent).not.toContain(STORY_LABEL);
  });

  it('omits unmodeled spells from the combat abilities panel', () => {
    expect(modeledCombatSpells(combatWizard, wizardSpells).map(s => s.name)).toEqual([
      'Fire Bolt',
      'Magic Missile',
    ]);
    render(
      <LocaleProvider>
        <CombatActionDeck
          character={combatWizard}
          spells={wizardSpells}
          busy={false}
          onAction={() => {}}
        />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Schopnosti|Combat abilities/i }));
    expect(screen.getByRole('button', { name: 'Ohnivá střela' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Magická střela' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mágova ruka' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sleep' })).not.toBeInTheDocument();
  });
});