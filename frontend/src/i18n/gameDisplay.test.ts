import { describe, expect, it } from 'vitest';
import {
  displayCreature,
  displayInventoryLabel,
  displayLocation,
  localizeMechanicsLine,
  presentEngineEventLine,
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

  it('localizes Bell Warden level gate and pit travel messages', () => {
    const levelBlock =
      'Bell Warden is beyond your current experience (you are level 2; reach at least level 3 by winning fights and exploring before you attack).';
    const csLevel = presentEngineEventLine(levelBlock, 'cs');
    expect(csLevel).toMatch(/úroveň 2/);
    expect(csLevel).toMatch(/úrovně 3/);
    expect(csLevel).not.toMatch(/is here for you/i);

    const pit =
      "The Bell Warden waits in the Bell Warden's Pit. Travel to the pit before you challenge it.";
    expect(presentEngineEventLine(pit, 'cs')).toMatch(/Jámě strážce zvonu/i);

    const sealed = "The Bell Warden's Pit is sealed until you unlock the Vault route with Caldus.";
    expect(presentEngineEventLine(sealed, 'cs')).toMatch(/Calduse/i);
  });

  it('localizes exploration outcomes and discovery facts for CS journal', () => {
    expect(localizeMechanicsLine('Exploration roll: 6 on a six-sided die.', 'cs')).toMatch(/Průzkum: 6/);
    expect(presentEngineEventLine('You explore the area but find no immediate threat.', 'cs')).toMatch(/hrozbu/i);
    expect(presentEngineEventLine('You take a moment to catch your breath. No new threat appears.', 'cs')).toMatch(
      /oddychneš/i,
    );
    const discovery = presentEngineEventLine(
      'New discovery: Fresh tracks cross the dust and lead toward the sunken corridor.',
      'cs',
    );
    expect(discovery).toMatch(/^Nový nález:/);
    expect(discovery).toMatch(/stopy/i);
  });
});
