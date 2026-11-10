import { describe, expect, it } from 'vitest';
import type { JournalEvent } from '../types';
import {
  questJournalSnippets,
  questLearnedFromFlags,
  questStakesMessage,
} from './questStory';

describe('questStory', () => {
  it('lists learned milestones from flags only', () => {
    const learned = questLearnedFromFlags({ bell_quest_accepted: true, bell_acquired: true });
    expect(learned.length).toBe(2);
    expect(learned[0]).toMatch(/Caldus/);
    expect(learned[1]).toMatch(/Nib/);
  });

  it('changes stakes with progression', () => {
    expect(questStakesMessage({})).toMatch(/shrine/i);
    expect(questStakesMessage({ bell_quest_accepted: true })).toMatch(/Without the bell/i);
    expect(questStakesMessage({ chapter_one_complete: true })).toMatch(/cellar/i);
  });

  it('links recent quest journal beats', () => {
    const events: JournalEvent[] = [
      { id: 1, character_id: 'c', action: 'search', result: 'Dust.', created_at: '2026-01-01T10:00:00Z' },
      { id: 2, character_id: 'c', action: 'talk to Caldus', result: 'Caldus asks about the bell.', created_at: '2026-01-01T11:00:00Z' },
    ];
    const snippets = questJournalSnippets(events, ['quest', 'talk'], 2);
    expect(snippets).toHaveLength(1);
    expect(snippets[0].id).toBe(2);
  });
});
