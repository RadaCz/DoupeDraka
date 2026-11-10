import type { JournalEvent } from './types';

export type JournalCategory = 'story' | 'talk' | 'discover' | 'combat' | 'quest' | 'rewards';

export type JournalFilter = 'all' | JournalCategory;

const COMBAT_ACTION = /^(attack|defend|flee|cast|use potion)/i;
const COMBAT_RESULT = /(attack roll|damage|hit\.|miss\.|defeated|initiative|ac \d+|útočný hod|poškození)/i;
const QUEST_RESULT = /\b(quest|shrine bell|vault of echoes|bell warden|return the bell|chrámový zvon|krypta|strážce zvonu)\b/i;
const QUEST_ACTION = /\b(return the bell|shrine bell|vault of echoes|bell warden)\b/i;
const TALK_ACTION = /^(talk|speak|ask|tell|persuade|greet|chat|mluv|zeptat|promluv)/i;
const TALK_RESULT = /\b(caldus|nib|mara|says|asks|replies|whispers|odpovídá|říká|šeptá)\b/i;
const DISCOVER_ACTION = /^(search|explore|investigate|look|inspect|listen|track|prohled|prozkoum|hled|podívej|poslouch)/i;
const DISCOVER_RESULT = /\b(you find|you discover|hidden|passage|tracks|clue|sign|stopu|objevil|naléz|skryt)\b/i;
const REWARD_RESULT = /\b(level up!|gained \d+ (gp|gold|xp)|recover \d+ hp|you receive|learned spell|inventory|bell acquired)\b/i;

export function classifyJournalCategory(event: JournalEvent): JournalCategory {
  const action = event.action?.toLowerCase() ?? '';
  const result = event.result.toLowerCase();
  if (COMBAT_ACTION.test(action) || COMBAT_RESULT.test(result)) return 'combat';
  if (QUEST_RESULT.test(result) || QUEST_ACTION.test(action)) return 'quest';
  if (REWARD_RESULT.test(result) || event.result.includes('LEVEL UP!')) return 'rewards';
  if (TALK_ACTION.test(action) || TALK_RESULT.test(result)) return 'talk';
  if (DISCOVER_RESULT.test(result) || (DISCOVER_ACTION.test(action) && DISCOVER_RESULT.test(result))) {
    return 'discover';
  }
  return 'story';
}

/** @deprecated Use classifyJournalCategory */
export function classifyJournalEvent(event: JournalEvent): JournalFilter {
  const category = classifyJournalCategory(event);
  return category === 'talk' || category === 'discover' || category === 'rewards' ? 'story' : category;
}

export function filterJournalEvents(events: JournalEvent[], filter: JournalFilter): JournalEvent[] {
  if (filter === 'all') return events;
  return events.filter(event => classifyJournalCategory(event) === filter);
}
