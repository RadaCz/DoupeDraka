import type { CombatTactics } from './combatRange';

export const BATTLEFIELD_TRACK_MAX_FT = 60;

export interface BattlefieldLayout {
  /** Enemy token horizontal position 0–100 (hero anchored at 0). */
  enemyPercent: number;
  /** Show „60+ ft“ when distance exceeds track scale. */
  enemyBeyondTrack: boolean;
  distanceFt: number;
  /** End of weapon reach band from hero (0–100). */
  weaponReachPercent: number;
  /** Start of dashed movement band toward foe (0–100). */
  movementBandStartPercent: number;
  /** End of dashed movement band (usually enemyPercent). */
  movementBandEndPercent: number;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function percentForDistance(ft: number): number {
  const clamped = Math.max(0, Math.min(ft, BATTLEFIELD_TRACK_MAX_FT));
  return (clamped / BATTLEFIELD_TRACK_MAX_FT) * 100;
}

export function battlefieldLayout(tactics: CombatTactics | null | undefined): BattlefieldLayout {
  const distanceFt = tactics?.distance_ft ?? 0;
  const moveLeft = Math.max(0, tactics?.movement_remaining_ft ?? 0);
  const normalFt = tactics?.weapon_range?.normal_ft;
  const weaponReachFt = typeof normalFt === 'number' && normalFt > 0
    ? normalFt
    : (tactics?.weapon_range?.long_ft ?? 5);
  const enemyPercent = clampPercent(percentForDistance(distanceFt));
  const weaponReachPercent = clampPercent(percentForDistance(weaponReachFt));
  const closingFt = Math.min(moveLeft, Math.max(0, distanceFt));
  const movementBandEndPercent = enemyPercent;
  const movementBandStartPercent = clampPercent(
    percentForDistance(Math.max(0, distanceFt - closingFt)),
  );

  return {
    enemyPercent,
    enemyBeyondTrack: distanceFt > BATTLEFIELD_TRACK_MAX_FT,
    distanceFt,
    weaponReachPercent,
    movementBandStartPercent,
    movementBandEndPercent,
  };
}