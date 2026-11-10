import { describe, expect, it } from 'vitest';
import type { Character, LocationReference } from '../types';
import {
  buildTravelAction,
  isQuestDestination,
  reachableFromCurrent,
  sortPlacesByRelevance,
  travelEligibility,
  visibleChapterPlaces,
} from './worldMap';
import { mapNodeState } from '../chapterOneMap';

const locations: LocationReference[] = [
  {
    name: 'The Whispering Cellar',
    connections: ['The Sunken Corridor'],
    arrival_beat: 'A cold draft curls around the old stone stairs.',
  },
  {
    name: 'The Sunken Corridor',
    connections: ['The Whispering Cellar', 'The Shrine of the Forgotten', 'The Vault of Echoes'],
    arrival_beat: 'Mara warns about the waterway.',
  },
  {
    name: 'The Vault of Echoes',
    connections: ['The Sunken Corridor'],
    arrival_beat: 'Damp stone amplifies every footstep.',
  },
  {
    name: 'The Shrine of the Forgotten',
    connections: ['The Goblin Market', 'The Sunken Corridor'],
    arrival_beat: 'Caldus asks about the bell.',
  },
];

const hero = {
  id: '1',
  location: 'The Whispering Cellar',
  visited_locations: ['The Whispering Cellar'],
  quest_flags: {},
} as Character;

describe('buildTravelAction', () => {
  it('uses engine travel wording', () => {
    expect(buildTravelAction('The Sunken Corridor')).toBe('travel to The Sunken Corridor');
  });
});

describe('visibleChapterPlaces', () => {
  it('hides unrevealed locations', () => {
    const visible = visibleChapterPlaces(hero, locations);
    const names = visible.map(item => item.name);
    expect(names).toContain('The Whispering Cellar');
    expect(names).toContain('The Sunken Corridor');
    expect(names).not.toContain('The Goblin Market');
  });
});

describe('travelEligibility', () => {
  it('allows adjacent open routes', () => {
    const result = travelEligibility('The Sunken Corridor', hero, locations);
    expect(result.canTravel).toBe(true);
    expect(buildTravelAction('The Sunken Corridor')).toMatch(/^travel to /);
  });

  it('blocks vault without vault_unlocked', () => {
    const corridorHero = {
      ...hero,
      location: 'The Sunken Corridor',
      visited_locations: ['The Whispering Cellar', 'The Sunken Corridor'],
    } as Character;
    const result = travelEligibility('The Vault of Echoes', corridorHero, locations);
    expect(result.canTravel).toBe(false);
    expect(result.reasonKey).toMatch(/shrine bell|Caldus|Locked/i);
  });

  it('blocks destinations that are not connected', () => {
    const result = travelEligibility('The Shrine of the Forgotten', hero, locations);
    expect(result.canTravel).toBe(false);
    expect(result.reasonKey).toMatch(/cannot reach/i);
  });

  it('blocks travel when already there', () => {
    expect(travelEligibility('The Whispering Cellar', hero, locations).canTravel).toBe(false);
  });
});

describe('reachableFromCurrent', () => {
  it('lists only open connections from current node', () => {
    expect(reachableFromCurrent(hero, locations)).toEqual(['The Sunken Corridor']);
  });
});

describe('quest destination', () => {
  it('matches active step location only when provided', () => {
    expect(
      isQuestDestination('The Shrine of the Forgotten', {
        id: 'bell_quest_accepted',
        label: 'Recover the stolen shrine bell',
        hint: 'Talk to Caldus.',
        location: 'The Shrine of the Forgotten',
      }),
    ).toBe(true);
    expect(isQuestDestination('The Goblin Market', null)).toBe(false);
  });
});

describe('sortPlacesByRelevance', () => {
  it('orders current before adjacent', () => {
    const places = [
      { name: 'The Sunken Corridor', state: mapNodeState('The Sunken Corridor', hero, locations) },
      { name: 'The Whispering Cellar', state: mapNodeState('The Whispering Cellar', hero, locations) },
    ];
    const sorted = sortPlacesByRelevance(places);
    expect(sorted[0].name).toBe('The Whispering Cellar');
  });
});
