import { describe, expect, it } from 'vitest';
import type { JournalEvent } from '../types';
import { combatJournalBeats, isCombatJournalEvent, priorCombatBeats } from './combatChronicle';

const mk = (id: number, action: string, result = ''): JournalEvent => ({
  id,
  action,
  result,
  created_at: new Date().toISOString(),
});

describe('combat chronicle (Průběh boje)', () => {
  it('keeps only combat journal beats', () => {
    expect(isCombatJournalEvent(mk(1, 'travel to cellar'))).toBe(false);
    expect(isCombatJournalEvent(mk(2, 'attack goblin', 'hit.'))).toBe(true);
    const beats = combatJournalBeats([
      mk(1, 'talk to npc'),
      mk(2, 'attack goblin', 'roll 15'),
      mk(3, 'defend', 'stance'),
    ]);
    expect(beats).toHaveLength(2);
  });

  it('excludes the latest beat from prior history', () => {
    const events = [
      mk(1, 'attack one'),
      mk(2, 'attack two'),
      mk(3, 'defend'),
    ];
    expect(priorCombatBeats(events)).toEqual([mk(1, 'attack one'), mk(2, 'attack two')]);
    expect(priorCombatBeats([mk(1, 'attack only')])).toEqual([]);
  });
});