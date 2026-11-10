import { describe, expect, it } from 'vitest';
import { isExploreActionRedundant } from './journalDisplay';

describe('journalDisplay', () => {
  it('hides redundant search labels when action repeats the location', () => {
    expect(isExploreActionRedundant('search The Underground River', 'The Underground River')).toBe(true);
    expect(isExploreActionRedundant('explore the cellar', 'The Whispering Cellar')).toBe(false);
  });

  it('keeps distinct explore commands visible', () => {
    expect(isExploreActionRedundant('search the area', 'The Underground River')).toBe(false);
    expect(isExploreActionRedundant('attack goblin', 'The Underground River')).toBe(false);
  });
});
