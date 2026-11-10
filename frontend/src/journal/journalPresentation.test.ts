import { describe, expect, it } from 'vitest';
import type { JournalEvent } from '../types';
import { latestStoryBeatForOverview } from './journalPresentation';

describe('latestStoryBeatForOverview', () => {
  const event: JournalEvent = {
    id: 42,
    action: 'search The Sunken Corridor',
    created_at: '2026-11-10T12:00:00Z',
    result: [
      'Exploration roll: 4 on a six-sided die.',
      'New discovery: A brass token stamped with a broken moon lies in the silt.',
    ].join('\n\n'),
  };

  it('hides raw exploration mechanics in CS overview', () => {
    const beat = latestStoryBeatForOverview([event], 'cs');
    expect(beat).not.toMatch(/Exploration roll/i);
    expect(beat).not.toMatch(/six-sided die/i);
    expect(beat).not.toMatch(/brass token stamped/i);
    expect(beat).toMatch(/Nový nález|mosazná žetona|měsíce/i);
  });

  it('prefers narrator prose over fact lines', () => {
    const withProse: JournalEvent = {
      ...event,
      result: 'Šeptající chodba je studená.\n\nExploration roll: 3 on a six-sided die.',
    };
    expect(latestStoryBeatForOverview([withProse], 'cs')).toMatch(/chodba/i);
    expect(latestStoryBeatForOverview([withProse], 'cs')).not.toMatch(/Exploration roll/i);
  });

  it('leaves EN unchanged when prose is present', () => {
    const enEvent: JournalEvent = {
      ...event,
      result: 'You steady yourself.\n\nYou explore the area but find no immediate threat.',
    };
    const beat = latestStoryBeatForOverview([enEvent], 'en');
    expect(beat).toMatch(/steady yourself/i);
    expect(beat).not.toMatch(/no immediate threat/i);
  });
});
