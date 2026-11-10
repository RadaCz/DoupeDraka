import { describe, expect, it } from 'vitest';
import { displayInventoryLabel, displayLocation, localizeMechanicsLine } from '../i18n/gameDisplay';

describe('display localization integration', () => {
  it('keeps canonical travel actions unchanged in engine layer', () => {
    expect('travel to The Sunken Corridor').toBe('travel to The Sunken Corridor');
  });

  it('uses consistent CS labels for map, character and journal mechanics', () => {
    expect(displayLocation('The Sunken Corridor', 'cs')).toBe('Potopená chodba');
    expect(displayInventoryLabel('shortsword', 'cs')).toBe('krátký meč');
    const line = localizeMechanicsLine(
      'Attack with shortsword: 16 (d20 +3) vs AC 13 — hit.',
      'cs',
    );
    expect(line).toContain('16');
    expect(line).toMatch(/zásah/i);
  });
});
