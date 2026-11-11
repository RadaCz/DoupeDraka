import type { Character, RaceReference } from '../types';

export type RaceTraitRow = RaceReference['traits'][number];

export function raceTraitStatus(trait: RaceTraitRow, t: (label: string) => string): string {
  if (trait.deferred) return t('Deferred in MVP');
  if (trait.modeled) return t('Active in engine');
  return t('Reference only');
}

export function modeledRaceTraits(traits: RaceTraitRow[] | undefined): RaceTraitRow[] {
  return (traits ?? []).filter(trait => trait.modeled);
}

export function characterRaceFeatureRows(character: Character): Array<{ id: string; name: string; modeled: boolean; deferred: boolean }> {
  return character.race_features?.traits ?? [];
}
