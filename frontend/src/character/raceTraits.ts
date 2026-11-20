import type { Character, RaceReference } from '../types';

export type RaceTraitRow = RaceReference['traits'][number];
export type EngineRaceTrait = NonNullable<Character['race_features']>['traits'][number];

export function raceTraitStatus(trait: { modeled?: boolean }, t: (label: string) => string): string {
  if (trait.modeled) return t('Applies in play');
  return t('Story only');
}

export function modeledRaceTraits(traits: RaceTraitRow[] | undefined): RaceTraitRow[] {
  return (traits ?? []).filter(trait => trait.modeled);
}

export function characterRaceFeatureRows(character: Character): EngineRaceTrait[] {
  return (character.race_features?.traits ?? []).filter(trait => !trait.deferred);
}
