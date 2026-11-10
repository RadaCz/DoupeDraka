import { describe, expect, it } from 'vitest';
import { isLightUiColor, relativeLuminance } from './colorUtils';

describe('colorUtils', () => {
  it('detects light Telegram chrome colors', () => {
    expect(isLightUiColor('#ffffff')).toBe(true);
    expect(isLightUiColor('#0d120e')).toBe(false);
    expect(relativeLuminance('#ffffff')).toBeGreaterThan(0.9);
  });
});
