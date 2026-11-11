import type { ReferenceCatalog } from '../types';
import { abilityModifier, formatModifier, ABILITY_KEYS, type AbilityKey } from './characterSheet';

export { ABILITY_KEYS };

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export type CreationMeta = NonNullable<ReferenceCatalog['character_creation']>;

export function defaultBackground(classKey: string): string {
  const map: Record<string, string> = {
    fighter: 'folk_hero',
    rogue: 'criminal',
    cleric: 'acolyte',
    wizard: 'sage',
  };
  return map[classKey] ?? 'folk_hero';
}

export function defaultClassSkills(classKey: string, backgroundKey: string, meta: CreationMeta): string[] {
  const pick = meta.class_skill_picks[classKey];
  const bg = meta.backgrounds.find(item => item.key === backgroundKey);
  const blocked = new Set(bg?.skill_proficiencies ?? []);
  if (!pick) return [];
  return pick.options.filter(skill => !blocked.has(skill)).slice(0, pick.count);
}

export function defaultEquipmentPackage(classKey: string, meta: CreationMeta): string {
  const packages = meta.equipment_packages[classKey];
  return packages ? Object.keys(packages)[0] : '';
}

export function defaultSpellPicks(classKey: string, meta: CreationMeta): { cantrips: string[]; level_one_spells: string[] } {
  const limits = meta.spell_pick_limits[classKey];
  if (!limits) return { cantrips: [], level_one_spells: [] };
  return { cantrips: [], level_one_spells: [] };
}

export function isStandardArrayAssignment(scores: Record<AbilityKey, number>): boolean {
  const values = Object.values(scores).sort((a, b) => a - b);
  const expected = [...STANDARD_ARRAY].sort((a, b) => a - b);
  return values.length === 6 && values.every((value, index) => value === expected[index]);
}

export function emptyAbilityAssignment(): Record<AbilityKey, number | null> {
  return Object.fromEntries(ABILITY_KEYS.map(key => [key, null])) as Record<AbilityKey, number | null>;
}

export function assignedAbilities(map: Record<AbilityKey, number | null>): Record<string, number> | null {
  const entries = Object.entries(map);
  if (entries.some(([, value]) => value === null)) return null;
  return Object.fromEntries(entries) as Record<string, number>;
}

export function remainingArrayValues(map: Record<AbilityKey, number | null>): number[] {
  const used = new Set(Object.values(map).filter((value): value is number => value !== null));
  return STANDARD_ARRAY.filter(value => !used.has(value));
}

export function reviewAbilityRow(scores: Record<string, number>, raceBonuses: Record<string, number>) {
  return ABILITY_KEYS.map(key => {
    const base = scores[key] ?? 10;
    const bonus = raceBonuses[key] ?? 0;
    const total = base + bonus;
    return { key, base, bonus, total, modifier: formatModifier(total) };
  });
}

export { abilityModifier };
