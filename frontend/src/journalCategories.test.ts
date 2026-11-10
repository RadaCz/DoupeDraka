import { describe, expect, it } from 'vitest';
import { classifyJournalCategory, classifyJournalEvent, filterJournalEvents } from './journalCategories';
import type { JournalEvent } from './types';

function beat(action: string, result: string): JournalEvent {
  return { id: 1, character_id: 'c1', action, result, created_at: new Date().toISOString() };
}

describe('journalCategories', () => {
  it('classifies combat, quest, talk and discoveries', () => {
    expect(classifyJournalCategory(beat('attack goblin', 'Attack roll: 15 vs AC 13 — hit.'))).toBe('combat');
    expect(classifyJournalCategory(beat('talk', 'You return the shrine bell to Caldus.'))).toBe('quest');
    expect(classifyJournalCategory(beat('talk to Mara', 'Mara says the tunnels run cold.'))).toBe('talk');
    expect(classifyJournalCategory(beat('search cellar', 'You find hidden tracks near the well.'))).toBe('discover');
    expect(classifyJournalCategory(beat('search', 'Cold stone and quiet air.'))).toBe('story');
    expect(classifyJournalEvent(beat('search', 'Cold stone and quiet air.'))).toBe('story');
  });

  it('filters journal list', () => {
    const events = [
      beat('search', 'Quiet.'),
      beat('attack', 'Damage 5.'),
      beat('talk to Nib', 'Nib grins.'),
    ];
    expect(filterJournalEvents(events, 'combat')).toHaveLength(1);
    expect(filterJournalEvents(events, 'talk')).toHaveLength(1);
  });
});
