import type { ReactElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../i18n';
import { CharacterScreen } from '../screens/CharacterScreen';
import { characterStub } from '../test/characterStub';
import type { Spell } from '../types';

const spells: Spell[] = [];

function renderCs(ui: ReactElement) {
  localStorage.setItem('app_locale', 'cs');
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('AC18-1 Character sheet (cs)', () => {
  it('shows vitals in Czech without English XP/AC labels on the sheet', () => {
    const hero = characterStub({
      id: '1',
      name: 'Mira',
      character_class: 'fighter',
      level: 2,
      xp: 40,
      armor_class: 16,
      hp: 14,
      max_hp: 18,
      location: 'The Whispering Cellar',
    });
    renderCs(
      <CharacterScreen
        character={hero}
        characters={[hero]}
        spells={spells}
        maxLevel={3}
        xpPerLevel={100}
        onSelect={() => undefined}
        onCreate={() => undefined}
      />,
    );
    expect(screen.getAllByText(/^OČ$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/40 \/ 100 ZK/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/\bXP\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^AC$/)).not.toBeInTheDocument();
    cleanup();
  });

  it('uses Czech race trait status labels', () => {
    const hero = characterStub({
      id: '1',
      name: 'Mira',
      character_class: 'fighter',
      race: 'halfling',
      race_features: {
        race: 'halfling',
        darkvision_ft: null,
        traits: [
          { id: 'lucky', name: 'Lucky', modeled: true, deferred: false },
          { id: 'brave', name: 'Brave', modeled: false, deferred: false },
        ],
      },
      location: 'The Whispering Cellar',
    });
    renderCs(
      <CharacterScreen
        character={hero}
        characters={[hero]}
        spells={spells}
        maxLevel={3}
        xpPerLevel={100}
        onSelect={() => undefined}
        onCreate={() => undefined}
      />,
    );
    expect(screen.getByText('Platí ve hře')).toBeInTheDocument();
    expect(screen.getByText('Jen v příběhu')).toBeInTheDocument();
    expect(screen.queryByText(/Active in engine|Reference only/i)).not.toBeInTheDocument();
  });
});