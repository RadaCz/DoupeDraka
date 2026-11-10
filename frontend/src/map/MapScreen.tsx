import { useCallback, useState } from 'react';
import type { Character, LocationReference, QuestCatalog } from '../types';
import { useI18n } from '../i18n';
import { displayLocation, displayLocationShort } from '../i18n/gameDisplay';
import {
  CHAPTER_ONE_LAYOUT,
  mapEdges,
  mapLocationEmoji,
  mapNodeState,
  routeOpen,
} from '../chapterOneMap';
import { questStepsFromCatalog, visibleQuestTimeline } from '../questProgress';
import {
  buildTravelAction,
  isQuestDestination,
  locationDescription,
  mapStatusLabelKey,
  reachableFromCurrent,
  sortPlacesByRelevance,
  travelEligibility,
  visibleChapterPlaces,
} from './worldMap';

export function MapScreen({
  character,
  locations,
  busy,
  onTravel,
  onOpenQuests,
  onOpenJournal,
  onContinueAdventure,
  questCatalog,
}: {
  character: Character | null;
  locations: LocationReference[];
  busy?: boolean;
  onTravel: (action: string) => void;
  onOpenQuests?: () => void;
  onOpenJournal?: () => void;
  onContinueAdventure?: () => void;
  questCatalog?: QuestCatalog;
}) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSelected(null), []);

  if (!character) {
    return (
      <section className="screen map-screen map-screen-v2">
        <p>{t('Choose or create an adventurer to see the map.')}</p>
      </section>
    );
  }

  if (locations.length === 0) {
    return (
      <section className="screen map-screen map-screen-v2">
        <div className="page-title">
          <p className="eyebrow">{t('WORLD')}</p>
          <h1>{t('Map')}</h1>
        </div>
        <p className="map-empty-state">{t('Location data is not available yet. Continue your adventure and try again.')}</p>
        {onContinueAdventure && (
          <button type="button" className="primary" onClick={onContinueAdventure}>
            {t('Continue adventure')}
          </button>
        )}
      </section>
    );
  }

  const quests = character.quest_flags ?? {};
  const { active } = visibleQuestTimeline(quests, questStepsFromCatalog(questCatalog));
  const node = locations.find(item => item.name === character.location);
  const edges = mapEdges(locations);
  const visiblePlaces = sortPlacesByRelevance(visibleChapterPlaces(character, locations));
  const routesHere = reachableFromCurrent(character, locations);
  const currentBeat = locationDescription(character.location, locations);
  const selectedRef = selected ? locations.find(item => item.name === selected) : null;
  const selectedState = selected ? mapNodeState(selected, character, locations) : null;
  const selectedTravel = selected ? travelEligibility(selected, character, locations) : null;
  const questAtSelected = selected ? isQuestDestination(selected, active) : false;

  const handleTravel = () => {
    if (!selected || !selectedTravel?.canTravel || busy) return;
    onTravel(buildTravelAction(selected));
    setSelected(null);
  };

  const edgeVisible = (from: string, to: string) => {
    const a = mapNodeState(from, character, locations);
    const b = mapNodeState(to, character, locations);
    return a !== 'hidden' && b !== 'hidden';
  };

  return (
    <section className="screen map-screen map-screen-v2">
      <div className="page-title">
        <p className="eyebrow">{t('CHAPTER ONE')}</p>
        <h1>{t('Map')}</h1>
      </div>

      <article className="map-current-card">
        <p className="eyebrow">{t('You are here')}</p>
        <h2>
          <span aria-hidden="true">{mapLocationEmoji(character.location)}</span>{' '}
          {displayLocation(character.location, locale)}
        </h2>
        {currentBeat && <p>{t(currentBeat)}</p>}
        {active && (
          <p className="map-quest-context">
            <span className="eyebrow">{t('CURRENT OBJECTIVE')}</span>
            {active.location === character.location
              ? t('Your quest leads you here.')
              : active.location
                ? `${t('Quest points toward')}: ${displayLocation(active.location, locale)}`
                : t(active.hint)}
          </p>
        )}
      </article>

      <div className="map-quick-links" role="navigation" aria-label={t('Map links')}>
        {onContinueAdventure && (
          <button type="button" className="primary" disabled={busy} onClick={onContinueAdventure}>
            {t('Continue adventure')}
          </button>
        )}
        {onOpenQuests && (
          <button type="button" className="text-button" onClick={onOpenQuests}>
            {t('Current quest')}
          </button>
        )}
        {onOpenJournal && (
          <button type="button" className="text-button" onClick={onOpenJournal}>
            {t('Journal')}
          </button>
        )}
      </div>

      <div className="map-graph-wrap map-parchment" aria-label={t('Campaign map')}>
        <svg className="map-graph" viewBox="0 0 100 100" role="img" aria-hidden="true">
          {edges.filter(edge => edgeVisible(edge.from, edge.to)).map(edge => {
            const a = CHAPTER_ONE_LAYOUT[edge.from];
            const b = CHAPTER_ONE_LAYOUT[edge.to];
            if (!a || !b) return null;
            const locked = !routeOpen(edge.to, quests) || !routeOpen(edge.from, quests);
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={locked ? 'map-edge locked' : 'map-edge'}
              />
            );
          })}
        </svg>
        <div className="map-graph-nodes">
          {visiblePlaces.map(({ name: place, state }) => {
            const pos = CHAPTER_ONE_LAYOUT[place];
            const questMark = isQuestDestination(place, active);
            return (
              <button
                type="button"
                key={place}
                className={`map-graph-node ${state}${questMark ? ' quest-destination' : ''}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                title={displayLocation(place, locale)}
                onClick={() => setSelected(place)}
              >
                <span className="map-node-glyph" aria-hidden="true">
                  {state === 'current' ? '◉' : state === 'locked' ? '🔒' : state === 'visited' ? '◎' : '○'}
                </span>
                <span className="map-node-label">
                  <span className="map-node-place-icon" aria-hidden="true">{mapLocationEmoji(place)}</span>
                  {displayLocationShort(place, locale)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="map-legend" aria-label={t('Map legend')}>
        <li><span className="legend-dot current" /> {t('You are here')}</li>
        <li><span className="legend-dot adjacent" /> {t('Next stop')}</li>
        <li><span className="legend-dot visited" /> {t('Visited')}</li>
        <li><span className="legend-dot locked" /> {t('Locked route')}</li>
        <li><span className="legend-dot quest" /> {t('Quest destination')}</li>
      </ul>

      {routesHere.length > 0 && (
        <section className="map-routes-card">
          <h2>{t('Reachable from here')}</h2>
          <ol className="map-route-list">
            {routesHere.map(route => (
              <li key={route}>
                <button type="button" className="text-button" onClick={() => setSelected(route)}>
                  <span aria-hidden="true">{mapLocationEmoji(route)}</span> {displayLocation(route, locale)}
                  {isQuestDestination(route, active) && (
                    <span className="map-quest-tag">{t('Quest destination')}</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="map-known-list">
        <h2>{t('Known places')}</h2>
        <ul>
          {visiblePlaces.map(({ name, state }) => {
            const beat = locationDescription(name, locations);
            const questMark = isQuestDestination(name, active);
            return (
              <li key={name}>
                <button type="button" className="map-known-row" onClick={() => setSelected(name)}>
                  <span className="map-known-icon" aria-hidden="true">{mapLocationEmoji(name)}</span>
                  <span className="map-known-copy">
                    <strong>{displayLocation(name, locale)}</strong>
                    <small>{t(mapStatusLabelKey(state))}{questMark ? ` · ${t('Quest destination')}` : ''}</small>
                    {beat && <span className="map-known-beat">{t(beat)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {selected && selectedRef && (
        <div className="map-location-sheet" role="dialog" aria-modal="true" aria-labelledby="map-sheet-title">
          <article className="map-location-sheet-card">
            <button type="button" className="icon-button map-sheet-close" aria-label={t('Close')} onClick={closeSheet}>×</button>
            <p className="eyebrow">
              {selectedState ? t(mapStatusLabelKey(selectedState)) : t('Discovered')}
            </p>
            <h2 id="map-sheet-title">
              <span aria-hidden="true">{mapLocationEmoji(selected)}</span> {displayLocation(selected, locale)}
            </h2>
            {questAtSelected && active && (
              <p className="map-sheet-quest" role="status">
                <span className="eyebrow">{t('CURRENT OBJECTIVE')}</span>
                {t(active.label)}
              </p>
            )}
            <p>
              {selectedRef.arrival_beat
                ? t(selectedRef.arrival_beat)
                : t('No description yet for this place.')}
            </p>
            {selectedTravel?.canTravel ? (
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={handleTravel}
              >
                {busy ? t('Sending your action…') : t('Set out')}
              </button>
            ) : (
              <p className="map-sheet-muted">
                {selectedTravel?.reasonKey ? t(selectedTravel.reasonKey) : t('This path is not open yet.')}
              </p>
            )}
            {onOpenQuests && questAtSelected && (
              <button type="button" className="text-button" onClick={onOpenQuests}>
                {t('Open current quest')}
              </button>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
