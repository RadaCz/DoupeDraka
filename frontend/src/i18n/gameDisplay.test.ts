import { describe, expect, it } from 'vitest';
import {
  displayInventoryLabel,
  displayLocation,
  localizeMechanicsLine,
} from './gameDisplay';

describe('gameDisplay', () => {
  it('localizes canonical locations for CS UI', () => {
    expect(displayLocation('The Sunken Corridor', 'cs')).toBe('Potopená chodba');
    expect(displayLocation('The Sunken Corridor', 'en')).toBe('The Sunken Corridor');
  });

  it('localizes inventory labels', () => {
    expect(displayInventoryLabel('shortsword', 'cs')).toBe('krátký meč');
    expect(displayInventoryLabel('shortsword', 'en')).toBe('shortsword');
  });

  it('localizes attack fact lines without changing numbers', () => {
    const line = 'Attack with shortsword: 18 (d20+5) vs AC 13 — hit.';
    const cs = localizeMechanicsLine(line, 'cs');
    expect(cs).toContain('18');
    expect(cs).toContain('k20+5');
    expect(cs).toContain('13');
    expect(cs).toMatch(/zásah/i);
    expect(cs).toContain('krátkým mečem');
  });

  it('localizes exploration checks', () => {
    const cs = localizeMechanicsLine('Dexterity check: 14 vs DC 12 — success.', 'cs');
    expect(cs).toContain('obratnosti');
    expect(cs).toContain('úspěch');
  });
});
