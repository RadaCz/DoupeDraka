import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character, JournalEvent, TurnResolutionBeat } from '../types';
import { CombatArena, CombatMoment } from './CombatUI';
import { buildReactionCombatActions } from './combatActions';
import {
  beatToChips,
  foeDisplayName,
  suggestNextCombatAction,
} from './combatResolution';

const csT = (key: string): string => {
  const dict: Record<string, string> = {
    'Cast Shield': 'Seslat Štít',
    'Structured turn facts are unavailable for this entry.':
      'U tohoto staršího záznamu podrobnosti tahu chybí.',
    COMBAT: 'BOJ',
    HP: 'HP',
    AC: 'OČ',
    'Your turn': 'Tvůj tah',
    Story: 'Příběh',
    'Turn outcome': 'Výsledek tahu',
    'What next': 'Co dál',
    'Latest combat beat': 'Poslední moment boje',
  };
  return dict[key] ?? key;
};

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: csT,
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

describe('SPEC-16 follow-up chip texts (points 1–7)', () => {
  it('1 — localizes spell, weapon, and foe names in chips and card header', () => {
    const beat: TurnResolutionBeat = {
      kind: 'attack',
      spell_name: 'Fire Bolt',
      attack_roll: { total: 14, modifier: 5, natural: 9 },
      target_ac: 13,
      outcome: 'hit',
      damage: { total: 6 },
      enemy: { name: 'Goblin scout', hp_current: 2, hp_max: 7 },
    };
    const chips = beatToChips(beat, 'cs');
    expect(chips.some(c => c.label.includes('Ohnivý paprsek'))).toBe(true);
    expect(chips.some(c => c.label.includes('Gobliní zvěd'))).toBe(true);
    expect(foeDisplayName('Goblin scout', 'cs')).toBe('Gobliní zvěd');

    const weaponBeat: TurnResolutionBeat = {
      kind: 'attack',
      weapon: 'longsword',
      attack_roll: { total: 12, modifier: 3, natural: 9 },
      target_ac: 13,
      outcome: 'miss',
    };
    expect(beatToChips(weaponBeat, 'cs')[0]?.label).toMatch(/dlouhý meč/);

    render(<CombatArena character={fighter} busy={false} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Gobliní zvěd' })).toBeInTheDocument();
  });

  it('2 — shield chip uses beat ac only; reaction button Seslat Štít', () => {
    const withAc: TurnResolutionBeat = { kind: 'reaction', name: 'shield', cast: true, ac: 18 };
    const withoutAc: TurnResolutionBeat = { kind: 'reaction', name: 'shield', cast: true };
    expect(beatToChips(withAc, 'cs')[0]?.label).toBe('Štít seslán, OČ 18');
    expect(beatToChips(withoutAc, 'cs')[0]?.label).toBe('Štít seslán');
    expect(beatToChips(withoutAc, 'cs')[0]?.label).not.toMatch(/\+5|\(\+/);
    const shieldRow = buildReactionCombatActions(
      {
        ...fighter,
        combat_turn: 'reaction',
        combat_reaction_pending: { kind: 'shield_vs_attack' },
        spell_slots: { '1': 1 },
        known_spells: ['Shield'],
      },
      csT,
    ).find(a => a.action === 'cast Shield');
    expect(shieldRow?.label).toBe('Seslat Štít');
  });

  it('3 — damage chip reads poškození {n}', () => {
    const beat: TurnResolutionBeat = {
      kind: 'attack',
      weapon: 'shortsword',
      attack_roll: { total: 18, modifier: 4, natural: 14 },
      target_ac: 13,
      outcome: 'hit',
      damage: { total: 7 },
    };
    expect(beatToChips(beat, 'cs').some(c => c.label === 'poškození 7')).toBe(true);
  });

  it('4 — saving throw chip uses Czech ability abbreviations', () => {
    const beat: TurnResolutionBeat = {
      kind: 'saving_throw',
      ability: 'dexterity',
      roll: { total: 11, modifier: 2, natural: 9 },
      dc: 13,
      success: false,
    };
    expect(beatToChips(beat, 'cs')[0]?.label).toBe('Záchranný hod OBR: 11 vs OČ 13 — neúspěch');
  });

  it('5 — opportunity reaction chip is Příležitostný útok', () => {
    const beat: TurnResolutionBeat = { kind: 'reaction', name: 'opportunity_attack' };
    expect(beatToChips(beat, 'cs')[0]?.label).toBe('Příležitostný útok');
  });

  it('6 — range denial suggests Přibliž se na dosah útoku.', () => {
    const outOfReach: Character = {
      ...fighter,
      combat_tactics: {
        distance_ft: 50,
        weapon_range: { can_attack: false, denial: 'Target is out of range.' },
      },
    };
    expect(suggestNextCombatAction(outOfReach, 'cs')).toBe('Přibliž se na dosah útoku.');
  });

  it('7 — legacy result card fallback copy', () => {
    const events: JournalEvent[] = [
      {
        id: 1,
        action: 'attack',
        result: 'Jen příběh bez resolution.',
        created_at: new Date().toISOString(),
      },
    ];
    render(<CombatMoment character={fighter} events={events} busy={false} />);
    expect(
      screen.getByText('U tohoto staršího záznamu podrobnosti tahu chybí.'),
    ).toBeInTheDocument();
  });
});