import type { Locale } from '../i18n';
import { formatWizardSpeedFt } from '../character/wizardDisplay';
import { displaySpellName } from '../spells/spellDisplay';
import type { Character } from '../types';

export interface CombatSpellTacticRow {
  name: string;
  range_ft: number | null;
  can_cast: boolean;
  denial?: string | null;
}

export function readCombatSpellTactics(character: Character): CombatSpellTacticRow[] {
  const rows = character.combat_tactics?.spells;
  return Array.isArray(rows) ? (rows as CombatSpellTacticRow[]) : [];
}

export function spellRangeRow(
  character: Character,
  spellName: string,
): CombatSpellTacticRow | undefined {
  const key = spellName.trim().toLowerCase();
  return readCombatSpellTactics(character).find(row => row.name.trim().toLowerCase() === key);
}

export function formatSpellRangeDenial(
  row: CombatSpellTacticRow,
  locale: Locale,
  t: (value: string) => string,
  distanceFt?: number | null,
): string {
  if (locale === 'en' && row.denial) {
    return row.denial;
  }
  if (row.range_ft == null) {
    return row.denial ?? t('Target is out of spell range.');
  }
  const spellLabel = displaySpellName(row.name, locale, t);
  const rangeLabel = formatWizardSpeedFt(row.range_ft, locale);
  const burningHandsCone = row.name.trim().toLowerCase() === 'burning hands';
  if (locale === 'cs') {
    if (burningHandsCone) {
      return `${spellLabel} zasáhnou jen do ${rangeLabel} od tebe.`;
    }
    if (typeof distanceFt === 'number' && Number.isFinite(distanceFt)) {
      const distanceLabel = formatWizardSpeedFt(distanceFt, locale);
      return `${spellLabel} má dosah ${rangeLabel}. Nepřítel je ${distanceLabel} daleko.`;
    }
    return `${spellLabel} má dosah ${rangeLabel}.`;
  }
  if (typeof distanceFt === 'number' && Number.isFinite(distanceFt)) {
    return `${row.name} has a range of ${row.range_ft} ft. The enemy is ${distanceFt} ft away.`;
  }
  return row.denial ?? `${row.name} has a range of ${row.range_ft} ft.`;
}