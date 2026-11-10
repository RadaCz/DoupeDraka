import { describe, expect, it } from 'vitest';
import { questStepsFromCatalog, visibleQuestTimeline } from '../questProgress';
import { buildTravelAction, travelEligibility } from '../map/worldMap';
import type { Character, LocationReference } from '../types';

const locations: LocationReference[] = [
  { name: 'The Whispering Cellar', connections: ['The Sunken Corridor'] },
  { name: 'The Sunken Corridor', connections: ['The Whispering Cellar'] },
];

const newHero = {
  id: 'h1',
  location: 'The Whispering Cellar',
  visited_locations: ['The Whispering Cellar'],
  quest_flags: {},
} as Character;

describe('cross-screen quest consistency', () => {
  it('Overview, Quest and Adventure share spoiler-safe first objective', () => {
    const timeline = visibleQuestTimeline(newHero.quest_flags ?? {}, questStepsFromCatalog());
    expect(timeline.active?.label).toBe('Find out what happened to the shrine bell');
    expect(timeline.active?.label).not.toMatch(/Caldus|Nib/i);
    expect(timeline.active?.hint).toMatch(/cellar|underground/i);
  });

  it('Map travel uses the same action pipeline wording as Play chips', () => {
    const destination = 'The Sunken Corridor';
    expect(buildTravelAction(destination)).toBe(`travel to ${destination}`);
    expect(travelEligibility(destination, newHero, locations).canTravel).toBe(true);
  });
});
