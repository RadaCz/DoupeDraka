import type { Character } from '../types';

export interface LevelUpNotice {
  level: number;
  hpGained: number;
}

export interface LevelUpFacts {
  new_level?: number;
  hp_gained?: number;
}

const DEFEAT_EVENT_PREFIX = 'Defeated in combat.';

export function isCombatDefeatRespawn(events: string[]): boolean {
  return events.some((line) => line.startsWith(DEFEAT_EVENT_PREFIX));
}

export function noticeFromLevelUp(
  before: Character,
  after: Character,
  facts?: LevelUpFacts | null,
): LevelUpNotice | null {
  if (facts && typeof facts.new_level === 'number') {
    const hpGained = typeof facts.hp_gained === 'number'
      ? facts.hp_gained
      : Math.max(0, after.max_hp - before.max_hp);
    return { level: facts.new_level, hpGained };
  }
  if (after.level > before.level) {
    return { level: after.level, hpGained: Math.max(0, after.max_hp - before.max_hp) };
  }
  return null;
}
