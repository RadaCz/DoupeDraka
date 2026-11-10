import type { JournalEvent } from '../types';
import { splitNarrationAndFacts } from '../components/journalBlocks';
import { isExploreActionRedundant } from '../journalDisplay';
import type { JournalCategory } from '../journalCategories';
import { classifyJournalCategory } from '../journalCategories';

const INTERNAL_ACTION = /^(system|debug|__)/i;
const JSON_LIKE = /^\s*[\[{]/;

export function sortJournalChronologically(events: JournalEvent[]): JournalEvent[] {
  return [...events].sort((a, b) => {
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return a.id - b.id;
  });
}

export function isPlayerVisibleJournalEvent(event: JournalEvent): boolean {
  const trimmed = event.result.trim();
  if (trimmed && JSON_LIKE.test(trimmed)) return false;
  const { narration } = splitNarrationAndFacts(event.result);
  if (!narration && trimmed && /^[a-z0-9_]+$/i.test(trimmed)) {
    return false;
  }
  const action = event.action?.trim() ?? '';
  if (!action || INTERNAL_ACTION.test(action)) return false;
  return Boolean(narration || trimmed);
}

export function shouldShowJournalActionLine(event: JournalEvent, location?: string): boolean {
  const action = event.action?.trim() ?? '';
  if (!action || INTERNAL_ACTION.test(action)) return false;
  if (location && isExploreActionRedundant(action, location)) return false;
  return true;
}

export function journalBeatTimeLabel(
  createdAt: string,
  mode: 'play' | 'page',
  locale: string,
): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  if (mode === 'play') {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function categoryLabelKey(category: JournalCategory): string {
  switch (category) {
    case 'talk':
      return 'Talk & NPCs';
    case 'discover':
      return 'Discoveries';
    case 'combat':
      return 'Combat';
    case 'quest':
      return 'Quest beats';
    case 'rewards':
      return 'Rewards & consequences';
    default:
      return 'Story';
  }
}

export function categoryGlyph(category: JournalCategory): string {
  switch (category) {
    case 'talk':
      return '💬';
    case 'discover':
      return '🔍';
    case 'combat':
      return '⚔';
    case 'quest':
      return '🎯';
    case 'rewards':
      return '✦';
    default:
      return '📖';
  }
}

export function journalBeatCategory(event: JournalEvent): JournalCategory {
  return classifyJournalCategory(event);
}
