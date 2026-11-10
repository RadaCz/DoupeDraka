import { describe, expect, it } from 'vitest';
import {
  displayCreature,
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

  it('localizes exploration gold and rest facts', () => {
    expect(localizeMechanicsLine('You find 3 gold pieces tucked beneath loose stones (a one-time find here).', 'cs')).toMatch(
      /3 zlatých/,
    );
    expect(localizeMechanicsLine('You pick over stones and debris, but this area has no loose coin left to find.', 'cs')).toMatch(
      /mince/,
    );
    expect(localizeMechanicsLine('You take a short rest and recover 4 HP. Your HP: 10/14.', 'cs')).toContain('4');
    expect(localizeMechanicsLine('You cannot take a long rest here — the ruins are too exposed. Retreat to the Whispering Cellar, the shrine, or Nib\'s market.', 'cs')).toMatch(
      /Šeptajícího sklepa/,
    );
  });

  it('localizes expanded bestiary names', () => {
    expect(displayCreature('Kobold skirmisher', 'cs')).toBe('Koboldí záškodník');
  });
});
