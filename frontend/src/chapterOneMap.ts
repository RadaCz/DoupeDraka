import type { Character, LocationReference } from './types';

/** Fixed layout for chapter-one locations (viewBox 0–100). */
export const CHAPTER_ONE_LAYOUT: Record<string, { x: number; y: number }> = {
  'The Whispering Cellar': { x: 12, y: 52 },
  'The Sunken Corridor': { x: 38, y: 52 },
  'The Shrine of the Forgotten': { x: 64, y: 38 },
  'The Goblin Market': { x: 88, y: 38 },
  'The Vault of Echoes': { x: 38, y: 78 },
  "The Bell Warden's Pit": { x: 38, y: 92 },
};

export function routeOpen(route: string, quests: Record<string, boolean>) {
  if (route === 'The Vault of Echoes' || route === "The Bell Warden's Pit") {
    return Boolean(quests.vault_unlocked || quests.vault_hint_given);
  }
  return true;
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
