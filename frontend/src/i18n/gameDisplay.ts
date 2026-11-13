import type { Locale } from '../i18n';
import chapterCatalog from '../../../localization/chapter_one_display.json';

type LocationEntry = string | { nom: string; gen?: string; loc?: string; acc?: string; ins?: string; dat?: string };

function locationNom(key: string): string {
  const entry = (chapterCatalog.locations as Record<string, LocationEntry>)[key];
  if (!entry) return key;
  return typeof entry === 'string' ? entry : entry.nom;
}

/** Canonical engine location id → Czech display label (UI only). Synced with localization/chapter_one_display.json */
export const LOCATION_CS: Record<string, string> = Object.fromEntries(
  Object.keys(chapterCatalog.locations).map(key => [key, locationNom(key)]),
);

export const CREATURE_CS: Record<string, string> = {
  'Goblin scout': 'Gobliní zvěd',
  'Goblin Scout': 'Gobliní zvěd',
  'Kobold skirmisher': 'Koboldí záškodník',
  'Starving wolf': 'Hladový vlk',
  'Rattling skeleton': 'Chřestící kostlivec',
  'Road bandit': 'Loupežník na cestě',
  'Hobgoblin soldier': 'Hobgobliní voják',
  'Cellar ghoul': 'Ghúl ze sklepa',
  'Orc marauder': 'Orčí nájezdník',
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
  'echo shard': 'střep ozvěny',
  shield: 'štít',
  ...(chapterCatalog.items as Record<string, string>),
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

export function displayArrivalBeat(beat: string, locale: Locale): string {
  if (locale !== 'cs' || !beat.trim()) return beat;
  const mapped = (chapterCatalog as { arrival_beats_cs?: Record<string, string> }).arrival_beats_cs?.[beat.trim()];
  return mapped ?? beat;
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

/** Exact engine discovery lines → Czech (presentation only; DB stays EN). */
const DISCOVERY_BODY_CS: Record<string, string> = {
  'Fresh tracks cross the dust and lead toward the sunken corridor.':
    'Čerstvé stopy kříží prach a vedou k potopené chodbě.',
  'Wet footprints lead toward a pale light beneath the shrine doors.':
    'Mokré otisky míří k bledému světlu pod dveřmi svatyně.',
  'Boot prints cross the shrine dust and continue toward a crowded bazaar.':
    'Otisky bot procházejí prachem svatyně a míří k rušnému tržišti.',
  "A trail of copper scales vanishes behind the market's shuttered stalls.":
    'Stopy měděných šupin mizí za zataženými stánky trhu.',
  'Bell scratches mark a spiral path deeper into the vault.':
    'Škrábance od zvonů vyznačují spirálovitou cestu hlouběji do komnaty.',
  'The pit floor is scorched in a ring around a shattered brazier.':
    'Dno jámy je vypálené kruhem kolem rozbitého ohniště.',
  'Bone dust swirls in a draft from deeper niches.':
    'Kostní prach se víří v průvanu z hlubších výklenků.',
  'Cookfire smoke stains the tree line above hidden tents.':
    'Kouř z ohniště kazí obzor nad skrytými stany.',
  'Cold water trails toward a tunnel mouth slick with moss.':
    'Studená voda stéká k ústí chodby pokryté mechem.',
  "Scratches around a stone panel mark the cellar's hidden passage.":
    'Škrábance kolem kamenného panelu označují skrytý průchod sklepa.',
  'A brass token stamped with a broken moon lies in the silt.':
    'V bahně leží mosazná žetona s otiskem rozbitého měsíce.',
  'An offering bowl hides a map fragment marked with a green hand.':
    'Obětní mísa skrývá fragment mapy označený zelenou rukou.',
  'Nib, a goblin trader, claims the stolen shrine bell changed hands at this market.':
    'Gobliní kupec Nib tvrdí, že ukradený chrámový zvon se na tomto trhu prodal dál.',
  "A rusted key ring holds a shrine tag that reads 'return what was stolen'.":
    'Rezavý svazek klíčů nese štítek chrámu: „Vrať, co bylo ukradeno.“',
  "Carved into the wall: 'The Warden keeps tolls even in death.'":
    'Vyryto ve zdi: „Strážce vybírá mýto i po smrti.“',
  'A nameless sarcophagus lid bears claw marks from the inside.':
    'Víko bezejmenného sarkofágu nese stopy drápů zevnitř.',
  'A bounty notice lists stolen shrine goods headed for the market.':
    'Odměna na plakátu uvádí ukradené chrámové věci mířící na trh.',
  'A ferry chain hangs broken; something dragged it into the dark.':
    'Zdvižný řetěz je přetržený; něco ho táhlo do tmy.',
  'Danger follows the waterway.': 'Nebezpečí sleduje tok vody.',
  'Something heavy sloshes against the stones downstream.':
    'Něco těžkého šplouchá o kameny po proudu.',
  "Nib's stall smells of tarnished brass — gossip says a shrine bell changed hands here.":
    'Nibův stánek páchl po matné mosazi — povídá se, že tu změnil majitele chrámový zvon.',
  'Behind a cracked sarcophagus you find an echo shard and 15 gold from a forgotten burial.':
    'Za prasklým sarkofágem najdeš střep ozvěny a 15 zlatých z dávno zapomenutého pohřbu.',
  'You gain 10 XP for uncovering the relic.':
    'Získáváš 10 XP za nalezení relikvie.',
  'You gain 50 XP for uncovering the vault route.':
    'Získáváš 50 XP za odhalení cesty do krypta.',
  "You gain 85 XP for surviving the vault's first descent.":
    'Získáváš 85 XP za přežití prvního sestupu do krypta.',
};

const BELL_WARDEN_LEVEL_BLOCK =
  /^(.+) is beyond your current experience \(you are level (\d+); reach at least level (\d+) by winning fights and exploring before you attack\)\.?$/i;

const MECHANIC_PATTERNS_CS: Array<[RegExp, string | ((...args: string[]) => string)]> = [
  [
    BELL_WARDEN_LEVEL_BLOCK,
    (_name, current, needed) =>
      `${displayCreature('Bell Warden', 'cs')} je na tvoji současnou zkušenost příliš nebezpečný (jsi úroveň ${current}; dosáhni alespoň úrovně ${needed} vítěznými souboji a průzkumem, než zaútočíš).`,
  ],
  [
    /^The Bell Warden waits in the Bell Warden's Pit\. Travel to the pit before you challenge it\.$/,
    () =>
      `${displayCreature('Bell Warden', 'cs')} čeká v Jámě strážce zvonu. Nejdřív tam dojdi přes mapu, až ho budeš chtít vyzvat.`,
  ],
  [
    /^The Bell Warden's Pit is sealed until you unlock the Vault route with Caldus\.$/,
    () => 'Jáma strážce zvonu je zamčená, dokud u Calduse neodemkneš cestu do Komnaty ozvěn.',
  ],
  [
    /^That route is not open\. Nearby destinations:\s*(.+)\.?$/i,
    (destinations) => `Tahle cesta není otevřená. Blízké cíle: ${destinations}.`,
  ],
  [
    /^No one here answers to that\. Name an NPC \(Caldus, Nib\) or use a suggested conversation chip\.?$/i,
    'Nikdo tady na to neodpoví. Pojmenuj NPC (Caldus, Nib) nebo použij nabízený čip rozhovoru.',
  ],
  [
    /^That quest step cannot be resolved here\.?$/i,
    'Tento krok úkolu tady nejde vyřešit.',
  ],
  [
    /^That action cannot be resolved here\. Try a clearer command or a UI chip\.?$/i,
    'Tuhle akci tady nejde provést. Zkus jasnější příkaz nebo čip v UI.',
  ],
  [
    /^No enemy is in front of you\. Explore the area or wait for a threat to appear\.?$/i,
    'Před tebou není nepřítel. Prozkoumej okolí, nebo počkej, až se objeví hrozba.',
  ],
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
  [
    /^You explore the area but find no immediate threat\.?$/i,
    'Prohledáváš okolí, ale nezahlédneš bezprostřední hrozbu.',
  ],
  [/^You find nothing new here\.?$/i, 'Nenacházíš nic nového.'],
  [
    /^You already logged these tracks here; nothing new stands out\.?$/i,
    'Tyto stopy už znáš — nic nového tě neupoutá.',
  ],
  [
    /^You already logged these clue here; nothing new stands out\.?$/i,
    'Tuto stopu už máš zapsanou — nic nového tě neupoutá.',
  ],
  [
    /^You already logged these clues here; nothing new stands out\.?$/i,
    'Tyto stopy už znáš — nic nového tě neupoutá.',
  ],
  [
    /^You find (\d+) gold pieces tucked beneath loose stones \(a one-time find here\)\.?$/i,
    'Najdeš $1 zlatých pod volnými kameny (v této lokaci jen jednou).',
  ],
  [
    /^You pick over stones and debris, but this area has no loose coin left to find\.?$/i,
    'Prohledáváš kamení a sutiny, ale v této oblasti už nenajdeš volné mince.',
  ],
  [
    /^You take a moment to catch your breath\. No new threat appears\.?$/i,
    'Na chvíli zastavíš a oddychneš. Žádná nová hrozba se neobjeví.',
  ],
  [
    /^(.+) hits you for (\d+)\. Your HP: (\d+)\/(\d+)\.?$/i,
    (name, dmg, hp, max) => `${displayCreature(name, 'cs')} tě zasáhne za ${dmg}. Tvoje HP: ${hp}/${max}.`,
  ],
  [
    /^You take a long rest and recover (\d+) HP\.?$/i,
    'Dopřeješ si dlouhý odpočinek a obnovíš $1 HP.',
  ],
  [
    /^The creature has not attacked yet\. Choose your next action\.?$/i,
    'Tvor zatím neútočil. Zvol další akci.',
  ],
  [
    /^You cannot take a short rest while a fight is raging\.?$/i,
    'Během boje nelze krátký odpočinek.',
  ],
  [
    /^You already caught your breath recently\. Take a long rest in a safe camp to recover fully\.?$/i,
    'Nedávno jsi už oddychoval. Pro plné obnovení si dopřej dlouhý odpočinek v bezpečném táboře.',
  ],
  [
    /^You are already at full health — a short rest changes nothing\.?$/i,
    'Máš plné zdraví — krátký odpočinek nic nezmění.',
  ],
  [
    /^You take a short rest and recover (\d+) HP\. Your HP: (\d+)\/(\d+)\.?$/i,
    'Krátký odpočinek: obnovíš $1 životů. Životy: $2/$3.',
  ],
  [
    /^You cannot rest while a fight is still raging\.?$/i,
    'Dokud zuří boj, nemůžeš odpočívat.',
  ],
  [
    /^You cannot take a long rest here — the ruins are too exposed\. Retreat to the Whispering Cellar, the shrine, or Nib's market\.?$/i,
    'Tady nelze dlouhý odpočinek — ruiny jsou příliš vystavené. Vrať se do Šeptajícího sklepa, ke svatyni nebo na Gobliní trh.',
  ],
  [
    /^You are already at full health and all spell slots are restored\.?$/i,
    'Máš plné zdraví a všechny kouzelné sloty jsou obnovené.',
  ],
  [
    /^You take a long rest and recover (\d+) HP; all spell slots are restored\.?$/i,
    'Dlouhý odpočinek: obnovíš $1 životů; všechny kouzelné sloty jsou doplněné.',
  ],
  [
    /^You take a long rest and recover (\d+) HP\.?$/i,
    'Dlouhý odpočinek: obnovíš $1 životů.',
  ],
  [/Intelligence check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test inteligence: $1 proti ST $2 — $3.'],
  [/Wisdom check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test moudrosti: $1 proti ST $2 — $3.'],
  [/Charisma check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test charismy: $1 proti ST $2 — $3.'],
  [/Strength check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test síly: $1 proti ST $2 — $3.'],
  [/Dexterity check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test obratnosti: $1 proti ST $2 — $3.'],
  [/Constitution check: (\d+) vs DC (\d+) [-—] (success|failure)\.?/i, 'Test výdrže: $1 proti ST $2 — $3.'],
  [/Saving throw — (\w+)\. DC (\d+)/i, 'Záchranný hod — $1. ST $2.'],
  [/(.+) saving throw — (\w+)\. DC (\d+)/i, '$1 — záchranný hod na $2. ST $3.'],
  [/Roll (\d+) \+ (-?\d+) save = (\d+) — (success|failure)/i, 'Hod $1 + $2 = $3 — $4.'],
  [/You are paralyzed \(incapacitated\)\./i, 'Jsi paralyzovaný (neschopný jednat).'],
  [/The target loses focus — disadvantage on its next attack roll\./i,
    'Cíl ztrácí soustředění — nevýhoda na příští útok.'],
  [/Roll (\d+) \+ (-?\d+) ability(?: \+(\d+) proficiency)? = (\d+) — (success|failure)/i,
    'Hod $1 + $2 síla$3 = $4 — $5.'],
  [/Attack roll: (.*)/i, 'Útočný hod: $1'],
  [/^Damage (\d+)(.*)$/i, 'Poškození: $1$2'],
  [/^(.+) takes (\d+) damage\.?$/i, '$1 utrpí $2 poškození.'],
  [/^An enemy appears: (.+?)\.?$/i, 'Objevuje se nepřítel: $1.'],
  [/^Initiative: (.*)$/i, 'Iniciativa: $1'],
];

function localizeDiscoveryLine(line: string): string {
  const trimmed = line.trim();
  const match = /^New discovery:\s*(.+)$/i.exec(trimmed);
  if (!match) return trimmed;
  const body = match[1].trim();
  const cs = DISCOVERY_BODY_CS[body] ?? body;
  return `Nový nález: ${cs}`;
}

/**
 * Localize a single engine event line for journal/combat UI (facts unchanged in DB).
 */
export function presentEngineEventLine(line: string, locale: Locale): string {
  if (locale !== 'cs' || !line.trim()) return line;
  if (/^New discovery:/i.test(line.trim())) return localizeDiscoveryLine(line);
  return localizeMechanicsLine(line, locale);
}

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
