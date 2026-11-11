import { describe, expect, it } from 'vitest';
import { rangeDisadvantageLabel } from './combatRange';

const t = (s: string) => s;

describe('combatRange', () => {
  it('labels disadvantage reasons', () => {
    expect(rangeDisadvantageLabel('long range', t)).toContain('Long range');
    expect(rangeDisadvantageLabel('ranged in melee', t)).toContain('5 ft');
  });
});
