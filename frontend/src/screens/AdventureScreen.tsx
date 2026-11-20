import {
  ActionComposer,
  PlayCoachingStrip,
  PlayJournal,
  PlayErrorPanel,
  PlayNpcTopicsCard,
  PlaySceneChrome,
  PlaySceneIntroCard,
  TurnDeltaStrip,
  type PlayScreenProps,
} from './sharedPlayUI';

export function AdventureScreen(props: PlayScreenProps) {
  const { character, events, turnDelta, questToast, onOpenQuests } = props;

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
      {questToast ? <p className="quest-step-toast" role="status">{questToast}</p> : null}
      <div className="game-play-story">
        <PlaySceneIntroCard character={character} locations={props.locations} />
        <PlayNpcTopicsCard character={character} busy={props.busy} onAction={props.onAction} />
        <PlayJournal {...props} />
      </div>
      <PlayErrorPanel error={props.error} onOpenSettings={props.onOpenSettings} onRetry={props.onRetryError} />
      <ActionComposer {...props} />
    </section>
  );
}
