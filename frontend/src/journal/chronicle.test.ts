import { describe, expect, it } from 'vitest';
import type { JournalEvent } from '../types';
import {
  isPlayerVisibleJournalEvent,
  sortJournalChronologically,
} from './chronicle';

function beat(partial: Partial<JournalEvent> & Pick<JournalEvent, 'id'>): JournalEvent {
  return {
    character_id: 'c1',
    action: 'search',
    result: 'Quiet air.',
    created_at: '2026-01-01T12:00:00Z',
    ...partial,
  };
}

describe('chronicle ordering', () => {
  it('sorts by created_at then id', () => {
    const events = [
      beat({ id: 2, created_at: '2026-01-02T12:00:00Z' }),
      beat({ id: 1, created_at: '2026-01-01T12:00:00Z' }),
      beat({ id: 3, created_at: '2026-01-02T12:00:00Z' }),
    ];
    const sorted = sortJournalChronologically(events);
    expect(sorted.map(event => event.id)).toEqual([1, 2, 3]);
  });
});

describe('player-visible journal', () => {
  it('hides internal and json-only dumps', () => {
    expect(isPlayerVisibleJournalEvent(beat({ id: 1, action: 'system_tick', result: '{}' }))).toBe(false);
    expect(isPlayerVisibleJournalEvent(beat({ id: 2, result: '{"handler":"x"}' }))).toBe(false);
    expect(isPlayerVisibleJournalEvent(beat({ id: 3, result: 'Cold stone.' }))).toBe(true);
  });
});
