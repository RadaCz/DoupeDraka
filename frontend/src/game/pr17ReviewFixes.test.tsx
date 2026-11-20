import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  longRestChipAllowed,
  playActionChips,
  primaryPlayChipKey,
  SAFE_LONG_REST_LOCATIONS,
} from './gameActions';
import { LocaleProvider, useI18n } from '../i18n';
import { characterStub } from '../test/characterStub';

const t = (s: string) => s;
const locations = [
  { name: 'The Shrine of the Forgotten', connections: [], arrival_beat: '' },
  { name: 'The Sunken Corridor', connections: [], arrival_beat: '' },
  { name: 'The Goblin Market', connections: [], arrival_beat: '' },
];

describe('PR #17 review — long rest chips (engine safe hubs)', () => {
  it('matches engine SAFE_LONG_REST_LOCATIONS', () => {
    expect([...SAFE_LONG_REST_LOCATIONS].sort()).toEqual([
      'The Goblin Market',
      'The Shrine of the Forgotten',
      'The Whispering Cellar',
    ]);
  });

  it('offers rest chip when injured at a safe hub', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Shrine of the Forgotten',
      hp: 6,
      max_hp: 20,
    });
    expect(longRestChipAllowed(hero.location)).toBe(true);
    const chips = playActionChips(hero, [], locations, t, false, false);
    expect(chips.some(c => c.action === 'rest')).toBe(true);
  });

  it('does not offer rest chip when injured elsewhere', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Sunken Corridor',
      hp: 6,
      max_hp: 20,
    });
    expect(longRestChipAllowed(hero.location)).toBe(false);
    const chips = playActionChips(hero, [], locations, t, false, false);
    expect(chips.some(c => c.action === 'rest')).toBe(false);
  });

  it('primary chip still prefers rest for hp < max_hp at a safe hub', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Goblin Market',
      hp: 12,
      max_hp: 20,
      quest_flags: { bell_quest_accepted: true, bell_acquired: true },
    });
    const key = primaryPlayChipKey(hero, [], locations, t, false, false);
    const chips = playActionChips(hero, [], locations, t, false, false);
    const rest = chips.find(c => c.action === 'rest');
    expect(rest).toBeDefined();
    expect(key).toBe(rest!.key);
  });
});

describe('PR #17 review — Czech copy in i18n.tsx', () => {
  function wrapper({ children }: { children: ReactNode }) {
    localStorage.setItem('app_locale', 'cs');
    return <LocaleProvider>{children}</LocaleProvider>;
  }

  it('renders Designer cs strings for Nib, coach, and Caldus journal', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('Nib runs a stall at the Goblin Market.')).toBe(
      'Nib má stánek na Gobliním trhu.',
    );
    expect(
      result.current.t(
        'No one here answers to that. Name an NPC (Caldus, Nib) or use a suggested conversation chip.',
      ),
    ).toBe('Nikdo tady na to neodpoví. Klepni na téma rozhovoru.');
    expect(
      result.current.t(
        'Caldus told you the shrine bell was stolen — the Vault of Echoes grows louder every night.',
      ),
    ).toBe(
      'Caldus ti řekl, že ukradli chrámový zvon – Komnata ozvěn je každou noc hlasitější.',
    );
  });
});