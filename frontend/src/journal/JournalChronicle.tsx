import { useEffect, useMemo, useRef } from 'react';
import type { Character, JournalEvent } from '../types';
import { useI18n } from '../i18n';
import { dedupeJournalEvents } from '../journalFormat';
import { filterJournalEvents, type JournalFilter } from '../journalCategories';
import { JournalBeatCard } from './JournalBeatCard';
import { isPlayerVisibleJournalEvent, sortJournalChronologically } from './chronicle';

export function JournalChronicle({
  events,
  character,
  filter = 'all',
  mode,
  scrollOnChange,
  scrollKey,
}: {
  events: JournalEvent[];
  character?: Character | null;
  filter?: JournalFilter;
  mode: 'play' | 'page';
  scrollOnChange?: boolean;
  scrollKey?: string | number;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chronicle = useMemo(() => {
    const ordered = sortJournalChronologically(dedupeJournalEvents(events));
    const visible = ordered.filter(isPlayerVisibleJournalEvent);
    return filterJournalEvents(visible, filter);
  }, [events, filter]);

  useEffect(() => {
    if (!scrollOnChange) return;
    const node = scrollRef.current;
    if (!node) return;
    const top = node.scrollHeight;
    if (mode === 'play' && typeof node.scrollTo === 'function') {
      try {
        node.scrollTo({ top, behavior: chronicle.length > 1 ? 'smooth' : 'auto' });
        return;
      } catch {
        // fall through
      }
    }
    node.scrollTop = top;
  }, [chronicle.length, filter, mode, scrollOnChange, scrollKey]);

  const className = mode === 'page'
    ? 'journal-chronicle journal-chronicle-page'
  : 'journal-scene journal-presentation-text-first';

  return (
    <div className={className} ref={scrollRef} role="log" aria-label={t('Adventure journal')} aria-live={mode === 'play' ? 'polite' : undefined}>
      {chronicle.length === 0 && (
        <p className="journal-chronicle-empty">
          {events.length === 0 ? t('Your story has not begun yet.') : t('No entries match this filter yet.')}
        </p>
      )}
      {chronicle.map(event => (
        <JournalBeatCard
          key={event.id}
          event={event}
          character={character}
          mode={mode}
          collapseMechanics={mode === 'page'}
        />
      ))}
    </div>
  );
}
