import type { Locale } from '../i18n';
import { CREATURE_CS, displayCreature, displayInventoryLabel, LOCATION_CS } from './gameDisplay';

/** Engine cooldown lines that must never appear as player-facing prose in CS. */
const ENGINE_LINES_IN_PROSE =
  /^(You take a moment to catch your breath|You pause to steady your breathing|No new threat appears)/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Substitute canonical EN place/creature/item tokens inside already-localized prose. */
export function localizeEmbeddedCatalogNames(text: string, locale: Locale): string {
  if (locale !== 'cs' || !text.trim()) return text;
  let out = text;
  const locationEntries = Object.entries(LOCATION_CS).sort((a, b) => b[0].length - a[0].length);
  for (const [en, cs] of locationEntries) {
    out = out.replace(new RegExp(escapeRegex(en), 'g'), cs);
  }
  for (const [en, cs] of Object.entries(CREATURE_CS)) {
    out = out.replace(new RegExp(escapeRegex(en), 'gi'), cs);
  }
  for (const [en, cs] of Object.entries({
    shortsword: 'krátký meč',
    longsword: 'dlouhý meč',
    "traveler's clothes": 'cestovní oblečení',
    goblin: 'goblin',
  })) {
    out = out.replace(new RegExp(`\\b${escapeRegex(en)}\\b`, 'gi'), cs);
  }
  return out;
}

/**
 * Presentation-only: strip leaked engine echoes and localize names in journal/adventure prose.
 * Does not change stored events or engine facts.
 */
export function presentNarrationProse(text: string, locale: Locale): string {
  if (!text.trim()) return text;
  if (locale !== 'cs') return text;
  const lines = text.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (ENGINE_LINES_IN_PROSE.test(trimmed)) return false;
    return true;
  });
  const joined = filtered.join('\n').trim();
  return localizeEmbeddedCatalogNames(joined, locale);
}

export function presentCreatureName(name: string, locale: Locale): string {
  return displayCreature(name, locale);
}

export function presentItemLabel(label: string, locale: Locale): string {
  return displayInventoryLabel(label, locale);
}
