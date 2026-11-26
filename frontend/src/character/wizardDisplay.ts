import type { Locale } from '../i18n';

/** Czech wizard speed labels — API/engine values stay in feet. */
const WIZARD_SPEED_CS_M: Record<number, string> = {
  30: '9 m',
  25: '7,5 m',
};

export function formatWizardSpeedFt(speedFt: number, locale: Locale): string {
  if (locale === 'cs') {
    const mapped = WIZARD_SPEED_CS_M[speedFt];
    if (mapped) return mapped;
  }
  return `${speedFt} ft.`;
}

const ABILITY_EN_ABBR: Record<string, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

export function abilityAbbrevKey(ability: string): string {
  return ABILITY_EN_ABBR[ability] ?? ability.slice(0, 3).toUpperCase();
}

export function formatAbilityIncreaseLabel(
  ability: string,
  value: number,
  t: (label: string) => string,
): string {
  return `${t(abilityAbbrevKey(ability))} +${value}`;
}

export function formatAbilityIncreases(
  values: Record<string, number>,
  t: (label: string) => string,
): string {
  return Object.entries(values)
    .map(([ability, value]) => formatAbilityIncreaseLabel(ability, value, t))
    .join(' · ');
}