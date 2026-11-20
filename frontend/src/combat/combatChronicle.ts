import type { JournalEvent } from '../types';
import { chipsFromResolution } from './combatResolution';
import type { Locale } from '../i18n';

export function isCombatJournalEvent(event: JournalEvent): boolean {
  const blob = `${event.action} ${event.result}`.toLowerCase();
  return (
    /^(attack|defend|flee|cast|use potion|advance|retreat|disengage|end turn)/i.test(event.action.trim())
    || /attack roll|damage|initiative|saving throw|hit\.|miss\.|an enemy appears/i.test(blob)
  );
}

/** All combat beats in chronological order (oldest first). */
export function combatJournalBeats(events: JournalEvent[]): JournalEvent[] {
  return events.filter(isCombatJournalEvent);
}

/** Beats before the latest one (for collapsed Průběh boje). */
export function priorCombatBeats(events: JournalEvent[]): JournalEvent[] {
  const beats = combatJournalBeats(events);
  if (beats.length <= 1) return [];
  return beats.slice(0, -1);
}

export function chronicleEntryLabel(event: JournalEvent, locale: Locale): string {
  const action = event.action.trim();
  if (locale === 'cs') {
    if (/^attack/i.test(action)) return 'Útok';
    if (/^defend/i.test(action)) return 'Obrana';
    if (/^flee/i.test(action)) return 'Útěk';
    if (/^cast/i.test(action)) return 'Kouzlo';
    if (/^use potion/i.test(action)) return 'Lektvar';
    if (/^advance/i.test(action)) return 'Přiblížení';
    if (/^retreat/i.test(action)) return 'Ustoupení';
    if (/^disengage/i.test(action)) return 'Odpoutání';
    if (/^end turn/i.test(action)) return 'Konec tahu';
  }
  if (/^attack/i.test(action)) return 'Attack';
  if (/^defend/i.test(action)) return 'Defend';
  return action.split(/\s+/).slice(0, 2).join(' ');
}

export function chronicleEntrySummary(event: JournalEvent, locale: Locale): string {
  const chips = chipsFromResolution(event.resolution, locale);
  if (chips.length) return chips.map(c => c.label).join(' · ');
  const line = event.result.split('\n').find(row => row.trim())?.trim();
  return line ?? event.action;
}