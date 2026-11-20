import {
  CHAPTER_ONE_LAYOUT,
  mapLockReason,
  mapNodeState,
  routeOpen,
  type MapNodeState,
} from '../chapterOneMap';
import type { Character, LocationReference } from '../types';
import type { QuestStep } from '../questProgress';

export function buildTravelAction(destination: string): string {
  return `travel to ${destination}`;
}

export interface TravelEligibility {
  canTravel: boolean;
  reasonKey: string | null;
}

export function travelEligibility(
  destination: string,
  character: Character,
  locations: LocationReference[],
): TravelEligibility {
  const current = character.location;
  const quests = character.quest_flags ?? {};
  const node = locations.find(item => item.name === current);

  if (destination === current) {
    return { canTravel: false, reasonKey: 'You are already here.' };
  }
  if (!node?.connections.includes(destination)) {
    return {
      canTravel: false,
      reasonKey: 'You cannot reach this place from here — travel from a connected location first.',
    };
  }
  if (!routeOpen(destination, quests)) {
    const reason = mapLockReason(destination, quests);
    return { canTravel: false, reasonKey: reason ?? 'This path is not open yet.' };
  }
  const state = mapNodeState(destination, character, locations);
  if (state === 'locked' || state === 'hidden') {
    const reason = mapLockReason(destination, quests);
    return { canTravel: false, reasonKey: reason ?? 'This path is not open yet.' };
  }
  return { canTravel: true, reasonKey: null };
}

export function reachableFromCurrent(
  character: Character,
  locations: LocationReference[],
): string[] {
  const node = locations.find(item => item.name === character.location);
  if (!node) return [];
  const quests = character.quest_flags ?? {};
  return node.connections.filter(route => routeOpen(route, quests));
}

export function visibleChapterPlaces(
  character: Character,
  locations: LocationReference[],
): Array<{ name: string; state: MapNodeState }> {
  const places = Object.keys(CHAPTER_ONE_LAYOUT);
  return places
    .map(name => ({ name, state: mapNodeState(name, character, locations) }))
    .filter(item => item.state !== 'hidden');
}

const STATE_SORT: Record<MapNodeState, number> = {
  current: 0,
  adjacent: 1,
  visited: 2,
  known: 3,
  locked: 4,
  hidden: 5,
};

export function sortPlacesByRelevance(
  places: Array<{ name: string; state: MapNodeState }>,
): Array<{ name: string; state: MapNodeState }> {
  return [...places].sort((a, b) => STATE_SORT[a.state] - STATE_SORT[b.state] || a.name.localeCompare(b.name));
}

export function isQuestDestination(place: string, active: QuestStep | null): boolean {
  return Boolean(active?.location && active.location === place);
}

export function mapStatusLabelKey(state: MapNodeState): string {
  switch (state) {
    case 'current':
      return 'You are here';
    case 'adjacent':
      return 'Next stop';
    case 'visited':
      return 'Visited';
    case 'locked':
      return 'Locked route';
    case 'known':
      return 'Discovered';
    default:
      return 'Discovered';
  }
}

export function locationDescription(
  place: string,
  locations: LocationReference[],
): string | null {
  const ref = locations.find(item => item.name === place);
  return ref?.arrival_beat ?? null;
}
