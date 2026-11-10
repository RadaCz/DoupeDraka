import { fireEvent, render, screen, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n';
import { CharacterInventoryPanel } from './CharacterInventoryPanel';
import type { Character } from '../types';

const base: Character = {
  id: '1',
  name: 'Rada',
  race: 'human',
  character_class: 'fighter',
  level: 1,
  abilities: {},
  hp: 8,
  max_hp: 12,
  armor_class: 14,
  mana: 0,
  max_mana: 0,
  xp: 0,
  gold: 0,
  inventory: ['Longsword', 'Longbow'],
  item_instances: [
    { instance_id: '1', definition_id: 'longsword', name: 'Longsword', equipped: false, attack_bonus: 0 },
  ],
  location: 'Cellar',
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
};

function wrap(ui: ReactNode): RenderResult {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('CharacterInventoryPanel', () => {
  it('offers equip only for engine-wieldable weapons', () => {
    const onAction = vi.fn();
    wrap(<CharacterInventoryPanel character={base} onInventoryAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /Longsword/i }));
    fireEvent.click(screen.getByRole('button', { name: /^(Equip|Re-ready weapon)$/i }));
    expect(onAction).toHaveBeenCalledWith('equip Longsword');
  });

  it('does not show equip for unsupported weapons like longbow', () => {
    wrap(<CharacterInventoryPanel character={base} onInventoryAction={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Longbow/i }));
    expect(screen.queryByRole('button', { name: /^Equip$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be wielded/i)).toBeInTheDocument();
  });

  it('ignores duplicate fire while busy', () => {
    const onAction = vi.fn();
    const { rerender } = wrap(<CharacterInventoryPanel character={base} busy={false} onInventoryAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /Longsword/i }));
    fireEvent.click(screen.getByRole('button', { name: /^(Equip|Re-ready weapon)$/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
    rerender(
      <LocaleProvider>
        <CharacterInventoryPanel character={base} busy onInventoryAction={onAction} />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Longsword/i }));
    const equip = screen.getByRole('button', { name: /^Equip$/i });
    expect(equip).toBeDisabled();
    fireEvent.click(equip);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
