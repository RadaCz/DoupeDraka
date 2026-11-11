import { describe, expect, it } from 'vitest';
import { characterRaceFeatureRows, modeledRaceTraits, raceTraitStatus } from './raceTraits';

const t = (label: string) => label;

describe('raceTraits', () => {
  it('labels modeled vs deferred traits', () => {
    expect(raceTraitStatus({ name: 'Lucky', text: '', modeled: true }, t)).toBe('Active in engine');
    expect(raceTraitStatus({ name: 'Trance', text: '', deferred: true }, t)).toBe('Deferred in MVP');
    expect(raceTraitStatus({ name: 'Extra', text: '', modeled: false }, t)).toBe('Reference only');
  });

  it('filters modeled catalog traits', () => {
    const traits = [
      { name: 'A', text: '', modeled: true },
      { name: 'B', text: '', deferred: true },
    ];
    expect(modeledRaceTraits(traits).map(row => row.name)).toEqual(['A']);
  });

  it('reads engine race_features on character', () => {
    const rows = characterRaceFeatureRows({
      race_features: {
        race: 'elf',
        darkvision_ft: 60,
        traits: [{ id: 'darkvision', name: 'Darkvision', modeled: true, deferred: false }],
      },
    } as never);
    expect(rows[0]?.name).toBe('Darkvision');
  });
});
