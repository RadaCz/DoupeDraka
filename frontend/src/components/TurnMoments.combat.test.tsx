import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CombatVictoryOverlay, DefeatOverlay } from './TurnMoments';

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'cs' as const,
  }),
}));

describe('AC16-3 combat outcome overlays', () => {
  it('renders victory card with rewards', () => {
    render(
      <CombatVictoryOverlay
        rewards={{ xp: 50, gold: 0, lootLines: [], foeName: 'Goblin scout' }}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Victory' })).toBeInTheDocument();
    expect(screen.getByText(/Experience gained/)).toBeInTheDocument();
  });

  it('renders defeat card with recovery hint', () => {
    render(<DefeatOverlay onDismiss={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'You have been defeated' })).toBeInTheDocument();
    expect(screen.getByText(/try the fight again/i)).toBeInTheDocument();
  });
});