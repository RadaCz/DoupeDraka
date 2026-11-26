import type { Locale } from '../i18n';

/** SRD spell names localized in playtest-6 (engine actions stay EN). */
export const SPELL_NAMES_CS_KEYS = [
  'Dancing Lights',
  'Fire Bolt',
  'Light',
  'Mage Hand',
  'Mending',
  'Message',
  'Minor Illusion',
  'Prestidigitation',
  'Burning Hands',
  'Mage Armor',
  'Magic Missile',
  'Shield',
  'Guidance',
  'Resistance',
  'Sacred Flame',
  'Spare the Dying',
  'Thaumaturgy',
  'Bless',
  'Cure Wounds',
  'Healing Word',
  'Shield of Faith',
] as const;

const SHIELD_SPELL_I18N_KEY = 'Spell · Shield';

export function displaySpellName(name: string, locale: Locale, t: (label: string) => string): string {
  if (locale !== 'cs') return name;
  const key = name === 'Shield' ? SHIELD_SPELL_I18N_KEY : name;
  const translated = t(key);
  return translated !== key ? translated : name;
}

export function shieldSpellI18nKey(): string {
  return SHIELD_SPELL_I18N_KEY;
}