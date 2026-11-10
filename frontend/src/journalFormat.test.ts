import { describe, expect, it } from 'vitest';
import type { JournalEvent } from './types';
import { dedupeJournalEvents, formatJournalStreamResult, mergeJournalAfterRefresh } from './journalFormat';

describe('formatJournalStreamResult', () => {
  it('hides mechanics until narration prose exists', () => {
    expect(formatJournalStreamResult('', ['Attack roll: 18 — hit.'])).toBe('');
  });

  it('orders story before mechanics', () => {
    const blob = formatJournalStreamResult('The blade flashes.', ['Attack roll: 18 — hit.']);
    expect(blob.startsWith('The blade flashes.')).toBe(true);
    expect(blob).toContain('Attack roll');
  });

  it('localizes streamed facts for CS locale', () => {
    const blob = formatJournalStreamResult('Tiše čekáš.', ['Exploration roll: 4 on a six-sided die.'], 'cs');
    expect(blob).toMatch(/Průzkum: 4/);
    expect(blob).not.toMatch(/Exploration roll/i);
  });

  it('dedupes identical server beats after reconnect refresh', () => {
    const beat: JournalEvent = {
      id: 1,
      action: 'look',
      result: 'Story.\n\nExploration roll: 3.',
      created_at: '2026-01-01T12:00:00Z',
    };
    const events = dedupeJournalEvents([beat, { ...beat, id: 2 }, beat]);
    expect(events).toHaveLength(1);
  });

  it('drops optimistic pending when server already returned the same turn', () => {
    const serverBeat: JournalEvent = {
      id: 9,
      action: 'attack',
      result: 'Steel rings.\n\nAttack roll: hit.',
      created_at: '2026-01-01T12:01:00Z',
    };
    const pending: JournalEvent = {
      id: -1,
      action: 'attack',
      result: 'Steel rings.\n\nAttack roll: hit.',
      created_at: '2026-01-01T12:00:50Z',
    };
    const merged = mergeJournalAfterRefresh([serverBeat], [pending]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(9);
  });
});
