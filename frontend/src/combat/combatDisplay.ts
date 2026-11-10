import type { Locale } from '../i18n';
import { displayCreature, displayLocation } from '../i18n/gameDisplay';
import type { Character, JournalEvent } from '../types';
import { lastCombatBeat } from './combatActions';

/** Current play location from engine-backed character state (not journal history). */
export function canonicalPlayLocation(character: Character): string | null {
  const loc = character.location?.trim();
  return loc || null;
}

export function combatAtmosphereLine(character: Character, locale: Locale): string {
  const place = canonicalPlayLocation(character);
  const foe = character.combatant?.name;

  const placeLabel = place ? displayLocation(place, locale) : null;
  const foeLabel = foe ? displayCreature(foe, locale) : null;
  if (locale === 'cs') {
    if (placeLabel && foeLabel) return `Souboj v místě ${placeLabel}. Proti tobě stojí ${foeLabel}.`;
    if (placeLabel) return `Souboj v místě ${placeLabel}.`;
    if (foeLabel) return `Proti tobě stojí ${foeLabel}.`;
    return 'Čepel je tasená — boj právě probíhá.';
  }
  if (place && foe) return `Fight at ${place}. ${foe} stands against you.`;
  if (place) return `Fight at ${place}.`;
  if (foe) return `${foe} stands against you.`;
  return 'Steel is drawn — the clash is underway.';
}

/** True when the latest combat journal entry is only the enemy spawn (no strike yet). */
export function isPreStrikeCombatBeat(events: JournalEvent[]): boolean {
  const beat = lastCombatBeat(events);
  if (!beat) return true;
  const blob = `${beat.action} ${beat.result}`.toLowerCase();
  if (blob.includes('attack roll')) return false;
  return blob.includes('an enemy appears:') || blob.includes('initiative:');
}

export function combatIntroProse(character: Character, locale: Locale): string {
  const foe = character.combatant?.name ?? (locale === 'cs' ? 'nepřítel' : 'a foe');
  const place = canonicalPlayLocation(character);
  const placeLabel = place ? displayLocation(place, locale) : null;
  const foeLabel = displayCreature(foe, locale);
  const lower = foe.toLowerCase();

  if (locale === 'cs') {
    if (lower.includes('goblin')) {
      const where = placeLabel ? `V ${placeLabel} ` : '';
      return (
        `${where}se z temnoty vynoří ${foeLabel}. Vychrtlé prsty svírají zbraň ` +
        'a jeho pohled tě měří s podezřívavou ostražitostí — jakmile tě zaznamená, napřímí se do bojového postoje.'
      );
    }
    if (placeLabel) {
      return (
        `V prostoru ${placeLabel} se před tebou rýsuje ${foeLabel}. ` +
        'Střetnutí přeruší chladné ticho — protivník se napřímí a čeká tvůj první tah.'
      );
    }
    return `Před tebou se vynoří ${foeLabel}. Jak tě zaznamená, ustoupí do bojového postoje.`;
  }

  if (lower.includes('goblin')) {
    const where = place ? `In ${place}, ` : '';
    return (
      `${where}${foe} slips from the shadows with a wary grip on a blade. ` +
      'The moment you are spotted, the creature squares up to fight.'
    );
  }
  if (place) {
    return (
      `In ${place}, ${foe} steps into view. The stillness breaks as your foe squares up and watches your next move.`
    );
  }
  return `${foe} emerges to face you. As you meet its gaze, the fight is ready to begin.`;
}
