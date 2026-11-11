import { describe, expect, it } from 'vitest';
import { backgroundFeatureAvailable, backgroundFeatureFor } from './backgroundFeatures';
import type { Character } from '../types';

const base: Character = {
  id: '1',
  name: 'T',
  race: 'human',
  character_class: 'cleric',
  background: 'acolyte',
  level: 1,
  hp: 10,
  max_hp: 10,
  gold: 0,
  xp: 0,
  location: 'The Shrine of the Forgotten',
  inventory: [],
  quest_flags: {},
};

describe('backgroundFeatures', () => {
  it('offers acolyte chip at shrine before use', () => {
    const spec = backgroundFeatureFor(base);
    expect(spec?.chipAction).toBe('seek shelter of the faithful');
    expect(backgroundFeatureAvailable(base, spec!)).toBe(true);
  });

  it('hides chip after flag set', () => {
    const spec = backgroundFeatureFor(base)!;
    const used = { ...base, quest_flags: { bg_acolyte_shelter_used: true } };
    expect(backgroundFeatureAvailable(used, spec)).toBe(false);
  });
});
