import {
  PlayErrorPanel,
  TurnDeltaStrip,
  type PlayScreenProps,
} from './sharedPlayUI';
import { CombatActionDeck, CombatArena, CombatHeroStrip, CombatMoment } from '../combat/CombatUI';

export function CombatScreen(props: PlayScreenProps) {
  const { character, events, busy, turnPhase, turnDelta } = props;

  return (
    <section
      className="screen game-screen combat-screen combat-v2 text-first"
      aria-busy={busy}
      data-in-combat="true"
    >
      <CombatArena character={character} busy={busy} />
      <CombatHeroStrip character={character} />
      <TurnDeltaStrip message={turnDelta} />
      <div className="combat-v2-story">
        <CombatMoment character={character} events={events} busy={busy} turnPhase={turnPhase} />
      </div>
      <PlayErrorPanel
        error={props.error}
        onOpenSettings={props.onOpenSettings}
        onRetry={props.onRetryError}
      />
      <CombatActionDeck
        character={character}
        spells={props.spells}
        busy={busy}
        onAction={props.onAction}
      />
    </section>
  );
}
