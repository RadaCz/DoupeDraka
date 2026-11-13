import {
  ActionComposer,
  PlayCoachingStrip,
  PlayJournal,
  PlayErrorPanel,
  PlaySceneChrome,
  TurnDeltaStrip,
  type PlayScreenProps,
} from './sharedPlayUI';

export function AdventureScreen(props: PlayScreenProps) {
  const { character, events, turnDelta, onOpenQuests } = props;

  return (
    <section className="screen game-screen adventure-screen text-first">
      <PlaySceneChrome
        character={character}
        economy={props.economy}
        events={events}
        coaching={(
          <PlayCoachingStrip character={character} events={events} onOpenQuests={onOpenQuests} />
        )}
      />
      <TurnDeltaStrip message={turnDelta} />
      <div className="game-play-story">
        <PlayJournal {...props} />
      </div>
      <PlayErrorPanel error={props.error} onOpenSettings={props.onOpenSettings} onRetry={props.onRetryError} />
      <ActionComposer {...props} />
    </section>
  );
}
