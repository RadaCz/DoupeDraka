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

  it('opens the Bell Warden pit for travel once the vault is unlocked (level is boss-only)', () => {
    const flags = { vault_unlocked: true };
    expect(routeOpen("The Bell Warden's Pit", flags)).toBe(true);
    const atVault = {
      ...hero,
      level: 2,
      location: 'The Vault of Echoes',
      visited_locations: ['The Whispering Cellar', 'The Vault of Echoes'],
      quest_flags: { vault_unlocked: true },
    } as Character;
    const vaultLocations: LocationReference[] = [
      { name: 'The Whispering Cellar', connections: ['The Sunken Corridor'] },
      { name: 'The Sunken Corridor', connections: ['The Whispering Cellar', 'The Vault of Echoes'] },
      { name: 'The Vault of Echoes', connections: ['The Sunken Corridor', "The Bell Warden's Pit"] },
      { name: "The Bell Warden's Pit", connections: ['The Vault of Echoes'] },
    ];
    expect(mapNodeState("The Bell Warden's Pit", atVault, vaultLocations)).toBe('adjacent');
  });
});
