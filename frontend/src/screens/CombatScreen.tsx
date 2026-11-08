import { useI18n } from '../i18n';
import {
  ActionComposer,
  PlayJournal,
  PlayErrorPanel,
  PlaySceneChrome,
  TurnDeltaStrip,
  type PlayScreenProps,
} from './sharedPlayUI';

export function CombatScreen(props: PlayScreenProps) {
  const { character, turnDelta } = props;
  const { t } = useI18n();
  const enemy = character.combatant;

  return (
    <section className="screen game-screen combat-screen text-first">
      <header className="combat-strip" role="group" aria-label={t('Combat in progress')}>
        <span aria-hidden="true">⚔</span>
        <strong>{enemy ? enemy.name : t('Combat in progress')}</strong>
        {enemy && (
          <span className="combat-strip-hp">{enemy.hp}/{enemy.max_hp}</span>
        )}
      </header>
      <PlaySceneChrome character={character} events={props.events} onOpenSheet={props.onOpenSheet} combat />
      <TurnDeltaStrip message={turnDelta} />
      <div className="game-play-story">
        <PlayJournal {...props} />
      </div>
      <PlayErrorPanel error={props.error} onOpenSettings={props.onOpenSettings} />
      <ActionComposer {...props} />
    </section>
  );
}
