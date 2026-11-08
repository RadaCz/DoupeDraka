import type { PlayScreenProps } from './sharedPlayUI';
import { AdventureScreen } from './AdventureScreen';
import { CombatScreen } from './CombatScreen';

export function GameScreenRouter(props: PlayScreenProps) {
  if (props.character.in_combat) return <CombatScreen {...props} />;
  return <AdventureScreen {...props} />;
}
