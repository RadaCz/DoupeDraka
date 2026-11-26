import { describe, expect, it } from 'vitest';
import { characterRaceFeatureRows, displayRaceTraits, modeledRaceTraits, raceTraitStatus } from './raceTraits';

const t = (label: string) => label;

describe('raceTraits', () => {
  it('labels modeled vs story-only traits', () => {
    expect(raceTraitStatus({ modeled: true, name: 'Lucky' }, t)).toBe('Active in engine');
    expect(raceTraitStatus({ modeled: false, name: 'Brave' }, t)).toBe('Reference only');
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

  it('keeps deferred traits in engine rows but hides them from display lists', () => {
    const engineTraits = [
      { id: 'lucky', name: 'Lucky', modeled: true, deferred: false },
      { id: 'trance', name: 'Trance', modeled: false, deferred: true },
    ];
    const rows = characterRaceFeatureRows({
      race_features: { race: 'elf', traits: engineTraits },
    } as never);
    expect(rows.map(row => row.id)).toEqual(['lucky', 'trance']);
    const visible = displayRaceTraits(
      rows.map(trait => ({
        name: trait.name,
        text: '',
        trait_id: trait.id,
        modeled: trait.modeled,
        deferred: trait.deferred,
      })),
    );
    expect(visible.map(row => row.trait_id)).toEqual(['lucky']);
  });
});
