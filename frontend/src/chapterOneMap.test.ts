import { describe, expect, it } from 'vitest';
import { mapNodeState, routeOpen } from './chapterOneMap';
import type { Character, LocationReference } from './types';

const locations: LocationReference[] = [
  { name: 'The Whispering Cellar', connections: ['The Sunken Corridor'] },
  { name: 'The Sunken Corridor', connections: ['The Whispering Cellar', 'The Vault of Echoes'] },
  { name: 'The Vault of Echoes', connections: ['The Sunken Corridor'] },
];

const hero = {
  id: '1',
  location: 'The Whispering Cellar',
  visited_locations: ['The Whispering Cellar'],
  quest_flags: {},
} as Character;

describe('chapterOneMap', () => {
  it('locks the vault until Caldus reveals the route', () => {
    expect(routeOpen('The Vault of Echoes', {})).toBe(false);
    expect(routeOpen('The Vault of Echoes', { vault_hint_given: true })).toBe(false);
    expect(routeOpen('The Vault of Echoes', { vault_unlocked: true })).toBe(true);
  });

  it('marks the next corridor as adjacent', () => {
    expect(mapNodeState('The Sunken Corridor', hero, locations)).toBe('adjacent');
  });
});
