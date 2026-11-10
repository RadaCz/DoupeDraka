import { describe, expect, it } from 'vitest';
import { PLAYER_FACING_API_ERRORS, playerFacingErrorKey, presentPlayerFacingError } from './playerFacingErrors';

describe('playerFacingErrors', () => {
  it('maps known API detail strings to translation keys', () => {
    expect(playerFacingErrorKey('Action cannot be empty')).toBe('Action cannot be empty');
    expect(playerFacingErrorKey('Unknown tier: pro')).toBe('Unknown narrator tier.');
  });

  it('returns Czech copy when locale is cs and catalog has a match', () => {
    const t = (key: string) => (key === 'Action cannot be empty' ? 'Akce nesmí být prázdná.' : key);
    expect(presentPlayerFacingError('Action cannot be empty', 'cs', t)).toBe('Akce nesmí být prázdná.');
    expect(presentPlayerFacingError('Totally new error', 'cs', t)).toBe('Totally new error');
  });

  it('exposes stable keys for regression coverage', () => {
    expect(Object.keys(PLAYER_FACING_API_ERRORS).length).toBeGreaterThanOrEqual(10);
  });
});
