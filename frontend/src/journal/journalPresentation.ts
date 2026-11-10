import type { Locale } from '../i18n';
import { splitNarrationAndFacts } from '../components/journalBlocks';
import { presentEngineEventLine } from '../i18n/gameDisplay';
import { presentNarrationProse } from '../i18n/narrationPresent';
import type { JournalEvent } from '../types';

/** Same fact-line detector as the adventure journal (presentation only). */
const MECHANIC_EVENT_LINE =
  /^(Attack roll:|Attack with\b|.*\bdamage\b|Saving throw:|Exploration roll:|Intelligence check:|Wisdom check:|Strength check:|Dexterity check:|Constitution check:|Charisma check:|.* vs (DC|AC) \d+|Initiative:)/i;

function truncateProse(text: string, maxLen: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen - 1).trim()}…`;
}

/**
 * Player-facing story snippet for Overview / hub cards — mirrors journal presentation,
 * never raw English engine facts or naked dice lines.
 */
export function latestStoryBeatForOverview(events: JournalEvent[], locale: Locale): string {
  const last = events[events.length - 1];
  if (!last) return '';

  const { narration, facts } = splitNarrationAndFacts(last.result);
  const prose = presentNarrationProse(narration, locale).trim();
  if (prose && !MECHANIC_EVENT_LINE.test(prose)) return truncateProse(prose, 240);

  const factLines = last.result.split('\n').map(entry => entry.trim()).filter(Boolean);

  for (const line of factLines) {
    if (MECHANIC_EVENT_LINE.test(line)) continue;
    const localized = presentEngineEventLine(line, locale);
    if (localized) return truncateProse(localized, 240);
  }

  return '';
}
