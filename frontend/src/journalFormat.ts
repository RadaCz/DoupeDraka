import type { Locale } from './i18n';
import { presentNarrationProse } from './i18n/narrationPresent';
import type { JournalEvent } from './types';

/** Journal result blob: story first; hide mechanics until narrator prose exists. */
export function formatJournalStreamResult(
  narration: string,
  facts: string[],
  locale: Locale = 'en',
): string {
  const prose = presentNarrationProse(narration.trim(), locale);
  if (!prose) {
    return '';
  }
  const mechanics = facts.join('\n').trim();
  return mechanics ? `${prose}\n\n${mechanics}` : prose;
}

/** Drop duplicate ids or identical action+result pairs after SSE recovery refresh. */
export function dedupeJournalEvents(events: JournalEvent[]): JournalEvent[] {
  const seenIds = new Set<number>();
  const seenFingerprints = new Set<string>();
  const ordered: JournalEvent[] = [];
  for (const event of events) {
    if (seenIds.has(event.id)) continue;
    seenIds.add(event.id);
    const fingerprint = `${event.action}\n${event.result.trim()}`;
    if (seenFingerprints.has(fingerprint)) continue;
    seenFingerprints.add(fingerprint);
    ordered.push(event);
  }
  return ordered;
}

export function mergeJournalAfterRefresh(
  server: JournalEvent[],
  previous: JournalEvent[],
): JournalEvent[] {
  const dedupedServer = dedupeJournalEvents(server);
  const pending = previous.find(event => event.id < 0);
  if (!pending) return dedupedServer;
  const duplicate = dedupedServer.some(
    event => event.action === pending.action && event.result.trim() === pending.result.trim(),
  );
  if (duplicate) return dedupedServer;
  return dedupeJournalEvents([...dedupedServer, pending]);
}
