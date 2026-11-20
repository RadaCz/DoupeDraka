import { useI18n } from '../i18n';
import type { JournalEvent } from '../types';
import { chronicleEntryLabel, chronicleEntrySummary, priorCombatBeats } from './combatChronicle';

export function CombatChronicleFold({ events }: { events: JournalEvent[] }) {
  const { t, locale } = useI18n();
  const prior = priorCombatBeats(events);
  if (!prior.length) return null;

  return (
    <details className="combat-chronicle-fold">
      <summary>{t('Combat progress')}</summary>
      <ol className="combat-chronicle-list" role="list">
        {prior.map(event => (
          <li key={event.id} className="combat-chronicle-item">
            <span className="combat-chronicle-action">{chronicleEntryLabel(event, locale)}</span>
            <span className="combat-chronicle-summary">{chronicleEntrySummary(event, locale)}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}