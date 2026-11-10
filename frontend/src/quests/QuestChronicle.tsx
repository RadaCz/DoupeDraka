import type { Character, JournalEvent, QuestCatalog } from '../types';
import { useI18n } from '../i18n';
import { journalExcerpt } from '../share/adventureShare';
import { questStepsFromCatalog, visibleQuestTimeline } from '../questProgress';
import {
  questJournalSnippets,
  questLearnedFromFlags,
  questObjectiveWhy,
  questStakesMessage,
} from './questStory';

export function QuestChronicle({
  character,
  questCatalog,
  journalEvents = [],
  onOpenJournal,
  onOpenMap,
  onContinueAdventure,
}: {
  character: Character;
  questCatalog?: QuestCatalog;
  journalEvents?: JournalEvent[];
  onOpenJournal?: () => void;
  onOpenMap?: (location?: string) => void;
  onContinueAdventure?: () => void;
}) {
  const { t } = useI18n();
  const flags = character.quest_flags ?? {};
  const stepSource = questStepsFromCatalog(questCatalog);
  const { done, active, teaser } = visibleQuestTimeline(flags, stepSource);
  const learned = questLearnedFromFlags(flags);
  const stakes = questStakesMessage(flags);
  const why = active ? questObjectiveWhy(active, flags) : '';
  const sideQuest = questCatalog?.side_quests?.[0];
  const sideComplete = sideQuest ? Boolean(flags[sideQuest.reward_flag]) : false;
  const atNextLocation = active?.location && character.location === active.location;
  const journalSnippets = questJournalSnippets(journalEvents);

  return (
    <>
      <div className="page-title">
        <p className="eyebrow">{t('CAMPAIGN')}</p>
        <h1>{t('Quests')}</h1>
      </div>
      <article className="quest-main-card quest-v2-main">
        <p className="eyebrow">{t('MAIN QUEST')}</p>
        <h2>{t('The lost shrine bell')}</h2>
        <p>{t('Return Caldus’s stolen bell and quiet the Vault of Echoes.')}</p>
        {stakes && <p className="quest-stakes">{t(stakes)}</p>}
      </article>
      {active ? (
        <article className={`quest-next-card quest-v2-active ${atNextLocation ? 'here' : ''}`}>
          <p className="eyebrow">{t('CURRENT OBJECTIVE')}</p>
          <h2>{t(active.label)}</h2>
          <p>{t(active.hint)}</p>
          {why && <p className="quest-why">{t(why)}</p>}
          {active.location && (
            <p className="quest-next-meta">
              {atNextLocation
                ? t('You are at the right location.')
                : `${t('Head to')}: ${active.location}`}
            </p>
          )}
          <div className="quest-v2-actions">
            {onContinueAdventure && (
              <button type="button" className="primary" onClick={onContinueAdventure}>
                {t('Continue adventure')}
              </button>
            )}
            {active.location && onOpenMap && (
              <button type="button" className="text-button" onClick={() => onOpenMap(active.location)}>
                {t('Open map')}
              </button>
            )}
          </div>
        </article>
      ) : (
        <article className="quest-next-card done">
          <p className="eyebrow">{t('CHAPTER ONE')}</p>
          <h2>{t('Bell quest complete')}</h2>
          <p>{t('The shrine bell is home and the Bell Warden is defeated.')}</p>
        </article>
      )}
      {teaser && <p className="quest-teaser">{t(teaser)}</p>}
      {learned.length > 0 && (
        <section className="quest-learned-block">
          <p className="eyebrow">{t('What you have learned')}</p>
          <ul className="quest-learned-list">
            {learned.map(item => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </section>
      )}
      {journalSnippets.length > 0 && (
        <section className="quest-journal-block">
          <div className="section-heading quest-journal-heading">
            <p className="eyebrow">{t('From your journal')}</p>
            {onOpenJournal && (
              <button type="button" className="text-button" onClick={onOpenJournal}>
                {t('Full journal')}
              </button>
            )}
          </div>
          <ul className="quest-journal-snippets">
            {journalSnippets.map(event => (
              <li key={event.id}>
                <span className="quest-journal-action">{event.action}</span>
                <p>{journalExcerpt(event.result, 160)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {sideQuest && (
        <article className={`quest-next-card ${sideComplete ? 'done' : ''}`}>
          <p className="eyebrow">{t('SIDE QUEST')}</p>
          <h2>{t(sideQuest.title)}</h2>
          <p>{sideComplete ? t('Relic secured in the Forgotten Crypt.') : t(sideQuest.hint)}</p>
        </article>
      )}
      {done.length > 0 && (
        <ol className="quest-step-list">
          {done.map(step => (
            <li key={step.id} className="quest-step done">
              <span className="quest-step-marker" aria-hidden="true">✓</span>
              <div>
                <strong>{t(step.label)}</strong>
                <small>{t('Complete')}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
