import type { JournalEvent } from '../types';
import { classifyJournalCategory, type JournalCategory } from '../journalCategories';
import type { QuestStep } from '../questProgress';

const LEARNED_MILESTONES: Array<{ flag: string; messageKey: string }> = [
  { flag: 'bell_quest_accepted', messageKey: 'Caldus told you the shrine bell was stolen — the Vault of Echoes grows louder every night.' },
  { flag: 'bell_acquired', messageKey: 'You secured the shrine bell from Nib at the Goblin Market.' },
  { flag: 'bell_found', messageKey: 'You found a lead on the stolen shrine bell.' },
  { flag: 'bell_quest_complete', messageKey: 'You returned the bell to Caldus; the shrine falls quiet again.' },
  { flag: 'vault_hint_given', messageKey: 'Caldus revealed the path to the Vault of Echoes beneath the cellar.' },
  { flag: 'vault_unlocked', messageKey: 'The sealed route to the Vault of Echoes is open.' },
  { flag: 'chapter_one_complete', messageKey: 'You defeated the Bell Warden and ended the echo-threat for now.' },
];

export function questLearnedFromFlags(flags: Record<string, boolean> = {}): string[] {
  return LEARNED_MILESTONES.filter(item => Boolean(flags[item.flag])).map(item => item.messageKey);
}

export function questStakesMessage(flags: Record<string, boolean> = {}): string {
  if (flags.chapter_one_complete) {
    return 'The cellar can breathe again — but deeper halls still whisper.';
  }
  if (!flags.bell_quest_accepted) {
    return 'Someone below the shrine needs answers before the echoes spill into the village.';
  }
  if (!flags.bell_quest_complete) {
    return 'Without the bell, Caldus cannot quiet the Vault — and the echoes will spread.';
  }
  if (!flags.vault_hint_given && !flags.vault_unlocked) {
    return 'The bell is home, but Caldus still owes you the truth about what lies beneath.';
  }
  return 'The Vault of Echoes must be silenced at its source — the Bell Warden waits below.';
}

export function questJournalSnippets(
  events: JournalEvent[],
  categories: JournalCategory[] = ['quest', 'talk', 'discover', 'rewards'],
  limit = 4,
): JournalEvent[] {
  const picked: JournalEvent[] = [];
  for (let i = events.length - 1; i >= 0 && picked.length < limit; i -= 1) {
    const event = events[i];
    const category = classifyJournalCategory(event);
    if (categories.includes(category)) {
      picked.unshift(event);
    }
  }
  return picked;
}

export function questObjectiveWhy(active: QuestStep | null, flags: Record<string, boolean> = {}): string {
  if (!active) return '';
  switch (active.id) {
    case 'bell_quest_accepted':
      return flags.bell_quest_accepted
        ? 'Caldus trusts you to recover sacred metal before the echoes worsen.'
        : 'Learn who stole the bell and who in the cellar can point you forward.';
    case 'bell_acquired':
      return 'Nib trades in secrets as much as goods — the bell is the proof Caldus needs.';
    case 'bell_quest_complete':
      return 'Returning the bell restores the shrine and unlocks Caldus’s next counsel.';
    case 'vault_hint_given':
      return 'Only Caldus knows how to reach the Vault once the bell rings true again.';
    case 'chapter_one_complete':
      return 'The Bell Warden feeds on stolen sound — leave it undefeated and the depths stay hungry.';
    default:
      return '';
  }
}
