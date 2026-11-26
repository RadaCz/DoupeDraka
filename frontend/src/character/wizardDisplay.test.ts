import { describe, expect, it } from 'vitest';
import {
  abilityAbbrevKey,
  formatAbilityIncreaseLabel,
  formatWizardSpeedFt,
} from './wizardDisplay';

const tCs = (label: string) => {
  const cs: Record<string, string> = {
    STR: 'SIL',
    DEX: 'OBR',
    CON: 'ODL',
    INT: 'INT',
    WIS: 'MDR',
    CHA: 'CHA',
  };
  return cs[label] ?? label;
};

describe('wizardDisplay', () => {
  it('maps catalog foot speeds to Czech metres on race cards', () => {
    expect(formatWizardSpeedFt(30, 'cs')).toBe('9 m');
    expect(formatWizardSpeedFt(25, 'cs')).toBe('7,5 m');
    expect(formatWizardSpeedFt(60, 'cs')).toBe('18 m');
    expect(formatWizardSpeedFt(30, 'en')).toBe('30 ft.');
  });

  it('uses Czech ability abbreviations via i18n keys', () => {
    expect(abilityAbbrevKey('strength')).toBe('STR');
    expect(formatAbilityIncreaseLabel('dexterity', 2, tCs)).toBe('OBR +2');
    expect(formatAbilityIncreaseLabel('constitution', 2, tCs)).toBe('ODL +2');
  });
});