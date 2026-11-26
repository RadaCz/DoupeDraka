import type { Locale } from '../i18n';

/** Czech distance labels — API/engine values stay in feet (5 ft = 1,5 m). */
const WIZARD_DISTANCE_CS_M: Record<number, string> = {
  30: '9 m',
  25: '7,5 m',
  60: '18 m',
};

function formatFeetAsDistance(ft: number, locale: Locale): string {
  if (locale === 'cs') {
    const mapped = WIZARD_DISTANCE_CS_M[ft];
    if (mapped) return mapped;
    const meters = ft * 0.3;
    const label = Number.isInteger(meters)
      ? String(meters)
      : meters.toLocaleString('cs', { maximumFractionDigits: 1 });
    return `${label} m`;
  }
  return `${ft} ft.`;
}

export function formatWizardSpeedFt(speedFt: number, locale: Locale): string {
  return formatFeetAsDistance(speedFt, locale);
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