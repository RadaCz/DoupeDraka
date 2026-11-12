import type { Character } from '../types';

export interface LevelUpNotice {
  level: number;
  hpGained: number;
  classFeatures?: string[];
  classFeaturesDeferred?: string[];
  spellSlotSummary?: string;
}

export interface LevelUpFacts {
  new_level?: number;
  hp_gained?: number;
  class_features_gained?: string[];
  class_features_deferred?: string[];
  max_spell_slots?: Record<string, number>;
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
  const spellSlotSummary = formatSpellSlotSummary(facts?.max_spell_slots ?? after.max_spell_slots);
  if (facts && typeof facts.new_level === 'number') {
    const hpGained = typeof facts.hp_gained === 'number'
      ? facts.hp_gained
      : Math.max(0, after.max_hp - before.max_hp);
    return {
      level: facts.new_level,
      hpGained,
      classFeatures: facts.class_features_gained?.length ? [...facts.class_features_gained] : undefined,
      classFeaturesDeferred: facts.class_features_deferred?.length
        ? [...facts.class_features_deferred]
        : undefined,
      spellSlotSummary,
    };
  }
  if (after.level > before.level) {
    return {
      level: after.level,
      hpGained: Math.max(0, after.max_hp - before.max_hp),
      spellSlotSummary,
    };
  }
  return null;
}

function formatSpellSlotSummary(slots?: Record<string, number>): string | undefined {
  if (!slots || Object.keys(slots).length === 0) return undefined;
  return Object.entries(slots)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, count]) => `L${level}×${count}`)
    .join(', ');
}
