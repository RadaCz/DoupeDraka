import type { Character, LocationReference } from './types';

/** Fixed layout for chapter-one locations (viewBox 0–100). */
export const CHAPTER_ONE_LAYOUT: Record<string, { x: number; y: number }> = {
  'The Whispering Cellar': { x: 12, y: 52 },
  'The Sunken Corridor': { x: 38, y: 52 },
  'The Shrine of the Forgotten': { x: 64, y: 38 },
  'The Goblin Market': { x: 88, y: 38 },
  'The Bandit Camp': { x: 88, y: 18 },
  'The Vault of Echoes': { x: 38, y: 78 },
  'The Forgotten Crypt': { x: 62, y: 78 },
  'The Underground River': { x: 38, y: 32 },
  "The Bell Warden's Pit": { x: 38, y: 92 },
};

export function routeOpen(route: string, quests: Record<string, boolean>) {
  if (route === 'The Vault of Echoes' || route === "The Bell Warden's Pit") {
    return Boolean(quests.vault_unlocked);
  }
  return true;
}

export function mapLockReason(route: string, quests: Record<string, boolean>) {
  if (route === 'The Vault of Echoes' || route === "The Bell Warden's Pit") {
    if (quests.vault_unlocked) return null;
    if (quests.bell_quest_complete) {
      return 'Return to the Shrine of the Forgotten and speak with Caldus again to learn the way to the Vault of Echoes.';
    }
    return 'Locked — complete the shrine bell quest first.';
  }
  return 'This path is not open yet.';
}

export type MapNodeState = 'current' | 'adjacent' | 'visited' | 'locked' | 'hidden' | 'known';

export function mapNodeState(
  place: string,
  character: Character,
  locations: LocationReference[],
): MapNodeState {
  const visited = new Set(character.visited_locations ?? [character.location]);
  const quests = character.quest_flags ?? {};
  const current = character.location;
  const node = locations.find(item => item.name === current);

  if (place === current) return 'current';
  if (!CHAPTER_ONE_LAYOUT[place]) return 'hidden';

  const isVaultRoute = place === 'The Vault of Echoes' || place === "The Bell Warden's Pit";
  if (isVaultRoute && !routeOpen(place, quests)) {
    return visited.has(current) || visited.has('The Sunken Corridor') ? 'locked' : 'hidden';
  }

  if (visited.has(place)) return 'visited';

  const neighborOfCurrent = node?.connections.includes(place) ?? false;
  if (neighborOfCurrent && routeOpen(place, quests)) return 'adjacent';

  const anyVisitedConnects = locations.some(
    loc => visited.has(loc.name) && loc.connections.includes(place) && routeOpen(place, quests),
  );
  if (anyVisitedConnects) return 'known';

  return 'hidden';
}

const LOCATION_EMOJI: Record<string, string> = {
  'The Whispering Cellar': '🕸️',
  'The Sunken Corridor': '🌊',
  'The Shrine of the Forgotten': '🏛️',
  'The Goblin Market': '🏮',
  'The Bandit Camp': '⛺',
  'The Vault of Echoes': '🔔',
  'The Forgotten Crypt': '⚰️',
  'The Underground River': '💧',
  "The Bell Warden's Pit": '⛓️',
};

export function mapLocationEmoji(place: string): string {
  return LOCATION_EMOJI[place] ?? '⌖';
}

export function mapEdges(locations: LocationReference[]) {
  const seen = new Set<string>();
  const edges: Array<{ from: string; to: string }> = [];
  for (const loc of locations) {
    for (const to of loc.connections) {
      if (!CHAPTER_ONE_LAYOUT[loc.name] || !CHAPTER_ONE_LAYOUT[to]) continue;
      const key = [loc.name, to].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: loc.name, to });
    }
  }
  return edges;
}
