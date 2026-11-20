import { describe, expect, it } from 'vitest';
import { battlefieldLayout } from './combatBattlefield';

describe('AC16-3 battlefield layout', () => {
  it('places enemy token at 5, 15, and 60 ft on the 0–60 ft track', () => {
    expect(battlefieldLayout({ distance_ft: 5 }).enemyPercent).toBeCloseTo((5 / 60) * 100, 4);
    expect(battlefieldLayout({ distance_ft: 15 }).enemyPercent).toBeCloseTo(25, 4);
    expect(battlefieldLayout({ distance_ft: 60 }).enemyPercent).toBe(100);
    expect(battlefieldLayout({ distance_ft: 60 }).enemyBeyondTrack).toBe(false);
  });

  it('pins enemy at track edge with 60+ ft label beyond 60 ft', () => {
    const far = battlefieldLayout({ distance_ft: 75 });
    expect(far.enemyPercent).toBe(100);
    expect(far.enemyBeyondTrack).toBe(true);
    expect(far.distanceFt).toBe(75);
  });

  it('weapon reach band follows weapon_range.normal_ft', () => {
    const melee = battlefieldLayout({
      distance_ft: 30,
      weapon_range: { normal_ft: 5, can_attack: false },
    });
    expect(melee.weaponReachPercent).toBeCloseTo((5 / 60) * 100, 4);

    const ranged = battlefieldLayout({
      distance_ft: 45,
      weapon_range: { normal_ft: 80, long_ft: 320, can_attack: true },
    });
    expect(ranged.weaponReachPercent).toBe(100);
  });

  it('movement dashed band spans closing distance toward the foe', () => {
    const layout = battlefieldLayout({
      distance_ft: 30,
      movement_remaining_ft: 15,
      weapon_range: { normal_ft: 5 },
    });
    expect(layout.movementBandStartPercent).toBeCloseTo((15 / 60) * 100, 4);
    expect(layout.movementBandEndPercent).toBeCloseTo(50, 4);
  });
});