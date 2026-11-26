import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n';
import type { Character } from '../types';
import '../styles.css';
import { PlayJournal } from './sharedPlayUI';

const sampleCharacter: Character = {
  id: 'hero-1',
  name: 'Rada',
  race: 'human',
  character_class: 'ranger',
  level: 1,
  abilities: { strength: 10, dexterity: 15, constitution: 14, intelligence: 8, wisdom: 13, charisma: 12 },
  hp: 12,
  max_hp: 12,
  armor_class: 14,
  mana: 3,
  max_mana: 3,
  xp: 0,
  gold: 0,
  inventory: [],
  location: 'The Whispering Cellar',
  in_combat: false,
  combatant: null,
  spell_slots: {},
  max_spell_slots: {},
  known_spells: [],
  prepared_spells: [],
  spellcasting_ability: '',
  difficulty: 'normal',
  tone: 'balanced',
  humor: 'rare',
  verbose: true,
};

describe('PlayJournal pending recovery', () => {
  it('shows Czech recovery copy and Zkusit znovu without idempotency jargon', () => {
    localStorage.setItem('app_locale', 'cs');
    const onResume = vi.fn();
    render(
      <LocaleProvider>
        <PlayJournal
          character={sampleCharacter}
          economy={null}
          events={[]}
          busy={false}
          turnPhase="recovering"
          narrationStatus={null}
          locations={[]}
          onAction={vi.fn()}
          onResumePending={onResume}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText(/Poslední akce se možná nedokončila/i)).toBeInTheDocument();
    expect(screen.queryByText(/klíčem|klicem|idempotenc/i)).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Zkusit znovu' });
    expect(retry).toHaveClass('ghost');
    expect(retry.closest('.pending-turn-recovery-actions')).toBeTruthy();
    fireEvent.click(retry);
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});