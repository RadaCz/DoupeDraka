import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { LocaleProvider, useI18n } from '../i18n';
import { renderHook } from '@testing-library/react';
import { buildCastAction } from './spellbook';
import type { Character } from '../types';
import { SPELL_NAMES_CS_KEYS, displaySpellName } from './spellDisplay';

const EXPECTED_CS: Record<string, string> = {
  'Dancing Lights': 'Tančící světla',
  'Fire Bolt': 'Ohnivá střela',
  Light: 'Světlo',
  'Mage Hand': 'Mágova ruka',
  Mending: 'Spravení',
  Message: 'Zpráva',
  'Minor Illusion': 'Drobná iluze',
  Prestidigitation: 'Kejkle',
  'Burning Hands': 'Hořící ruce',
  'Mage Armor': 'Mágova zbroj',
  'Magic Missile': 'Magická střela',
  Shield: 'Magický štít',
  Guidance: 'Vedení',
  Resistance: 'Odolání',
  'Sacred Flame': 'Posvátný plamen',
  'Spare the Dying': 'Ušetření umírajícího',
  Thaumaturgy: 'Thaumaturgie',
  Bless: 'Požehnání',
  'Cure Wounds': 'Léčení ran',
  'Healing Word': 'Léčivé slovo',
  'Shield of Faith': 'Štít víry',
};

function wrapper({ children }: { children: ReactNode }) {
  localStorage.setItem('app_locale', 'cs');
  return <LocaleProvider>{children}</LocaleProvider>;
}

const wizardHero = {
  id: '1',
  name: 'Caster',
  race: 'human',
  character_class: 'wizard',
  level: 1,
  in_combat: true,
  combatant: { name: 'Goblin', hp: 5, max_hp: 5, armor_class: 12 },
} as Character;

describe('Czech spell display names (playtest-6)', () => {
  it('localizes all 21 playtest spell names in cs', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const { t, locale } = result.current;
    expect(SPELL_NAMES_CS_KEYS).toHaveLength(21);
    for (const en of SPELL_NAMES_CS_KEYS) {
      expect(displaySpellName(en, locale, t)).toBe(EXPECTED_CS[en]);
    }
  });

  it('keeps engine cast actions in English', () => {
    expect(buildCastAction(wizardHero, 'Fire Bolt')).toBe('cast Fire Bolt at Goblin');
    expect(buildCastAction(wizardHero, 'Shield')).toBe('cast Shield');
  });
});