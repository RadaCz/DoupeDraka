import { describe, expect, it } from 'vitest';
import { characterRaceFeatureRows, displayRaceTraits, modeledRaceTraits, raceTraitStatus } from './raceTraits';

const t = (label: string) => label;

describe('raceTraits', () => {
  it('labels modeled vs story-only traits', () => {
    expect(raceTraitStatus({ modeled: true }, t)).toBe('Applies in play');
    expect(raceTraitStatus({ modeled: false }, t)).toBe('Story only');
  });

  it('shows darkvision as narrative-only even when modeled in catalog', () => {
    expect(
      raceTraitStatus({
        name: 'Darkvision',
        text: '',
        trait_id: 'darkvision',
        modeled: true,
      }, t),
    ).toBe('Reference only');
  });

  it('hides deferred traits from player-facing lists', () => {
    const traits = [
      { name: 'A', text: '', modeled: true },
      { name: 'B', text: '', deferred: true },
    ];
    expect(displayRaceTraits(traits).map(row => row.name)).toEqual(['A']);
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

  it('hides deferred traits on the character sheet', () => {
    const rows = characterRaceFeatureRows({
      race_features: {
        race: 'elf',
        traits: [
          { id: 'lucky', name: 'Lucky', modeled: true, deferred: false },
          { id: 'trance', name: 'Trance', modeled: false, deferred: true },
        ],
      },
    } as never);
    expect(rows.map(row => row.id)).toEqual(['lucky']);
  });
});
