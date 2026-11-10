import type { Locale } from '../i18n';

/** Canonical engine location id → Czech display label (UI only). */
export const LOCATION_CS: Record<string, string> = {
  'The Whispering Cellar': 'Šeptající sklep',
  'The Sunken Corridor': 'Potopená chodba',
  'The Shrine of the Forgotten': 'Svatyně zapomenutých',
  'The Goblin Market': 'Gobliní trh',
  'The Vault of Echoes': 'Komnata ozvěn',
  "The Bell Warden's Pit": 'Jáma strážce zvonu',
  'The Forgotten Crypt': 'Zapomenutá krypta',
  'The Underground River': 'Podzemní řeka',
};

export const CREATURE_CS: Record<string, string> = {
  'Goblin scout': 'Gobliní zvěd',
  'Goblin Scout': 'Gobliní zvěd',
  'Bell Warden': 'Strážce zvonu',
};

const ITEM_LABEL_CS: Record<string, string> = {
  shortsword: 'krátký meč',
  'shortsword +1': 'krátký meč +1',
  longsword: 'dlouhý meč',
  longbow: 'dlouhý luk',
  dagger: 'dýka',
  mace: 'palcát',
  rapier: 'rapír',
  'healing potion': 'léčivý lektvar',
  "traveler's clothes": 'cestovní oblečení',
  'leather armor': 'kožená zbroj',
  'shrine bell': 'chrámový zvon',
  shield: 'štít',
};

const WEAPON_INSTRUMENTAL_CS: Record<string, string> = {
  shortsword: 'krátkým mečem',
  'shortsword +1': 'krátkým mečem +1',
  longsword: 'dlouhým mečem',
  longbow: 'dlouhým lukem',
  dagger: 'dýkou',
  mace: 'palcátem',
  rapier: 'rapírem',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function displayLocation(canonical: string, locale: Locale): string {
  if (locale !== 'cs') return canonical;
  return LOCATION_CS[canonical] ?? canonical;
}

export function displayLocationShort(canonical: string, locale: Locale): string {
  const full = displayLocation(canonical, locale);
  if (locale !== 'cs') return full.replace(/^The /, '').replace(/'/g, '');
  return full;
}

export function displayCreature(name: string, locale: Locale): string {
  if (locale !== 'cs') return name;
  return CREATURE_CS[name] ?? CREATURE_CS[name.trim()] ?? name;
}

export function displayInventoryLabel(canonical: string, locale: Locale): string {
  if (locale !== 'cs') return canonical;
  const key = normalizeKey(canonical);
  return ITEM_LABEL_CS[key] ?? canonical;
}

function combatResultCs(result: string): string {
  const lower = result.toLowerCase();
  if (lower.includes('critical hit')) return 'kritický zásah';
  if (lower.includes('critical miss')) return 'kritické minutí';
  if (lower.includes('miss')) return 'minutí';
  if (lower.includes('hit')) return 'zásah';
  return result;
}

const MECHANIC_PATTERNS_CS: Array<[RegExp, string | ((...args: string[]) => string)]> = [
  [
    /^Attack with (.+?): (\d+) \(d20\s*\+(\d+)\) vs AC (\d+) — (critical miss|miss|hit|critical hit)\.?$/i,
    (weapon, total, mod, ac, result) => {
      const wKey = normalizeKey(weapon);
      const instr = WEAPON_INSTRUMENTAL_CS[wKey] ?? displayInventoryLabel(weapon, 'cs');
      return `Útok ${instr}: ${total} (k20+${mod}) proti OZ ${ac} — ${combatResultCs(result)}.`;
    },
  ],
  [
    /^Attack with (.+?): (\d+) \(d20\s*\+(\d+)\) — (critical miss|miss|hit|critical hit)\.?$/i,
    (weapon, total, mod, result) => {
      const wKey = normalizeKey(weapon);
      const instr = WEAPON_INSTRUMENTAL_CS[wKey] ?? displayInventoryLabel(weapon, 'cs');
      return `Útok ${instr}: ${total} (k20+${mod}) — ${combatResultCs(result)}.`;
    },
  ],
  [/Exploration roll: (\d+) on a six-sided die\.(.*)/i, 'Průzkum: $1 na šestistranné kostce.$2'],
  [/Intelligence check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test inteligence: $1 proti ST $2 — $3.'],
  [/Wisdom check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test moudrosti: $1 proti ST $2 — $3.'],
  [/Charisma check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test charismy: $1 proti ST $2 — $3.'],
  [/Strength check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test síly: $1 proti ST $2 — $3.'],
  [/Dexterity check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test obratnosti: $1 proti ST $2 — $3.'],
  [/Constitution check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test výdrže: $1 proti ST $2 — $3.'],
  [/Attack roll: (.*)/i, 'Útočný hod: $1'],
  [/^Damage (\d+)(.*)$/i, 'Poškození: $1$2'],
  [/^(.+) takes (\d+) damage\.?$/i, '$1 utrpí $2 poškození.'],
  [/^An enemy appears: (.+?)\.?$/i, 'Objevuje se nepřítel: $1.'],
  [/^Initiative: (.*)$/i, 'Iniciativa: $1'],
];

/**
 * Localize a single engine mechanic line for journal/combat UI (facts unchanged in DB).
 */
export function localizeMechanicsLine(line: string, locale: Locale): string {
  if (locale !== 'cs') return line;
  let output = line.trim();
  for (const [pattern, replacement] of MECHANIC_PATTERNS_CS) {
    if (!pattern.test(output)) continue;
    if (typeof replacement === 'string') {
      output = output.replace(pattern, replacement);
    } else {
      output = output.replace(pattern, (...args) => {
        const groups = args.slice(1, -2) as string[];
        return replacement(...groups);
      });
    }
    break;
  }
  output = output
    .replace(/\bsuccess\b/gi, 'úspěch')
    .replace(/\bfailure\b/gi, 'neúspěch')
    .replace(/\bd20\b/gi, 'k20')
    .replace(/\bhit\.?$/gi, 'zásah.')
    .replace(/\bmiss\.?$/gi, 'minutí.');
  for (const [en, cs] of Object.entries(CREATURE_CS)) {
    output = output.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), cs);
  }
  for (const [en, cs] of Object.entries(LOCATION_CS)) {
    output = output.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), cs);
  }
  for (const [en, cs] of Object.entries(ITEM_LABEL_CS)) {
    const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    output = output.replace(re, cs);
  }
  return output;
}

export function localizeMechanicsBlob(text: string, locale: Locale): string {
  if (locale !== 'cs') return text;
  return text
    .split('\n')
    .map(line => (line.trim() ? localizeMechanicsLine(line, locale) : line))
    .join('\n');
}
