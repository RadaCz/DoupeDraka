export interface CombatVictoryRewards {
  xp?: number;
  gold?: number;
  lootLines: string[];
  foeName?: string;
}

const XP_RE = /gain\s+(\d+)\s+xp/i;
const GOLD_RE = /(\d+)\s*gp\b|gold\s*\+\s*(\d+)/i;

export function extractCombatVictory(events: string[]): CombatVictoryRewards | null {
  const joined = events.join('\n');
  if (!/is defeated|defeated\.\s*you gain/i.test(joined)) return null;
  const rewards: CombatVictoryRewards = { lootLines: [] };
  const xpMatch = joined.match(XP_RE);
  if (xpMatch) rewards.xp = Number(xpMatch[1]);
  const goldMatch = joined.match(GOLD_RE);
  if (goldMatch) rewards.gold = Number(goldMatch[1] ?? goldMatch[2]);
  const foeMatch = joined.match(/^(.+?)\s+is defeated/mi);
  if (foeMatch) rewards.foeName = foeMatch[1].trim();
  for (const line of events) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/loot|found|picked up|získáváš|kořist/i.test(trimmed)
      && !/is defeated|you gain.*xp/i.test(trimmed)) {
      rewards.lootLines.push(trimmed);
    }
  }
  return rewards;
}

export function shouldOfferCombatVictory(
  wasInCombat: boolean,
  nowInCombat: boolean,
  hp: number,
  events: string[],
): boolean {
  return wasInCombat && !nowInCombat && hp > 0 && extractCombatVictory(events) != null;
}