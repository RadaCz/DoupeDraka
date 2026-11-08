import type { Character } from '../types';

export function formatTurnDelta(before: Character, after: Character): string | null {
  const parts: string[] = [];
  if (before.hp !== after.hp) {
    const diff = after.hp - before.hp;
    parts.push(`HP ${diff >= 0 ? '+' : ''}${diff} (${after.hp}/${after.max_hp})`);
  }
  if (before.gold !== after.gold) {
    const diff = after.gold - before.gold;
    parts.push(`Gold ${diff >= 0 ? '+' : ''}${diff} gp`);
  }
  const beforeFlags = before.quest_flags ?? {};
  const afterFlags = after.quest_flags ?? {};
  for (const [key, value] of Object.entries(afterFlags)) {
    if (value && !beforeFlags[key]) {
      parts.push(`Quest: ${key.replace(/_/g, ' ')}`);
    }
  }
  return parts.length ? parts.join(' · ') : null;
}
