import type { Character, RaceReference } from '../types';

export type RaceTraitRow = RaceReference['traits'][number];

type TraitIdentity = Pick<RaceTraitRow, 'name' | 'modeled' | 'deferred'> & {
  text?: string;
  trait_id?: string;
  id?: string;
};

/** Darkvision is modeled in data but not enforced by the engine — show as narrative-only. */
export function isNarrativeOnlyRaceTrait(trait: TraitIdentity): boolean {
  const traitId = trait.trait_id ?? trait.id;
  return traitId === 'darkvision' || trait.name === 'Darkvision';
}

export function raceTraitStatus(trait: TraitIdentity, t: (label: string) => string): string {
  if (trait.deferred) return t('Deferred in MVP');
  if (isNarrativeOnlyRaceTrait(trait)) return t('Reference only');
  if (trait.modeled) return t('Active in engine');
  return t('Reference only');
}

export function modeledRaceTraits(traits: RaceTraitRow[] | undefined): RaceTraitRow[] {
  return (traits ?? []).filter(trait => trait.modeled);
}

/** Player-facing trait list — deferred MVP traits are hidden (no “Odloženo” label). */
export function displayRaceTraits(traits: RaceTraitRow[] | undefined): RaceTraitRow[] {
  return (traits ?? []).filter(trait => !trait.deferred);
}

export function characterRaceFeatureRows(character: Character): Array<{ id: string; name: string; modeled: boolean; deferred: boolean }> {
  return character.race_features?.traits ?? [];
}
