import { describe, expect, it } from 'vitest';
import {
  BELL_WARDEN_LEVEL_GATE_NOTICE,
  bellWardenLevelGateNotice,
  formatBellWardenLevelGateNotice,
} from './gameActions';
import type { Character } from '../types';

const identityT = (text: string) => text;

const pitReadyFlags = {
  bell_quest_accepted: true,
  bell_acquired: true,
  bell_found: true,
  bell_quest_complete: true,
  vault_hint_given: true,
  vault_unlocked: true,
  vault_first_descent_story_awarded: true,
};

const preBossHero = (level: number): Character =>
  ({
    id: '1',
    name: 'Test',
    level,
    location: 'The Vault of Echoes',
    quest_flags: pitReadyFlags,
    in_combat: false,
  }) as unknown as Character;

describe('bellWardenLevelGateNotice', () => {
  it('shows the shared notice for level 2 on the Bell Warden step', () => {
    const notice = bellWardenLevelGateNotice(preBossHero(2), identityT);
    expect(notice).toBe(formatBellWardenLevelGateNotice(2, identityT));
    expect(notice).toMatch(/at least level 3/i);
    expect(notice).toMatch(/level 2/i);
  });

  it('returns null at level 3 when the pit boss step is active', () => {
    expect(bellWardenLevelGateNotice(preBossHero(3), identityT)).toBeNull();
  });

  it('uses one i18n constant', () => {
    const formatted = formatBellWardenLevelGateNotice(2, identityT);
    expect(formatted).toBe(
      BELL_WARDEN_LEVEL_GATE_NOTICE.replace('{minLevel}', '3').replace('{level}', '2'),
    );
  });
});