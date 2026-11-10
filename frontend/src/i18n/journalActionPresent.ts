import type { Locale } from '../i18n';
import chapterCatalog from '../../../localization/chapter_one_display.json';
import { CREATURE_CS, displayCreature, displayLocation, displayInventoryLabel } from './gameDisplay';

const LOCATION_KEYS = Object.keys(chapterCatalog.locations);

function resolveLocationToken(token: string): string {
  const trimmed = token.trim();
  for (const key of LOCATION_KEYS) {
    if (trimmed === key || trimmed.toLowerCase() === key.toLowerCase()) {
      return key;
    }
  }
  const bare = trimmed.replace(/^the\s+/i, '');
  for (const key of LOCATION_KEYS) {
    const keyBare = key.replace(/^The\s+/i, '');
    if (bare.toLowerCase() === keyBare.toLowerCase()) {
      return key;
    }
  }
  return trimmed;
}

/** Player-facing journal action chip — engine/API action string stays English in DB. */
export function presentJournalAction(action: string, locale: Locale): string {
  const raw = action.trim();
  if (!raw || locale !== 'cs') return raw;
  const folded = raw.toLowerCase();

  if (folded === 'rest' || folded.startsWith('long rest') || folded.startsWith('short rest')) {
    return folded.includes('long') ? 'Dlouhý odpočinek' : folded.includes('short') ? 'Krátký odpočinek' : 'Odpočinek';
  }
  if (folded === 'use potion' || folded.startsWith('use healing')) {
    return 'Použít lektvar';
  }
  if (folded.startsWith('equip ')) {
    const item = raw.slice(6).trim();
    return `Vybavit: ${displayInventoryLabel(item, locale)}`;
  }

  const searchMatch = raw.match(/^(search|explore|investigate)\s+(.+)$/i);
  if (searchMatch) {
    const placeKey = resolveLocationToken(searchMatch[2]);
    const verb = searchMatch[1].toLowerCase() === 'explore' ? 'Prozkoumat' : 'Prohledat';
    return `${verb}: ${displayLocation(placeKey, locale)}`;
  }

  const attackMatch = raw.match(/^(attack|strike|hit)\s+(?:the\s+)?(.+)$/i);
  if (attackMatch) {
    const target = attackMatch[2].trim();
    const creature = displayCreature(target, locale);
    if (creature !== target || CREATURE_CS[target] || CREATURE_CS[target.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')]) {
      return `Útok: ${creature}`;
    }
    return `Útok: ${displayCreature(target, locale)}`;
  }

  if (folded.startsWith('travel ') || folded.startsWith('go to ')) {
    const place = resolveLocationToken(raw.split(/\s+/).slice(-3).join(' '));
    return `Cesta: ${displayLocation(place, locale)}`;
  }

  return raw;
}
