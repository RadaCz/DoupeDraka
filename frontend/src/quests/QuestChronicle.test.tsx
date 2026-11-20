import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '../i18n';
import { QuestChronicle } from './QuestChronicle';
import type { Character } from '../types';

const pitReadyFlags = {
  bell_quest_accepted: true,
  bell_acquired: true,
  bell_found: true,
  bell_quest_complete: true,
  vault_hint_given: true,
  vault_unlocked: true,
  vault_first_descent_story_awarded: true,
};

function hero(level: number): Character {
  return {
    id: '1',
    name: 'Test',
    level,
    location: 'The Vault of Echoes',
    quest_flags: pitReadyFlags,
  } as unknown as Character;
}

function renderQuest(ui: ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('QuestChronicle Bell Warden objective', () => {
  it('shows the boss goal and level gate for a level-2 hero', () => {
    renderQuest(<QuestChronicle character={hero(2)} />);
    expect(screen.getByRole('heading', { level: 2, name: /Defeat the Bell Warden/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Bell Warden requires at least level/i);
    expect(screen.getByRole('status')).toHaveTextContent(/level 2/i);
  });

  it('shows the boss goal without level gate at level 3', () => {
    renderQuest(<QuestChronicle character={hero(3)} />);
    expect(screen.getByRole('heading', { level: 2, name: /Defeat the Bell Warden/i })).toBeInTheDocument();
    expect(screen.queryByText(/Bell Warden requires at least level/i)).not.toBeInTheDocument();
  });
});