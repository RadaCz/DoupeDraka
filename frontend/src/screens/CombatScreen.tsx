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

  return (
    <section className="screen game-screen combat-screen text-first">
      <PlaySceneChrome character={character} economy={props.economy} combat />
      <TurnDeltaStrip message={turnDelta} />
      <div className="game-play-story">
        <PlayJournal {...props} />
      </div>
      <PlayErrorPanel error={props.error} onOpenSettings={props.onOpenSettings} onRetry={props.onRetryError} />
      <ActionComposer {...props} />
    </section>
  );
}
