import type { Character, JournalEvent } from '../types';
import { useI18n } from '../i18n';
import { JournalResultBody } from '../components/journalBlocks';
import { ShareButton } from '../components/ShareButton';
import { buildJournalShareMessage, journalExcerpt } from '../share/adventureShare';
import {
  categoryGlyph,
  categoryLabelKey,
  journalBeatCategory,
  journalBeatTimeLabel,
  shouldShowJournalActionLine,
} from './chronicle';
import { presentJournalAction } from '../i18n/journalActionPresent';

export function JournalBeatCard({
  event,
  character,
  mode,
  collapseMechanics,
}: {
  event: JournalEvent;
  character?: Character | null;
  mode: 'play' | 'page';
  collapseMechanics?: boolean;
}) {
  const { t, locale } = useI18n();
  const category = journalBeatCategory(event);
  const timeLabel = journalBeatTimeLabel(event.created_at, mode, locale);
  const location = character?.location;
  const showAction = shouldShowJournalActionLine(event, location);
  const levelUp = event.result.includes('LEVEL UP!');
  return (
    <article className={`journal-beat journal-beat-${category} ${levelUp ? 'level-up-entry' : ''}`}>
      <div className="journal-beat-head">
        <span className="journal-beat-category" title={t(categoryLabelKey(category))}>
          <span aria-hidden="true">{categoryGlyph(category)}</span>
          <span className="journal-beat-category-label">{t(categoryLabelKey(category))}</span>
        </span>
        {timeLabel && <time dateTime={event.created_at}>{timeLabel}</time>}
        {character && (
          <ShareButton
            message={buildJournalShareMessage(character, journalExcerpt(event.result), event.action)}
          />
        )}
      </div>
      {showAction && (
        <p className="journal-action">
          <span aria-hidden="true">›</span> {presentJournalAction(event.action, locale)}
        </p>
      )}
      {levelUp && <strong className="level-up-banner">{t('LEVEL UP')}</strong>}
      {event.action.toLowerCase().includes('rest') && event.result.toLowerCase().includes('cannot rest') && (
        <strong className="spell-warning" role="status">
          {t('Rest unavailable during combat')}
        </strong>
      )}
      <div className="journal-narration">
        <JournalResultBody result={event.result} collapseMechanics={collapseMechanics} />
      </div>
    </article>
  );
}
